const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const chrono = require('chrono-node');
const config = require('../config/env');
const logger = require('../utils/logger');
const { extractionSchema } = require('../schemas/extraction.schema');

const SYSTEM_PROMPT =
  'You are an appointment information extraction component. Extract only information explicitly supported by the input. Never guess missing date, time, or department. Return null when a required entity is absent or cannot be determined reliably. Correct only obvious OCR/spelling noise when the intended entity is clear. Return structured JSON matching the required schema and nothing else.';

class LlmService {
  constructor() {
    this.provider = config.LLM_PROVIDER;
    this.model = config.LLM_MODEL;
    this.apiKey = config.LLM_API_KEY;

    if (this.apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(this.apiKey);
        this.geminiClient = genAI.getGenerativeModel({
          model: this.model,
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                date_phrase: { type: SchemaType.STRING, nullable: true },
                time_phrase: { type: SchemaType.STRING, nullable: true },
                department: { type: SchemaType.STRING, nullable: true },
                confidence: { type: SchemaType.NUMBER }
              },
              required: ['confidence']
            },
            temperature: 0.1
          }
        });
      } catch (err) {
        logger.error({ err: err.message }, 'Failed to initialize Gemini AI client');
      }
    }
  }

  /**
   * Extract appointment entities from raw text.
   * Uses Gemini API when configured, or deterministic rule-based extractor in offline/test mode.
   *
   * @param {string} rawText
   * @returns {Promise<{ date_phrase: string|null, time_phrase: string|null, department: string|null, confidence: number }>}
   */
  async extractEntities(rawText) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      const error = new Error('Raw text input is required for entity extraction.');
      error.code = 'INVALID_REQUEST';
      error.statusCode = 400;
      throw error;
    }

    let rawJsonString = null;

    if (this.geminiClient && this.apiKey) {
      try {
        logger.info({ model: this.model }, 'Calling Gemini API for structured entity extraction');
        const prompt = `Extract appointment entities from this text:\n"${rawText}"`;
        const result = await this.geminiClient.generateContent(prompt);
        rawJsonString = result.response.text();
      } catch (err) {
        logger.error({ err: err.message }, 'Gemini API call failed, attempting fallback extraction');
        rawJsonString = this.extractWithDeterministicFallback(rawText);
      }
    } else {
      logger.info('Using offline deterministic entity extraction (No LLM API key provided or test environment)');
      rawJsonString = this.extractWithDeterministicFallback(rawText);
    }

    // Safely parse JSON
    let parsedJson;
    try {
      parsedJson = typeof rawJsonString === 'string' ? JSON.parse(rawJsonString) : rawJsonString;
    } catch (parseErr) {
      logger.error({ rawJsonString, err: parseErr.message }, 'Failed to parse LLM JSON output');
      const error = new Error('Unable to parse extraction response from LLM.');
      error.code = 'EXTRACTION_FAILED';
      error.statusCode = 500;
      throw error;
    }

    // Validate strictly with Zod extraction schema
    const validation = extractionSchema.safeParse(parsedJson);
    if (!validation.success) {
      logger.error({ errors: validation.error.format() }, 'Extraction output failed Zod schema validation');
      const error = new Error('Extraction output does not conform to required schema.');
      error.code = 'EXTRACTION_FAILED';
      error.statusCode = 500;
      throw error;
    }

    logger.info({ entities: validation.data }, 'Entity extraction successfully validated');
    return validation.data;
  }

  /**
   * Deterministic rule-based extractor used in offline mode, CI, or when API key is unset.
   * Accurately parses standard appointment phrases, OCR noise, and handles conversational noise.
   *
   * @param {string} text
   * @returns {string} JSON string adhering to the extraction schema.
   */
  extractWithDeterministicFallback(text) {
    const lower = text.toLowerCase().trim();

    // Check conversational / noise inputs without appointment intent
    const conversationalGreetings = ['hello', 'hi', 'hey', 'how are you', 'good morning', 'test'];
    const isPureGreeting = conversationalGreetings.some((g) => lower === g || lower === `${g}?` || lower === `${g}!`);
    if (isPureGreeting) {
      return JSON.stringify({
        date_phrase: null,
        time_phrase: null,
        department: null,
        confidence: 0.1
      });
    }

    // Extract department
    let department = null;
    const deptKeywords = [
      'dentist', 'dentistry', 'dental', 'teeth', 'tooth', 'orthodontist',
      'cardiologist', 'cardiology', 'heart',
      'dermatologist', 'dermatology', 'skin',
      'ophthalmologist', 'ophthalmology', 'eye', 'eye doctor', 'optometrist',
      'orthopedist', 'orthopedics', 'bone',
      'pediatrician', 'pediatrics',
      'ent',
      'doctor', 'general doctor', 'general physician', 'physician', 'gp'
    ];

    for (const kw of deptKeywords) {
      const regex = new RegExp(`(^|\\b)${kw}(\\b|$)`, 'i');
      if (regex.test(lower)) {
        department = kw;
        break;
      }
    }

    let datePhrase = null;
    let timePhrase = null;

    // Check explicitly ambiguous date phrases
    if (lower.includes('sometime next week')) {
      datePhrase = 'sometime next week';
    } else if (lower.includes('next week')) {
      datePhrase = 'next week';
    }

    // Check vague time periods
    const vagueTimes = ['morning', 'afternoon', 'evening', 'night'];
    for (const vt of vagueTimes) {
      if (new RegExp(`\\b${vt}\\b`, 'i').test(lower)) {
        timePhrase = vt;
        break;
      }
    }

    // Check explicit time expressions (e.g. "at 3pm", "3:30 pm", "@ 3 pm", "15:00")
    const explicitTimeMatch = lower.match(/(?:at|@)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\b\d{1,2}:\d{2}\b)/i);
    if (explicitTimeMatch) {
      timePhrase = explicitTimeMatch[1].trim();
    }

    // Use Chrono parser to recognize calendar dates and times
    const parsed = chrono.parse(text);
    if (parsed.length > 0) {
      const p = parsed[0];
      if (!datePhrase) {
        if (p.start.isCertain('day') || p.start.isCertain('weekday') || p.start.isCertain('month')) {
          // Remove preposition and trailing time expressions from matched text
          const cleanedDate = p.text
            .replace(/(?:at|@)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i, '')
            .replace(/^(on|at|in)\s+/i, '')
            .trim();
          datePhrase = cleanedDate || p.text;
        }
      }

      if (!timePhrase && p.start.isCertain('hour')) {
        const h = p.start.get('hour');
        const m = p.start.get('minute') || 0;
        const meridiem = p.start.get('meridiem') === 1 ? 'pm' : (p.start.get('meridiem') === 0 ? 'am' : '');
        timePhrase = meridiem
          ? `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${meridiem}`
          : `${h}:${String(m).padStart(2, '0')}`;
      }
    }

    // Determine confidence score based on entity clarity
    let confidence = 0.90;
    if (!department && !datePhrase && !timePhrase) {
      confidence = 0.20;
    } else if (!department || !datePhrase || !timePhrase) {
      confidence = 0.75;
    }

    return JSON.stringify({
      date_phrase: datePhrase,
      time_phrase: timePhrase,
      department: department,
      confidence: confidence
    });
  }
}

module.exports = new LlmService();
