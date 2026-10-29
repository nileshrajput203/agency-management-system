import {
  pgTable,
  text,
  timestamp,
  numeric,
  boolean,
  json,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { invoicesTable } from "./invoices";
import { purchaseOrdersTable } from "./purchaseOrders";
import { usersTable } from "./users";
import { vendorsTable } from "./vendors";
import { projectsTable } from "./projects";

type FinanceLineItem = {
  description: string;
  hsnSac?: string;
  qty: number;
  unitPrice: number;
  taxPercent: number;
  taxTreatment?: "TAXABLE" | "NIL_RATED" | "EXEMPT" | "NON_GST";
};

export const financeSequencesTable = pgTable("finance_sequences", {
  id: text("id").primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const proformaInvoicesTable = pgTable("proforma_invoices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull(),
  clientId: text("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  clientName: text("client_name"),
  status: text("status").notNull().default("DRAFT"),
  invoiceDate: text("invoice_date").notNull(),
  validUntil: text("valid_until"),
  currency: text("currency").notNull().default("INR"),
  companyGstin: text("company_gstin"),
  companyState: text("company_state"),
  clientGstin: text("client_gstin"),
  clientState: text("client_state"),
  placeOfSupplyState: text("place_of_supply_state"),
  gstType: text("gst_type").notNull().default("CGST_SGST"),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  igstAmount: numeric("igst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
  lineItems: json("line_items").$type<FinanceLineItem[]>().notNull().default([]),
  notes: text("notes"),
  termsAndConditions: text("terms_and_conditions"),
  bankDetails: json("bank_details").$type<{ bankName?: string; accountNumber?: string; ifsc?: string; accountName?: string }>(),
  convertedInvoiceId: text("converted_invoice_id").references(() => invoicesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy: text("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (table) => [
  uniqueIndex("proforma_invoices_number_unique").on(table.number),
  index("proforma_invoices_client_id_idx").on(table.clientId),
  index("proforma_invoices_status_idx").on(table.status),
  index("proforma_invoices_date_idx").on(table.invoiceDate),
]);

export const supplierBillsTable = pgTable("supplier_bills", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull(),
  vendorId: text("vendor_id").notNull().references(() => vendorsTable.id, { onDelete: "restrict" }),
  purchaseOrderId: text("purchase_order_id").references(() => purchaseOrdersTable.id, { onDelete: "set null" }),
  vendorInvoiceNumber: text("vendor_invoice_number").notNull(),
  billDate: text("bill_date").notNull(),
  receivedDate: text("received_date"),
  dueDate: text("due_date"),
  status: text("status").notNull().default("SUBMITTED"),
  vendorNameSnapshot: text("vendor_name_snapshot").notNull(),
  vendorGstin: text("vendor_gstin"),
  companyGstin: text("company_gstin"),
  placeOfSupplyState: text("place_of_supply_state"),
  gstType: text("gst_type").notNull().default("CGST_SGST"),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  igstAmount: numeric("igst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
  itcEligible: boolean("itc_eligible").notNull().default(false),
  lineItems: json("line_items").$type<FinanceLineItem[]>().notNull().default([]),
  notes: text("notes"),
  approvedBy: text("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (table) => [
  uniqueIndex("supplier_bills_vendor_invoice_unique").on(table.vendorId, table.vendorInvoiceNumber),
  index("supplier_bills_vendor_id_idx").on(table.vendorId),
  index("supplier_bills_status_idx").on(table.status),
  index("supplier_bills_date_idx").on(table.billDate),
]);

export const supplierBillPaymentsTable = pgTable("supplier_bill_payments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  supplierBillId: text("supplier_bill_id").notNull().references(() => supplierBillsTable.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  paymentDate: text("payment_date").notNull(),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  status: text("status").notNull().default("SUCCESS"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (table) => [
  index("supplier_bill_payments_bill_id_idx").on(table.supplierBillId),
]);

export const employeeExpensesTable = pgTable("employee_expenses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  vendorId: text("vendor_id").references(() => vendorsTable.id, { onDelete: "set null" }),
  clientId: text("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  description: text("description").notNull(),
  spendDate: text("spend_date").notNull(),
  vendorName: text("vendor_name"),
  vendorGstin: text("vendor_gstin"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  taxPercent: numeric("tax_percent", { precision: 6, scale: 3 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  gstType: text("gst_type").notNull().default("CGST_SGST"),
  itcEligible: boolean("itc_eligible").notNull().default(false),
  reimbursable: boolean("reimbursable").notNull().default(true),
  receiptReference: text("receipt_reference"),
  status: text("status").notNull().default("SUBMITTED"),
  rejectionReason: text("rejection_reason"),
  approvedBy: text("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  reimbursedAt: timestamp("reimbursed_at"),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("employee_expenses_user_id_idx").on(table.userId),
  index("employee_expenses_status_idx").on(table.status),
  index("employee_expenses_spend_date_idx").on(table.spendDate),
]);

export const clientLifecycleEventsTable = pgTable("client_lifecycle_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().references(() => clientsTable.id, { onDelete: "restrict" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  effectiveDate: text("effective_date").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (table) => [
  index("client_lifecycle_events_client_id_idx").on(table.clientId),
  index("client_lifecycle_events_effective_date_idx").on(table.effectiveDate),
]);
