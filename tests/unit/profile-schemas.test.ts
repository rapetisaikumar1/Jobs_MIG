import { describe, expect, it } from "vitest";
import { changePasswordSchema, profileDetailsSchema } from "@/modules/profile/schemas";

describe("profile details", () => {
  it("trims names and requires both", () => {
    expect(profileDetailsSchema.parse({ firstName: " Jane ", lastName: " Doe " })).toEqual({ firstName: "Jane", lastName: "Doe" });
    expect(profileDetailsSchema.safeParse({ firstName: "", lastName: "Doe" }).success).toBe(false);
    expect(profileDetailsSchema.safeParse({ firstName: "Jane", lastName: "  " }).success).toBe(false);
  });

  it("accepts only the name (email, roles and status are dropped)", () => {
    const parsed = profileDetailsSchema.parse({ firstName: "Jane", lastName: "Doe", email: "x@y.com", roleIds: ["a"], isActive: false });
    expect(parsed).toEqual({ firstName: "Jane", lastName: "Doe" });
  });
});

describe("change password", () => {
  const valid = { currentPassword: "OldPassw0rd!", password: "NewPassw0rd1", confirmPassword: "NewPassw0rd1" };
  const errorPath = (values: Record<string, string>) => changePasswordSchema.safeParse(values).error?.issues.map((i) => i.path.join("."));

  it("accepts a strong, confirmed new password", () => {
    expect(changePasswordSchema.parse(valid)).toEqual(valid);
  });
  it("requires the current password", () => {
    expect(errorPath({ ...valid, currentPassword: "" })).toContain("currentPassword");
  });
  it("applies the standard password rule to the new password", () => {
    for (const weak of ["short1", "onlyletterslong", "1234567890"]) {
      expect(errorPath({ ...valid, password: weak, confirmPassword: weak })).toContain("password");
    }
  });
  it("requires matching confirmation", () => {
    expect(errorPath({ ...valid, confirmPassword: "Different1x" })).toContain("confirmPassword");
  });
  it("rejects reusing the current password", () => {
    expect(errorPath({ currentPassword: "SamePassw0rd", password: "SamePassw0rd", confirmPassword: "SamePassw0rd" })).toContain("password");
  });
});
