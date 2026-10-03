const chrono = require('chrono-node');
const { startOfDay, isBefore } = require('date-fns');
const { toZonedTime, format: formatInTz } = require('date-fns-tz');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Canonical Department Mapping Catalog.
 * Maps common colloquial terms and medical disciplines to standard department names.
 */
const DEPARTMENT_CATALOG = {
  Dentistry: [
    'dentist',
    'dentistry',
    'dental',
    'teeth',
    'tooth',
    'orthodontist',
    'dental surgeon'
  ],
  Cardiology: [
    'cardiologist',
    'cardiology',
    'heart doctor',
    'heart specialist',
    'cardio'
  ],
  Dermatology: [
    'dermatologist',
    'dermatology',
    'skin doctor',
    'skin specialist',
    'skin',
    'derma'
  ],
  Ophthalmology: [
    'ophthalmologist',
    'ophthalmology',
    'eye doctor',
    'eye specialist',
    'optometrist',
    'eye'
  ],
  Pediatrics: [
    'pediatrician',
    'pediatrics',
    'pediatric',
    'child doctor',
    'child specialist'
  ],
  Orthopedics: [
    'orthopedist',
    'orthopedics',
    'orthopedic',
    'bone doctor',
    'bone'
  ],
  ENT: [
    'ent',
    'ent specialist',
    'ear nose throat',
    'ear doctor'
  ],
  'General Medicine': [
    'doctor',
    'general doctor',
    'general physician',
    'physician',
    'gp',
    'general practitioner',
    'general medicine',
    'consultation'
  ]
};

const VAGUE_TIME_WORDS = new Set([
  'morning',
  'afternoon',
  'evening',
  'night',
  'sometime',
  'anytime',
  'later',
  'soon',
  'lunchtime'
]);

const AMBIGUOUS_DATE_TERMS = [
  'sometime',
  'anytime',
  'later',
  'soon',
  'upcoming',
  'in a few days'
];

const WEEKDAY_NAMES = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun'
];

class NormalizationService {
  constructor() {
    this.timeZone = config.TIMEZONE || 'Asia/Kolkata';
  }

  /**
   * Deterministically maps a raw department string to a canonical specialty.
   * Returns null if unmapped or ambiguous.
   *
   * @param {string|null} rawDepartment
   * @returns {string|null} Canonical department name or null.
   */
  normalizeDepartment(rawDepartment) {
    if (!rawDepartment || typeof rawDepartment !== 'string') return null;

    const cleaned = rawDepartment.toLowerCase().trim();
    if (!cleaned) return null;

    for (const [canonical, aliases] of Object.entries(DEPARTMENT_CATALOG)) {
      if (canonical.toLowerCase() === cleaned) return canonical;

      for (const alias of aliases) {
        // Direct match or word boundary match
        const regex = new RegExp(`(^|\\b)${alias}(\\b|$)`, 'i');
        if (regex.test(cleaned)) {
          return canonical;
        }
      }
    }

    return null;
  }

  /**
   * Deterministically normalizes natural-language date phrases into YYYY-MM-DD.
   * Anchored to reference date in target timezone (Asia/Kolkata).
   *
   * @param {string|null} datePhrase
   * @param {Date} [referenceDate] - Optional reference date for deterministic testing.
   * @returns {string|null} ISO date string (YYYY-MM-DD) or null if invalid/ambiguous.
   */
  normalizeDate(datePhrase, referenceDate) {
    if (!datePhrase || typeof datePhrase !== 'string') return null;

    const lower = datePhrase.toLowerCase().trim();
    if (!lower) return null;

    // Reject explicitly vague date terms
    if (AMBIGUOUS_DATE_TERMS.some((term) => lower.includes(term))) {
      return null;
    }

    // Reject "next week" / "this week" without specific day of week
    const mentionsWeek = lower.includes('next week') || lower.includes('this week') || lower.includes('next month');
    const hasSpecificDay = WEEKDAY_NAMES.some((day) => lower.includes(day));
    if (mentionsWeek && !hasSpecificDay) {
      return null;
    }

    // Determine reference anchor in target timezone
    const now = referenceDate || new Date();
    const refZoned = toZonedTime(now, this.timeZone);

    try {
      const parsed = chrono.parse(lower, refZoned, { forwardDate: true });
      if (!parsed || parsed.length === 0) return null;

      const matchedDate = parsed[0].start.date();
      const isoDateString = formatInTz(matchedDate, 'yyyy-MM-dd', { timeZone: this.timeZone });

      // Guard against past dates: appointments must be on or after today in the target timezone
      const todayStart = startOfDay(refZoned);
      const parsedStart = startOfDay(toZonedTime(new Date(`${isoDateString}T00:00:00`), this.timeZone));

      if (isBefore(parsedStart, todayStart)) {
        logger.warn({ isoDateString, datePhrase }, 'Parsed appointment date is in the past');
        return null;
      }

      return isoDateString;
    } catch (err) {
      logger.warn({ err: err.message, datePhrase }, 'Date normalization failed');
      return null;
    }
  }

  /**
   * Deterministically normalizes natural language time phrases to 24-hour HH:mm.
   * Rejects vague phrases like "morning", "afternoon", or bare ambiguous digits like "3".
   *
   * @param {string|null} timePhrase
   * @returns {string|null} 24-hour time HH:mm or null.
   */
  normalizeTime(timePhrase) {
    if (!timePhrase || typeof timePhrase !== 'string') return null;

    const lower = timePhrase.toLowerCase().trim();
    if (!lower) return null;

    // Check for vague time words without numeric time
    if (VAGUE_TIME_WORDS.has(lower) || (Array.from(VAGUE_TIME_WORDS).some((w) => lower.includes(w)) && !/\d/.test(lower))) {
      return null;
    }

    // Pattern 1: Standard 12-hour or 24-hour format
    // Examples: "3pm", "3:30 pm", "15:00", "09:00", "9 am", "11:45 PM"
    const standardMatch = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (standardMatch) {
      let hours = parseInt(standardMatch[1], 10);
      const minutes = standardMatch[2] ? parseInt(standardMatch[2], 10) : 0;
      const meridiem = standardMatch[3] ? standardMatch[3].toLowerCase() : null;

      if (minutes < 0 || minutes > 59) return null;

      if (meridiem) {
        if (hours < 1 || hours > 12) return null;
        if (meridiem === 'pm' && hours !== 12) hours += 12;
        if (meridiem === 'am' && hours === 12) hours = 0;
      } else {
        // Without am/pm, must be explicit 24h format (e.g. "09:00", "15:00")
        // Single digit or double digit without minutes and without am/pm is ambiguous
        if (!standardMatch[2]) return null;
        if (hours < 0 || hours > 23) return null;
      }

      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      return `${hh}:${mm}`;
    }

    // Fallback: Chrono time parser
    try {
      const parsed = chrono.parse(`at ${lower}`);
      if (parsed.length > 0 && parsed[0].start.isCertain('hour')) {
        const hours = parsed[0].start.get('hour');
        const minutes = parsed[0].start.get('minute') || 0;
        const hh = String(hours).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        return `${hh}:${mm}`;
      }
    } catch {
      // Fall through to null
    }

    return null;
  }
}

module.exports = new NormalizationService();
