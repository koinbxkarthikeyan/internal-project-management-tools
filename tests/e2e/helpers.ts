import { expect, type Page } from "@playwright/test";

export const ADMIN = { name: "Test Admin", email: "test.admin@koinbx.com", password: "Test@Pass123" };

/** Today in the zone the test server runs in (KOINBX_TIMEZONE in playwright.config.ts). */
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder(/you@/).fill(ADMIN.email);
  await page.locator("form button[type=submit]").click();
  await page.locator('input[name="password"]').fill(ADMIN.password);
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL(/overview/);
}

/** Sets up data through the app's own API, as the signed-in person (so a test starts from known data without clicking through every form). */
export async function api<T = unknown>(page: Page, method: "GET" | "POST" | "PATCH" | "DELETE", url: string, data?: unknown): Promise<T> {
  const res = await page.request.post("/api/rpc", { headers: { "x-koinbx-client": "1" }, data: { method, url, data } });
  const body = await res.json();
  if (!res.ok()) throw new Error(`${method} ${url}: ${body?.error?.message ?? res.status()}`);
  return body.data as T;
}
