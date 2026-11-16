import { expect, test } from "@playwright/test";
import { ADMIN, signIn } from "./helpers";

// One empty app, one account made by the test itself: the first visit creates the first Super Admin.
test.describe.configure({ mode: "serial" });

test("the first visit creates the first account and signs in", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Full name").fill(ADMIN.name);
  await page.getByPlaceholder(/you@/).fill(ADMIN.email);
  await page.locator('input[name="new-password"]').fill(ADMIN.password);
  await page.locator('input[name="confirm-password"]').fill(ADMIN.password);
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL(/overview/);
});

test("signing out returns to the sign-in page, and the account signs in again", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).not.toHaveURL(/overview/); // signed out: back at the start page, which asks for the email
  await signIn(page);
});
