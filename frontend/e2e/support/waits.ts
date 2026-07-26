import { expect, type Page, type Response } from "@playwright/test";

const mockApiOrigin = new URL(
  process.env.E2E_MOCK_API_URL
    ?? `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}`,
).origin;

export async function waitForApiResponse(
  page: Page,
  method: string,
  pathname: string | RegExp,
  action: () => Promise<unknown> | unknown,
  expectOk = true,
): Promise<Response> {
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    const matchesPath = typeof pathname === "string" ? url.pathname === pathname : pathname.test(url.pathname);
    return url.origin === mockApiOrigin
      && response.request().method() === method.toUpperCase()
      && matchesPath;
  }, { timeout: 45_000 });
  await action();
  const response = await responsePromise;
  if (expectOk) {
    expect(response.ok(), `${response.request().method()} ${response.url()} returned ${response.status()}`).toBeTruthy();
  }
  return response;
}

export async function waitForWorkspaceReady(page: Page) {
  await expect(page.locator('[role="status"][aria-label^="Loading"]').filter({ visible: true })).toHaveCount(0);
}

export async function expectToast(page: Page, message: string | RegExp) {
  await expect(page.getByText(message, { exact: typeof message === "string" })).toBeVisible();
}

export async function expectNoPageOverflow(page: Page) {
  await expect.poll(async () => page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))).toEqual({ body: 0, root: 0 });
}
