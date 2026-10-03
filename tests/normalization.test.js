const normalizationService = require('../src/services/normalization.service');
const { addDays } = require('date-fns');
const { formatDateToISO } = require('../src/utils/date.utils');

describe('NormalizationService Unit Tests', () => {
  const timeZone = 'Asia/Kolkata';

  describe('Department Normalization', () => {
    test('maps "dentist", "dentistry", "dental" to "Dentistry"', () => {
      expect(normalizationService.normalizeDepartment('dentist')).toBe('Dentistry');
      expect(normalizationService.normalizeDepartment('DENTISTRY')).toBe('Dentistry');
      expect(normalizationService.normalizeDepartment('dental clinic')).toBe('Dentistry');
      expect(normalizationService.normalizeDepartment('orthodontist')).toBe('Dentistry');
    });

    test('maps "doctor", "general physician", "gp" to "General Medicine"', () => {
      expect(normalizationService.normalizeDepartment('doctor')).toBe('General Medicine');
      expect(normalizationService.normalizeDepartment('general physician')).toBe('General Medicine');
      expect(normalizationService.normalizeDepartment('general practitioner')).toBe('General Medicine');
      expect(normalizationService.normalizeDepartment('physician')).toBe('General Medicine');
    });

    test('maps specialties correctly', () => {
      expect(normalizationService.normalizeDepartment('cardiologist')).toBe('Cardiology');
      expect(normalizationService.normalizeDepartment('dermatology')).toBe('Dermatology');
      expect(normalizationService.normalizeDepartment('eye doctor')).toBe('Ophthalmology');
      expect(normalizationService.normalizeDepartment('pediatrician')).toBe('Pediatrics');
      expect(normalizationService.normalizeDepartment('orthopedic')).toBe('Orthopedics');
      expect(normalizationService.normalizeDepartment('ent specialist')).toBe('ENT');
    });

    test('returns null for unknown, empty, or invalid department', () => {
      expect(normalizationService.normalizeDepartment('astronaut')).toBeNull();
      expect(normalizationService.normalizeDepartment('')).toBeNull();
      expect(normalizationService.normalizeDepartment(null)).toBeNull();
      expect(normalizationService.normalizeDepartment(undefined)).toBeNull();
    });
  });

  describe('Date Normalization', () => {
    test('normalizes "today" and "tomorrow" based on runtime date', () => {
      const now = new Date();
      const todayExpected = formatDateToISO(now, timeZone);
      const tomorrowExpected = formatDateToISO(addDays(now, 1), timeZone);

      expect(normalizationService.normalizeDate('today')).toBe(todayExpected);
      expect(normalizationService.normalizeDate('tomorrow')).toBe(tomorrowExpected);
    });

    test('normalizes relative weekdays (e.g. "next Friday")', () => {
      const result = normalizationService.normalizeDate('next Friday');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('rejects explicitly ambiguous date phrases', () => {
      expect(normalizationService.normalizeDate('sometime next week')).toBeNull();
      expect(normalizationService.normalizeDate('next week')).toBeNull();
      expect(normalizationService.normalizeDate('this week')).toBeNull();
      expect(normalizationService.normalizeDate('in a few days')).toBeNull();
      expect(normalizationService.normalizeDate('sometime')).toBeNull();
    });

    test('rejects past dates', () => {
      expect(normalizationService.normalizeDate('2020-01-01')).toBeNull();
      expect(normalizationService.normalizeDate('yesterday')).toBeNull();
    });

    test('returns null for empty or invalid input', () => {
      expect(normalizationService.normalizeDate('')).toBeNull();
      expect(normalizationService.normalizeDate(null)).toBeNull();
      expect(normalizationService.normalizeDate('gibberish text')).toBeNull();
    });
  });

  describe('Time Normalization', () => {
    test('normalizes 12-hour times with am/pm', () => {
      expect(normalizationService.normalizeTime('3pm')).toBe('15:00');
      expect(normalizationService.normalizeTime('3:30 pm')).toBe('15:30');
      expect(normalizationService.normalizeTime('3:30pm')).toBe('15:30');
      expect(normalizationService.normalizeTime('9 am')).toBe('09:00');
      expect(normalizationService.normalizeTime('11:45 AM')).toBe('11:45');
      expect(normalizationService.normalizeTime('12:00 pm')).toBe('12:00');
      expect(normalizationService.normalizeTime('12:00 am')).toBe('00:00');
    });

    test('normalizes 24-hour military times', () => {
      expect(normalizationService.normalizeTime('15:00')).toBe('15:00');
      expect(normalizationService.normalizeTime('09:00')).toBe('09:00');
      expect(normalizationService.normalizeTime('18:45')).toBe('18:45');
    });

    test('rejects vague time periods', () => {
      expect(normalizationService.normalizeTime('morning')).toBeNull();
      expect(normalizationService.normalizeTime('afternoon')).toBeNull();
      expect(normalizationService.normalizeTime('evening')).toBeNull();
      expect(normalizationService.normalizeTime('night')).toBeNull();
      expect(normalizationService.normalizeTime('sometime')).toBeNull();
      expect(normalizationService.normalizeTime('anytime')).toBeNull();
    });

    test('rejects ambiguous raw numbers without meridiem or minutes', () => {
      expect(normalizationService.normalizeTime('3')).toBeNull();
      expect(normalizationService.normalizeTime('11')).toBeNull();
    });

    test('returns null for empty or invalid input', () => {
      expect(normalizationService.normalizeTime('')).toBeNull();
      expect(normalizationService.normalizeTime(null)).toBeNull();
      expect(normalizationService.normalizeTime('invalid')).toBeNull();
    });
  });
});
