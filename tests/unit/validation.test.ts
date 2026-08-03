import { describe, it, expect } from "vitest";
import { isValidUUID, sanitizeAndValidate, validateLineItems } from "../../artifacts/api-server/src/lib/validation";

describe("Validation Utilities Unit Tests", () => {
  describe("isValidUUID", () => {
    it("should return true for valid v4 UUIDs", () => {
      expect(isValidUUID("c56a4180-65aa-42ec-a945-5fd21dec0538")).toBe(true);
      expect(isValidUUID("9df7d339-addb-4f1f-9e72-ee9b29d21ada")).toBe(true);
    });

    it("should return false for invalid UUIDs", () => {
      expect(isValidUUID("invalid-uuid")).toBe(false);
      expect(isValidUUID(null)).toBe(false);
      expect(isValidUUID(undefined)).toBe(false);
      expect(isValidUUID("12345")).toBe(false);
    });
  });

  describe("sanitizeAndValidate", () => {
    it("should map empty strings and 'null' strings to null", () => {
      const input = { name: "Test", emptyStr: "", nullStr: "null", undefinedStr: "undefined" };
      const output = sanitizeAndValidate(input);
      expect(output.name).toBe("Test");
      expect(output.emptyStr).toBeNull();
      expect(output.nullStr).toBeNull();
      expect(output.undefinedStr).toBeNull();
    });

    it("should validate UUID fields", () => {
      const valid = { clientId: "c56a4180-65aa-42ec-a945-5fd21dec0538" };
      expect(() => sanitizeAndValidate(valid, { uuids: ["clientId"] })).not.toThrow();

      const invalid = { clientId: "bad-uuid" };
      expect(() => sanitizeAndValidate(invalid, { uuids: ["clientId"] })).toThrow(/Invalid UUID format/i);
    });

    it("should validate numbers and convert strings to numbers", () => {
      const input = { amount: "150.50", discount: 10 };
      const result = sanitizeAndValidate(input, { numbers: ["amount", "discount"] });
      expect(result.amount).toBe(150.5);
      expect(result.discount).toBe(10);

      const invalid = { amount: "not-a-number" };
      expect(() => sanitizeAndValidate(invalid, { numbers: ["amount"] })).toThrow(/Invalid numeric value/i);
    });

    it("should validate enum values and normalize casing", () => {
      const input = { status: "pending" };
      const result = sanitizeAndValidate(input, { enums: { status: ["PENDING", "APPROVED", "REJECTED"] } });
      expect(result.status).toBe("PENDING");

      const invalid = { status: "UNKNOWN_STATUS" };
      expect(() => sanitizeAndValidate(invalid, { enums: { status: ["PENDING", "APPROVED"] } })).toThrow(/Allowed values are/i);
    });
  });

  describe("validateLineItems", () => {
    it("should validate valid line items", () => {
      const payload = {
        lineItems: [
          { description: "Design", qty: 2, unitPrice: 100, totalPrice: 200 }
        ]
      };
      expect(() => validateLineItems(payload, "Invoices")).not.toThrow();
    });

    it("should throw error if required line item fields are missing or invalid", () => {
      const payloadMissingQty = {
        lineItems: [
          { description: "Design", unitPrice: 100 }
        ]
      };
      expect(() => validateLineItems(payloadMissingQty, "Invoices")).toThrow(/Required child item field 'qty'/i);

      const payloadBadNumber = {
        lineItems: [
          { description: "Design", qty: "abc", unitPrice: 100 }
        ]
      };
      expect(() => validateLineItems(payloadBadNumber, "Invoices")).toThrow(/Invalid numeric value/i);
    });
  });
});
