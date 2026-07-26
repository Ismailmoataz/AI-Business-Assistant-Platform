import { test, expect } from "@/e2e/fixtures/test";
import { AuthPage, DashboardPage } from "@/e2e/support/pages";
import { waitForApiResponse } from "@/e2e/support/waits";

test("login reaches the protected dashboard @cross-browser", async ({ page, workspace }) => {
  const auth = new AuthPage(page);
  await auth.goto();
  await auth.signIn(workspace.accounts.admin);
  await expect(page.getByRole("heading", { name: "Welcome back, Ada." })).toBeVisible();
  await expect(page.getByLabel("Current workspace: Northstar Labs")).toBeVisible();
});

test("logout clears the persisted session", async ({ authenticatedPage: page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  await page.getByRole("button", { name: /Ada Admin/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("ba-session") ?? "{}").state?.tokens ?? null)).toBeNull();
});

test("session survives a full reload", async ({ authenticatedPage: page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  await waitForApiResponse(page, "GET", "/dashboard/overview", () => page.reload());

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Welcome back, Ada." })).toBeVisible();
});

test("protected routes redirect anonymous visitors", async ({ page }) => {
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
