import { test, expect } from "@/e2e/fixtures/test";
import { expectToast, waitForApiResponse } from "@/e2e/support/waits";
import type { Page } from "@playwright/test";

async function openWorkspace(page: Page, path: string, apiPath: string, heading: string) {
  await waitForApiResponse(page, "GET", apiPath, () => page.goto(path));
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
}

test("projects support CRUD, search, and filtering", async ({ authenticatedPage: page }) => {
  await openWorkspace(page, "/projects", "/projects", "Projects");

  await waitForApiResponse(page, "GET", "/projects", () =>
    page.getByRole("searchbox", { name: "Search projects" }).fill("Atlas"),
  );
  await expect(page.getByRole("link", { name: "Atlas Launch" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Internal Operations" })).toHaveCount(0);

  await page.getByRole("searchbox", { name: "Search projects" }).clear();
  await waitForApiResponse(page, "GET", "/projects", () =>
    page.getByRole("combobox", { name: "Filter by status" }).selectOption("planning"),
  );
  await expect(page.getByRole("link", { name: "Internal Operations" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();

  await page.getByRole("button", { name: "New project" }).click();
  await page.getByRole("dialog").getByLabel("Project name").fill("E2E Delivery");
  await page.getByRole("dialog").getByLabel("Description").fill("Created by the isolated Playwright workspace.");
  await page.getByRole("dialog").getByLabel("Status").selectOption("active");
  const createResponse = await waitForApiResponse(page, "POST", "/projects", () =>
    page.getByRole("dialog").getByRole("button", { name: "Create project" }).click(),
  );
  const project = await createResponse.json() as { id: string };
  await expectToast(page, "Project created");
  await expect(page.getByRole("link", { name: "E2E Delivery" })).toBeVisible();

  await waitForApiResponse(page, "GET", `/projects/${project.id}`, () =>
    page.getByRole("link", { name: "E2E Delivery" }).click(),
  );
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Project name").fill("E2E Delivery Updated");
  await waitForApiResponse(page, "PATCH", `/projects/${project.id}`, () =>
    page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click(),
  );
  await expect(page.getByRole("heading", { name: "E2E Delivery Updated" })).toBeVisible();

  await page.getByRole("button", { name: "Delete project" }).click();
  await waitForApiResponse(page, "DELETE", `/projects/${project.id}`, () =>
    page.getByRole("dialog").getByRole("button", { name: "Delete" }).click(),
  );
  await expect(page).toHaveURL(/\/projects$/);
});

test("tasks support assignment, CRUD, Kanban status, comments, and filters", async ({ authenticatedPage: page }) => {
  await openWorkspace(page, "/tasks", "/tasks", "Tasks");
  await page.getByRole("button", { name: "New task" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project").selectOption({ label: "Atlas Launch" });
  await dialog.getByLabel("Task title").fill("Coordinate E2E launch");
  await dialog.getByLabel("Description").fill("Exercise task assignment and comments.");
  await dialog.getByLabel("Assignee").selectOption({ label: "Eli Employee" });
  await dialog.getByRole("combobox", { name: "Priority" }).selectOption("urgent");
  const createResponse = await waitForApiResponse(page, "POST", "/tasks", () =>
    dialog.getByRole("button", { name: "Create task" }).click(),
  );
  const task = await createResponse.json() as { id: string };
  await expectToast(page, "Task created");

  const status = page.getByRole("combobox", { name: "Move Coordinate E2E launch to another status" });
  await waitForApiResponse(page, "PATCH", `/tasks/${task.id}`, () => status.selectOption("review"));
  await expectToast(page, "Task status updated");

  await waitForApiResponse(page, "GET", `/tasks/${task.id}`, () =>
    page.getByRole("link", { name: "Coordinate E2E launch" }).click(),
  );
  await page.getByLabel("Add a comment").fill("The assignment and status are verified.");
  await waitForApiResponse(page, "POST", `/tasks/${task.id}/comments`, () =>
    page.getByRole("button", { name: "Comment" }).click(),
  );
  await expect(page.getByText("The assignment and status are verified.")).toBeVisible();

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog.getByLabel("Task title").fill("Coordinate E2E launch updated");
  await waitForApiResponse(page, "PATCH", `/tasks/${task.id}`, () =>
    dialog.getByRole("button", { name: "Save changes" }).click(),
  );
  await expect(page.getByRole("heading", { name: "Coordinate E2E launch updated" })).toBeVisible();

  await page.getByRole("button", { name: "Delete task" }).click();
  await waitForApiResponse(page, "DELETE", `/tasks/${task.id}`, () =>
    page.getByRole("dialog").getByRole("button", { name: "Delete" }).click(),
  );
  await expect(page).toHaveURL(/\/tasks$/);
  await waitForApiResponse(page, "GET", "/tasks", () =>
    page.getByRole("combobox", { name: "Filter by status" }).selectOption("done"),
  );
  await expect(page.getByRole("link", { name: "Archive legacy checklist" })).toBeVisible();
});

test("customers support lifecycle CRUD", async ({ authenticatedPage: page }) => {
  await openWorkspace(page, "/customers", "/customers", "Customers");
  await page.getByRole("button", { name: "New customer" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Customer name").fill("E2E Customer");
  await dialog.getByLabel("Status").selectOption("prospect");
  await dialog.getByLabel("Contact name").fill("Taylor Test");
  await dialog.getByLabel("Email").fill("taylor@example.test");
  const createResponse = await waitForApiResponse(page, "POST", "/customers", () =>
    dialog.getByRole("button", { name: "Create customer" }).click(),
  );
  const customer = await createResponse.json() as { id: string };
  await expect(page.getByRole("link", { name: "E2E Customer" })).toBeVisible();

  await waitForApiResponse(page, "GET", `/customers/${customer.id}`, () =>
    page.getByRole("link", { name: "E2E Customer" }).click(),
  );
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog.getByLabel("Customer name").fill("E2E Customer Updated");
  await waitForApiResponse(page, "PATCH", `/customers/${customer.id}`, () =>
    dialog.getByRole("button", { name: "Save changes" }).click(),
  );
  await expect(page.getByRole("heading", { name: "E2E Customer Updated" })).toBeVisible();

  await waitForApiResponse(page, "PATCH", `/customers/${customer.id}`, () =>
    page.getByRole("button", { name: "Archive" }).click(),
  );
  await expectToast(page, "Customer archived");
  await page.getByRole("button", { name: "Delete customer" }).click();
  await waitForApiResponse(page, "DELETE", `/customers/${customer.id}`, () =>
    page.getByRole("dialog").getByRole("button", { name: "Delete" }).click(),
  );
  await expect(page).toHaveURL(/\/customers$/);
});

test("employee directory supports search, filtering, and authorized profile updates", async ({ authenticatedPage: page }) => {
  await openWorkspace(page, "/employees", "/employees", "Employees");
  await waitForApiResponse(page, "GET", "/employees", () =>
    page.getByRole("searchbox", { name: "Search employees" }).fill("Eli"),
  );
  await expect(page.getByRole("link", { name: "Eli Employee" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search employees" }).clear();
  await waitForApiResponse(page, "GET", "/employees", () =>
    page.getByRole("combobox", { name: "Filter by role" }).selectOption("employee"),
  );

  await waitForApiResponse(page, "GET", /\/employees\/.+/, () =>
    page.getByRole("link", { name: "Eli Employee" }).click(),
  );
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByRole("dialog").getByLabel("Job title").fill("Senior Product Analyst");
  await waitForApiResponse(page, "PATCH", /\/employees\/.+/, () =>
    page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click(),
  );
  await expect(page.getByText(/Senior Product Analyst/)).toBeVisible();
});

test("notes support Markdown CRUD and search", async ({ authenticatedPage: page }) => {
  await openWorkspace(page, "/notes", "/notes", "Notes");
  await page.getByRole("button", { name: "New note" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("E2E release note");
  await dialog.getByLabel("Note", { exact: true }).fill("## Verified\n\nThe **browser flow** is deterministic.");
  const createResponse = await waitForApiResponse(page, "POST", "/notes", () =>
    dialog.getByRole("button", { name: "Create note" }).click(),
  );
  const note = await createResponse.json() as { id: string };

  await waitForApiResponse(page, "GET", "/notes", () =>
    page.getByRole("searchbox", { name: "Search notes" }).fill("release note"),
  );
  await waitForApiResponse(page, "GET", `/notes/${note.id}`, () =>
    page.getByRole("link", { name: /E2E release note/ }).click(),
  );
  await expect(page.getByRole("heading", { name: "Verified" })).toBeVisible();

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog.getByLabel("Title").fill("E2E release note updated");
  await waitForApiResponse(page, "PATCH", `/notes/${note.id}`, () =>
    dialog.getByRole("button", { name: "Save changes" }).click(),
  );
  await expect(page.getByRole("heading", { name: "E2E release note updated" })).toBeVisible();

  await page.getByRole("button", { name: "Delete note" }).click();
  await waitForApiResponse(page, "DELETE", `/notes/${note.id}`, () =>
    page.getByRole("dialog").getByRole("button", { name: "Delete" }).click(),
  );
  await expect(page).toHaveURL(/\/notes$/);
});

test("tags support reusable-label CRUD and search", async ({ authenticatedPage: page }) => {
  await openWorkspace(page, "/tags", "/tags", "Tags");
  await page.getByRole("button", { name: "New tag" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tag name").fill("E2E Verified");
  const createResponse = await waitForApiResponse(page, "POST", "/tags", () =>
    dialog.getByRole("button", { name: "Create tag" }).click(),
  );
  const tag = await createResponse.json() as { id: string };

  await waitForApiResponse(page, "GET", "/tags", () =>
    page.getByRole("searchbox", { name: "Search tags" }).fill("E2E"),
  );
  await expect(page.getByRole("link", { name: "E2E Verified" })).toBeVisible();
  await page.getByRole("button", { name: "Edit E2E Verified" }).click();
  await dialog.getByLabel("Tag name").fill("E2E Verified Updated");
  await waitForApiResponse(page, "PATCH", `/tags/${tag.id}`, () =>
    dialog.getByRole("button", { name: "Save changes" }).click(),
  );
  await expect(page.getByRole("link", { name: "E2E Verified Updated" })).toBeVisible();

  await page.getByRole("button", { name: "Delete E2E Verified Updated" }).click();
  await waitForApiResponse(page, "DELETE", `/tags/${tag.id}`, () =>
    page.getByRole("dialog").getByRole("button", { name: "Delete" }).click(),
  );
  await expect(page.getByRole("link", { name: "E2E Verified Updated" })).toHaveCount(0);
});
