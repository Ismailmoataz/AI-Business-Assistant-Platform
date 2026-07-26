import { randomUUID } from "node:crypto";
import { expect, test as base, type APIRequestContext, type Page } from "@playwright/test";
import type { Company, Tokens, User, UserRole } from "@/lib/types/api";

export type E2ERole = UserRole | "outsider";

export interface E2EAccount {
  role: E2ERole;
  email: string;
  password: string;
  user: User;
  company: Company;
  tokens: Tokens;
}

export interface E2ESeed {
  test_id: string;
  accounts: Record<E2ERole, E2EAccount>;
  ids: Record<string, string>;
}

export interface E2EWorkspace extends E2ESeed {
  authenticate(page: Page, role?: E2ERole): Promise<E2EAccount>;
  setDocumentStatus(documentId: string, processingStatus: "uploaded" | "processing" | "ready" | "failed"): Promise<void>;
}

type Fixtures = {
  workspace: E2EWorkspace;
  authenticatedPage: Page;
};

const mockApiURL = process.env.E2E_MOCK_API_URL ?? `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3101}`;

async function persistSession(page: Page, account: E2EAccount) {
  const persisted = JSON.stringify({
    state: {
      tokens: account.tokens,
      user: account.user,
      company: account.company,
    },
    version: 0,
  });
  await page.addInitScript((session) => {
    window.localStorage.setItem("ba-session", session);
  }, persisted);
}

async function seedTestWorkspace(request: APIRequestContext): Promise<E2ESeed> {
  const testId = randomUUID();
  const response = await request.post(`${mockApiURL}/__e2e/seed`, {
    data: { test_id: testId },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<E2ESeed>;
}

export const test = base.extend<Fixtures>({
  workspace: [async ({ request }, provide) => {
    const seed = await seedTestWorkspace(request);
    const workspace: E2EWorkspace = {
      ...seed,
      async authenticate(page, role = "admin") {
        const account = seed.accounts[role];
        await persistSession(page, account);
        return account;
      },
      async setDocumentStatus(documentId, processingStatus) {
        const response = await request.patch(
          `${mockApiURL}/__e2e/state/${encodeURIComponent(seed.test_id)}/documents/${documentId}`,
          { data: { processing_status: processingStatus } },
        );
        expect(response.ok(), await response.text()).toBeTruthy();
      },
    };
    await provide(workspace);
    await request.delete(`${mockApiURL}/__e2e/state/${encodeURIComponent(seed.test_id)}`);
  }, { auto: true }],
  authenticatedPage: async ({ page, workspace }, provide) => {
    await workspace.authenticate(page, "admin");
    await provide(page);
  },
});

export { expect } from "@playwright/test";
