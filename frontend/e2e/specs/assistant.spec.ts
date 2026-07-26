import { test, expect } from "@/e2e/fixtures/test";
import { AssistantPage } from "@/e2e/support/pages";
import { waitForApiResponse } from "@/e2e/support/waits";

test("creates and continues a conversation with a visible SSE stream", async ({ authenticatedPage: page }) => {
  const assistant = new AssistantPage(page);
  await assistant.goto();
  await assistant.newConversation();

  const firstStream = assistant.send("Explain the Atlas launch policy");
  await expect(page.getByText("Generating", { exact: true }).first()).toBeVisible();
  await firstStream;
  await expect(assistant.messages().getByText("Streaming answer with citations.")).toBeVisible();

  await assistant.send("What should happen next?");
  await expect(assistant.messages().getByText("What should happen next?")).toBeVisible();
  await expect(assistant.messages().getByText("Streaming answer with citations.")).toHaveCount(2);
});

test("suggested questions populate the accessible composer", async ({ authenticatedPage: page }) => {
  const assistant = new AssistantPage(page);
  await assistant.goto();

  await page.getByRole("button", { name: "What should I prioritize this week?" }).click();

  await expect(page.getByLabel("Message Orbit AI")).toHaveValue("What should I prioritize this week?");
  await expect(page.getByLabel("Message Orbit AI")).toBeFocused();
});

test("regenerates an existing answer in place", async ({ authenticatedPage: page, workspace }) => {
  const assistant = new AssistantPage(page);
  await assistant.goto();
  await waitForApiResponse(page, "GET", `/conversations/${workspace.ids.conversation}`, () =>
    assistant.conversation("Launch planning").click(),
  );
  await expect(assistant.messages().getByText("The original launch answer.")).toBeVisible();

  await waitForApiResponse(page, "POST", "/chat/regenerate/stream", () =>
    page.getByRole("button", { name: "Regenerate assistant response" }).click(),
  );

  await expect(assistant.messages().getByText("Regenerated answer in place.")).toBeVisible();
  await expect(assistant.messages().getByText("The original launch answer.")).toHaveCount(0);
});

test("shows source citations and opens sources through the authorized download", async ({ authenticatedPage: page, workspace }) => {
  const assistant = new AssistantPage(page);
  await assistant.goto();
  await waitForApiResponse(page, "GET", `/conversations/${workspace.ids.conversation}`, () =>
    assistant.conversation("Launch planning").click(),
  );

  await page.getByText("Sources (1)", { exact: true }).click();
  await waitForApiResponse(page, "GET", `/documents/${workspace.ids.document}/download`, () =>
    page.getByRole("button", { name: "Open source document Launch policy" }).click(),
  );
});

test("states explicitly when a generated answer has no citations", async ({ authenticatedPage: page }) => {
  const assistant = new AssistantPage(page);
  await assistant.goto();
  await assistant.newConversation();

  await assistant.send("Answer without sources");

  await expect(assistant.messages().getByText("Streaming answer without sources.")).toBeVisible();
  await expect(assistant.messages().getByText("No source citations available.")).toBeVisible();
});

test("conversation history supports message search, rename, and cleanup", async ({ authenticatedPage: page }) => {
  const assistant = new AssistantPage(page);
  await assistant.goto();

  await waitForApiResponse(page, "GET", "/conversations", () =>
    page.getByRole("searchbox", { name: "Search conversations" }).fill("hidden needle"),
  );
  await expect(assistant.conversation("Budget review")).toBeVisible();

  await page.getByRole("button", { name: "Conversation actions for Budget review" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByLabel("Conversation name").fill("Quarterly budget");
  await waitForApiResponse(page, "PATCH", /\/conversations\/.+/, () =>
    page.getByRole("button", { name: "Save" }).click(),
  );
  await expect(assistant.conversation("Quarterly budget")).toBeVisible();

  await page.getByRole("button", { name: "Conversation actions for Quarterly budget" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await waitForApiResponse(page, "DELETE", /\/conversations\/.+/, () =>
    page.getByRole("button", { name: "Delete" }).click(),
  );
  await expect(assistant.conversation("Quarterly budget")).toHaveCount(0);
});
