import { expect, type Page } from "@playwright/test";
import type { E2EAccount } from "@/e2e/fixtures/test";
import { waitForApiResponse } from "@/e2e/support/waits";

export class AuthPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/login");
    await expect(this.page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  }

  async signIn(account: E2EAccount) {
    await this.page.getByPlaceholder("you@company.com").fill(account.email);
    await this.page.locator('input[type="password"]').fill(account.password);
    await waitForApiResponse(this.page, "GET", "/users/me", () =>
      this.page.getByRole("button", { name: "Sign in" }).click(),
    );
    await expect(this.page).toHaveURL(/\/dashboard$/);
  }
}

export class DashboardPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await waitForApiResponse(this.page, "GET", "/dashboard/overview", () => this.page.goto("/dashboard"));
    await expect(this.page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  }

  quickAction(name: string) {
    return this.page.getByRole("link", { name: new RegExp(`^${name}`) });
  }

  async openNavigation(name: string) {
    await this.page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name }).click();
  }
}

export class AssistantPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await waitForApiResponse(this.page, "GET", "/conversations", () => this.page.goto("/assistant"));
    await expect(this.page.getByRole("region", { name: "AI conversation workspace" })).toBeVisible();
  }

  async newConversation() {
    const response = await waitForApiResponse(this.page, "POST", "/conversations", () =>
      this.page.getByRole("button", { name: "Start a new conversation" }).click(),
    );
    return (await response.json()) as { id: string };
  }

  async send(message: string) {
    await this.page.getByLabel("Message Orbit AI").fill(message);
    await waitForApiResponse(this.page, "POST", "/chat/stream", () =>
      this.page.getByRole("button", { name: "Send message" }).click(),
    );
  }

  conversation(title: string) {
    return this.page.getByRole("button").filter({
      has: this.page.getByText(title, { exact: true }),
    });
  }

  messages() {
    return this.page.getByRole("log", { name: "Conversation messages" });
  }
}

export class DocumentsPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await waitForApiResponse(this.page, "GET", "/documents", () => this.page.goto("/documents"));
    await expect(this.page.getByRole("heading", { name: "All documents" })).toBeVisible();
  }

  document(name: string) {
    return this.page.getByRole("article", { name: new RegExp(`^${name},`) });
  }

  async search(value: string) {
    await waitForApiResponse(this.page, "GET", "/documents", () =>
      this.page.getByRole("textbox", { name: "Search documents" }).fill(value),
    );
  }
}
