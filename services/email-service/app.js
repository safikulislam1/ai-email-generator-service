const express = require('express');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';

function getRequestId(req) {
  const requestId = req.headers['x-request-id'];
  return typeof requestId === 'string' && requestId.trim() ? requestId.trim() : 'no-request-id';
}

async function requestAiService(payload, requestId) {
  const response = await fetch(`${AI_SERVICE_URL}/internal/generate-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(requestId ? { 'x-request-id': requestId } : {})
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  return { response, body };
}

const app = express();
app.use(express.json({ limit: '100kb' }));

app.get('/health', async (req, res) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/health`);
    const aiHealth = await response.json();
    res.status(response.ok ? 200 : 503).json({
      status: response.ok ? 'UP' : 'DOWN',
      service: 'Email Generation Service',
      ai_service: aiHealth
    });
  } catch (error) {
    res.status(503).json({ status: 'DOWN', service: 'Email Generation Service', error: error.message });
  }
});

app.get('/ready', async (req, res) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/ready`);
    const aiHealth = await response.json();
    res.status(response.ok ? 200 : 503).json({
      status: response.ok ? 'READY' : 'NOT_READY',
      service: 'Email Generation Service',
      ai_service: aiHealth
    });
  } catch (error) {
    res.status(503).json({ status: 'NOT_READY', service: 'Email Generation Service', error: error.message });
  }
});

app.post('/internal/generate-email', async (req, res, next) => {
  try {
    const requestId = getRequestId(req);
    const { response, body } = await requestAiService({
      purpose: req.body.purpose.trim(),
      recipient_name: req.body.recipient_name.trim(),
      tone: req.body.tone.trim().toLowerCase()
    }, requestId);

    const meta = body.meta || {};
    const finalBody = {
      ...body,
      meta: {
        ...meta,
        request_id: meta.request_id || requestId,
        service: 'Email Generation Service'
      }
    };

    res.status(response.status).json(finalBody);
  } catch (error) {
    error.statusCode = 503;
    next(error);
  }
});

app.use((error, req, res, next) => {
  res.status(error.statusCode || 500).json({
    success: false,
    error: 'AIServiceUnavailable',
    message: error.statusCode === 503 ? 'AI service is unavailable.' : error.message
  });
});

module.exports = app;