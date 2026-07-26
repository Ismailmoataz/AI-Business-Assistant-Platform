import { test, expect } from "@/e2e/fixtures/test";
import { DashboardPage } from "@/e2e/support/pages";
import { waitForApiResponse } from "@/e2e/support/waits";

test("tenant-scoped routes do not disclose foreign records", async ({ page, workspace }) => {
  await workspace.authenticate(page, "admin");
  const response = await waitForApiResponse(
    page,
    "GET",
    `/projects/${workspace.ids.foreignProject}`,
    () => page.goto(`/projects/${workspace.ids.foreignProject}`),
    false,
  );

  expect(response.status()).toBe(404);
  await expect(page.getByText("Project unavailable")).toBeVisible();
  await expect(page.getByText("Foreign Confidential Project")).toHaveCount(0);
});

test("employee permissions restrict management and customer flows", async ({ page, workspace }) => {
  await workspace.authenticate(page, "employee");
  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  await expect(dashboard.quickAction("Create project")).toHaveCount(0);
  await expect(dashboard.quickAction("Add customer")).toHaveCount(0);
  await expect(page.getByText("Customer insights are restricted")).toBeVisible();

  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New project" })).toHaveCount(0);

  const customerResponse = await waitForApiResponse(page, "GET", "/customers", () => page.goto("/customers"), false);
  expect(customerResponse.status()).toBe(403);
  await expect(page.getByText("Customer records are available to managers and administrators.")).toBeVisible();

  await page.goto("/tags");
  await expect(page.getByRole("heading", { name: "Tags" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New tag" })).toHaveCount(0);
});
