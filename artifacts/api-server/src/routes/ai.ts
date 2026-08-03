import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";

const router = Router();

let openaiClient: OpenAI | null = null;
let geminiClient: GoogleGenAI | null = null;

async function generateWithAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    if (!geminiClient) {
      geminiClient = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    const modelsToTry = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3-flash-preview"];
    let lastError: unknown = null;
    for (const model of modelsToTry) {
      try {
        const response = await geminiClient.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            temperature: 0.4,
            maxOutputTokens: 1200,
          },
        });
        if (response.text) {
          return response.text.trim();
        }
      } catch (err) {
        lastError = err;
      }
    }
    if (lastError && !openaiKey) {
      throw createError(`Gemini generation failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`, 500);
    }
  }

  if (openaiKey) {
    if (!openaiClient) {
      openaiClient = new OpenAI({ apiKey: openaiKey });
    }
    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
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

  throw createError(
    "AI assistant is not configured. Add a GEMINI_API_KEY or OPENAI_API_KEY environment variable to enable it.",
    503,
  );
}

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

router.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const { prompt, context, existingText } = req.body as { prompt?: string; context?: string; existingText?: string };

    if (!prompt || !prompt.trim()) {
      throw createError("prompt is required", 400);
    }

    const systemPrompt = `You are a professional assistant writing content for an agency management system. Context: ${context || "general"}. ${existingText ? `Existing text to improve or base on: ${existingText}` : ""} Return clear, polished response text.`;

    const text = await generateWithAI(systemPrompt, prompt);
    res.json({ text });
  }),
);

export default router;
