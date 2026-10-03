const request = require('supertest');
const path = require('path');
const app = require('../src/app');

describe('Appointment Scheduler API Integration Tests', () => {
  describe('GET /health', () => {
    test('returns 200 OK with server status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /api/docs', () => {
    test('serves Swagger UI HTML documentation', async () => {
      const res = await request(app).get('/api/docs/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('swagger-ui');
    });
  });

  describe('POST /api/v1/appointments/parse - JSON Text Input', () => {
    test('successfully parses valid appointment text: "Book dentist next Friday at 3pm"', async () => {
      const res = await request(app)
        .post('/api/v1/appointments/parse')
        .send({ text: 'Book dentist next Friday at 3pm' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('appointment');
      expect(res.body.appointment).toEqual({
        department: 'Dentistry',
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        time: '15:00',
        tz: 'Asia/Kolkata'
      });
    });

    test('successfully parses relative appointment text: "Book dentist tomorrow at 4:30 PM"', async () => {
      const res = await request(app)
        .post('/api/v1/appointments/parse')
        .send({ text: 'Book dentist tomorrow at 4:30 PM' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.appointment.department).toBe('Dentistry');
      expect(res.body.appointment.time).toBe('16:30');
      expect(res.body.appointment.tz).toBe('Asia/Kolkata');
    });

    test('guardrail triggers clarification when time is missing: "Book dentist next Friday"', async () => {
      const res = await request(app)
        .post('/api/v1/appointments/parse')
        .send({ text: 'Book dentist next Friday' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        status: 'needs_clarification',
        message: 'Please provide a specific appointment time.'
      });
    });

    test('guardrail triggers clarification when department is missing: "Book an appointment next Friday at 3pm"', async () => {
      const res = await request(app)
        .post('/api/v1/appointments/parse')
        .send({ text: 'Book an appointment next Friday at 3pm' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        status: 'needs_clarification',
        message: 'Please specify the medical department or doctor type.'
      });
    });

    test('guardrail triggers clarification on ambiguous date/time: "Book dentist sometime next week"', async () => {
      const res = await request(app)
        .post('/api/v1/appointments/parse')
        .send({ text: 'Book dentist sometime next week' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        status: 'needs_clarification',
        message: 'Ambiguous date/time or department.'
      });
    });

    test('guardrail triggers clarification on non-appointment greeting: "hello how are you"', async () => {
      const res = await request(app)
        .post('/api/v1/appointments/parse')
        .send({ text: 'hello how are you' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        status: 'needs_clarification',
        message: 'No appointment request detected. Please specify department, date, and time.'
      });
    });

    test('returns 400 for empty or whitespace-only text', async () => {
      const res = await request(app)
        .post('/api/v1/appointments/parse')
        .send({ text: '   ' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.code).toBe('INVALID_REQUEST');
    });

    test('returns 400 for empty payload', async () => {
      const res = await request(app)
        .post('/api/v1/appointments/parse')
        .send({})
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.code).toBe('INVALID_REQUEST');
    });
  });

  describe('POST /api/v1/appointments/parse - Multipart Image Input', () => {
    test('successfully extracts and parses appointment from valid image note', async () => {
      const sampleImagePath = path.resolve('samples/valid/appointment_note.png');

      const res = await request(app)
        .post('/api/v1/appointments/parse')
        .attach('image', sampleImagePath);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.appointment).toEqual({
        department: 'Dentistry',
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        time: '15:00',
        tz: 'Asia/Kolkata'
      });
    }, 15000);

    test('returns controlled OCR_FAILED error for unreadable image', async () => {
      const noisyImagePath = path.resolve('samples/noisy/unreadable_image.png');

      const res = await request(app)
        .post('/api/v1/appointments/parse')
        .attach('image', noisyImagePath);

      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        status: 'error',
        code: 'OCR_FAILED',
        message: 'Unable to extract usable text from the image.'
      });
    }, 15000);

    test('returns 400 error for unsupported file MIME type', async () => {
      const textFilePath = path.resolve('samples/noisy/not_an_image.txt');

      const res = await request(app)
        .post('/api/v1/appointments/parse')
        .attach('image', textFilePath);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.code).toBe('INVALID_IMAGE');
    });

    test('returns 400 error if both text and image are supplied', async () => {
      const sampleImagePath = path.resolve('samples/valid/appointment_note.png');

      const res = await request(app)
        .post('/api/v1/appointments/parse')
        .field('text', 'Book dentist next Friday at 3pm')
        .attach('image', sampleImagePath);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        status: 'error',
        code: 'INVALID_REQUEST',
        message: 'Provide either text or an image, not both.'
      });
    });
  });
});
