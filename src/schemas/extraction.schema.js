const { z } = require('zod');

/**
 * Zod schema for validating raw entity extraction produced by the LLM.
 * Strictly adheres to the required contract:
 * - date_phrase: string | null
 * - time_phrase: string | null
 * - department: string | null
 * - confidence: float in [0.0, 1.0]
 */
const extractionSchema = z.object({
  date_phrase: z.string().trim().min(1).nullable().catch(null),
  time_phrase: z.string().trim().min(1).nullable().catch(null),
  department: z.string().trim().min(1).nullable().catch(null),
  confidence: z
    .number()
    .min(0, 'Confidence must be at least 0.0')
    .max(1, 'Confidence cannot exceed 1.0')
    .default(0.85)
}).strip(); // Safely strip any extraneous fields returned by the model

module.exports = {
  extractionSchema
};
