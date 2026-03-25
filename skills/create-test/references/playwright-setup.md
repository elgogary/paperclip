# Playwright Setup for Frappe/ERPNext

## Config

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/system',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:8000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    // Frappe login cookie
    storageState: './tests/system/.auth/admin.json',
  },
  reporter: [['html', { outputFolder: 'tests/system/report' }], ['list']],
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'tests',
      dependencies: ['setup'],
    },
  ],
});
```

## Auth Setup (Login Once, Reuse)

```typescript
// tests/system/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#login_email', process.env.TEST_USER || 'Administrator');
  await page.fill('#login_password', process.env.TEST_PASSWORD || 'admin');
  await page.click('.btn-login');
  await page.waitForURL('/app/home');
  await page.context().storageState({ path: './tests/system/.auth/admin.json' });
});
```

## Monitoring Fixtures

```typescript
// tests/system/fixtures.ts
import { test as base, expect } from '@playwright/test';

type MonitoringFixtures = {
  monitor: {
    errors: string[];
    apiCalls: { method: string; url: string; status: number; duration: number }[];
    assertClean: () => void;
  };
};

export const test = base.extend<MonitoringFixtures>({
  monitor: async ({ page }, use) => {
    const errors: string[] = [];
    const apiCalls: { method: string; url: string; status: number; duration: number }[] = [];

    // Capture browser console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(`CONSOLE: ${msg.text()}`);
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      errors.push(`PAGE ERROR: ${err.message}`);
    });

    // Capture API calls with timing
    const requestTimings = new Map<string, number>();

    page.on('request', req => {
      if (req.resourceType() === 'fetch' || req.resourceType() === 'xhr') {
        requestTimings.set(req.url(), Date.now());
      }
    });

    page.on('response', res => {
      if (res.url().includes('/api/')) {
        const startTime = requestTimings.get(res.url()) || Date.now();
        apiCalls.push({
          method: res.request().method(),
          url: res.url(),
          status: res.status(),
          duration: Date.now() - startTime,
        });
      }
    });

    const assertClean = () => {
      // No unexpected errors
      expect(errors, 'Browser errors detected').toEqual([]);
      // No 5xx responses
      const serverErrors = apiCalls.filter(c => c.status >= 500);
      expect(serverErrors, 'Server errors detected').toEqual([]);
      // No slow requests (>5s)
      const slowRequests = apiCalls.filter(c => c.duration > 5000);
      expect(slowRequests, 'Slow API calls detected').toEqual([]);
    };

    await use({ errors, apiCalls, assertClean });
  },
});

export { expect };
```

## Usage in Tests

```typescript
// tests/system/item-creation.spec.ts
import { test, expect } from './fixtures';

test.describe('Item Creation', () => {
  test('creates item with all required fields', async ({ page, monitor }) => {
    // Navigate
    await page.goto('/app/item/new');
    await page.waitForLoadState('networkidle');

    // Fill form
    await page.fill('[data-fieldname="item_code"] input', 'TEST-ITEM-001');
    await page.fill('[data-fieldname="item_name"] input', 'Test Item');
    await page.click('[data-fieldname="item_group"] .link-btn');
    // ... fill other fields

    // Save
    await page.click('[data-action="primary"]');
    await page.waitForLoadState('networkidle');

    // Assert UI
    await expect(page.locator('.page-title')).toContainText('TEST-ITEM-001');

    // Assert API
    const saveCall = monitor.apiCalls.find(c =>
      c.url.includes('frappe.client.save') && c.status === 200
    );
    expect(saveCall).toBeTruthy();

    // Assert clean (no errors, no 5xx, no slow calls)
    monitor.assertClean();
  });
});
```

## Frappe-Specific Selectors

```typescript
// Common Frappe element selectors
const selectors = {
  // Form fields
  field: (name: string) => `[data-fieldname="${name}"]`,
  input: (name: string) => `[data-fieldname="${name}"] input`,
  select: (name: string) => `[data-fieldname="${name}"] select`,
  check: (name: string) => `[data-fieldname="${name}"] .checkbox`,
  link: (name: string) => `[data-fieldname="${name}"] .link-field input`,
  text: (name: string) => `[data-fieldname="${name}"] .ql-editor`,

  // Buttons
  primaryBtn: '.btn-primary-dark',
  saveBtn: '[data-action="primary"]',
  submitBtn: '.btn-primary[data-action="submit"]',
  cancelBtn: '.btn-default[data-action="cancel"]',
  menuBtn: '.menu-btn-group .btn',

  // Messages
  msgprint: '.msgprint',
  redAlert: '.red',
  greenAlert: '.green',
  indicator: '.indicator-pill',

  // Page elements
  pageTitle: '.page-title .title-text',
  breadcrumb: '.breadcrumb',
  sidebar: '.layout-side-section',
  comment: '.comment-box',

  // List view
  listRow: '.list-row',
  listCheckbox: '.list-row-checkbox',
  filterBtn: '.filter-button',

  // Dialog
  dialog: '.modal-dialog',
  dialogPrimary: '.modal-dialog .btn-primary',
  dialogClose: '.modal-dialog .btn-modal-close',
};
```

## Running System Tests

```bash
# Install Playwright
npx playwright install chromium

# Run all system tests
npx playwright test

# Run specific test
npx playwright test item-creation

# Run with UI (debug mode)
npx playwright test --ui

# Run headed (see browser)
npx playwright test --headed

# Generate report
npx playwright show-report tests/system/report
```

## Frappe Test Site Considerations

- Always use a dedicated test site, never production
- Reset test data before suite: `bench --site test_site reinstall --yes`
- Or use API to create/delete test data in setup/teardown
- Set `TEST_BASE_URL` and `TEST_PASSWORD` in `.env` or CI config
- For CI: use `bench start &` in background before running Playwright
