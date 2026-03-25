# Level Spec Templates

## Level 1: Unit Spec

```
UNIT SPEC: <function_name / ClassName.method_name>
───────────────────────────────────────────────────
File: <path/to/file.py>
Input:  <parameters with types>
Output: <return value with type>
Side effects: <none / DB write / API call / file write>

Test cases:
  1. [happy] <description> → expects <result>
  2. [edge]  empty input → expects <result>
  3. [edge]  null/None input → expects <result>
  4. [edge]  boundary value (max/min/zero) → expects <result>
  5. [error] invalid input → expects <exception>
  6. [error] missing required field → expects <exception>
  7. [prod]  concurrent access → expects <result>
  8. [prod]  large dataset (1000+ items) → expects <result within Nms>

Mocks needed:
  - <dependency> → mock because <reason>
```

### Unit Test Skeleton (Python/Frappe)
```python
import unittest
from unittest.mock import patch, MagicMock
# or: from frappe.tests.utils import FrappeTestCase

class TestFunctionName(unittest.TestCase):
    def setUp(self):
        """Create test fixtures"""
        pass

    def tearDown(self):
        """Clean up"""
        pass

    # Happy path
    def test_happy_path_description(self):
        # Arrange
        input_data = {...}
        # Act
        result = function_name(input_data)
        # Assert
        self.assertEqual(result, expected)

    # Edge case
    def test_empty_input(self):
        result = function_name({})
        self.assertEqual(result, expected_default)

    # Error case
    def test_invalid_input_raises(self):
        with self.assertRaises(ValueError):
            function_name(invalid_data)

    # Production edge case
    @patch('module.external_dependency')
    def test_with_mocked_dependency(self, mock_dep):
        mock_dep.return_value = {...}
        result = function_name(data)
        self.assertEqual(result, expected)
        mock_dep.assert_called_once_with(expected_args)
```

---

## Level 2: Integration Spec

```
INTEGRATION SPEC: <Feature Name>
───────────────────────────────────────────────────
Components involved:
  - <Component A> (role: <what it does>)
  - <Component B> (role: <what it does>)

Real dependencies (NOT mocked):
  - <Component A> ↔ <Component B> (the integration boundary)
  - <Database> (real test DB)

Mocked dependencies (and why):
  - <External API> → mock because <rate limits / cost / flaky>
  - <Email service> → mock because <side effects>

Sub-type: [2a: FE↔FE | 2b: FE↔BE | 2c: BE↔BE | 2d: BE↔DB]

Test cases:
  1. [flow]    data flows from <A> to <B> when <condition>
  2. [flow]    <A> sends request, <B> returns correct response shape
  3. [error]   error from <B> handled gracefully by <A>
  4. [state]   DB state after <action> is <expected>
  5. [contract] request shape matches <B>'s expected input
  6. [contract] response shape matches <A>'s expected output
  7. [rollback] failed operation leaves DB in original state
```

### Integration Test Skeleton (Frappe)
```python
from frappe.tests.utils import FrappeTestCase
import frappe

class TestFeatureIntegration(FrappeTestCase):
    def setUp(self):
        """Create real test documents"""
        self.item = frappe.get_doc({
            "doctype": "Item",
            "item_code": "_Test Item Integration",
            "item_name": "Test Item",
            # ... required fields
        }).insert()

    def test_doctype_a_triggers_hook_in_doctype_b(self):
        """2c: Backend ↔ Backend"""
        # Act: submit DocType A
        self.item.submit()
        # Assert: DocType B was affected
        related = frappe.get_doc("Related DocType", {"item": self.item.name})
        self.assertEqual(related.status, "Updated")

    def test_api_returns_correct_shape(self):
        """2b: Frontend ↔ Backend contract"""
        from myapp.api import get_items
        result = get_items(filters={"item_group": "Test"})
        # Assert response shape
        self.assertIsInstance(result, list)
        self.assertIn("item_code", result[0])
        self.assertIn("item_name", result[0])

    def test_failed_operation_rollbacks(self):
        """2d: Backend ↔ Database rollback"""
        try:
            # Act: operation that should fail
            frappe.get_doc({...}).insert()  # missing required
        except Exception:
            pass
        # Assert: DB unchanged
        count = frappe.db.count("Target DocType", {"source": self.item.name})
        self.assertEqual(count, 0)
```

---

## Level 3: System Spec

```
SYSTEM SPEC: <User Story Title>
───────────────────────────────────────────────────
As a: <user role>
I want to: <action>
So that: <outcome>

Prerequisites:
  - <test data that must exist>
  - <user account with role>
  - <system config>

Scenario 1: <Happy path name>
  Given: <initial state — what's on screen, what's in DB>
  When:  <user action — click, type, navigate>
  Then:  <expected UI state — what user sees>
  And:   <expected API calls — method, status code>
  And:   <expected DB state — records created/updated>
  And:   <no errors in browser console>
  And:   <no errors in server logs>

Scenario 2: <Error path name>
  Given: <initial state>
  When:  <user action that should fail>
  Then:  <error message shown to user>
  And:   <no 500 errors — graceful 4xx>
  And:   <DB unchanged>

Scenario 3: <Edge case name>
  Given: <unusual but valid state>
  When:  <user action>
  Then:  <system handles gracefully>
```

### System Test Skeleton (Playwright)
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature: <User Story>', () => {
  // Monitoring setup
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    const apiCalls: { method: string; url: string; status: number }[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));
    page.on('response', res => {
      if (res.url().includes('/api/')) {
        apiCalls.push({
          method: res.request().method(),
          url: res.url(),
          status: res.status()
        });
      }
    });

    // Store for assertions
    (page as any)._errors = errors;
    (page as any)._apiCalls = apiCalls;
  });

  test.afterEach(async ({ page }) => {
    // Assert no unexpected errors
    const errors = (page as any)._errors;
    expect(errors).toEqual([]);

    // Assert no 5xx responses
    const apiCalls = (page as any)._apiCalls;
    const serverErrors = apiCalls.filter(c => c.status >= 500);
    expect(serverErrors).toEqual([]);
  });

  test('Scenario 1: Happy path', async ({ page }) => {
    // Given
    await page.goto('/app/doctype/new');

    // When
    await page.fill('[data-fieldname="field_name"] input', 'value');
    await page.click('.btn-primary-dark');  // Save

    // Then — UI state
    await expect(page.locator('.msgprint')).toContainText('Saved');

    // Then — API calls
    const apiCalls = (page as any)._apiCalls;
    const saveCall = apiCalls.find(c => c.url.includes('frappe.client.save'));
    expect(saveCall?.status).toBe(200);
  });

  test('Scenario 2: Error path', async ({ page }) => {
    // Given
    await page.goto('/app/doctype/new');

    // When — submit without required fields
    await page.click('.btn-primary-dark');

    // Then — validation error shown
    await expect(page.locator('.frappe-control.has-error')).toBeVisible();
  });
});
```

---

## Spec Completeness Checklist

Before proceeding to implementation, verify all specs cover:

### Level 1
- [ ] Every public function/method has a spec
- [ ] Happy path defined for each
- [ ] At least 1 edge case per function
- [ ] At least 1 error case per function
- [ ] At least 1 production edge case per function
- [ ] Mocks identified with reasons

### Level 2
- [ ] Every integration boundary from diagram has a spec
- [ ] Request/response contracts defined
- [ ] Error propagation across boundaries tested
- [ ] DB state assertions included
- [ ] Rollback scenarios covered

### Level 3
- [ ] Every user-facing scenario has a spec
- [ ] Given/When/Then fully specified
- [ ] API call expectations defined
- [ ] DB state expectations defined
- [ ] Error scenarios included
- [ ] Monitoring assertions (console, API, logs)
