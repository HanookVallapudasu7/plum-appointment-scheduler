const { z } = require('zod');

/**
 * Text appointment request validation.
 */
const textRequestSchema = z.object({
  text: z
    .string({
      required_error: 'The "text" field is required when sending a JSON payload.',
      invalid_type_error: 'The "text" field must be a string.'
    })
    .trim()
    .min(1, 'Text input cannot be empty or whitespace only.')
});

/**
 * Normalized Appointment entity schema.
 */
const appointmentDetailsSchema = z.object({
  department: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in 24-hour HH:mm format'),
  tz: z.string().default('Asia/Kolkata')
});

/**
 * Final Successful Appointment response contract.
 */
const appointmentResponseSchema = z.object({
  appointment: appointmentDetailsSchema,
  status: z.literal('ok')
});

/**
 * Needs Clarification response contract.
 */
const clarificationResponseSchema = z.object({
  status: z.literal('needs_clarification'),
  message: z.string().min(1)
});

/**
 * Standard Error response contract.
 */
const errorResponseSchema = z.object({
  status: z.literal('error'),
  code: z.string().min(1),
  message: z.string().min(1)
});

module.exports = {
  textRequestSchema,
  appointmentDetailsSchema,
  appointmentResponseSchema,
  clarificationResponseSchema,
  errorResponseSchema
};
