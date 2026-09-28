const request = require('supertest');
const app = require('../gateway/app');

const aiResponse = {
  success: true,
  data: {
    subject: 'Update Regarding: Follow up on deliverables',
    body: 'Dear Alex Johnson,\n\nPlease see the update.',
    tone_explanation: 'Professional language.',
    purpose: 'Follow up on deliverables',
    recipient_name: 'Alex Johnson',
    tone: 'professional'
  },
  meta: { response_time_ms: 4, timestamp: new Date().toISOString(), model_used: 'fallback-template-engine', status: 'success' }
};

beforeEach(() => {
  global.fetch = jest.fn((url) => {
    if (url.endsWith('/health')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'UP', service: 'Email Generation Service', ai_service: { status: 'UP' } }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => aiResponse });
  });
});

afterEach(() => jest.restoreAllMocks());

jest.setTimeout(20000); // Allow ample timeout for real network AI API calls

describe('AI Email Template Generator API Tests', () => {
  
  describe('GET /api/v1/health', () => {
    it('should return service health status with 200 OK', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'UP');
      expect(res.body).toHaveProperty('service');
      expect(res.body).toHaveProperty('email_service.ai_service');
    });
  });

  describe('GET /api/v1/ready', () => {
    it('should return readiness status for the gateway', async () => {
      const res = await request(app).get('/api/v1/ready');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'READY');
      expect(res.body).toHaveProperty('service', 'API Gateway');
    });
  });

  describe('POST /api/v1/generate-email', () => {

    it('should return 400 Bad Request when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/generate-email')
        .send({
          purpose: 'Meeting reminder'
          // Missing recipient_name and tone
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details.length).toBeGreaterThan(0);
    });

    it('should return 400 Bad Request when an invalid tone is provided', async () => {
      const res = await request(app)
        .post('/api/v1/generate-email')
        .send({
          purpose: 'Reminder regarding overdue invoice #INV-4092',
          recipient_name: 'Safikul Islam',
          tone: 'test' // Invalid random tone
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.details[0]).toContain("Field 'tone' is invalid");
      expect(res.body).toHaveProperty('allowed_tones');
    });

    it('should successfully generate an email template with valid inputs and include response time metrics', async () => {
      const payload = {
        purpose: 'Follow up on Q3 project deliverables and set up alignment call',
        recipient_name: 'Alex Johnson',
        tone: 'professional'
      };

      const res = await request(app)
        .post('/api/v1/generate-email')
        .set('x-request-id', 'req-123')
        .send(payload);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      
      // Data fields assertions
      expect(res.body.data).toHaveProperty('subject');
      expect(res.body.data).toHaveProperty('body');
      expect(res.body.data).toHaveProperty('tone_explanation');
      expect(res.body.data.recipient_name).toBe('Alex Johnson');
      expect(res.body.data.tone).toBe('professional');

      // Meta & Response Time logging assertions (Requirement #3)
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('response_time_ms');
      expect(typeof res.body.meta.response_time_ms).toBe('number');
      expect(res.body.meta.response_time_ms).toBeGreaterThanOrEqual(0);
      expect(res.body.meta).toHaveProperty('timestamp');
      expect(res.body.meta).toHaveProperty('request_id', 'req-123');
    });

  });

});
