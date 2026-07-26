import { test, expect } from "@/e2e/fixtures/test";
import { expectNoSeriousAccessibilityViolations } from "@/e2e/support/accessibility";
import { DashboardPage } from "@/e2e/support/pages";
import { expectNoPageOverflow, waitForApiResponse } from "@/e2e/support/waits";

test("global search is keyboard-operable and navigates grouped results", async ({ authenticatedPage: page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  await page.keyboard.press("Control+K");
  const search = page.getByRole("dialog").getByRole("searchbox", { name: "Search workspace" });
  await expect(search).toBeFocused();
  await waitForApiResponse(page, "GET", "/projects", () => search.fill("Atlas"));
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Atlas Launch/ })).toBeVisible();

  await search.press("Tab");
  await expect(page.getByRole("button", { name: /^Atlas Retail\b/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/customers\//);
});

test("light and dark themes persist across navigation", async ({ authenticatedPage: page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  await page.getByRole("button", { name: "Use dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("button", { name: "Use light mode" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("responsive shell and document navigation avoid page overflow @mobile", async ({ page, workspace }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await workspace.authenticate(page, "admin");
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await expectNoPageOverflow(page);

  await page.getByRole("button", { name: "Open navigation" }).click();
  const navigation = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(navigation).toBeVisible();
  await waitForApiResponse(page, "GET", "/documents", () =>
    navigation.getByRole("link", { name: "Documents" }).click(),
  );
  await expect(page.getByRole("button", { name: "Open folders" })).toBeVisible();
  await expectNoPageOverflow(page);
});

test("critical public and protected surfaces have no serious WCAG violations", async ({ page, workspace }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  await workspace.authenticate(page, "admin");
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await expectNoSeriousAccessibilityViolations(page);

  await waitForApiResponse(page, "GET", "/projects", () => page.goto("/projects"));
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});
