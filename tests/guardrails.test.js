const guardrailService = require('../src/services/guardrail.service');

describe('GuardrailService Unit Tests', () => {
  test('passes when all entities are normalized and confident', () => {
    const evaluation = guardrailService.evaluate({
      normalizedDepartment: 'Dentistry',
      normalizedDate: '2026-10-09',
      normalizedTime: '15:00',
      rawDepartment: 'dentist',
      rawDatePhrase: 'next Friday',
      rawTimePhrase: '3pm',
      extractionConfidence: 0.95
    });

    expect(evaluation.passed).toBe(true);
    expect(evaluation.clarificationMessage).toBeUndefined();
  });

  test('triggers clarification when no entities exist (e.g. conversational input)', () => {
    const evaluation = guardrailService.evaluate({
      normalizedDepartment: null,
      normalizedDate: null,
      normalizedTime: null,
      rawDepartment: null,
      rawDatePhrase: null,
      rawTimePhrase: null,
      extractionConfidence: 0.1
    });

    expect(evaluation.passed).toBe(false);
    expect(evaluation.clarificationMessage).toBe('No appointment request detected. Please specify department, date, and time.');
  });

  test('triggers clarification when extraction confidence is below threshold (< 0.60)', () => {
    const evaluation = guardrailService.evaluate({
      normalizedDepartment: 'Dentistry',
      normalizedDate: '2026-10-09',
      normalizedTime: '15:00',
      rawDepartment: 'dentist',
      rawDatePhrase: 'next Friday',
      rawTimePhrase: '3pm',
      extractionConfidence: 0.45
    });

    expect(evaluation.passed).toBe(false);
    expect(evaluation.clarificationMessage).toBe('Ambiguous appointment request. Please clarify the department, date, and time.');
  });

  test('requests department when department is missing or unmapped', () => {
    const evaluation = guardrailService.evaluate({
      normalizedDepartment: null,
      normalizedDate: '2026-10-09',
      normalizedTime: '15:00',
      rawDepartment: null,
      rawDatePhrase: 'next Friday',
      rawTimePhrase: '3pm',
      extractionConfidence: 0.85
    });

    expect(evaluation.passed).toBe(false);
    expect(evaluation.clarificationMessage).toBe('Please specify the medical department or doctor type.');
  });

  test('requests date when date is missing or ambiguous', () => {
    const evaluation = guardrailService.evaluate({
      normalizedDepartment: 'Dentistry',
      normalizedDate: null,
      normalizedTime: '15:00',
      rawDepartment: 'dentist',
      rawDatePhrase: null,
      rawTimePhrase: '3pm',
      extractionConfidence: 0.85
    });

    expect(evaluation.passed).toBe(false);
    expect(evaluation.clarificationMessage).toBe('Please provide a specific appointment date.');
  });

  test('requests time when time is missing or vague', () => {
    const evaluation = guardrailService.evaluate({
      normalizedDepartment: 'Dentistry',
      normalizedDate: '2026-10-09',
      normalizedTime: null,
      rawDepartment: 'dentist',
      rawDatePhrase: 'next Friday',
      rawTimePhrase: null,
      extractionConfidence: 0.85
    });

    expect(evaluation.passed).toBe(false);
    expect(evaluation.clarificationMessage).toBe('Please provide a specific appointment time.');
  });

  test('requests complete details when multiple fields are missing', () => {
    const evaluation = guardrailService.evaluate({
      normalizedDepartment: 'Dentistry',
      normalizedDate: null,
      normalizedTime: null,
      rawDepartment: 'dentist',
      rawDatePhrase: 'sometime next week',
      rawTimePhrase: null,
      extractionConfidence: 0.85
    });

    expect(evaluation.passed).toBe(false);
    expect(evaluation.clarificationMessage).toBe('Ambiguous date/time or department.');
  });
});
