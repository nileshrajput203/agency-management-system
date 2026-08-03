import type { ActionResult } from "@/lib/validations";

export const initialActionResult: ActionResult = { ok: false, error: "" };

export const DRAFT_PRESETS = {
  website: {
    clientName: "Nike Retail",
    projectTitle: "E-Commerce Website Development",
    amount: "120000",
    revisions: "3",
    termsDays: "15",
    scope: "Design, development, and launch of a fully responsive e-commerce web application with custom product pages, checkout flow, search filters, and an admin dashboard interface.",
  },
  social: {
    clientName: "Adidas Originals",
    projectTitle: "Social Media Campaign Retainer",
    amount: "45000",
    revisions: "2",
    termsDays: "10",
    scope: "Creation of 15 social media assets per month, monthly calendar setup, post scheduling, performance analytics tracking, and community engagement for Instagram and LinkedIn channels.",
  },
  performance: {
    clientName: "Puma Fitness",
    projectTitle: "Paid Performance Marketing",
    amount: "80000",
    revisions: "2",
    termsDays: "15",
    scope: "Management of paid advertisement campaigns across Meta Ads Manager and Google Ads. A/B testing copy, audience segmentation, budget optimization, and bi-weekly growth reports.",
  },
  retainer: {
    clientName: "Reebok India",
    projectTitle: "Full-Service Digital Agency Retainer",
    amount: "150000",
    revisions: "4",
    termsDays: "30",
    scope: "Comprehensive marketing and technical support including search engine optimization (SEO), custom landing pages, monthly creative creatives, newsletter copy, and server maintenance.",
  },
};
