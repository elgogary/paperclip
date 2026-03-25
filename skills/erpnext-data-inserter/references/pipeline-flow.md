# ERPNext Data Inserter — Pipeline Flow

Simplified 3-step flow for inserting data into ERPNext.

## Visual Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              STEP 1: Get Site Connection                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                             │
│  1. "What is your ERPNext site URL?"                                       │
│     → User: https://mycompany.erpnext.com                                  │
│                                                                             │
│  2. "What is your API Key?"                                               │
│     → User: c61a512db39c705:d2208060effff63                                │
│                                                                             │
│  3. Test Connection: GET {site}/api/method/ping                           │
│     → ✓ "Connected successfully!" or ✗ "Failed - check credentials"        │
│                                                                             │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              STEP 2: Get DocType & Schema                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                             │
│  4. "Which DocType do you want to insert data into?"                       │
│     → User: Customer                                                       │
│                                                                             │
│  5. AI calls get_doctype_schema("Customer")                               │
│     → ✓ "Loaded Customer schema with 25 fields"                           │
│                                                                             │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              STEP 3: Get Data & Insert                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                             │
│  6. "Please provide the data to insert:"                                   │
│     → User: name: Acme Corp, email: info@acme.com                         │
│     OR JSON, natural language, Excel file                                  │
│                                                                             │
│  7. AI Auto-Mapping:                                                       │
│     • Parse input data                                                     │
│     • Map to DocType fields from schema                                    │
│     • Show mapping results                                                 │
│                                                                             │
│  8. Dependency Check:                                                      │
│     • Check Link fields (e.g., customer → CUST-00001)                     │
│     • Verify via frappe_list_documents                                     │
│     • If missing: ask to create first, select, or skip                    │
│                                                                             │
│  9. Confirm & Insert:                                                      │
│     • Show final mapping                                                   │
│     • User: "yes"                                                          │
│     • Call frappe_create_document                                         │
│     • Return: "Customer CUST-00001 created"                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Quick Reference Flow

| Step | Question | User Input | AI Action |
|------|----------|------------|-----------|
| 1 | Site URL | `https://site.com` | Ping site |
| 2 | API Key | `key:secret` | Test auth |
| 3 | DocType | `Customer` | Get schema |
| 4 | Data | `name: Acme, email: info@acme.com` | Auto-map |
| 5 | Confirm | `yes` | Insert document |

## Dependency Handling

When a field is a **Link** type (references another DocType):

```
Input: customer = "CUST-00001"
         ↓
    Is this Link field? → Yes
         ↓
    Check if CUST-00001 exists in Customer DocType
         ↓
    ┌────────┴────────┐
    YES               NO
    │                 │
    ✓ Continue        ⚠ Ask user:
                      1. Create Customer first?
                      2. Select existing?
                      3. Skip this field?
```

## Example Session

```
AI: What is your ERPNext site URL?
You: https://accbuilddev.mvpstorm.com

AI: What is your API Key?
You: c61a512db39c705:d2208060effff63

AI: ✓ Connected successfully!

AI: Which DocType do you want to insert data into?
You: Customer

AI: ✓ Loaded Customer schema with 25 fields.

AI: Please provide the data to insert.
You: name: ABC Construction, email: abc@construction.com, type: Commercial

AI: Mapped Fields:
    ✓ name → customer_name
    ✓ email → email_id
    ✓ type → customer_group

    Missing Required Fields:
    ! territory → [All Territories] (default)

    Confirm? (yes/no)
You: yes

AI: ✓ Document Created Successfully
    DocType: Customer
    Name: CUST-00001
    View: https://accbuilddev.mvpstorm.com/app/customer/CUST-00001
```
