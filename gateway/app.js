const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const crypto = require('crypto');

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://localhost:3001';
const ALLOWED_TONES = ['professional', 'casual', 'urgent', 'persuasive', 'empathetic', 'formal'];

function generateRequestId() {
  return crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function attachRequestContext(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  req.requestId = typeof incomingId === 'string' && incomingId.trim() ? incomingId.trim() : generateRequestId();
  res.setHeader('x-request-id', req.requestId);
  next();
}

function validateGenerateEmail(req, res, next) {
  const { purpose, recipient_name, tone } = req.body || {};
  const errors = [];

  if (!purpose || typeof purpose !== 'string' || purpose.trim() === '') {
    errors.push("Field 'purpose' is required and must be a non-empty string.");
  }
  if (!recipient_name || typeof recipient_name !== 'string' || recipient_name.trim() === '') {
    errors.push("Field 'recipient_name' is required and must be a non-empty string.");
  }
  if (!tone || typeof tone !== 'string' || tone.trim() === '') {
    errors.push("Field 'tone' is required and must be a non-empty string.");
  } else if (!ALLOWED_TONES.includes(tone.trim().toLowerCase())) {
    errors.push(`Field 'tone' is invalid ('${tone}'). Allowed tones are: ${ALLOWED_TONES.join(', ')}.`);
  }

  if (errors.length) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Invalid or missing parameters in request body.',
      details: errors,
      allowed_tones: ALLOWED_TONES
    });
  }

  next();
}

async function requestEmailService(pathname, options = {}, requestId) {
  const response = await fetch(`${EMAIL_SERVICE_URL}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(requestId ? { 'x-request-id': requestId } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  return { response, body };
}

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(express.json({ limit: '100kb' }));
app.use(attachRequestContext);
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/v1/health', async (req, res) => {
  try {
    const { response, body } = await requestEmailService('/health', {}, req.requestId);
    res.status(response.ok ? 200 : 503).json({
      status: response.ok ? 'UP' : 'DOWN',
      service: 'API Gateway',
      email_service: body
    });
  } catch (error) {
    res.status(503).json({ status: 'DOWN', service: 'API Gateway', error: error.message });
  }
});

app.get('/api/v1/ready', async (req, res) => {
  try {
    const { response, body } = await requestEmailService('/ready', {}, req.requestId);
    res.status(response.ok ? 200 : 503).json({
      status: response.ok ? 'READY' : 'NOT_READY',
      service: 'API Gateway',
      downstream: body
    });
  } catch (error) {
    res.status(503).json({ status: 'NOT_READY', service: 'API Gateway', error: error.message });
  }
});

app.post('/api/v1/generate-email', validateGenerateEmail, async (req, res, next) => {
  try {
    const { response, body } = await requestEmailService('/internal/generate-email', {
      method: 'POST',
      body: JSON.stringify(req.body)
    }, req.requestId);
    res.status(response.status).json({ ...body, meta: { ...(body.meta || {}), request_id: body.meta?.request_id || req.requestId } });
  } catch (error) {
    error.statusCode = 503;
    error.message = 'Email generation service is unavailable.';
    next(error);
  }
});

app.use((req, res) => res.status(404).json({ success: false, error: 'NotFound' }));
app.use((error, req, res, next) => {
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.name || 'InternalServerError',
    message: error.message
  });
});

module.exports = app;