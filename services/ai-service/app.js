const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const client = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const TONE_GUIDELINES = {
  professional: 'Use clear, polite, and respectful business language.',
  casual: 'Use a warm, friendly, conversational tone.',
  urgent: 'Be direct, clear, and action-oriented without sounding aggressive.',
  persuasive: 'Focus on benefits, value, and a compelling call to action.',
  empathetic: 'Demonstrate care, understanding, and supportive language.',
  formal: 'Maintain strict etiquette and traditional business formatting.'
};

function getRequestId(req) {
  const requestId = req.headers['x-request-id'];
  return typeof requestId === 'string' && requestId.trim() ? requestId.trim() : 'no-request-id';
}

function buildPrompt({ purpose, recipient_name, tone }) {
  return `Generate a customer-friendly email for ${recipient_name} about ${purpose}. Use a ${tone} tone: ${TONE_GUIDELINES[tone]}. Return only JSON with keys subject, body, tone_explanation.`;
}

function fallback({ purpose, recipient_name, tone }) {
  return {
    subject: `Update Regarding: ${purpose}`,
    body: `Dear ${recipient_name},\n\nI am writing to communicate with you regarding ${purpose}.\n\nPlease let me know if you need any further information.\n\nBest regards,\n[Your Name / Company]`,
    tone_explanation: `The message uses clear, customer-friendly ${tone} language.`
  };
}

async function generateWithGemini(input) {
  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024, responseMimeType: 'application/json' }
  });
  const result = await model.generateContent(buildPrompt(input));
  return JSON.parse(result.response.text().replace(/```json|```/gi, '').trim());
}

function extractQuotaValue(error) {
  if (!error) return null;
  const msg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
  
  const quotaMatch = msg.match(/"quotaValue"\s*:\s*"([^"]+)"/) ||
                     msg.match(/"quotaValue"\s*:\s*(\d+)/) ||
                     msg.match(/quotaValue\s*[:=]\s*"?([^"\s\}]+)"?/) ||
                     msg.match(/limit:\s*(\d+)/i);
                     
  if (quotaMatch && quotaMatch[1]) {
    return quotaMatch[1];
  }
  return null;
}

const app = express();
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => res.json({
  status: 'UP',
  service: 'AI Generation Service',
  provider: 'Google Gemini AI',
  model: MODEL,
  api_key_configured: Boolean(client),
  mode: client ? 'Live Gemini AI' : 'Fallback Template Engine'
}));

app.get('/ready', (req, res) => res.json({
  status: 'READY',
  service: 'AI Generation Service',
  provider: 'Google Gemini AI',
  model: MODEL,
  api_key_configured: Boolean(client),
  mode: client ? 'Live Gemini AI' : 'Fallback Template Engine'
}));

app.post('/internal/generate-email', async (req, res) => {
  const start = Date.now();
  const input = req.body;
  const requestId = getRequestId(req);
  let data;
  let modelUsed = MODEL;
  let status = 'success';
  let quotaValue = null;

  try {
    data = client ? await generateWithGemini(input) : fallback(input);
    if (!client) {
      modelUsed = 'fallback-template-engine';
      quotaValue = process.env.FALLBACK_QUOTA_VALUE || '20';
    }
  } catch (error) {
    data = fallback(input);
    modelUsed = 'fallback-template-engine (error-recovery)';
    status = 'degraded';
    quotaValue = extractQuotaValue(error) || process.env.FALLBACK_QUOTA_VALUE || '20';
    console.error(`AI generation failed: ${error.message}`);
  }

  const meta = {
    response_time_ms: Date.now() - start,
    timestamp: new Date().toISOString(),
    model_used: modelUsed,
    status,
    request_id: requestId
  };

  if (quotaValue) {
    meta.quota_limit = quotaValue;
    meta.quota_used = quotaValue;
  }

  res.json({
    success: true,
    data: { ...data, purpose: input.purpose, recipient_name: input.recipient_name, tone: input.tone },
    meta
  });
});

module.exports = app;