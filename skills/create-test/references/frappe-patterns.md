# Frappe/ERPNext Test Patterns

## Test Class Base

### v15+ (auto-rollback)
```python
from frappe.tests.utils import FrappeTestCase

class TestMyDocType(FrappeTestCase):
    # FrappeTestCase auto-rollbacks after each test
    # No manual rollback needed

    def setUp(self):
        self.doc = frappe.get_doc({
            "doctype": "My DocType",
            "field": "value"
        }).insert()

    def test_something(self):
        self.assertEqual(self.doc.field, "value")
```

### v14 (manual rollback)
```python
import unittest
import frappe

class TestMyDocType(unittest.TestCase):
    def setUp(self):
        frappe.set_user("Administrator")
        self.doc = frappe.get_doc({
            "doctype": "My DocType",
            "field": "value"
        }).insert()

    def tearDown(self):
        frappe.db.rollback()
        frappe.set_user("Administrator")
```

## Running Tests

```bash
# All tests for a DocType
bench run-tests --doctype "My DocType"

# Specific test file
bench run-tests --module myapp.module.doctype.my_doctype.test_my_doctype

# All tests for app
bench run-tests --app myapp

# With verbose output
bench run-tests --doctype "My DocType" -v

# With failfast (stop on first failure)
bench run-tests --doctype "My DocType" --failfast
```

## Permission Testing

```python
def test_restricted_user_cannot_read(self):
    """Test role-based access"""
    frappe.set_user("restricted@example.com")
    try:
        self.assertRaises(
            frappe.PermissionError,
            frappe.get_doc, "My DocType", self.doc.name
        )
    finally:
        frappe.set_user("Administrator")  # ALWAYS restore

def test_user_with_role_can_read(self):
    """Test permitted access"""
    frappe.set_user("permitted@example.com")
    try:
        doc = frappe.get_doc("My DocType", self.doc.name)
        self.assertEqual(doc.name, self.doc.name)
    finally:
        frappe.set_user("Administrator")
```

## Workflow / Submit Testing

```python
def test_submit_changes_docstatus(self):
    """Test document submission"""
    doc = frappe.get_doc({
        "doctype": "Submittable DocType",
        "field": "value"
    }).insert()

    doc.submit()
    self.assertEqual(doc.docstatus, 1)

    doc.cancel()
    self.assertEqual(doc.docstatus, 2)

def test_amendment(self):
    """Test amend after cancel"""
    doc = frappe.get_doc({...}).insert()
    doc.submit()
    doc.cancel()

    amended = frappe.copy_doc(doc)
    amended.amended_from = doc.name
    amended.insert()
    amended.submit()
    self.assertEqual(amended.docstatus, 1)
```

## Validation Testing

```python
def test_required_field_validation(self):
    """Test that missing required field raises"""
    doc = frappe.get_doc({
        "doctype": "My DocType",
        "required_field": None  # missing
    })
    self.assertRaises(frappe.ValidationError, doc.insert)

def test_custom_validation(self):
    """Test controller validate() logic"""
    doc = frappe.get_doc({
        "doctype": "My DocType",
        "amount": -100  # invalid
    })
    self.assertRaises(frappe.ValidationError, doc.insert)

def test_unique_constraint(self):
    """Test duplicate prevention"""
    frappe.get_doc({"doctype": "My DocType", "code": "ABC"}).insert()
    self.assertRaises(
        frappe.DuplicateEntryError,
        frappe.get_doc({"doctype": "My DocType", "code": "ABC"}).insert
    )
```

## Whitelisted API Testing

```python
def test_whitelisted_method(self):
    """Test @frappe.whitelist() endpoint"""
    from myapp.api import get_items

    # Test with valid args
    result = get_items(filters={"status": "Active"})
    self.assertIsInstance(result, list)
    self.assertTrue(len(result) > 0)

def test_whitelisted_method_permission(self):
    """Test API respects permissions"""
    from myapp.api import admin_only_method

    frappe.set_user("guest@example.com")
    try:
        self.assertRaises(frappe.PermissionError, admin_only_method)
    finally:
        frappe.set_user("Administrator")

def test_whitelisted_method_via_client(self):
    """Test API via frappe.client.get_list equivalent"""
    result = frappe.call(
        "myapp.api.get_items",
        filters={"status": "Active"}
    )
    self.assertIsNotNone(result)
```

## Mocking Patterns

```python
from unittest.mock import patch, MagicMock

# Mock frappe.get_doc
@patch('frappe.get_doc')
def test_with_mocked_doc(self, mock_get_doc):
    mock_doc = MagicMock()
    mock_doc.status = "Active"
    mock_get_doc.return_value = mock_doc

    result = my_function("DocType", "name")
    mock_get_doc.assert_called_once_with("DocType", "name")

# Mock frappe.db.sql
@patch('frappe.db.sql')
def test_with_mocked_db(self, mock_sql):
    mock_sql.return_value = [{"name": "test", "value": 100}]
    result = my_query_function()
    self.assertEqual(result[0]["value"], 100)

# Mock external API call
@patch('myapp.utils.requests.get')
def test_external_api(self, mock_get):
    mock_get.return_value = MagicMock(
        status_code=200,
        json=lambda: {"data": "test"}
    )
    result = fetch_external_data()
    self.assertEqual(result, "test")

# Mock frappe.sendmail
@patch('frappe.sendmail')
def test_email_sent(self, mock_sendmail):
    trigger_notification(self.doc)
    mock_sendmail.assert_called_once()
    args = mock_sendmail.call_args
    self.assertIn("test@example.com", args.kwargs["recipients"])
```

## Hook Testing

```python
def test_doc_event_hook(self):
    """Test hooks.py doc_events trigger correctly"""
    doc = frappe.get_doc({
        "doctype": "Source DocType",
        "field": "value"
    }).insert()

    # After insert, hook should have created related record
    related = frappe.get_all("Target DocType",
        filters={"source": doc.name},
        fields=["name", "status"]
    )
    self.assertEqual(len(related), 1)
    self.assertEqual(related[0]["status"], "Pending")

def test_on_submit_hook(self):
    """Test submit hook side effects"""
    doc = frappe.get_doc({...}).insert()
    doc.submit()

    # Verify hook side effect
    log = frappe.get_last_doc("Activity Log",
        filters={"reference_doctype": "My DocType"}
    )
    self.assertIsNotNone(log)
```

## Child Table Testing

```python
def test_child_table_operations(self):
    """Test parent with child rows"""
    doc = frappe.get_doc({
        "doctype": "Parent DocType",
        "items": [
            {"item_code": "A", "qty": 10},
            {"item_code": "B", "qty": 20},
        ]
    }).insert()

    self.assertEqual(len(doc.items), 2)
    self.assertEqual(doc.items[0].item_code, "A")

    # Test computed total
    self.assertEqual(doc.total_qty, 30)

    # Test adding row
    doc.append("items", {"item_code": "C", "qty": 5})
    doc.save()
    self.assertEqual(len(doc.items), 3)
```

## Test Data Fixtures

```python
# tests/fixtures/test_data.py
def create_test_item(item_code="_Test Item", **kwargs):
    """Reusable test fixture"""
    if frappe.db.exists("Item", item_code):
        return frappe.get_doc("Item", item_code)

    defaults = {
        "doctype": "Item",
        "item_code": item_code,
        "item_name": item_code,
        "item_group": "All Item Groups",
    }
    defaults.update(kwargs)
    return frappe.get_doc(defaults).insert()
```

## Anti-Patterns (Frappe-Specific)

| Wrong | Correct |
|-------|---------|
| `frappe.db.sql("DELETE FROM ...")` in tests | Let FrappeTestCase rollback handle cleanup |
| Testing on production site | Use dedicated test site |
| Not restoring user after `set_user` | Always restore in finally/tearDown |
| Hardcoding document names | Use `_Test` prefix or generate unique names |
| Testing internal Frappe framework behavior | Test YOUR code's behavior |
| Importing test data from CSV in every test | Create fixtures programmatically |
| `time.sleep()` in tests | Use `frappe.utils.now()` or mock time |
