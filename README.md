# AI-Powered Email Template Generator Service

> A production-ready Node.js microservices system that generates customer-friendly email templates using Google Gemini AI.

## Microservices Architecture

The application is built as three independently startable, stateless microservices that operate entirely on-the-fly:

```text
Browser / Client (Web UI Studio)
  |
  v
API Gateway :3000
  |  (HTTP Internal REST)
  v
Email Generation Service :3001
  |  (HTTP Internal REST)
  v
AI Generation Service :3002 ---> Google Gemini API (or In-Memory Fallback Engine)
```

| Service                  | Responsibility                                                                            | Endpoints                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| API Gateway              | Ingress, CORS, Helmet security, rate limiting, validation, static UI, public API          | `POST /api/v1/generate-email`, `GET /api/v1/health`, `GET /api/v1/ready` |
| Email Generation Service | Email workflow orchestration, parameter normalization, downstream proxying                | Internal `POST /internal/generate-email`, `GET /health`, `GET /ready`    |
| AI Generation Service    | Gemini AI integration, structured JSON prompt engine, in-memory fallback, latency metrics | Internal `POST /internal/generate-email`, `GET /health`, `GET /ready`    |

The services communicate over HTTP using `EMAIL_SERVICE_URL` and `AI_SERVICE_URL`. Each service runs in its own process, port, container, and health environment. The system is intentionally **stateless without a database**, enabling low latency, zero storage overhead, and seamless horizontal scaling. Only the AI service receives `GEMINI_API_KEY`.

### Run all services locally

Open three terminals:

```bash
npm run start:ai
npm run start:email
npm run start:gateway
```

Then open `http://localhost:3000`. The gateway is the only service that should be exposed to clients.

### Run with Docker Compose

```bash
docker compose up --build
```

The public API is available at `http://localhost:3000`.

---

## Problem Statement & Overview

Modern customer communications require writing tailored, context-specific emails across various customer touchpoints (e.g. sales demos, payment reminders, welcome emails, feature updates).

This microservice provides a REST API (`POST /api/v1/generate-email`) that accepts a few core parameters (`purpose`, `recipient_name`, `tone`), prompts an AI language model to generate a polished email template, logs execution timings, and returns structured JSON responses.

---

## Key Features & Requirements Met

| Requirement               | Implementation Details                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **POST API**              | Accepts strictly `{ purpose, recipient_name, tone }`. Validates input with standard HTTP 400 error reporting.                                                               |
| **AI Generation**         | Powered by Google Gemini AI (`@google/generative-ai` SDK) using structured prompt engineering to guarantee valid JSON email templates.                                      |
| **Response Time Logs**    | High-precision timing diff (`Date.now()` / `hrtime`) logged in server stdout and returned in response metadata (`meta.response_time_ms`).                                   |
| **Modular Architecture**  | Clean separation of Layered Architecture: **Controllers** (HTTP), **Services** (Business/AI logic), **Middlewares** (Validation, Error, Logger), **Config**, and **Utils**. |
| **Env Variable Handling** | Secure API key & config handling via `dotenv` with `GEMINI_API_KEY`, model selection, and environment scoping.                                                              |
| **Web UI Studio**         | Includes a clean light-mode interactive browser dashboard for live API testing and visually reviewing generated templates & response times.                                 |
| **Automated Testing**     | Comprehensive unit & integration tests written with Jest and Supertest.                                                                                                     |

---

## Codebase Structure

```
Assignment-2/
├── gateway/                       # Public API gateway process
│   ├── app.js                     # Public routes, validation, proxying, security
│   └── server.js                  # Gateway entrypoint
├── services/
│   ├── email-service/             # Email workflow process
│   │   ├── app.js                 # Internal HTTP contract and AI proxy
│   │   └── server.js              # Email service entrypoint
│   └── ai-service/                # AI provider process
│       ├── app.js                 # Gemini integration and fallback engine
│       └── server.js              # AI service entrypoint
├── public/                        # Interactive Web UI Studio (HTML/CSS/JS)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── tests/
│   └── email.test.js              # Automated Jest & Supertest suite
├── .env.example                   # Environment configuration template
├── .env                           # Local environment variables
├── package.json
└── README.md
```

---

## Brief Explanation of AI Prompt Design

The prompt engineering strategy in `services/ai-service/app.js` is structured around 4 foundational pillars:

### 1. Persona & System Persona Role

The AI model is explicitly instructed:

> _"You are an expert AI customer communications assistant specializing in generating concise, effective, customer-friendly email templates."_

### 2. Output Schema Enforcement

To prevent unpredictable free-form text or markdown code blocks, the prompt enforces a strict JSON schema via system instructions and Gemini's `responseMimeType: "application/json"` configuration:

```json
{
  "subject": "Concise, engaging subject line",
  "body": "Complete email body including recipient greeting, message, call to action, and sign-off",
  "tone_explanation": "One-sentence rationale explaining how the text aligns with the requested tone"
}
```

### 3. Tone Guidance Mapping

The prompt dynamically injects specific linguistic instructions tailored to the requested `tone`:

- **Professional:** Polished, polite, business-appropriate language without slang.
- **Casual:** Warm, conversational, friendly, and approachable posture.
- **Urgent:** Direct, action-oriented, emphasizing deadlines clearly.
- **Persuasive:** Value-proposition focused, highlighting benefits and clear call-to-action.
- **Empathetic:** Supportive, caring, and understanding posture.

### 4. Robust Fallback Strategy

If `GEMINI_API_KEY` is omitted or if an external network error occurs, the service automatically routes requests to an intelligent rule-based template engine that generates tone-matched emails while maintaining identical response schema and accurate timing logs.

---

## Response Time Logging Mechanism

As per **Requirement #3**, response times for AI calls are measured using high-precision timestamp differentials:

```javascript
const startTime = Date.now();
// Execute AI model call or fallback generation
const resultData = await this._callGeminiAPI(...);
const responseTimeMs = Date.now() - startTime;
```

### 1. Console Output Log

Every AI generation logs the performance metric to standard output:

```text
[2026-09-28T10:22:50.266Z] [AI_PERF] Generate Email Template completed in 312ms {
  recipient_name: 'Sarah Jenkins',
  purpose_preview: 'Follow up on product demo request',
  tone: 'professional',
  model: 'gemini-3.6-flash'
}
```

### 2. API Response Metadata

The exact response time is returned directly to the API caller inside the `meta` object:

```json
"meta": {
  "response_time_ms": 312,
  "timestamp": "2026-09-28T10:22:50.266Z",
  "model_used": "gemini-3.6-flash",
  "status": "success"
}
```

---

## API Specification & Sample Responses

### Endpoint: Generate Email Template

`POST /api/v1/generate-email`

#### Request Headers

```http
Content-Type: application/json
```

#### Request Body

```json
{
  "purpose": "Follow up on product demo request and schedule a 15-minute alignment call",
  "recipient_name": "Sarah Jenkins",
  "tone": "professional"
}
```

#### Sample 200 OK API Response

```json
{
  "success": true,
  "data": {
    "subject": "Following Up: Product Demo & Next Steps for Acme Solutions",
    "body": "Dear Sarah Jenkins,\n\nI hope this email finds you well.\n\nFollowing up on your recent product demo request, I would love to schedule a brief 15-minute alignment call to walk you through our workflow automation features.\n\nPlease let me know which time works best for you, or feel free to propose an alternative.\n\nBest regards,\n[Your Name / Company]",
    "tone_explanation": "Polished business formatting with polite salutations and clear phrasing.",
    "purpose": "Follow up on product demo request and schedule a 15-minute alignment call",
    "recipient_name": "Sarah Jenkins",
    "tone": "professional"
  },
  "meta": {
    "response_time_ms": 312,
    "timestamp": "2026-09-28T10:22:50.266Z",
    "model_used": "gemini-3.6-flash",
    "status": "success"
  }
}
```

#### Sample 400 Bad Request Response (Validation Error)

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid or missing parameters in request body.",
  "details": [
    "Field 'recipient_name' is required and must be a non-empty string.",
    "Field 'tone' is required and must be a non-empty string."
  ],
  "example_valid_payload": {
    "purpose": "Follow up on product demo request",
    "recipient_name": "Sarah Jenkins",
    "tone": "professional"
  }
}
```

---

## Setup & Installation Instructions

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd ai-email-generator-service
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and set your Google Gemini API key:

```env
GATEWAY_PORT=3000
EMAIL_SERVICE_PORT=3001
AI_SERVICE_PORT=3002
EMAIL_SERVICE_URL=http://localhost:3001
AI_SERVICE_URL=http://localhost:3002
NODE_ENV=development
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash
```

_(Note: You can obtain a free Gemini API Key at [Google AI Studio](https://aistudio.google.com/))._

---

## Running the Application

### Development Mode (with hot-reloading)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Running Automated Tests

```bash
npm test
```

---

## Interactive Web UI Studio

Once the server is running on `http://localhost:3000`, open your web browser to:

`http://localhost:3000/`

The Web UI Studio features:

- **Quick Presets**: 1-click loading for Demo Requests, Payment Reminders, Welcome Onboarding, and Discounts.
- **Live Latency Badge**: Displays live AI response timing (`AI Latency: XXXms`).
- **Copy Buttons**: Copy generated subject or body with a single click.
- **Raw JSON Inspector**: Accordion viewing full REST API responses including response time logs.

---

## Sample cURL Command

To test via terminal:

```bash
curl -X POST http://localhost:3000/api/v1/generate-email \
  -H "Content-Type: application/json" \
  -d '{
    "purpose": "Remind customer about upcoming subscription renewal",
    "recipient_name": "Michael Scott",
    "tone": "casual"
  }'
```

---

## License

MIT License
