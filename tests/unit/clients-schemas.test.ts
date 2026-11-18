import { describe, expect, it } from "vitest";
import { clientSchema, EMPTY_CLIENT } from "@/modules/clients/schemas";

describe("client form", () => {
  it("needs only a name; blank optional fields become undefined", () => {
    expect(clientSchema.parse({ ...EMPTY_CLIENT, name: "  Acme Corp  " })).toEqual({
      name: "Acme Corp",
      contactName: undefined,
      contactEmail: undefined,
      contactPhone: undefined,
      website: undefined,
      notes: undefined,
    });
  });

  it("requires a name", () => {
    const result = clientSchema.safeParse({ ...EMPTY_CLIENT, name: "   " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["name"]);
  });

  it("normalizes the contact email and phone", () => {
    const result = clientSchema.parse({ ...EMPTY_CLIENT, name: "Acme", contactEmail: " Jane@Acme.COM ", contactPhone: "(416) 555-0100" });
    expect(result.contactEmail).toBe("jane@acme.com");
    expect(result.contactPhone).toBe("+14165550100");
  });

  it("re-validates already-parsed values (the server parses the client's output again)", () => {
    const once = clientSchema.parse({ ...EMPTY_CLIENT, name: "Acme", contactEmail: "jane@acme.com", contactPhone: "(416) 555-0100", website: "https://acme.com" });
    expect(clientSchema.parse(once)).toEqual(once);
  });

  it("rejects an invalid email, phone or website", () => {
    expect(clientSchema.safeParse({ ...EMPTY_CLIENT, name: "Acme", contactEmail: "not-an-email" }).success).toBe(false);
    expect(clientSchema.safeParse({ ...EMPTY_CLIENT, name: "Acme", contactPhone: "123" }).success).toBe(false);
    for (const website of ["acme.com", "javascript:alert(1)", "ftp://acme.com"]) {
      expect(clientSchema.safeParse({ ...EMPTY_CLIENT, name: "Acme", website }).success).toBe(false);
    }
    expect(clientSchema.parse({ ...EMPTY_CLIENT, name: "Acme", website: "https://acme.com/careers" }).website).toBe("https://acme.com/careers");
  });

  it("limits field lengths", () => {
    expect(clientSchema.safeParse({ ...EMPTY_CLIENT, name: "x".repeat(151) }).success).toBe(false);
    expect(clientSchema.safeParse({ ...EMPTY_CLIENT, name: "Acme", notes: "x".repeat(2001) }).success).toBe(false);
  });
});
