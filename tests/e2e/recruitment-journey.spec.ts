import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Full journey against a seeded environment with real Supabase Auth and Storage
 * (npm run db:seed with SEED_DEMO_PASSWORD). Provide:
 *   E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD         — an Admin or Super Admin
 *   E2E_CANDIDATE_EMAIL / E2E_CANDIDATE_PASSWORD — a verified portal candidate
 */
const staff = { email: process.env.E2E_STAFF_EMAIL, password: process.env.E2E_STAFF_PASSWORD };
const candidate = { email: process.env.E2E_CANDIDATE_EMAIL, password: process.env.E2E_CANDIDATE_PASSWORD };
test.skip(!staff.email || !staff.password || !candidate.email || !candidate.password, "E2E credentials not configured");
test.describe.configure({ mode: "serial" });

const title = `E2E Kotlin Developer ${Date.now()}`;
let jobUrl = "";
let jobId = "";

async function login(page: Page, who: { email?: string; password?: string }, portal: "staff" | "candidate") {
  await page.goto(portal === "staff" ? "/admin/login" : "/login");
  await page.fill("#email", who.email!);
  await page.fill("#password", who.password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(portal === "staff" ? /\/admin\/jobs/ : /\/candidate\/dashboard/);
}

test("staff creates a job: Job ID and case file are generated", async ({ page }) => {
  await login(page, staff, "staff");
  await page.goto("/admin/jobs/new");
  await page.fill("#title", title);
  await page.fill("#description", "Build Android apps for a Canadian bank.");
  await page.fill("#requiredSkills", "Kotlin");
  await page.keyboard.press("Enter");
  await page.selectOption("#country", "CA");
  await page.selectOption("#state", "ON");
  await page.fill("#city", "Waterloo");
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page).toHaveURL(/\/admin\/jobs\/MIG-JOB-\d{6}\?notice=created/);
  await expect(page.getByText(/case file MIG-CF-\d{6}/)).toBeVisible();
  jobUrl = page.url().split("?")[0];
  jobId = jobUrl.split("/").pop()!;
});

test("staff publishes; job appears publicly with its posted date", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await login(page, staff, "staff");
  await page.goto(jobUrl);
  await page.getByRole("button", { name: "Publish job" }).click();
  await expect(page.getByText("Job status updated.")).toBeVisible();
  await page.goto(`/jobs/${jobId}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const today = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date());
  await expect(page.getByText(today)).toBeVisible();
});

test("candidate applies with a resume, sees it tracked, cannot apply twice or open admin", async ({ page }) => {
  await login(page, candidate, "candidate");
  await page.goto(`/jobs/${jobId}`);
  await page.getByRole("link", { name: "Apply Now" }).first().click();
  await page.getByLabel("Upload a different resume").check();
  await page.setInputFiles("#resume", path.join(__dirname, "fixtures/resume.pdf"));
  await expect(page.getByText("resume.pdf")).toBeVisible();
  await page.fill("#availability", "Two weeks");
  await page.getByRole("button", { name: "Review application" }).click();
  await page.getByText(/I confirm the information/).click();
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByText(/Application submitted — your Application ID is MIG-APP-\d{6}/)).toBeVisible();

  await page.goto("/candidate/applications");
  await expect(page.getByRole("cell", { name: title })).toBeVisible();
  await page.goto(`/jobs/${jobId}`);
  await expect(page.getByText("Already Applied").first()).toBeVisible();
  await page.goto(`/jobs/${jobId}/apply`);
  await expect(page).toHaveURL(new RegExp(`/jobs/${jobId}$`));

  await page.goto("/admin/jobs");
  await expect(page).toHaveURL(/\/admin\/forbidden/);
});

test("the application folder is in the job's case file and staff can open the resume", async ({ page }) => {
  await login(page, staff, "staff");
  await page.goto(`${jobUrl}/case-file`);
  await expect(page.getByText(/MIG-APP-\d{6} — /)).toBeVisible();
  await page.locator("summary").first().click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download" }).first().click();
  expect((await download).suggestedFilename()).toMatch(/resume\.pdf$/);

  await page.getByRole("link", { name: "Application Details" }).first().click();
  await page.selectOption("#status", "UNDER_REVIEW");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("Applied → Under Review")).toBeVisible();
});

test("candidate sees the updated status", async ({ page }) => {
  await login(page, candidate, "candidate");
  await page.goto("/candidate/applications");
  await expect(page.getByRole("row", { name: new RegExp(title) }).getByText("Under Review")).toBeVisible();
});
