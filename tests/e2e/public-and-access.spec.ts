import { expect, test } from "@playwright/test";

// Runs against any environment (seeded or empty). No credentials needed.

test("homepage shows branding and job search", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "MaverickInnogarage" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("MaverickInnogarage");
  await page.getByLabel("Job title or skill").fill("Java");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/jobs\?q=Java/);
});

test("job listings show ID, location, posted date; details page offers sign-in to apply", async ({ page }) => {
  await page.goto("/jobs");
  const first = page.locator("article").first();
  test.skip(!(await first.count()), "No published jobs in this environment");
  await expect(first.getByText(/MIG-JOB-\d{6}/)).toBeVisible();
  await expect(first.getByText(/Posted [A-Z][a-z]{2} \d{1,2}, \d{4}/)).toBeVisible();
  await first.getByRole("link").first().click();
  await expect(page.getByText("Job overview")).toBeVisible();
  await expect(page.getByText("Posted", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to Apply" }).first()).toBeVisible();
});

test("protected areas redirect anonymous visitors to the right login", async ({ page }) => {
  await page.goto("/admin/jobs");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/candidate/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("documents and cron endpoints refuse anonymous access", async ({ request }) => {
  const doc = await request.get("/api/documents/3f1c2b8e-5d4a-4c6b-9e7f-1a2b3c4d5e6f", { maxRedirects: 0 });
  expect([403, 404]).toContain(doc.status());
  const cron = await request.get("/api/cron/cleanup-uploads");
  expect(cron.status()).toBe(401);
});

test("registration validates input", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("First name is required")).toBeVisible();
  await page.fill("#password", "short");
  await page.fill("#confirmPassword", "different");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 10 characters")).toBeVisible();
});
