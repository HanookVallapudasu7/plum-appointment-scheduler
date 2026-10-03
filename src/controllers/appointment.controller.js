const appointmentService = require('../services/appointment.service');
const { textRequestSchema } = require('../schemas/appointment.schema');
const logger = require('../utils/logger');

class AppointmentController {
  /**
   * Parse appointment request from JSON text or multipart image upload.
   * Route: POST /api/v1/appointments/parse
   */
  async parseAppointment(req, res, next) {
    try {
      const hasImage = Boolean(req.file);
      const rawText = req.body && typeof req.body.text === 'string' ? req.body.text : undefined;
      const hasText = Boolean(rawText !== undefined);

      // Rule: Mutually exclusive inputs
      if (hasText && hasImage) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_REQUEST',
          message: 'Provide either text or an image, not both.'
        });
      }

      // Rule: At least one input required
      if (!hasText && !hasImage) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_REQUEST',
          message: 'Provide either text or an image.'
        });
      }

      // Validate JSON text payload
      if (hasText) {
        const validation = textRequestSchema.safeParse(req.body);
        if (!validation.success) {
          const firstIssue = validation.error.issues[0];
          return res.status(400).json({
            status: 'error',
            code: 'INVALID_REQUEST',
            message: firstIssue ? firstIssue.message : 'Invalid text request payload.'
          });
        }
      }

      // Execute parsing pipeline
      const isDebug = req.query.debug === 'true' || req.query.detailed === 'true';
      const result = await appointmentService.processAppointment({
        text: hasText ? req.body.text : undefined,
        imageBuffer: hasImage ? req.file.buffer : undefined,
        includeDebug: isDebug
      });

      if (result.isClarification) {
        return res.status(422).json(result.data);
      }

      return res.status(200).json(result.data);
    } catch (err) {
      logger.error({ err: err.message, stack: err.stack }, 'Appointment controller failed');
      next(err);
    }
  }

  /**
   * Health check endpoint.
   * Route: GET /health
   */
  getHealth(req, res) {
    return res.status(200).json({ status: 'ok' });
  }
}

module.exports = new AppointmentController();
