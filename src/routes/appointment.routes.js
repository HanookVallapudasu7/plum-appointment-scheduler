const express = require('express');
const appointmentController = require('../controllers/appointment.controller');
const { uploadImageMiddleware } = require('../middleware/upload.middleware');

const router = express.Router();

/**
 * @route POST /api/v1/appointments/parse
 * @desc Parses appointment request from natural language text or image
 * @access Public
 */
router.post(
  '/appointments/parse',
  uploadImageMiddleware,
  appointmentController.parseAppointment
);

module.exports = router;
