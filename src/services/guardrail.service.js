const logger = require('../utils/logger');

/**
 * Guardrail Service.
 * Implements deterministic business rules and ambiguity detection in application code.
 * Ensures the system never guesses or hallucinates missing critical appointment entities.
 */
class GuardrailService {
  /**
   * Evaluates extracted and normalized components against guardrail policies.
   *
   * @param {Object} params
   * @param {string|null} params.normalizedDepartment
   * @param {string|null} params.normalizedDate
   * @param {string|null} params.normalizedTime
   * @param {string|null} params.rawDepartment
   * @param {string|null} params.rawDatePhrase
   * @param {string|null} params.rawTimePhrase
   * @param {number} [params.extractionConfidence=1.0]
   * @returns {{ passed: boolean, clarificationMessage?: string }}
   */
  evaluate({
    normalizedDepartment,
    normalizedDate,
    normalizedTime,
    rawDepartment,
    rawDatePhrase,
    rawTimePhrase,
    extractionConfidence = 1.0
  }) {
    // Catch generic conversational inputs with no appointment intent (e.g. "hello how are you")
    const hasAnyEntity = Boolean(rawDepartment || rawDatePhrase || rawTimePhrase);
    if (!hasAnyEntity) {
      logger.info('Guardrail triggered: No appointment entities detected in input');
      return {
        passed: false,
        clarificationMessage: 'No appointment request detected. Please specify department, date, and time.'
      };
    }

    // Require high-confidence entity extraction
    if (typeof extractionConfidence === 'number' && extractionConfidence < 0.60) {
      logger.info({ extractionConfidence }, 'Guardrail triggered: Extraction confidence below threshold');
      return {
        passed: false,
        clarificationMessage: 'Ambiguous appointment request. Please clarify the department, date, and time.'
      };
    }

    const missingDepartment = !normalizedDepartment;
    const missingDate = !normalizedDate;
    const missingTime = !normalizedTime;

    // If 2 or more details are missing, return consolidated ambiguity message
    const missingCount = (missingDepartment ? 1 : 0) + (missingDate ? 1 : 0) + (missingTime ? 1 : 0);
    if (missingCount >= 2) {
      logger.info({ missingDepartment, missingDate, missingTime }, 'Guardrail triggered: Multiple entities missing');
      return {
        passed: false,
        clarificationMessage: 'Ambiguous date/time or department.'
      };
    }

    if (missingDepartment) {
      logger.info({ rawDepartment }, 'Guardrail triggered: Department missing or unrecognized');
      return {
        passed: false,
        clarificationMessage: 'Please specify the medical department or doctor type.'
      };
    }

    if (missingDate) {
      logger.info({ rawDatePhrase }, 'Guardrail triggered: Date missing or ambiguous');
      return {
        passed: false,
        clarificationMessage: 'Please provide a specific appointment date.'
      };
    }

    if (missingTime) {
      logger.info({ rawTimePhrase }, 'Guardrail triggered: Time missing or ambiguous');
      return {
        passed: false,
        clarificationMessage: 'Please provide a specific appointment time.'
      };
    }

    return { passed: true };
  }
}

module.exports = new GuardrailService();
