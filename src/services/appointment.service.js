const ocrService = require('./ocr.service');
const llmService = require('./llm.service');
const normalizationService = require('./normalization.service');
const guardrailService = require('./guardrail.service');
const logger = require('../utils/logger');
const config = require('../config/env');

class AppointmentService {
  /**
   * Orchestrates the complete end-to-end appointment parsing pipeline.
   *
   * Flow:
   * 1. Ingestion: Typed text or Image OCR
   * 2. Semantic Extraction: LLM entity extraction
   * 3. Schema Validation: Strict Zod validation
   * 4. Normalization: Deterministic date, time, and department resolvers
   * 5. Guardrails: Ambiguity detection & confidence checks
   * 6. Final JSON Assembly: Synthesis of normalized appointment contract
   *
   * @param {Object} input
   * @param {string} [input.text] - Typed natural language appointment string
   * @param {Buffer} [input.imageBuffer] - Uploaded image buffer
   * @param {Date} [input.referenceDate] - Optional reference date for testing
   * @returns {Promise<{ isClarification: boolean, data: Object }>}
   */
  async processAppointment({ text, imageBuffer, referenceDate }) {
    const startTime = Date.now();
    let rawText = '';
    let ocrConfidence = 1.0;
    const inputType = imageBuffer ? 'image' : 'text';

    logger.info({ inputType }, 'Starting appointment parsing pipeline');

    // Extract text directly or run OCR on the uploaded image
    if (imageBuffer) {
      const ocrResult = await ocrService.extractTextFromImage(imageBuffer);
      rawText = ocrResult.raw_text;
      ocrConfidence = ocrResult.confidence;
    } else {
      rawText = text.trim();
      ocrConfidence = 1.0;
    }

    logger.info({ rawText, ocrConfidence }, 'Raw text obtained from input');

    // Extract entities via LLM (validated against Zod extraction schema)
    const extractionResult = await llmService.extractEntities(rawText);
    const { date_phrase, time_phrase, department, confidence } = extractionResult;

    // Normalization: resolve canonical department and local date/time
    const normalizedDept = normalizationService.normalizeDepartment(department);
    const normalizedDate = normalizationService.normalizeDate(date_phrase, referenceDate);
    const normalizedTime = normalizationService.normalizeTime(time_phrase);

    logger.info(
      {
        entities: { date_phrase, time_phrase, department },
        normalized: { normalizedDept, normalizedDate, normalizedTime }
      },
      'Deterministic normalization completed'
    );

    // Evaluate guardrails for missing fields or low confidence
    const guardrailEvaluation = guardrailService.evaluate({
      normalizedDepartment: normalizedDept,
      normalizedDate: normalizedDate,
      normalizedTime: normalizedTime,
      rawDepartment: department,
      rawDatePhrase: date_phrase,
      rawTimePhrase: time_phrase,
      extractionConfidence: confidence
    });

    const durationMs = Date.now() - startTime;

    if (!guardrailEvaluation.passed) {
      logger.info(
        {
          durationMs,
          clarificationMessage: guardrailEvaluation.clarificationMessage
        },
        'Pipeline terminated with clarification requirement'
      );

      return {
        isClarification: true,
        data: {
          status: 'needs_clarification',
          message: guardrailEvaluation.clarificationMessage
        }
      };
    }

    // Assemble final response payload
    const finalResponse = {
      appointment: {
        department: normalizedDept,
        date: normalizedDate,
        time: normalizedTime,
        tz: config.TIMEZONE
      },
      status: 'ok'
    };

    logger.info({ durationMs, finalResponse }, 'Appointment successfully scheduled');

    return {
      isClarification: false,
      data: finalResponse
    };
  }
}

module.exports = new AppointmentService();
