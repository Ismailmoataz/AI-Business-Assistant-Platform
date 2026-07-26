import { test, expect } from "@/e2e/fixtures/test";
import { DashboardPage } from "@/e2e/support/pages";
import { waitForApiResponse } from "@/e2e/support/waits";

test("executive widgets render authorized live fixture data @cross-browser", async ({ authenticatedPage: page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  await expect(page.getByText("Northstar Labs", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Active projects", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quick actions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My work" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projects" }).last()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Documents" }).last()).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI workspace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
});

test("primary navigation and quick actions open existing workspaces", async ({ authenticatedPage: page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  await waitForApiResponse(page, "GET", "/projects", () => dashboard.openNavigation("Projects"));
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await dashboard.quickAction("Open AI assistant").click();
  await expect(page).toHaveURL(/\/assistant$/);
});

test("dashboard customization persists across reloads", async ({ authenticatedPage: page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  await page.getByRole("button", { name: "Customize dashboard" }).click();
  await page.getByRole("menuitem", { name: /Compact/ }).click();
  await page.getByRole("button", { name: "Collapse My work" }).click();
  await expect(page.getByRole("button", { name: "Expand My work" })).toBeVisible();

  await waitForApiResponse(page, "GET", "/dashboard/overview", () => page.reload());
  await expect(page.getByRole("button", { name: "Expand My work" })).toBeVisible();
});
