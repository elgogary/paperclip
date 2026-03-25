---
name: erpnext-data-inserter
description: Universal ERPNext/Frappe data inserter. Works with any site - auto-detects installed apps, DocTypes, and fields. Smart field mapping with dependency handling.
argument-hint: "data_input"
user-invocable: true
---

## Input
Target: $ARGUMENTS

Accepted inputs:
- Key-value pairs (e.g., "name: Acme Corp, email: info@acme.com")
- JSON object
- Natural language description
- Excel/CSV file path

---

## Preflight (MANDATORY — START HERE)

### Step 0 — Requirements & Planning (Ask FIRST!)
**Ask user BEFORE connecting to site:**

1. **What industry is this site for?**
   - Construction
   - Manufacturing
   - Retail/E-commerce
   - Services/Consulting
   - Healthcare
   - Education
   - Restaurant/Food
   - Other: [specify]

2. **How many records do you need to insert?**
   - Single record (just one now)
   - Small batch: 10-50 records
   - Medium batch: 50-200 records
   - Large batch: 200-1000 records
   - Custom: [specify number]

3. **Data language preference?**
   - English only
   - Arabic only
   - Bilingual (both English and Arabic)

4. **Which DocTypes need data?** (Multi-select - choose all that apply)
   - After connecting, show available DocTypes grouped by module
   - User selects all DocTypes to populate
   - Example: "Customer, Item, Sales Invoice, Project, Lead"

**Save these settings for the session** - use for all subsequent inserts.

### Step 1 — Site Connection
**Ask user:**

1. **Site URL:** "What is your ERPNext site URL?"
2. **API Key:** "What is your API Key? (format: api_key:api_secret)"
3. **Test Connection & Analyze Site:**
   - Ping: `GET {site}/api/method/ping`
   - Get installed apps: `GET {site}/api/method/frappe.get_installed_apps`
   - Get all DocTypes: `GET {site}/api/v2/docType`
   - **GitHub App Discovery:** For each installed app (except frappe/erpnext/hrms):
     - Search GitHub: `https://github.com/search?q={app_name}+frappe+app`
     - Find official or most relevant repo
     - Extract: repo URL, stars, last updated
   - **Show site summary:**
     ```
     ╔════════════════════════════════════════════════════════╗
     ║         ERPNext Data Inserter - Site Analysis          ║
     ╠════════════════════════════════════════════════════════╣
     ║ Site: https://mysite.erpnext.com                      ║
     ║ Version: Frappe v15.32.2, ERPNext v15.31.0            ║
     ╠════════════════════════════════════════════════════════╣
     ║ Installed Apps (from GitHub):                         ║
     ║ • Frappe Framework                                     ║
     ║   → github.com/frappe/frappe                          ║
     ║ • ERPNext                                              ║
     ║   → github.com/frappe/erpnext                         ║
     ║ • {Custom App 1} ⭐ 123                               ║
     ║   → github.com/org/{app1}                             ║
     ║ • {Custom App 2} ⭐ 45                               ║
     ║   → github.com/org/{app2} (not found, skip)           ║
     ╠════════════════════════════════════════════════════════╣
     ║ Total DocTypes: 245                                  ║
     ║ Custom DocTypes: 18 (from custom apps)               ║
     ╚════════════════════════════════════════════════════════╝

     Ready to insert data into any DocType.
     ```

4. **Optional: Fetch Custom DocType Structures**
   - Ask: "Want to fetch custom DocType definitions from GitHub repos? (yes/no)"
   - If yes: For each custom app repo, fetch:
     - `/{app_name}/{app_name}/doctype/` folder structure
     - List all custom DocTypes with their JSON schemas
   - Store in session memory for field mapping

### Step 2 — DocType Multi-Select & Grouping
**After site connection, show available DocTypes grouped by module:**

5. **Display DocTypes by Module:**
   ```
   ╔════════════════════════════════════════════════════════╗
   ║              Select DocTypes to Populate               ║
   ╠════════════════════════════════════════════════════════╣
   ║ 📁 Core                                                ║
   ║   [ ] User                                             ║
   ║   [ ] Role                                             ║
   ║   [ ] File                                             ║
   ╠════════════════════════════════════════════════════════╣
   ║ 📁 Selling                                             ║
   ║   [ ] Customer                                         ║
   ║   [ ] Customer Group                                   ║
   ║   [ ] Territory                                        ║
   ║   [ ] Sales Invoice                                    ║
   ╠════════════════════════════════════════════════════════╣
   ║ 📁 Stock                                               ║
   ║   [ ] Item                                             ║
   ║   [ ] Item Group                                       ║
   ║   [ ] UOM                                              ║
   ║   [ ] Warehouse                                        ║
   ╠════════════════════════════════════════════════════════╣
   ║ 📁 Buying                                              ║
   ║   [ ] Supplier                                         ║
   ║   [ ] Purchase Order                                   ║
   ╠════════════════════════════════════════════════════════╣
   ║ 📁 {Custom App Module}                                 ║
   ║   [ ] Custom DocType 1                                 ║
   ║   [ ] Custom DocType 2                                 ║
   ╚════════════════════════════════════════════════════════╝

   Type DocType names to select (comma-separated):
   Example: Customer, Item, Sales Invoice
   ```

6. **Analyze Dependencies & Generate Insert Plan:**
   - For each selected DocType:
     - Fetch schema via `get_doctype_schema()`
     - Extract: Link fields (dependencies), required fields, child tables
     - Check if dependency DocTypes exist in selected list
   - **Sort by dependency order** (independent first, dependent last)
   - **Generate Insert Plan Report**

### Step 3 — Insert Plan Report

**Show detailed insert plan:**

```
╔════════════════════════════════════════════════════════╗
║            DATA INSERT PLAN & QA REPORT                 ║
╠════════════════════════════════════════════════════════╣
║ Target Site: https://mysite.erpnext.com                ║
║ Industry: Construction                                 ║
║ Records to Insert: 150 total                           ║
║ Language: Bilingual (English + Arabic)                 ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║ 📋 INSERT ORDER (by dependency):                       ║
║                                                        ║
║ 1️⃣  UOM (Unit of Measure)                              ║
║    → Records: 10                                       ║
║    → Fields: 2 (name, must_be_whole_number)            ║
║    → Dependencies: NONE ✓                              ║
║    → Status: READY                                     ║
║                                                        ║
║ 2️⃣  Item Group                                         ║
║    → Records: 25                                       ║
║    → Fields: 4 (item_group_name, is_group, parent...)  ║
║    → Dependencies: NONE ✓                              ║
║    → Status: READY                                     ║
║                                                        ║
║ 3️⃣  Item                                               ║
║    → Records: 50                                       ║
║    → Fields: 15 (item_code, item_name, item_group...)  ║
║    → Dependencies:                                     ║
║      • item_group → Item Group ✓ (in plan)            ║
║      • stock_uom → UOM ✓ (in plan)                    ║
║    → Status: READY (after 1,2)                         ║
║                                                        ║
║ 4️⃣  Customer                                           ║
║    → Records: 30                                       ║
║    → Fields: 12 (customer_name, customer_group...)     ║
║    → Dependencies:                                     ║
║      • customer_group → Customer Group ❌ (NOT selected)
║    → Status: NEEDS INPUT or SKIP                       ║
║                                                        ║
║ 5️⃣  Sales Invoice                                      ║
║    → Records: 35                                       ║
║    → Dependencies:                                     ║
║      • customer → Customer ✓ (in plan)                 ║
║      • items → Item ✓ (in plan)                        ║
║      • debit_to → Account ❌ (NOT selected)            ║
║    → Status: NEEDS INPUT (Account)                     ║
║                                                        ║
╠════════════════════════════════════════════════════════╣
║ 📊 SUMMARY                                             ║
║                                                        ║
║ • Total DocTypes: 5                                   ║
║ • Ready to Insert: 3 (UOM, Item Group, Item)          ║
║ • Needs Input: 2 (Customer, Sales Invoice)            ║
║ • Missing Dependencies:                               ║
║   - Customer Group (for Customer)                      ║
║   - Account (for Sales Invoice)                        ║
║                                                        ║
╠════════════════════════════════════════════════════════╣
║ ❓ ACTIONS                                             ║
║                                                        ║
║ 1. Add missing DocTypes to plan? (yes/no)              ║
║ 2. Proceed with ready DocTypes only? (yes/no)          ║
║ 3. Skip problematic DocTypes? (yes/no)                 ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
```

### Step 4 — Insert Execution

7. **For each DocType in insert order:**
   - Show current DocType being processed
   - Ask: "Provide data for {DocType} or press Enter for sample data"
   - Parse input (key-value, JSON, or file path)
   - Auto-map fields to schema
   - **Show field mapping preview:**
     ```
     Mapped: ✓ name → uom_name
     Mapped: ✓ whole → must_be_whole_number
     Missing: ! [Ask or use default]
     ```
   - Confirm and insert via `frappe_create_document`
   - Track success/failure

8. **Generate Final Insert Report:**
   ```
   ╔════════════════════════════════════════════════════════╗
   ║              INSERT COMPLETION REPORT                  ║
   ╠════════════════════════════════════════════════════════╣
   ║ Site: https://mysite.erpnext.com                      ║
   ║ Date: 2026-03-11 14:30:00                            ║
   ╠════════════════════════════════════════════════════════╣
   ║                                                        ║
   ║ ✅ SUCCESSFUL:                                        ║
   ║ • UOM: 10/10 inserted (100%)                          ║
   ║ • Item Group: 25/25 inserted (100%)                   ║
   ║ • Item: 48/50 inserted (96%)                          ║
   ║                                                        ║
   ║ ❌ FAILED:                                            ║
   ║ • Item: 2 failed (duplicate item_code)                ║
   ║                                                        ║
   ║ ⏭️  SKIPPED:                                          ║
   ║ • Customer (missing dependencies)                     ║
   ║ • Sales Invoice (missing dependencies)                ║
   ║                                                        ║
   ╠════════════════════════════════════════════════════════╣
   ║ Total: 83/85 successful (97.6%)                       ║
   ╚════════════════════════════════════════════════════════╝
   ```

### Step 5 — Single DocType Insert (Alternative)

**If user wants to insert into just ONE DocType:**

9. **Quick Flow:**
   - Ask DocType name
   - Fetch schema
   - Ask for data
   - Map and insert
   - Show result

---

## Rules (Universal - Works With Any Site)

### Site Discovery
- **Auto-detect** installed apps and custom DocTypes
- **Works with** any ERPNext v14/v15/v16 site
- **No hardcoded** DocType lists or field mappings
- **Schema-driven** - all field info from API
- **GitHub-aware** - searches GitHub for app repos to understand custom DocTypes

### GitHub App Search
- Skip core apps: `frappe`, `erpnext`, `hrms`
- Search pattern: `https://github.com/search?q={app_name}+language:python+topic:frappe`
- Or search: `https://github.com/search?q={app_name}+frappe+app`
- Look for repos with `frappe` topic or containing `/doctype/` folders
- Extract: repo URL, star count, last commit date
- For private apps: mark as "[Private - skip GitHub search]"

### Field Matching Priority
1. Exact match
2. Case-insensitive match
3. Snake_case ↔ CamelCase
4. Common aliases (learn from schema)
5. Fuzzy match (Levenshtein < 3)

### Required Fields
- Detect from schema (`reqd: 1`)
- Ask user for values or suggest defaults
- Use field type to suggest appropriate defaults

### Link Field Handling
- Detect `fieldtype: "Link"`
- Extract target DocType from `options`
- Verify linked document exists
- If missing: offer to create, select existing, or skip

### Child Tables
- Detect `fieldtype: "Table"`
- Handle nested arrays in input
- Map child table fields recursively
- Ask for child table field name if ambiguous

### Batch Insert (Excel/CSV)
- Read file, detect headers
- Show preview (first 5 rows)
- Auto-map columns to fields
- Insert row by row with progress
- Report summary with success/failure

---

## Output Format

### Site Summary (After Connection)
```
╔════════════════════════════════════════════════════════╗
║         ERPNext Data Inserter - Site Analysis          ║
╠════════════════════════════════════════════════════════╣
║ Site: https://mysite.erpnext.com                      ║
║ Version: Frappe v15.32.2, ERPNext v15.31.0            ║
╠════════════════════════════════════════════════════════╣
║ Installed Modules:                                    ║
║ • Accounts, Buying, CRM, HR, Manufacturing, Projects  ║
║ • Stock, Selling, Website, Custom Apps               ║
║                                                        ║
║ Total DocTypes: 245                                  ║
║ Custom DocTypes: 18                                  ║
╚════════════════════════════════════════════════════════╝

Ready to insert data into any DocType.
```

### Mapping Display
```
Field Mapping for {DocType}:

Input Data: {show parsed input}

Field Mapping:
┌─────────────────┬───────────────────┬──────────────┐
│ Input Field      │ Target Field      │ Status       │
├─────────────────┼───────────────────┼──────────────┤
│ name             │ customer_name     │ ✓ Auto      │
│ email            │ email_id          │ ✓ Auto      │
│ type             │ customer_group    │ ✓ Auto      │
│ contact_person   │ ???               │ ? Ask user  │
│                  │ territory          │ ! Required  │
└─────────────────┴───────────────────┴──────────────┘

Link Dependencies:
• customer: "CUST-00001" → ✓ Verified

Missing Required Fields:
• territory: [Select: All Territories / Saudi Arabia / UAE]

Confirm mapping? (yes/edit/cancel)
```

### Success Response
```
✓ Document Created Successfully

DocType: Customer
Name: CUST-00001
URL: {site}/app/customer/CUST-00001

Data Inserted:
• customer_name: Acme Corporation
• email_id: info@acme.com
• customer_group: Commercial
• territory: All Territories
```

### Batch Insert Summary
```
╔════════════════════════════════════════════════════════╗
║              Batch Insert Summary                       ║
╠════════════════════════════════════════════════════════╣
║ File: data.xlsx                                        ║
║ Target DocType: Customer                               ║
║ Rows: 150                                              ║
╠════════════════════════════════════════════════════════╣
║ ✓ Success: 148 (98.7%)                                ║
║ ✗ Failed: 2 (1.3%)                                    ║
║                                                        ║
║ Failures:                                              ║
║ • Row 45: Duplicate email                              ║
║ • Row 112: Missing required territory                  ║
╚════════════════════════════════════════════════════════╝
```

---

## API Methods Used

| Method | Purpose |
|--------|---------|
| `frappe.get_installed_apps` | Detect installed apps |
| `frappe.get_all_modules` | List all modules |
| `get_doctype_schema` | Get DocType fields & metadata |
| `frappe_list_documents` | Verify Link fields exist |
| `frappe_create_document` | Create new document |
| `bulk_update` | Batch insert (optional) |

### GitHub Search (Web Search API)
| Search URL | Purpose |
|-----------|---------|
| `https://github.com/search?q={app}+language:python+topic:frappe` | Find app repo |
| `https://github.com/search?q={app}+frappe+app` | Fallback search |
| `https://api.github.com/repos/{org}/{repo}` | Get repo metadata |

---

## Examples (Universal - Any Site)

### Example 1: Simple Insert
**Input:** `name: ABC Construction, email: abc@con.com`

**Flow:**
1. Connect to site
2. Detect installed DocTypes
3. Ask DocType → "Customer"
4. Fetch schema, auto-map fields
5. Confirm → Insert

### Example 2: JSON with Link
**Input:** `{"customer": "CUST-00001", "date": "2026-03-11", "amount": 5000}`

**Flow:**
1. Parse JSON
2. Ask DocType → "Sales Invoice"
3. Fetch schema, map fields
4. Verify customer exists
5. Confirm → Insert

### Example 3: Bulk Insert
**Input:** `path/to/customers.xlsx`

**Flow:**
1. Read Excel file
2. Detect headers
3. Ask target DocType → "Customer"
4. Auto-map columns
5. Show preview
6. Insert all rows
7. Show summary

---

## Key Features

✓ **Universal** - Works with ANY ERPNext site
✓ **Auto-detect** - Discovers installed apps, DocTypes, and modules from GitHub
✓ **Multi-select** - Select multiple DocTypes at once, grouped by module
✓ **Dependency analysis** - Auto-detects Link fields and sorts insert order
✓ **Insert plan report** - Shows what's ready, what needs input, what's missing
✓ **Smart mapping** - AI-driven field name matching
✓ **QA report** - Final completion report with success/failure stats
✓ **Batch support** - Excel/CSV bulk insert
✓ **Error recovery** - Graceful handling of failures
✓ **Bilingual** - Supports English/Arabic data generation

---

## User Guide & Recommendations

### How to Use (Quick Start)

**For Single Record:**
```
/erpnext-data-inserter customer_name: ABC Corp, email: abc@test.com
```

**For Multiple Records (Excel/CSV):**
```
/erpnext-data-inserter C:/path/to/customers.xlsx
```

**For JSON Data:**
```
/erpnext-data-inserter {"customer_name": "ABC Corp", "customer_group": "Commercial"}
```

### Best Practices

1. **Start with Foundation Data First**
   - Always insert in order: UOM → Item Group → Item → Customer → Documents
   - Dependencies must exist before linked records

2. **Use Sample Data for Testing**
   - Press Enter when asked for data to get auto-generated samples
   - Verify the schema mapping before bulk insert

3. **Review the Insert Plan**
   - Check dependency status (✓ READY, ❌ NEEDS INPUT)
   - Add missing DocTypes or skip problematic ones

4. **Batch Insert Tips**
   - Excel/CSV should have headers matching field names
   - First 5 rows preview shown before insert
   - Duplicate values cause failures - clean data first

5. **Field Naming**
   - Use snake_case: `customer_name`, `item_code`
   - Common aliases work: `name`, `email`, `type`
   - Link fields need existing document names

6. **Arabic/UTF-8 Data (CRITICAL)**
   - curl/bash often fails with Arabic characters (shows as "????")
   - **Use Python or PowerShell** for Arabic data insertion
   - Or use Frappe UI Data Import for Arabic CSV files
   - Always test one Arabic record before bulk insert

---

### Data Richness Levels (How Many Fields to Fill)

**Ask user: "How rich should the data be?"**

| Level | Fields to Fill | Best For | Example (Customer) |
|-------|---------------|----------|-------------------|
| **Minimal** | Required only | Quick testing, MVP | customer_name, customer_type |
| **Standard** | Required + Core | Production use | + email, phone, territory, customer_group |
| **Full** | All relevant | Complete data | + tax_id, website, address, credit limits, payment terms |

**Auto-Selection Rules:**

```
IF user record count < 10:
  → Ask: "Full data for testing? (recommended)"

IF user record count 10-50:
  → Ask: "Standard or Full data?"
  → Default: Standard

IF user record count > 50:
  → Use Standard (balance of quality vs speed)
  → Ask: "Need Full data?" only if user specifies
```

**Field Priority by Category:**

| Priority | Field Types | Always Include? |
|----------|-------------|-----------------|
| **Critical** | Required fields (`reqd: 1`) | ✓ Yes |
| **High** | Naming, identifiers, links | ✓ Yes |
| **Medium** | Contact info, classifications | ✓ For Standard/Full |
| **Low** | Optional flags, notes | Only for Full |
| **Skip** | Deprecated, internal fields | ✗ No |

**Smart Field Filtering:**

When generating data, automatically skip:
- `idx`, `creation`, `modified`, `owner`, `modified_by` (system fields)
- `lft`, `rgt`, `old_parent` (tree fields)
- `seen`, `__onload` (internal flags)
- Fields with `hidden: 1` or `read_only: 1`

**Example Output (Standard Level):**

```
📋 Customer Fields to Fill (Standard Level - 15 fields)

Required (3):
✓ customer_name
✓ customer_type
✓ customer_group

Core Business (12):
✓ territory
✓ email_id
✓ phone_no (or mobile_no)
✓ language
✓ default_currency
✓ payment_terms
✓ credit_limits
✓ customer_primary_address (with full address)
✓ primary_contact
✓ tax_id / VAT
✓ website
✓ default_price_list

Skipped (system/internal only):
○ idx, creation, modified, owner, lft, rgt...
```

**User Can Override:**

```
"All fields" → Fill everything except system fields
"Core only" → Required + High priority only
"Custom" → Let user pick specific fields
```

---

## Comprehensive Sample Data Templates

### Customer (Standard Level - Bilingual)

**English Customers:**
```json
{
  "customer_name": "Al-Rajhi Construction Company",
  "customer_type": "Company",
  "customer_group": "Commercial",
  "territory": "Saudi Arabia",
  "email_id": "info@alrajhi-construction.sa",
  "phone_no": "+966-11-2345678",
  "mobile_no": "+966-50-1234567",
  "language": "en",
  "default_currency": "SAR",
  "payment_terms": "NET 30",
  "credit_limit": 500000,
  "tax_id": "300123456700003",
  "website": "www.alrajhi-construction.sa",
  "default_price_list": "Standard Selling"
}
```

**Arabic Customers:**
```json
{
  "customer_name": "شركة الراجحي للإنشاءات",
  "customer_type": "Company",
  "customer_group": "تجاري",
  "territory": "السعودية",
  "email_id": "info@alrajhi-construction.sa",
  "phone_no": "+966-11-2345678",
  "mobile_no": "+966-50-1234567",
  "language": "ar",
  "default_currency": "SAR",
  "payment_terms": "NET 30",
  "credit_limit": 500000,
  "tax_id": "300123456700003",
  "website": "www.alrajhi-construction.sa"
}
```

### Supplier (Standard Level)

```json
{
  "supplier_name": "Building Materials Supply Co.",
  "supplier_type": "Company",
  "supplier_group": "Domestic",
  "territory": "Saudi Arabia",
  "email_id": "supply@bmsco.sa",
  "mobile_no": "+966-50-9876543",
  "language": "en",
  "default_currency": "SAR",
  "payment_terms": "NET 45",
  "credit_limit": 1000000,
  "tax_id": "310987654300001",
  "is_transporter": 0,
  "is_internal_supplier": 0
}
```

### Item (Standard Level)

```json
{
  "item_code": "MAT-CEM-001",
  "item_name": "Portland Cement 50KG",
  "item_group": "Construction Materials",
  "stock_uom": "Nos",
  "item_type": "Stock",
  "include_item_in_manufacturing": 0,
  "is_stock_item": 1,
  "is_purchase_item": 1,
  "is_sales_item": 1,
  "standard_rate": 25.00,
  "valuation_rate": 20.00,
  "reorder_level": 100,
  "description": "High quality Portland cement 50KG bags",
  "brand": "Saudi Cement",
  "barcode": "628100000001"
}
```

### Address (for Customer/Supplier)

```json
{
  "address_type": "Billing",
  "address_line1": "Building 45, Office 201",
  "address_line2": "Olaya Main Street",
  "city": "Riyadh",
  "state": "Riyadh Region",
  "pincode": "11564",
  "country": "Saudi Arabia",
  "phone": "+966-11-2345678",
  "email_id": "info@company.sa",
  "is_primary_address": 1,
  "is_shipping_address": 1
}
```

### Contact (for Customer/Supplier)

```json
{
  "first_name": "Ahmed",
  "last_name": "Al-Mutairi",
  "email_id": "ahmed@company.sa",
  "phone": "+966-50-1234567",
  "mobile_no": "+966-50-1234567",
  "designation": "Purchase Manager",
  "is_primary_contact": 1
}
```

### Payment Terms

```json
{
  "name": "NET 30",
  "description": "Payment within 30 days from invoice date",
  "credit_days": 30,
  "due_date_based_on": "Delivery Date"
}
```

### Price List

```json
{
  "price_list_name": "Standard Selling",
  "currency": "SAR",
  "enabled": 1,
  "selling": 1
}
```

### Territory

```json
{
  "territory_name": "Saudi Arabia",
  "is_group": 0,
  "parent_territory": "All Territories"
}
```

### Customer Group

```json
{
  "customer_group_name": "Commercial",
  "is_group": 0,
  "parent_customer_group": "All Customer Groups"
}
```

### Item Group

```json
{
  "item_group_name": "Construction Materials",
  "is_group": 0,
  "parent_item_group": "All Item Groups",
  "include_in_variants": 0
}
```

---

### Common Workflows

#### Workflow 1: Quick Customer Creation
```
Step 1: /erpnext-data-inserter name: ABC Construction
Step 2: Select "Customer" when asked
Step 3: Confirm mapping
Step 4: Done → Customer created
```

#### Workflow 2: Bulk Items Import
```
Step 1: Prepare Excel with columns: item_code, item_name, item_group, stock_uom
Step 2: /erpnext-data-inserter C:/items.xlsx
Step 3: Select "Item" DocType
Step 4: Review mapping preview
Step 5: Confirm → All items inserted
```

#### Workflow 3: Multi-Doctype Seeding
```
Step 1: /erpnext-data-inserter (no data needed)
Step 2: Answer industry question (e.g., Construction)
Step 3: Select multiple DocTypes: UOM, Item Group, Item, Customer
Step 4: Review insert plan
Step 5: Approve → All inserted in correct order
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Link field not found" | Create the dependency record first |
| "Missing required field" | Provide value or accept default |
| "Duplicate entry" | Check existing records, use unique values |
| "Field not mapped" | Use exact field names from schema |
| "Connection failed" | Verify URL and API key format |
| **"Arabic text appears as ????"** | **UTF-8 encoding issue** - see below |

### Arabic/UTF-8 Encoding Handling

**CRITICAL**: When inserting Arabic or other non-ASCII text via curl/bash, encoding may fail and show as "?????"

**Root Cause**:
- Windows bash/curl may not handle UTF-8 properly by default
- JSON payload encoding strips non-ASCII characters

**Solutions**:

1. **Use Python instead of curl** for Arabic data:
```bash
python -c "
import urllib.request
import json

data = {'customer_name': 'شركة البناء الحديث', 'customer_type': 'Company'}
req = urllib.request.Request(
    'SITE_URL/api/resource/Customer',
    data=json.dumps(data).encode('utf-8'),
    headers={'Authorization': 'token API_KEY:API_SECRET', 'Content-Type': 'application/json; charset=utf-8'}
)
print(urllib.request.urlopen(req).read().decode())
"
```

2. **Use PowerShell** on Windows:
```powershell
$headers = @{'Authorization' = 'token API_KEY:API_SECRET'}
$body = '{"customer_name": "شركة البناء الحديث", "customer_type": "Company"}' | ConvertTo-Json
Invoke-RestMethod -Uri "SITE_URL/api/resource/Customer" -Method Post -Headers $headers -Body $body -ContentType "application/json; charset=utf-8"
```

3. **Use Frappe Desk UI** for manual Arabic entry (most reliable)

4. **For batch inserts** with Arabic:
   - Save data as UTF-8 encoded CSV file
   - Use Frappe Data Import tool from UI
   - Or use Python script with proper UTF-8 handling

**Testing Encoding**:
Before bulk insert, test with one Arabic record to verify encoding works correctly.

### Broken Records That Can't Be Deleted (NEW)
**Problem**: Some broken records (showing as "????") return 404 when trying DELETE
**Root Cause**: Possible database encoding corruption - the `name` field may contain invalid characters that API can't match
**Solution**:
- Try deleting via Frappe Desk UI (backend may handle it differently)
- Or mark as `disabled: 1` and ignore
- Last resort: Database cleanup via SQL (only for experienced admins)
- **Best prevention**: Always test Arabic encoding with ONE record before bulk insert

### Input Format Reference

| Format | Example | When to Use |
|--------|---------|-------------|
| Key-value pairs | `name: ABC, email: test@test.com` | Quick single record |
| JSON | `{"customer_name": "ABC"}` | Complex data with nested fields |
| Excel file | `C:/data.xlsx` | Bulk import (10+ records) |
| CSV file | `C:/data.csv` | Bulk export from other system |
| Natural language | `Create customer ABC Corp` | Simple records (AI parses) |

---

## Ready-to-Use PowerShell Scripts

### Comprehensive Customer Insertion (Bilingual)

```powershell
# Save as: insert_customers.ps1
# Run: powershell -ExecutionPolicy Bypass -File insert_customers.ps1
# (Use -ExecutionPolicy Bypass to avoid script execution policy errors)

$headers = @{'Authorization' = 'token YOUR_API_KEY:YOUR_SECRET'}

$customers = @(
    @{customer_name = "Al-Rajhi Construction"; customer_type = "Company"; customer_group = "Commercial"; territory = "Saudi Arabia"; email_id = "info@alrajhi.sa"; phone_no = "+966-11-2345678"; mobile_no = "+966-50-1234567"; language = "en"; default_currency = "SAR"; payment_terms = "NET 30"; credit_limit = 500000; tax_id = "300123456700003"; website = "www.alrajhi.sa"},
    @{customer_name = "شركة الراجحي للإنشاءات"; customer_type = "Company"; customer_group = "Commercial"; territory = "Saudi Arabia"; email_id = "info@alrajhi.sa"; phone_no = "+966-11-2345678"; mobile_no = "+966-50-1234567"; language = "ar"; default_currency = "SAR"; payment_terms = "NET 30"; credit_limit = 500000}
)

foreach ($cust in $customers) {
    $body = $cust | ConvertTo-Json
    try {
        $result = Invoke-RestMethod -Uri "YOUR_SITE/api/resource/Customer" -Method Post -Headers $headers -Body $body -ContentType 'application/json; charset=utf-8'
        Write-Host "SUCCESS: $($cust.customer_name)" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: $($cust.customer_name)" -ForegroundColor Red
    }
}
```

### Batch Insert with Error Handling

```powershell
# Comprehensive version with full error reporting
$headers = @{'Authorization' = 'token YOUR_KEY:YOUR_SECRET'}
$successCount = 0
$errorCount = 0

foreach ($cust in $customers) {
    $body = $cust | ConvertTo-Json
    try {
        $result = Invoke-RestMethod -Uri "YOUR_SITE/api/resource/Customer" -Method Post -Headers $headers -Body $body -ContentType 'application/json; charset=utf-8'
        $successCount++
        Write-Host "✓ $($cust.customer_name)"
    } catch {
        $errorCount++
        Write-Host "✗ $($cust.customer_name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Summary ==="
Write-Host "Success: $successCount"
Write-Host "Errors: $errorCount"
```

---

## Lessons Learned (From Real Implementation)

### Arabic Encoding Issues
**Problem**: Arabic text inserted as "?????" when using curl/bash commands
**Root Cause**: Windows console encoding (cp1252/charmap) doesn't support Arabic UTF-8
**Solution**: Use PowerShell or Python scripts instead - they handle UTF-8 natively

### Permission Errors
**Problem**: `PermissionError: User does not have doctype access`
**Solution**: Check user role permissions for specific DocTypes (e.g., UOM may require System Manager role)

### Field Name Variations
**Problem**: `phone_no` vs `mobile_no` vs `phone` - different DocTypes use different names
**Solution**: Always fetch DocType schema first to get exact field names

### Required vs Optional Fields
**Problem**: Insert fails with missing required field
**Solution**: Check schema for `reqd: 1` fields - these must be included

### Credit Limits Handling
**Problem**: `credit_limit` field may be part of child table `credit_limits`
**Solution**: Check if credit limit is:
- Direct field on Customer (simple value)
- Child table requiring company-wise limits

### Payment Terms Reference
**Problem**: `payment_terms` expects existing Payment Term name, not text
**Solution**: Either create Payment Terms first or use existing ones like "NET 30", "NET 45"

### Territory Hierarchy
**Problem**: Territory must exist or be child of "All Territories"
**Solution**: Check existing territories via GET `/api/resource/Territory` before using

### Customer Group Dependencies
**Problem**: `customer_group` must exist before creating Customer
**Solution**: Insert order: Customer Group → Customer → Sales Documents

### API Token Format
**Problem**: Authentication fails with wrong token format
**Solution**: Must be `api_key:api_secret` (colon separated) with "token " prefix in header

### URL Encoding for Special Characters
**Problem**: URLs with Arabic names for DELETE/GET operations
**Solution**: Use URL encoding or work with system-generated `name` field instead of customer_name

### Testing Strategy
**Always test** with 1 record before bulk insert:
1. Verify encoding works for Arabic
2. Check all required fields are accepted
3. Confirm link fields reference existing documents
4. Validate user permissions for the DocType

### Cleanup After Insert
**Problem**: Test records, broken Arabic (????), and demo data need removal
**Solution**:
- If API user lacks delete permission for owner's records, use UI to delete
- Or use Administrator API token for cleanup operations
- **Cleanup checklist after insert**:
  - Remove any "test", "demo", "sample" records
  - Remove broken Arabic records showing as "????"
  - Verify realistic company names remain
  - Check Customer Group and Territory are properly set

**Example cleanup (requires admin permissions):**
```powershell
# Only works if API token has delete permission
Add-Type -AssemblyName System.Web
$recordsToDelete = @("test", "test1", "demo Customer")
foreach ($name in $recordsToDelete) {
    try {
        # Use %20 for spaces (NOT UrlEncode which uses +)
        $encodedName = $name -replace " ", "%20"
        Invoke-RestMethod -Uri "$site/api/resource/Customer/$encodedName" -Method Delete -Headers $headers
        Write-Host "Deleted: $name"
    } catch {
        Write-Host "Cannot delete $name - use UI or admin token"
    }
}
```

### Delete Dependency Checking (NEW)
**Problem**: DELETE fails when documents are linked (Sales Invoices, Delivery Notes, etc.)
**Solution**: ALWAYS check dependencies before DELETE:
```powershell
# Check for linked documents before deleting customer
$si = Invoke-RestMethod -Uri "$site/api/resource/Sales Invoice?filters=[[`"customer`",`"=`",`"$customerName`"]]" -Headers $headers
$dn = Invoke-RestMethod -Uri "$site/api/resource/Delivery Note?filters=[[`"customer`",`"=`",`"$customerName`"]]" -Headers $headers

if ($si.data.Count -gt 0) { Write-Host "Has $($si.data.Count) Sales Invoices - delete these first" }
if ($dn.data.Count -gt 0) { Write-Host "Has $($dn.data.Count) Delivery Notes - delete these first" }
```

**Chain Delete Approach**:
1. First DELETE child documents (Draft Sales Invoices, Quotations, etc.)
2. Then DELETE the parent Customer/Supplier
3. For submitted documents, use Cancellation before DELETE

### DELETE URL Encoding (NEW)
**Problem**: `DoesNotExistError` when deleting records with spaces in name
**Root Cause**: `UrlEncode` converts space to `+` but ERPNext API expects `%20`
**Solution**: Use string replace for spaces instead of UrlEncode:
```powershell
# WRONG - produces demo+Customer which API rejects
$encoded = [System.Web.HttpUtility]::UrlEncode("demo Customer")

# CORRECT - produces demo%20Customer which API accepts
$encoded = "demo Customer" -replace " ", "%20"
```

### Use Curl Directly (Fastest Method) (NEW)
**Problem**: PowerShell scripts require files, curl is faster for simple inserts
**Solution**: Use curl directly for single/batch inserts (no Arabic):
```bash
# Single item
curl -s -X POST -H "Authorization: token KEY:SECRET" -H "Content-Type: application/json" \
  -d '{"item_code":"CEM-001","item_name":"Cement 50kg","item_group":"Products","stock_uom":"Nos","is_stock_item":1}' \
  "http://SITE/api/resource/Item"

# Multiple items (chain with &&)
curl -s -X POST ... -d '{"item_code":"A",...}' "URL" && curl -s -X POST ... -d '{"item_code":"B",...}' "URL"

# List records
curl -s -H "Authorization: token KEY:SECRET" "http://SITE/api/resource/Item?limit_page_length=20"
```
**Note**: Use PowerShell/Python only for Arabic data (UTF-8 encoding issues with curl on Windows)

### Transaction Cycles - Company Setup Required (NEW)
**Problem**: Purchase/Sales transactions fail with "Please set default Stock Received But Not Billed"
**Root Cause**: Company missing required default accounts for stock transactions
**Solution**: Create and set these accounts BEFORE creating transactions:

```bash
# 1. Create Stock Received But Not Billed Account
curl -X POST -H "Authorization: token KEY:SECRET" -H "Content-Type: application/json" -d '{
  "doctype": "Account",
  "account_name": "Stock Received But Not Billed",
  "parent_account": "Sources Of Funds(Liabilities) - ABC",
  "company": "Your Company",
  "account_type": "Stock Received But Not Billed",
  "is_group": 0
}' "http://SITE/api/resource/Account"

# 2. Create Stock Adjustment Account
curl -X POST ... -d '{
  "doctype": "Account",
  "account_name": "Stock Adjustment",
  "parent_account": "Expenses - ABC",
  "company": "Your Company",
  "account_type": "Stock Adjustment",
  "is_group": 0
}' "http://SITE/api/resource/Account"

# 3. Update Company with defaults
curl -X PUT ... -d '{
  "stock_received_but_not_billed": "Stock Received But Not Billed - ABC",
  "stock_adjustment_account": "Stock Adjustment - ABC"
}' "http://SITE/api/resource/Company/Your%20Company"
```

### Purchase Cycle Order (NEW)
**Required sequence** for complete purchase cycle:
1. **Purchase Order** (PO) → Submit (docstatus=1)
2. **Purchase Receipt** (PR) → Link to PO → Submit
3. **Purchase Invoice** (PI) → Link to PR → Submit
4. **Payment Entry** → Link to PI → Submit

```bash
# Purchase Order
curl -X POST ... -d '{
  "doctype": "Purchase Order",
  "supplier": "Supplier Name",
  "transaction_date": "2026-03-12",
  "company": "Your Company",
  "items": [{"item_code": "ITEM-001", "qty": 100, "rate": 20, "warehouse": "WH - ABC"}]
}' "http://SITE/api/resource/Purchase%20Order"

# Submit PO
curl -X PUT ... -d '{"docstatus": 1}' "http://SITE/api/resource/Purchase%20Order/PO-NAME"

# Purchase Receipt (requires PO submitted)
curl -X POST ... -d '{
  "doctype": "Purchase Receipt",
  "supplier": "Supplier Name",
  "items": [{"item_code": "ITEM-001", "qty": 100, "rate": 20, "warehouse": "WH - ABC", "purchase_order": "PO-NAME"}]
}' "http://SITE/api/resource/Purchase%20Receipt"
```

### Sales Cycle Order (NEW)
**Required sequence** for complete sales cycle:
1. **Stock Entry** (Material Receipt) → Add stock first!
2. **Sales Order** (SO) → Submit
3. **Delivery Note** (DN) → Link to SO with `so_detail` → Submit
4. **Sales Invoice** (SI) → Link to DN → Submit
5. **Payment Entry** (Receive) → Link to SI → Submit

```bash
# 0. Add Stock First (Material Receipt)
curl -X POST ... -d '{
  "doctype": "Stock Entry",
  "stock_entry_type": "Material Receipt",
  "items": [{"item_code": "ITEM-001", "qty": 200, "t_warehouse": "WH - ABC", "basic_rate": 20}]
}' "http://SITE/api/resource/Stock%20Entry"

# 1. Sales Order
curl -X POST ... -d '{
  "doctype": "Sales Order",
  "customer": "Customer Name",
  "transaction_date": "2026-03-12",
  "delivery_date": "2026-03-15",
  "items": [{"item_code": "ITEM-001", "qty": 50, "rate": 25, "warehouse": "WH - ABC"}]
}' "http://SITE/api/resource/Sales%20Order"

# 2. Delivery Note (CRITICAL: needs so_detail from SO items!)
# First get SO item names: GET /api/resource/Sales Order/SO-NAME
curl -X POST ... -d '{
  "doctype": "Delivery Note",
  "customer": "Customer Name",
  "items": [{"item_code": "ITEM-001", "qty": 50, "warehouse": "WH - ABC", "against_sales_order": "SO-NAME", "so_detail": "abc123xyz"}]
}' "http://SITE/api/resource/Delivery%20Note"

# 3. Sales Invoice
curl -X POST ... -d '{
  "doctype": "Sales Invoice",
  "customer": "Customer Name",
  "items": [{"item_code": "ITEM-001", "qty": 50, "rate": 25, "delivery_note": "DN-NAME"}]
}' "http://SITE/api/resource/Sales%20Invoice"
```

### Transaction Lessons (NEW)
- **Negative Stock Error**: Always add stock via Stock Entry (Material Receipt) BEFORE Delivery Note
- **so_detail Required**: Delivery Note items need `so_detail` (Sales Order item name) - fetch from SO first
- **Payment Entry**: Requires `reference_no` and `reference_date` for bank transactions
- **Account Mismatch**: Payment Entry party account must match Sales/Purchase Invoice receivable/payable account

### Data Quality Validation (Post-Insert Checklist)
**ALWAYS verify after insert** - check for:
- ❌ No "test", "demo", "sample" in customer/item names
- ❌ No "????" characters (broken Arabic encoding)
- ❌ No unrealistic names like "ABC123", "XXX Company"
- ✅ Realistic Saudi company names (Al-Rajhi, Saudi Trade, National, etc.)
- ✅ Proper phone formats (+966-XX-XXXXXXX)
- ✅ Valid VAT numbers (15 digits starting with 3)
- ✅ Proper email domains (.sa, .com.sa)
- ✅ Customer Group and Territory are set correctly
- ✅ Payment terms reference existing terms (NET 15/30/45/60)

**Quick validation query:**
```bash
# Check for test/demo records
GET /api/resource/Customer?filters=[["customer_name","like","%test%"]]

# Check for broken Arabic
GET /api/resource/Customer?filters=[["customer_name","like","%?%"]]
```
