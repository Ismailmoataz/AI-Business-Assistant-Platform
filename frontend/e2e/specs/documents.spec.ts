import path from "node:path";
import { test, expect } from "@/e2e/fixtures/test";
import { DocumentsPage } from "@/e2e/support/pages";
import { expectToast, waitForApiResponse } from "@/e2e/support/waits";

const uploadFixture = path.resolve(process.cwd(), "e2e/fixtures/files/launch-policy.txt");

test("uploads a document and synchronizes its processing lifecycle", async ({ authenticatedPage: page, workspace }) => {
  const documents = new DocumentsPage(page);
  await documents.goto();

  const uploadResponse = await waitForApiResponse(page, "POST", "/documents/upload", () =>
    page.locator('input[type="file"]').setInputFiles(uploadFixture),
  );
  const uploaded = await uploadResponse.json() as { id: string };
  await expectToast(page, "launch-policy.txt uploaded");
  await expect(documents.document("launch-policy.txt")).toContainText("Processing");

  await workspace.setDocumentStatus(uploaded.id, "ready");
  await waitForApiResponse(page, "GET", "/documents", () => page.reload());

  await expect(documents.document("launch-policy.txt")).toContainText("Ready");
});

test("searches and filters seeded documents", async ({ authenticatedPage: page }) => {
  const documents = new DocumentsPage(page);
  await documents.goto();

  await documents.search("Launch policy");
  await expect(documents.document("Launch policy")).toBeVisible();
  await expect(documents.document("Budget worksheet")).toHaveCount(0);

  await page.getByRole("button", { name: "Filter documents" }).click();
  await page.getByRole("menuitem", { name: "company" }).click();
  await expect(documents.document("Launch policy")).toBeVisible();
});

test("previews and downloads through authorized document endpoints", async ({ authenticatedPage: page, workspace }) => {
  const documents = new DocumentsPage(page);
  await documents.goto();
  await documents.document("Launch policy").click();

  await waitForApiResponse(page, "GET", `/documents/${workspace.ids.document}/signed-url`, () =>
    page.getByRole("button", { name: "Preview" }).click(),
  );
  await expect(page.getByTitle("Preview of Launch policy")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("launch-policy.txt");
});

test("favorites remain available in the dedicated document view", async ({ authenticatedPage: page, workspace }) => {
  const documents = new DocumentsPage(page);
  await documents.goto();

  const budget = documents.document("Budget worksheet");
  await waitForApiResponse(page, "POST", `/documents/${workspace.ids.secondaryDocument}/favorite`, () =>
    budget.getByRole("button", { name: "Add to favorites" }).click(),
  );
  await page.getByRole("button", { name: /Favorites/ }).click();

  await expect(documents.document("Budget worksheet")).toBeVisible();
  await expect(documents.document("Launch policy")).toBeVisible();
});
