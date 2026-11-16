import { expect, test } from "@playwright/test";
import { api, signIn, today } from "./helpers";

test.describe.configure({ mode: "serial" });

// The first account (made in auth.spec.ts) is the Super Admin, user id 1. Data below is made through the app's own API, so each test starts from known data.
let sprintId: number;
let ownerId: number;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ baseURL: "http://localhost:3100" });
  await signIn(page);
  const owner = await api<{ id: number }>(page, "POST", "/owners", { name: "E2E Owner" });
  const sprint = await api<{ id: number }>(page, "POST", "/sprints", { name: "E2E Sprint", startDate: today() });
  ownerId = owner.id;
  sprintId = sprint.id;
  await page.close();
});

test("creates a backlog item from the form", async ({ page }) => {
  await signIn(page);
  await page.goto("/all-items");
  await page.getByRole("button", { name: /Create backlog/ }).first().click();
  const form = page.getByRole("dialog");
  await form.getByRole("combobox", { name: /Owner/i }).click();
  await form.getByRole("option", { name: "E2E Owner" }).click();
  await form.getByPlaceholder("Short name for the work").fill("E2E created task");
  await form.getByRole("combobox", { name: /Type/i }).click();
  await form.getByRole("option", { name: "Task", exact: true }).click();
  await form.getByRole("combobox", { name: /Sprint/i }).click();
  await form.getByRole("option", { name: /E2E Sprint/ }).click();
  await form.getByRole("button", { name: "Create backlog" }).click();
  await expect(page.getByText("Created E2E created task")).toBeVisible();
});

test("moves a card to In Progress by dragging it on My Task", async ({ page }) => {
  await signIn(page);
  await api(page, "POST", "/items", { title: "E2E card to move", ownerId, sprintId, type: "TASK", assigneeIds: [1], leadId: 1 });
  await page.goto("/my-task?view=board");
  const card = page.getByRole("button", { name: /E2E card to move/ });
  await expect(card).toBeVisible();
  await card.dragTo(page.getByRole("region", { name: /^In Progress/ }));
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Started on it");
  await dialog.getByRole("button", { name: /Move to In progress/i }).click();
  await expect(page.getByRole("region", { name: /^In Progress, 1/ })).toContainText("E2E card to move");
});

test("adds a personal leave day on the Log Work page", async ({ page }) => {
  await signIn(page);
  await page.goto("/my-sprint");
  await page.getByRole("button", { name: /Leave dates/ }).click();
  await page.getByRole("button", { name: "Select days…" }).click();
  // The first day in the calendar that can be picked (weekends, days outside the sprint and taken days are disabled).
  await page.getByRole("dialog").getByRole("button", { disabled: false }).filter({ hasText: /^\d{1,2}$/ }).first().click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Add My Leave" }).click();
  await expect(page.getByText("Leave date added")).toBeVisible();
});
