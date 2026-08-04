import { Router } from "express";
import OpenAI from "openai";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";

const router = Router();

// ---------------------------------------------------------------------------
// Shared AI client factory
// Priority: OPENROUTER_API_KEY → OPENAI_API_KEY (auto-detect OpenRouter) → Gemini via OpenRouter
// ---------------------------------------------------------------------------

function buildOpenRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://agencyos.app",
      "X-Title": "AgencyOS",
    },
  });
}

function buildOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: "https://api.openai.com/v1" });
}

function getAIClient(): { client: OpenAI; model: string } | null {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (openrouterKey) {
    return { client: buildOpenRouterClient(openrouterKey), model: "google/gemini-2.5-flash" };
  }

  if (openaiKey) {
    // Auto-detect OpenRouter keys (start with sk-or-)
    const isOpenRouter = openaiKey.startsWith("sk-or-") || openaiKey.includes("openrouter");
    if (isOpenRouter) {
      return { client: buildOpenRouterClient(openaiKey), model: "google/gemini-2.5-flash" };
    }
    return { client: buildOpenAIClient(openaiKey), model: "gpt-4o-mini" };
  }

  return null;
}

async function generateWithAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const config = getAIClient();

  if (!config) {
    throw createError(
      "AI assistant is not configured. Add an OPENROUTER_API_KEY or OPENAI_API_KEY environment variable to enable it.",
      503,
    );
  }

  const { client, model } = config;
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
    max_tokens: 1200,
  });
  return completion.choices[0]?.message?.content?.trim() || "{}";
}

async function generateTextWithAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const config = getAIClient();

  if (!config) {
    throw createError(
      "AI assistant is not configured. Add an OPENROUTER_API_KEY or OPENAI_API_KEY environment variable to enable it.",
      503,
    );
  }

  const { client, model } = config;
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.5,
    max_tokens: 2000,
  });
  return completion.choices[0]?.message?.content?.trim() || "";
}

// ---------------------------------------------------------------------------
// Prompt schemas for the fill-form feature
// ---------------------------------------------------------------------------

const FILL_FORM_SCHEMAS: Record<string, { prompt: string; schema: string }> = {
  quotation: {
    prompt: `You are an AI assistant for a creative agency management platform. The user will describe a quotation/estimate they need to create. Extract information and return a JSON object with these optional fields:
- clientName (string): client company or person name
- clientEmail (string): client email
- clientPhone (string): client phone
- currency (string): one of "INR", "USD", "EUR", "GBP", "AED" — default to INR
- notes (string): additional notes for the client, 1–2 sentences
- termsAndConditions (string): payment terms, validity, delivery conditions
- lineItems (array): each item has { itemName (string), description (string), qty (number, default 1), unitPrice (number), taxPercent (number, default 18), hsnSac (string, optional) }
Only include fields you can reasonably infer. Return valid JSON only.`,
    schema: "quotation",
  },
  invoice: {
    prompt: `You are an AI assistant for a creative agency management platform. The user will describe an invoice they need to create. Extract information and return a JSON object with these optional fields:
- currency (string): one of "INR", "USD", "EUR", "GBP", "AED" — default to INR
- notes (string): invoice notes, 1–2 sentences
- termsAndConditions (string): payment terms and conditions
- lineItems (array): each item has { description (string), qty (number, default 1), unitPrice (number), taxPercent (number, default 18), hsnSac (string, optional) }
Only include fields you can reasonably infer. Return valid JSON only.`,
    schema: "invoice",
  },
  proposal: {
    prompt: `You are an AI assistant for a creative agency management platform. The user will describe a proposal they need. Extract information and return a JSON object with these optional fields:
- title (string): proposal title, e.g. "Social Media Management Proposal for Acme Corp"
- notes (string): full proposal body content — write this as a well-structured, persuasive agency proposal covering scope, approach, deliverables, and value. Use plain text with line breaks between sections, no markdown.
Only include fields you can reasonably infer. Return valid JSON only.`,
    schema: "proposal",
  },
  "purchase-order": {
    prompt: `You are an AI assistant for a creative agency management platform. The user will describe a purchase order they need. Extract information and return a JSON object with these optional fields:
- notes (string): PO notes or special instructions
- termsAndConditions (string): delivery, payment terms
- lineItems (array): each item has { description (string), qty (number, default 1), unitPrice (number), taxPercent (number, default 18), hsnSac (string, optional) }
Only include fields you can reasonably infer. Return valid JSON only.`,
    schema: "purchase-order",
  },
  task: {
    prompt: `You are an AI assistant for a project management tool. The user will describe a task they need to create. Extract information and return a JSON object with these optional fields:
- title (string): short, actionable task title (max 80 chars)
- description (string): detailed task description with clear acceptance criteria or steps
- priority (string): one of "LOW", "MEDIUM", "HIGH" — infer from urgency language
- dueDate (string): ISO date YYYY-MM-DD if a deadline is mentioned, otherwise omit
Only include fields you can reasonably infer. Return valid JSON only.`,
    schema: "task",
  },
  "content-post": {
    prompt: `You are an AI assistant for a social media content calendar tool. The user will describe a content post they need. Extract information and return a JSON object with these optional fields:
- title (string): post name/title
- platform (string): one of "INSTAGRAM", "FACEBOOK", "YOUTUBE", "LINKEDIN", "TWITTER", "TIKTOK", "PINTEREST"
- contentType (string): one of "REEL", "STORY", "POST", "CAROUSEL", "VIDEO", "BLOG", "TWEET"
- caption (string): the full social media caption text — write it in an engaging, on-brand tone. No markdown, no hashtags unless asked.
- status (string): one of "DRAFT", "SCHEDULED", "PUBLISHED", "APPROVED" — default DRAFT
Only include fields you can reasonably infer. Return valid JSON only.`,
    schema: "content-post",
  },
  client: {
    prompt: `You are an AI assistant for a CRM inside an agency management platform. The user will describe a new client they want to add. Extract information and return a JSON object with these optional fields:
- companyName (string): company or client name
- contactPerson (string): primary contact person's name
- email (string): contact email
- phone (string): phone number
- notes (string): relevant notes about the client, their business, requirements
- category (string): one of "RETAINER", "ONE_TIME", "PROJECT" — infer from context, default RETAINER
Only include fields you can reasonably infer. Return valid JSON only.`,
    schema: "client",
  },
  lead: {
    prompt: `You are an AI assistant for a sales CRM inside an agency management platform. The user will describe a new lead/prospect. Extract information and return a JSON object with these optional fields:
- title (string): lead title / service they need, e.g. "Social Media Management"
- companyName (string): prospect company name
- contactName (string): contact person name
- email (string): contact email
- value (number): estimated deal value in the local currency
- stage (string): one of "LEAD", "PROPOSAL", "NEGOTIATION", "WON", "LOST" — infer from context, default LEAD
Only include fields you can reasonably infer. Return valid JSON only.`,
    schema: "lead",
  },
};

// ---------------------------------------------------------------------------
// Finance document generation prompts
// ---------------------------------------------------------------------------

function getFinanceSystemPrompt(type: "invoice" | "proposal" | "agreement"): string {
  if (type === "invoice") {
    return `You are a professional accounting AI for a creative agency. Based on the client details and parameters provided, draft a professional invoice.
Respond with a raw JSON object matching this schema exactly. Do not wrap in markdown. Output only JSON:
{
  "lineDescription": "Professional Creative Retainer / Custom services name describing the work",
  "subtotal": 75000,
  "gstRate": 18,
  "dueDate": "YYYY-MM-DD"
}`;
  }
  if (type === "proposal") {
    return `You are a professional agency business development AI. Based on the client details and requirements, draft a professional business proposal.
Respond with a raw JSON object matching this schema exactly. Do not wrap in markdown. Output only JSON:
{
  "title": "Proposal for [service] for [client]",
  "subtotal": 125000,
  "discount": 10000,
  "templateKey": "website",
  "scopeDescription": "Describe the main deliverables, scope of work, timeline, and value proposition in 2-3 clear paragraphs."
}
templateKey MUST be one of: 'website', 'social', 'performance', 'retainer', 'branding'`;
  }
  return `You are an expert corporate legal counsel. Based on the client details, draft a comprehensive agency service contract agreement.
Respond with a raw JSON object matching this schema exactly. Do not wrap in markdown. Output only JSON:
{
  "title": "Master Services Agreement: [Client Company Name] & Agency",
  "content": "Full markdown agreement text with sections for: Scope of Services, Payment Terms, Term and Termination, Confidentiality & IP, SLA"
}`;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Fill form with AI (used by WriteWithAI component for structured forms)
router.post(
  "/fill-form",
  asyncHandler(async (req, res) => {
    const { prompt, context } = req.body as { prompt?: string; context?: string };

    if (!prompt || !prompt.trim()) {
      throw createError("prompt is required", 400);
    }
    if (!context || !FILL_FORM_SCHEMAS[context]) {
      throw createError(`Unknown context. Must be one of: ${Object.keys(FILL_FORM_SCHEMAS).join(", ")}`, 400);
    }

    const { prompt: systemPrompt } = FILL_FORM_SCHEMAS[context];
    const raw = await generateWithAI(systemPrompt, prompt);
    let fields: Record<string, unknown> = {};
    try {
      fields = JSON.parse(raw);
    } catch {
      fields = {};
    }

    res.json({ fields });
  }),
);

// Free-text generation (used by WriteWithAI for text expansion)
router.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const { prompt, context, existingText } = req.body as { prompt?: string; context?: string; existingText?: string };

    if (!prompt || !prompt.trim()) {
      throw createError("prompt is required", 400);
    }

    const systemPrompt = `You are a professional assistant writing content for an agency management system. Context: ${context || "general"}. ${existingText ? `Existing text to improve or base on: ${existingText}` : ""} Return clear, polished response text.`;
    const text = await generateTextWithAI(systemPrompt, prompt);
    res.json({ text });
  }),
);

// Finance document generation (invoice / proposal / agreement) — used by Finance AI Copilot dialog
router.post(
  "/generate-template",
  asyncHandler(async (req, res) => {
    const { type, prompt } = req.body as { type?: string; prompt?: string };

    if (!type || !["invoice", "proposal", "agreement"].includes(type)) {
      throw createError("type must be one of: invoice, proposal, agreement", 400);
    }
    if (!prompt || !prompt.trim()) {
      throw createError("prompt is required", 400);
    }

    const systemPrompt = getFinanceSystemPrompt(type as "invoice" | "proposal" | "agreement");
    const raw = await generateWithAI(systemPrompt, `Client Description and Parameters:\n"${prompt}"`);

    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(raw);
    } catch {
      // Try to extract JSON from the response
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { data = JSON.parse(match[0]); } catch { data = {}; }
      }
    }

    res.json({ data });
  }),
);

// Contract clause generation — used by Finance Agreement clause writer
router.post(
  "/generate-clause",
  asyncHandler(async (req, res) => {
    const { prompt, existingContent } = req.body as { prompt?: string; existingContent?: string };

    if (!prompt || !prompt.trim()) {
      throw createError("prompt is required", 400);
    }

    const systemPrompt = `You are an expert corporate legal counsel. Write a contract clause based on the user's prompt.
Integrate it nicely to match the styling of a standard Master Services Agreement.
Output ONLY the markdown clause text. Do not write any conversational intro or outro.`;

    const userPrompt = `${existingContent ? `Existing Contract Context (brief): ${existingContent.substring(0, 500)}...\n\n` : ""}Draft a clause for: "${prompt}"`;
    const clause = await generateTextWithAI(systemPrompt, userPrompt);

    res.json({ clause: `\n\n${clause.trim()}` });
  }),
);

export default router;
