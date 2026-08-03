export type ClientData = {
  id: string;
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  billingAddress?: string | null;
  gstin?: string | null;
};

export type ProjectData = {
  id: string;
  name: string;
  serviceType: string | null;
  status: string;
  progress: number;
  startDate: Date | null;
  endDate: Date | null;
  milestones: { id: string; title: string; completed: boolean; dueDate: Date | null }[];
};

export type ProposalData = {
  id: string;
  title: string;
  status: string;
  total: number;
};

export type AgreementData = {
  id: string;
  title: string;
  status: string;
  content: string;
  signedAt: Date | null;
};

export type InvoiceData = {
  id: string;
  number: string;
  status: string;
  total: number;
  dueDate: Date | null;
  subtotal: number;
  gstAmount: number;
  gstRate: number;
};

export type ContentPostData = {
  id: string;
  title: string;
  caption: string | null;
  script: string | null;
  status: string;
  platforms: string;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  publishProof: string | null;
};
