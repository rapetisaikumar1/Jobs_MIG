import { describe, expect, it } from "vitest";
import { redactHiddenSalary } from "@/modules/jobs/queries";

describe("redactHiddenSalary", () => {
  it("strips compensation from jobs whose salary is not public", () => {
    const job = { id: "j", salaryPublic: false, compensationMin: 90000, compensationMax: 110000 } as never;
    expect(redactHiddenSalary(job)).toMatchObject({ id: "j", compensationMin: null, compensationMax: null });
  });
  it("keeps compensation when the salary is public", () => {
    const job = { salaryPublic: true, compensationMin: 1, compensationMax: 2 } as never;
    expect(redactHiddenSalary(job)).toBe(job);
  });
});
