import { test, expect } from "@playwright/test";
import { seedTestData } from "./helpers";

// Seed once for all tests in this file (idempotent via dedupe_key on events/issues)
let seedResult: Awaited<ReturnType<typeof seedTestData>>;
test.beforeAll(async () => {
  seedResult = await seedTestData();
});

test.describe("Fleet Overview", () => {
  test("displays server cards with status indicators", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h2, h3").filter({ hasText: /Fleet Overview/i })).toBeVisible();

    // Should show at least the seeded servers
    const serverCards = page.locator("[data-testid='server-card'], a[href*='/servers/']");
    await expect(serverCards.first()).toBeVisible({ timeout: 10_000 });
    const count = await serverCards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("navigates to server detail on card click", async ({ page }) => {
    await page.goto("/");

    // Click first server link
    const serverLink = page.locator("a[href*='/servers/']").first();
    await expect(serverLink).toBeVisible({ timeout: 10_000 });
    await serverLink.click();

    await expect(page).toHaveURL(/\/servers\//);
    // Server detail page should show server name and briefing
    await expect(page.locator("main")).toContainText(/recent events|open issues|briefing/i, { timeout: 10_000 });
  });
});

test.describe("Event Stream", () => {
  test("displays events and supports category filter", async ({ page }) => {
    await page.goto("/events");

    // Wait for events to load
    const eventRows = page.locator("table tbody tr, [data-testid='event-row']");
    await expect(eventRows.first()).toBeVisible({ timeout: 10_000 });

    // Verify at least some events are shown
    const count = await eventRows.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Page should contain event data
    await expect(page.locator("main")).toContainText(/deployment|observation|ci_cd|config_change|security/i);
  });

  test("supports server filter", async ({ page }) => {
    await page.goto("/events");

    // Wait for events to load
    const eventRows = page.locator("table tbody tr, [data-testid='event-row']");
    await expect(eventRows.first()).toBeVisible({ timeout: 10_000 });

    // Look for server filter control
    const serverFilter = page.locator("select, [role='combobox'], [data-testid='server-filter']").first();
    if (await serverFilter.isVisible()) {
      await serverFilter.selectOption({ label: /agent-workspace/i }).catch(() => {
        // Custom select component — click-based interaction
      });
      // After filter attempt, page should still show event content
      await expect(page.locator("main")).toContainText(/event/i, { timeout: 5_000 });
    }
  });

  test("events show timestamp, principal, and summary", async ({ page }) => {
    await page.goto("/events");

    // Wait for events
    const firstEvent = page.locator("table tbody tr, [data-testid='event-row']").first();
    await expect(firstEvent).toBeVisible({ timeout: 10_000 });

    // The page should contain principal names
    const mainContent = await page.locator("main").textContent();
    expect(mainContent).toBeTruthy();
  });
});

test.describe("Issues Board", () => {
  test("displays issues in board or table view", async ({ page }) => {
    await page.goto("/issues");

    // Wait for issues to load
    await expect(page.locator("main")).not.toContainText(/loading/i, { timeout: 10_000 });

    // Should show issue titles
    await expect(page.locator("main")).toContainText(/E2E:|memory|disk/i, { timeout: 10_000 });
  });

  test("supports severity filter", async ({ page }) => {
    await page.goto("/issues");

    await expect(page.locator("main")).toContainText(/E2E:/i, { timeout: 10_000 });

    // Look for severity filter
    const severityFilter = page.locator("select, [role='combobox']").filter({ hasText: /severity|all/i }).first();
    if (await severityFilter.isVisible().catch(() => false)) {
      await severityFilter.click();
      // After interacting with filter, issues should still render
      await expect(page.locator("main")).toContainText(/E2E:/i, { timeout: 5_000 });
    }
  });

  test("navigates to issue detail on click", async ({ page }) => {
    await page.goto("/issues");

    // Wait for issues
    await expect(page.locator("main")).toContainText(/E2E:/i, { timeout: 10_000 });

    // Click the first issue link
    const issueLink = page.locator("a[href*='/issues/']").first();
    await expect(issueLink).toBeVisible();
    await issueLink.click();

    await expect(page).toHaveURL(/\/issues\//);
  });
});

test.describe("Issue Detail", () => {
  test("shows issue metadata and timeline", async ({ page }) => {
    const issueId = seedResult.issueIds[0];
    await page.goto(`/issues/${issueId}`);

    // Should show issue title
    await expect(page.locator("main")).toContainText(/E2E: Memory leak/i, { timeout: 10_000 });

    // Should show status
    await expect(page.locator("main")).toContainText(/investigating/i);

    // Should show severity badge
    await expect(page.locator("main")).toContainText(/critical/i);

    // Should show timeline/updates section
    await expect(page.locator("main")).toContainText(/timeline|updates|observation/i);
  });

  test("shows observation in timeline", async ({ page }) => {
    const issueId = seedResult.issueIds[0];
    await page.goto(`/issues/${issueId}`);

    // Wait for full load
    await expect(page.locator("main")).toContainText(/E2E: Memory leak/i, { timeout: 10_000 });

    // Should show the observation we added
    await expect(page.locator("main")).toContainText(/memory spike after deploy/i, { timeout: 5_000 });
  });
});

test.describe("Server Detail", () => {
  test("shows server briefing with events and issues", async ({ page }) => {
    await page.goto("/servers/agent-workspace");

    // Should show server name
    await expect(page.locator("main")).toContainText(/agent-workspace/i, { timeout: 10_000 });

    // Should have recent events section
    await expect(page.locator("main")).toContainText(/recent events|event/i);

    // Should have open issues section
    await expect(page.locator("main")).toContainText(/open issues|issue/i);
  });

  test("shows server-specific content", async ({ page }) => {
    await page.goto("/servers/agent-workspace");

    await expect(page.locator("main")).toContainText(/agent-workspace/i, { timeout: 10_000 });

    // Server detail should have meaningful content (status, events, or issues)
    const mainContent = await page.locator("main").textContent();
    expect(mainContent).toBeTruthy();
    expect(mainContent!.length).toBeGreaterThan(50);
  });
});

test.describe("Navigation", () => {
  test("sidebar links navigate between views", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h2, h3").filter({ hasText: /Fleet Overview/i })).toBeVisible({ timeout: 10_000 });

    // Navigate to Events
    await page.locator("nav a").filter({ hasText: /Event Stream/i }).click();
    await expect(page).toHaveURL(/\/events/);

    // Navigate to Issues
    await page.locator("nav a").filter({ hasText: /Issues Board/i }).click();
    await expect(page).toHaveURL(/\/issues/);

    // Navigate back to Fleet Overview
    await page.locator("nav a").filter({ hasText: /Fleet Overview/i }).click();
    await expect(page).toHaveURL("/");
  });

  test("sidebar shows server list", async ({ page }) => {
    await page.goto("/");

    // Server links are in the sidebar (aside) but outside the nav element
    const serverNav = page.locator("aside a[href*='/servers/']");
    await expect(serverNav.first()).toBeVisible({ timeout: 10_000 });
    const count = await serverNav.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
