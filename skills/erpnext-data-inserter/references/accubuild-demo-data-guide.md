# AccuBuild Demo Data Guide

Complete guide for seeding a fresh site with realistic demo data that exercises every module, every DocType connection, and the full project lifecycle.

## Why This Guide Exists

Creating demo data manually via the API taught us that **order matters**. Frappe DocTypes have deep dependency chains — a Payment Certificate needs a Contract, which needs a Bid, which needs an RFP, which needs a Customer and Project. Skip a step and you hit validation errors, workflow blocks, or empty reports.

This guide documents the exact sequence, the gotchas, and the lessons learned.

---

## Phase Overview

| Phase | What | DocTypes Created | Depends On |
|-------|------|-----------------|------------|
| **0** | Foundation | Company, Fiscal Year, Warehouses, Chart of Accounts | Fresh ERPNext |
| **1** | Master Data | UOM, Item Group, Work Division, Activity Type, Items | Phase 0 |
| **2** | Parties | Customer, Supplier, Employee, Department, Designation | Phase 0 |
| **3** | Project Setup | Project, RFP, Bid (with estimation tree) | Phases 1-2 |
| **4** | Contract & WBS | Construction Contract, WBS Elements, WBS Budget Lines | Phase 3 |
| **5** | Procurement | Material Request, Purchase Order, Purchase Receipt, Purchase Invoice | Phases 1-2, 4 |
| **6** | Sales & Delivery | Sales Order, Delivery Note, Sales Invoice | Phases 1-2, 4 |
| **7** | Stock | Stock Entry (Material Receipt, Transfer, Issue) | Phase 5 |
| **8** | Site Operations | Work Inspection Request, Timesheet | Phases 2, 4 |
| **9** | Financial | Payment Certificate, Payment Entry (client + supplier), Journal Entry | Phases 4-6 |
| **10** | Change Management | Change Request, Change Order (Construction Contract variant) | Phases 4, 9 |
| **11** | Document Management | Construction Document, RFI, Submittal | Phase 4 |
| **12** | Budget Adjustment | Budget Adjustment | Phase 4 |
| **13** | HR & Assets | Employee Certification, Expense Claim, Attendance, Leave, Asset | Phase 2 |
| **14** | Payroll | Salary Component, Salary Structure, SSA, Payroll Entry, Salary Slip | Phase 13 |

---

## Phase 0: Foundation (ERPNext Setup Wizard)

These are created by the ERPNext setup wizard or manually. Must exist before anything else.

```
Company                  → "Bena Construction (Demo)" (abbr: BCD)
Fiscal Year              → "2025-2026" (must cover your posting dates!)
Chart of Accounts        → Standard or imported
Warehouses               → Stores - BCD, Work In Progress - BCD, Finished Goods - BCD
Cost Center              → Main - BCD
Price Lists              → Standard Buying, Standard Selling
Currency                 → SAR (or your currency)
Letter Head              → Optional but shows in prints
```

### Lesson: Fiscal Year Must Exist

If no Fiscal Year covers your transaction dates, every doc_event controller that calls `_get_fiscal_year()` will fail. The function tries `erpnext.accounts.utils.get_fiscal_year(date)` and falls back to the global default. If neither works, the submit fails.

---

## Phase 1: Master Data

Run the existing bench command first:

```bash
bench --site mysite accubuild-seed-master-data
```

This creates: UOMs, Item Groups, Work Divisions, Activity Types.

Then create Items (stock items that will be used in procurement):

```
Items (is_stock_item=1, disabled=0):
  CONC-M25-RMC    → Ready Mix Concrete M25 (Cubic Meter)
  STEEL-REBAR-60  → Steel Reinforcement Grade 60 (Ton)
  DUCT-120        → Galvanized Ductwork (Nos)
  FITOUT-DOOR     → Solid Core Door (Nos)
  FITOUT-FLR      → Raised Flooring System (SQM)
  CABLE-TRAY-GI   → GI Cable Tray (Meter)
  LED-PANEL-60    → LED Panel 60x60 (Nos)
```

### Lesson: Disabled Items Block Everything

If `Item.disabled = 1`, you cannot use it in ANY transaction (MR, PO, SO, DN, SE). Check `disabled` flag before using items in demo data. Many auto-created items from bid estimation get disabled by default.

---

## Phase 2: Parties

### Customers
```
Demo Property Holdings   → customer_group: Commercial
Al Faisal Development    → customer_group: Commercial
```

### Suppliers
```
Alpha Steel              → supplier_group: All Supplier Groups
Beta Concrete            → supplier_group: All Supplier Groups
Gamma Electrical         → supplier_group: All Supplier Groups
```

### Employees (minimum 3-5 for realistic data)
```
HR-EMP-00001  → Project Manager (PM)      → Department: Projects - BCD
HR-EMP-00002  → Site Engineer              → Department: Engineering - BCD
HR-EMP-00003  → QA/QC Inspector            → Department: Quality - BCD
HR-EMP-00004  → Quantity Surveyor          → Department: Finance - BCD
HR-EMP-00005  → Safety Officer             → Department: HSE - BCD
```

### Project Roles (AccuBuild HR module)
```
Project Manager, Site Engineer, QA/QC Inspector,
Quantity Surveyor, Safety Officer, Foreman,
Document Controller, Planning Engineer
```

### Lesson: Employee After-Insert Hook

The `Employee.after_insert` hook in AccuBuild auto-creates a Document Folder for the employee. This is expected behavior, not an error.

---

## Phase 3: Project Setup

### Sequence: RFP → Bid → Bid Estimation Tree

#### 3a. Create Project
```python
Project PROJ-0003:
  project_name: "HVAC Building & Finishing Works"
  company: "Bena Construction (Demo)"
  customer: "Demo Property Holdings"
  expected_start_date: "2025-08-01"
  expected_end_date: "2026-06-30"
```

The `Project.after_insert` hook auto-creates a default WBS root element + document folder.

#### 3b. Create RFP and Walk Through Workflow

RFPs have a **7-step workflow**: Draft → Sent to Customer → Under Review → Won.

```
Step 1: Create RFP (status=Draft, workflow_state=Draft)
Step 2: Apply workflow action "Send to Customer"
Step 3: Apply "Start Review"
Step 4: Apply "Mark Qualified"
Step 5: Apply "Prepare Bid"
Step 6: Apply "Submit Bid"
Step 7: Apply "Mark Won"
```

**CRITICAL**: Between steps, you must also sync the `status` field manually if the workflow doesn't update it. Some controller validations check `status`, not `workflow_state`.

```python
# Pattern: update status THEN apply workflow action
frappe.db.set_value("RFP", rfp_name, "status", "Sent to Customer")
frappe.call("frappe.model.workflow.apply_workflow", doc=rfp_name, action="...")
```

#### 3c. Create Bid with Full Estimation Tree

The Bid estimation tree is a NestedSet hierarchy. Build it bottom-up:

```
Project Root (auto-created)
├── Item Root 1: "Demolition" (is_group=1)
│   ├── Equipment: "Excavator Rental" (qty=120, unit_cost=80)
│   └── Labor: "Demo Crew" (qty=120, unit_cost=60)
├── Item Root 2: "Concrete Works" (is_group=1)
│   ├── Material: "Concrete M25 Supply" (qty=100, unit_cost=550)
│   ├── Labor: "Pouring Crew" (qty=100, unit_cost=180)
│   └── Equipment: "Pump & Vibrator" (qty=100, unit_cost=50)
├── ... (repeat for each bid item)
```

**Use the whitelisted API**, not direct DocType creation:

```python
# Add child under an Item Root
frappe.call(
    "accubuild_core.accubuild_bidding.page.bid_estimation_grid.bid_estimation_grid.add_estimation",
    parent_id="<item_root_name>",
    bid="BID-2026-00016",
    estimation_type="Material",  # Material|Labor|Equipment|Subcontractor|Overhead
    description="Concrete M25 Supply",
    qty=100, uom="Cubic Meter", unit_cost=550,
    is_group=0, gp=8, risk=2, overhead=3,
    item_code="CONC-M25-RMC"  # optional Link to Item
)
```

Valid `estimation_type` values: `""`, `"Other"`, `"Material"`, `"Labor"`, `"Equipment"`, `"Subcontractor"`, `"Overhead"`, `"Project Root"`, `"Item Root"`, `"WBS"`.

#### 3d. Fill All Bid Tabs

| Tab | Child Table | Key Fields |
|-----|------------|------------|
| Taxes & Charges | `taxes_and_charges` (Bid Taxes and Charges) | `charge_type`, `rate`, `account_head`, `description` |
| Terms & Conditions | `bid_terms_details` (Bid Template Section) | `section_title`, `section_content` |
| Payment Milestones | `payment_milestones` (Bid Payment Milestone) | `milestone_name`, `milestone_percentage`, `payment_stage` |
| Project Team | `team_members` (Bid Team Member) | `member_source`, `employee`, `project_role` |
| Subcontractors | `subcontractors` (Bid Subcontractor) | `supplier`, `trade_specialty`, `scope_of_work`, `estimated_value` |
| Equipment & Assets | `equipment_and_assets` (Bid Equipment) | equipment fields |
| Attachments | `bid_attachment` (Bid Attachment) | file attachment |

**Valid `payment_stage` values**: `"Before Start"`, `"During Execution"`, `"On Completion"`, `"After Completion"`.

**Valid `trade_specialty` values**: `"Electrical"`, `"Mechanical"`, `"Plumbing & HVAC"`, `"Civil Works"`, `"Steel Fabrication"`, `"Concrete Works"`, `"Finishing & Painting"`, `"Landscaping"`, `"Safety & Security Systems"`, `"Elevator & Escalators"`, `"Other"`.

### Lesson: Bid Submit is Complex

Submitting a Bid requires:
1. All Item Roots must have children (no empty groups)
2. `ensure_estimations_linked()` runs and sets `item_code` on estimation nodes — if the item_code doesn't exist in Item doctype, it fails
3. `ensure_estimations_submitted()` blocks submit if draft estimation nodes exist

For demo data, it's easier to leave the Bid at "Under Customer Review" or "Won" workflow state (docstatus=0) and move downstream by creating contracts directly.

---

## Phase 4: Contract & WBS

### 4a. Construction Contract

```python
Construction Contract:
  contract_name: "HVAC Building & Finishing Works"
  party_type: "Customer"
  party: "Demo Property Holdings"
  project: "PROJ-0003"
  bid: "BID-2026-00016"  # Links back to bid
  contract_value: 434085.90
  start_date / end_date
  retention_percentage: 5
```

For Change Orders later, create a second contract with `contract_basis = "Change Order"` and `parent_contract` set.

### 4b. WBS Elements

Created automatically from Bid via `wbs_from_bid.py`, or manually:

```
WBS-0002  → Demolition (level 2, leaf)
WBS-0033  → Concrete Works (level 2, leaf)
WBS-0034  → Excavation (level 2, leaf)
...
```

### 4c. WBS Budget Lines (18+ lines)

Each WBS Element needs budget lines by cost category:

```python
WBS Budget Line:
  project: "PROJ-0003"
  wbs_element: "WBS-0033"
  cost_category: "Materials"    # Materials|Labor|Equipment|Subcontract|Overhead
  fiscal_year: "2025-2026"
  planned_amount: 55000         # Budget
  actual_amount: 35000          # Actual cost (populated by doc_event hooks)
  committed_amount: 0           # Reserved by POs
```

**Submit all budget lines** (docstatus=1). The P&L report only reads submitted lines.

### Lesson: Budget Line Categories Drive the P&L Report

The `_get_cost_maps()` function in the P&L report groups by `cost_category`:
- **Direct Cost**: `{"Labor", "Materials", "Equipment", "Subcontract"}`
- **Overhead**: `{"Overhead"}`
- **Revenue**: excluded from budget totals

If your budget lines use different category names, the report shows zeroes.

---

## Phase 5: Procurement (Supplier Side)

### Sequence: Material Request → Purchase Order → Purchase Receipt → Purchase Invoice

Each must have `project` field set on line items (not always the parent).

```
Material Request:
  material_request_type: "Purchase"
  items[].project: "PROJ-0003"
  items[].warehouse: "Stores - BCD"
  → Submit (docstatus=1)
  → doc_event: validate_budget_before_submit, reserve_budget_on_submit

Purchase Order:
  supplier: "Beta Concrete"
  items[].project: "PROJ-0003"
  items[].wbs_element: "WBS-0033"   # AccuBuild custom field
  → Submit
  → doc_event: validate_budget_before_submit, update_budget_reservation

Purchase Receipt:
  supplier: "Beta Concrete"
  items[].project: "PROJ-0003"
  items[].purchase_order: "PUR-ORD-2026-00001"
  → Submit (creates stock ledger entries)

Purchase Invoice:
  supplier: "Beta Concrete"
  items[].project: "PROJ-0003"
  items[].purchase_order: "PUR-ORD-2026-00001"
  → Submit
  → doc_event: post_actual_cost_to_wbs (writes to WBS Budget Line.actual_amount)
```

### Lesson: Purchase Invoice Posts Costs, Not Purchase Receipt

The `post_actual_cost_to_wbs` hook fires on Purchase Invoice submit, not Purchase Receipt. If you only create PRs without PIs, actual costs in the P&L will be zero.

---

## Phase 6: Sales & Delivery (Client Side)

```
Sales Order:
  customer: "Demo Property Holdings"
  project: "PROJ-0003"
  items[].item_code: "CONC-M25-RMC"
  items[].custom_wbs_element: "WBS-0002"
  → Submit

Delivery Note:
  customer: "Demo Property Holdings"
  project: "PROJ-0003"
  items[].against_sales_order: "SAL-ORD-2025-00007"
  → Submit (requires stock in warehouse!)

Sales Invoice:
  customer: "Demo Property Holdings"
  project: "PROJ-0003"
  items[].description: "Progress Billing - Civil Works"
  items[].rate: 120000
  → Submit
```

### Lesson: Delivery Note Needs Stock

You cannot submit a Delivery Note if the source warehouse has zero stock. Either:
1. First create a Stock Entry (Material Receipt) to add stock
2. Or leave the DN as draft (it still shows in Project Connections)

---

## Phase 7: Stock Operations

Create stock in this order:

```
1. Stock Entry (Material Receipt) → adds stock to "Stores - BCD"
2. Stock Entry (Material Transfer) → moves to "Work In Progress - BCD"
3. Stock Entry (Material Issue)    → consumes from WIP for project

Each item needs: project, cost_center
```

### Lesson: Stock Entry doc_event Bug (Fixed)

`stock_entry.py` calls `_get_fiscal_year(doc)` from `purchase_requisition.py`. That function had a bug where `fy_name, _ = erpnext_get_fiscal_year(dt)` shadowed `frappe._` (translation function). If the fiscal year lookup failed, the `_()` call at line 255 raised `UnboundLocalError`. **Fixed** by renaming to `_fy_end`.

---

## Phase 8: Site Operations

### Work Inspection Requests (WIR)

```python
Work Inspection Request:
  project: "PROJ-0003"
  wbs_element: "WBS-0033"
  inspection_type: "Material"  # or "Workmanship", "Testing"
  description: "Concrete cube test results"
  → Submit
  → Workflow: Draft → Submitted → Approved / Rejected
```

WIRs are required for Payment Certificate certification. Each PC Item needs a `work_inspection_request` link. To bypass: set `wir_responsibility_confirmed = 1` on the PC.

### Timesheets

```python
Timesheet:
  employee: "HR-EMP-00001"
  company: "Bena Construction (Demo)"
  time_logs[]:
    activity_type: "Execution"
    project: "PROJ-0003"
    from_time, to_time, hours
    description: "Civil works supervision"
  → Submit
```

Note: The `project` field is on the child `time_logs` table, not the parent Timesheet.

---

## Phase 9: Financial Documents

### Payment Certificate (Revenue Source for P&L)

This is the key revenue document. The P&L report reads `tabPayment Certificate Item.current_net`.

```python
Payment Certificate:
  project: "PROJ-0003"
  party_type: "Customer"
  party: "Demo Property Holdings"
  contract: "CON-2026-00001"
  certificate_date: "2026-03-01"
  wir_responsibility_confirmed: 1  # Bypass WIR validation
  items[]:
    wbs_element: "WBS-0033"
    contract_qty: 100
    executed_qty: 60
    current_qty: 60
    unit_rate: 780
    current_net: 46800
  → Submit
  → Walk workflow to "Certified" then "Paid"
```

**CRITICAL for P&L**: Revenue = SUM(current_net) from submitted PCs. Paid = SUM(current_net) from PCs with status IN ('Paid', 'Invoiced'). The `status` field must match — if `workflow_state = "Paid"` but `status = "Draft"`, the Paid Amount in P&L shows zero.

### Payment Entry (Client Payment)

```python
Payment Entry:
  payment_type: "Receive"      # FROM client
  party_type: "Customer"
  party: "Demo Property Holdings"
  project: "PROJ-0003"
  paid_from: "1310 - Debtors - BCD"
  paid_to: "Demo Bank Account - BCD"
  paid_amount: 120000
  references[]:
    reference_doctype: "Sales Invoice"
    reference_name: "ACC-SINV-2026-00001"
    allocated_amount: 120000
  → Submit
```

### Payment Entry (Supplier Payment)

```python
Payment Entry:
  payment_type: "Pay"           # TO supplier
  party_type: "Supplier"
  party: "Beta Concrete"
  project: "PROJ-0003"
  paid_from: "Demo Bank Account - BCD"
  paid_to: "2110 - Creditors - BCD"
  paid_amount: 35000
  references[]:
    reference_doctype: "Purchase Invoice"
    reference_name: "ACC-PINV-2026-00001"
    allocated_amount: 35000
  → Submit
```

### Journal Entry (Project Overheads — 15+ recommended)

Create 15-20 JEs spread across multiple months and WBS elements to populate finance reports with realistic cost data. Each JE should represent a real construction overhead or cost.

```python
Journal Entry:
  voucher_type: "Journal Entry"
  company: "Bena Construction (Demo)"
  posting_date: "2025-09-05"   # Spread across 6+ months
  user_remark: "Formwork rental - Month 1"
  project: "PROJ-0003"         # Header-level project (optional, used by some reports)
  accounts[]:
    - account: "5221 - Miscellaneous Expenses - BCD"
      debit_in_account_currency: 12000
      cost_center: "Main - BCD"
      project: "PROJ-0003"       # Row-level project (MANDATORY for WBS reports)
      wbs_element: "WBS-0035"    # Links cost to specific WBS element
    - account: "1110 - Cash - BCD"     # or "Demo Bank Account - BCD"
      credit_in_account_currency: 12000
      cost_center: "Main - BCD"
      project: "PROJ-0003"
  → Submit (triggers validate_budget_before_submit + post_actual_cost_to_wbs)
```

#### Recommended JE Expense Categories

| Account | Use For | Example |
|---------|---------|---------|
| `5201 - Administrative Expenses` | Permits, mobilization, admin overhead | Site mobilization costs, electrical permits |
| `5205 - Freight and Forwarding` | Transport, logistics | Equipment transport to site |
| `5208 - Office Maintenance` | Cleanup, maintenance | Year-end site cleanup |
| `5217 - Utility Expenses` | Power, water, temp services | Temporary power supply rental |
| `5221 - Miscellaneous Expenses` | General site costs | Safety PPE, testing fees, formwork rental |
| `5111 - Cost of Goods Sold` | Supplementary materials | Cable tray materials, panel accessories |

#### Credit Account Rules

| Account Type | Use When | Party Required? |
|-------------|----------|-----------------|
| `1110 - Cash - BCD` | Cash payments | No |
| `Demo Bank Account - BCD` | Bank transfers | No |
| `2110 - Creditors - BCD` | Supplier payable | **Yes** — requires `party_type: "Supplier"` + `party` on the row |

**Avoid `Creditors` account** unless you also set `party_type` and `party` on the credit row. Using Cash or Bank accounts is simpler for demo data.

#### Spread Pattern (15 JEs across 6 months)

```
Jul 2025:  1 JE  — Site mobilization (WBS-0034)
Aug 2025:  3 JEs — Testing, inspection, utilities (WBS-0033, WBS-0036, WBS-0004)
Sep 2025:  3 JEs — Formwork, transport, safety (WBS-0035, WBS-0034, WBS-0001)
Oct 2025:  3 JEs — Survey, permits, demolition waste (WBS-0034, WBS-0004, WBS-0002)
Nov 2025:  3 JEs — Materials supplementary (WBS-0037, WBS-0040, WBS-0038)
Dec 2025:  2 JEs — Conduit fittings, cleanup (WBS-0042, WBS-0001)
```

### Lesson: Journal Entry Best Practices

1. **`project` is on child rows, not header** — The `project` field on JE Account rows is what links costs to WBS reports. The header-level project is optional and used by some list views, but reports query the child table.
2. **Creditors account needs party** — Using `2110 - Creditors - BCD` without setting `party_type: "Supplier"` and `party` on the row causes `ValidationError`. Use `Cash` or `Bank` accounts for simpler demo data.
3. **`wbs_element` on debit rows** — Set `wbs_element` on the expense (debit) row to link the cost to a specific WBS element. The credit (cash/bank) row doesn't need it.
4. **Spread dates across months** — Reports like Cash Flow and WIP Schedule show temporal patterns. Clustered dates produce flat, unrealistic charts.
5. **Use realistic amounts** — Construction JEs range from 2,000-15,000 for overheads. Don't use round numbers like 10,000 everywhere — use 8,500, 3,200, 6,800 for realism.
6. **JE submit calls `_get_fiscal_year()`** — Same function that had the `_` shadowing bug in `purchase_requisition.py`. The fix must be deployed before JE submit works.

---

## Phase 10: Change Management

### Change Request → Change Order

```python
Change Request:
  project: "PROJ-0003"
  contract: "CON-2026-00001"
  change_type: "Scope Change"
  description: "Additional ductwork 130m"
  estimated_cost_impact: 25000
  → Walk workflow: Draft → Under Review → Send to Client → Implemented

Change Order (Construction Contract with contract_basis="Change Order"):
  contract_basis: "Change Order"
  parent_contract: "CON-2026-00001"
  party_type: "Customer"
  party: "Demo Property Holdings"
  project: "PROJ-0003"
  contract_value: 25000  # DELTA only, not total
  → Submit
```

### Lesson: Change Request Workflow Conditions

The Change Request workflow had broken conditions referencing a non-existent `complexity` field (`doc.complexity == 'Simple'`). These conditions must be cleared for the workflow to work. Check all workflow transitions before using them in demo data.

---

## Phase 11: Document Management

These are simple DocTypes (no complex validation):

```python
Construction Document:
  document_title: "HVAC Shop Drawings"
  project: "PROJ-0003"
  document_type: "General"
  document_category: "PDF File"
  → Submit (is_submittable)

RFI:
  subject: "Concrete Mix Design Clarification"
  project: "PROJ-0003"
  priority: "High"
  → Submit

Submittal:
  submittal_type: "Shop Drawing"
  project: "PROJ-0003"
  → Submit
```

---

## Phase 12: Budget Adjustment

```python
Budget Adjustment:
  project: "PROJ-0003"
  adjustment_type: "Reallocation"
  lines[]:
    wbs_element: "WBS-0037"
    cost_category: "Materials"
    adjustment_amount: 5000
```

### Lesson: Budget Adjustment Submit Bug

The `on_submit` handler tries to update `planned_amount` on submitted WBS Budget Lines, which raises `UpdateAfterSubmitError`. This is a **code bug** — the Budget Line needs `allow_on_submit=1` for `planned_amount`, or the adjustment must amend-and-resubmit the budget line. Leave as draft for now.

---

## Phase 13: HR & Assets (DONE)

### Dependency Chain

```
Holiday List → Department → Designation → Employee → Leave Type → Leave Allocation → Leave Application
                                         Employee → Attendance
                                         Employee → Expense Claim Type (with accounts) → Expense Claim
                                         Employee → Project Team (via custom_project_team)
Contact → Customer Focal Point (via custom_customer_focal_points on Project)
Item (is_fixed_asset=1) → Asset Category (with accounts) → Asset → Asset Movement
Location → Asset
```

### Records Created

| DocType | Records | Details |
|---------|---------|---------|
| Holiday List | 1 | BCD Holidays 2026 (8 holidays) |
| Department | 4 | Engineering, Project Management, Quality & Safety, Finance & Admin |
| Designation | 5 new | Site Engineer, QA Inspector, Quantity Surveyor, Safety Officer, Cost Engineer |
| Employee | 6 | Ahmed (PM), Khalid (Site Eng), Fatima (QA), Omar (QS), Youssef (Safety), Layla (Cost Eng) |
| Attendance | 18 | 6 employees x 3 days (Mar 3-5), all Present, all submitted |
| Leave Type | 2 | Annual Leave (21 days), Sick Leave (10 days) |
| Leave Allocation | 7 | All employees get Annual Leave; Khalid also gets Sick Leave |
| Leave Application | 2 | Fatima: 4 days annual (Mar 15-18), Khalid: 2 days sick (Mar 10-11) |
| Expense Claim Type | 5 | Transportation, Accommodation, Meals, Site Materials, PPE and Safety |
| Expense Claim | 2 | Ahmed: SAR 530 (transport + meals), Youssef: SAR 2,950 (PPE + site materials) |
| Contact | 2 | Mohammed Al-Otaibi, Sarah Al-Dossari (linked to Demo Property Holdings) |
| Customer Focal Point | 2 | On PROJ-0003 (PM + Design Manager roles) |
| Project Team | 6 | All employees on PROJ-0003 with Project Roles |
| Asset Category | 3 | Heavy Equipment (60mo), Vehicles (48mo), Survey Instruments (36mo) |
| Item (Fixed Asset) | 3 | AST-HVY-001 (Excavator), AST-VEH-001 (Hilux), AST-SRV-001 (Total Station) |
| Location | 1 | PROJ-0003 Site |
| Asset | 3 | CAT 320 Excavator (SAR 450K), Toyota Hilux (SAR 120K), Topcon Total Station (SAR 35K) |

### Creation Sequence

```python
# 1. Holiday List (required for employees)
Holiday List:
  holiday_list_name: "BCD Holidays 2026"
  from_date: "2026-01-01"
  to_date: "2026-12-31"
  company: "Bena Construction (Demo)"
  holidays[]: [{holiday_date, description}, ...]

# 2. Departments
Department:
  department_name: "Engineering"
  company: "Bena Construction (Demo)"
  # Auto-named as "Engineering - BCD"

# 3. Designations (field name is "designation_name", NOT "designation")
Designation:
  designation_name: "Site Engineer"

# 4. Employees
Employee:
  first_name: "Ahmed"
  last_name: "Al-Rashid"
  company: "Bena Construction (Demo)"
  department: "Project Management - BCD"
  designation: "Project Manager"
  gender: "Male"
  date_of_birth: "1985-06-15"
  date_of_joining: "2024-01-15"
  status: "Active"
  holiday_list: "BCD Holidays 2026"

# 5. Link employees to project team
Project (update):
  custom_project_team[]:
    employee: "HR-EMP-00002"
    employee_name: "Ahmed Al-Rashid"  # MANDATORY - not auto-fetched
    project_role: "Project Manager"   # Must be valid Project Role

# 6. Contacts + Customer Focal Points
Contact:
  first_name: "Mohammed"
  last_name: "Al-Otaibi"
  email_ids[]: [{email_id, is_primary: 1}]
  links[]: [{link_doctype: "Customer", link_name: "Demo Property Holdings"}]

Project (update):
  custom_customer_focal_points[]:
    contact: "Mohammed Al-Otaibi-Demo Property Holdings"  # Full contact name
    role: "Project Manager"  # Must be valid Project Role

# 7. Expense Claim Types (need default account per company!)
Expense Claim Type:
  expense_type: "Transportation"
  accounts[]:
    company: "Bena Construction (Demo)"
    default_account: "5201 - Administrative Expenses - BCD"

# 8. Expense Claims (need cost_center on EACH expense row for submit!)
Expense Claim:
  employee: "HR-EMP-00002"
  company: "Bena Construction (Demo)"
  project: "PROJ-0003"
  payable_account: "2110 - Creditors - BCD"
  expenses[]:
    expense_date, expense_type, description, amount, sanctioned_amount,
    cost_center: "Main - BCD"  # REQUIRED for GL entries on submit
  → Set approval_status: "Approved" + docstatus: 1

# 9. Leave Types → Leave Allocations → Leave Applications
Leave Type:
  leave_type_name: "Annual Leave"
  max_leaves_allowed: 21

Leave Allocation:
  employee, leave_type, from_date, to_date, new_leaves_allocated
  → Submit (docstatus: 1)

Leave Application:
  employee, leave_type, from_date, to_date, reason
  status: "Approved"
  leave_approver: "Administrator"
  → Submit

# 10. Assets (require Item with is_fixed_asset=1)
Item:
  item_name: "CAT 320 Excavator"
  is_fixed_asset: 1
  is_stock_item: 0
  asset_category: "Heavy Equipment"

Asset Category:
  asset_category_name: "Heavy Equipment"
  finance_books[]: [{depreciation_method, total_number_of_depreciations, frequency_of_depreciation}]
  accounts[]: [{company_name, fixed_asset_account, depreciation_expense_account, accumulated_depreciation_account}]

Asset:
  item_code: "STO-ITEM-2026-02953"
  asset_category: "Heavy Equipment"
  company: "Bena Construction (Demo)"
  location: "PROJ-0003 Site"
  is_existing_asset: 1
  gross_purchase_amount: 450000
  project: "PROJ-0003"
  custodian: "HR-EMP-00003"
  → Submit
```

---

## Phase 14: Payroll (DONE)

### Dependency Chain

```
Salary Component (with accounts) → Salary Structure (with earnings + deductions)
  → Salary Structure Assignment (per employee, with base salary)
    → Payroll Entry (orchestrator, optional)
      → Salary Slip (per employee per month)
```

### Records Created

| DocType | Records | Details |
|---------|---------|---------|
| Salary Component | 4 | Basic Salary (Earning), Housing Allowance (Earning), Transport Allowance (Earning), GOSI Deduction (Deduction) |
| Salary Structure | 1 | BCD Standard Salary (Monthly, submitted) |
| Salary Structure Assignment | 6 | One per employee, base salaries SAR 8,000-12,000 |
| Payroll Entry | 1 | HR-PRUN-2026-00001 (Feb 2026, draft — see lesson below) |
| Salary Slip | 6 | One per employee for Feb 2026, all submitted, total net SAR 68,692.50 |

### Creation Sequence

```python
# 1. Salary Components (4 total: 3 Earning + 1 Deduction)
Salary Component:
  salary_component: "Basic Salary"
  salary_component_abbr: "BS"
  type: "Earning"
  accounts[]:
    company: "Bena Construction (Demo)"
    account: "5213 - Salary - BCD"           # Earnings → Salary expense account

Salary Component:
  salary_component: "GOSI Deduction"
  salary_component_abbr: "GOSI"
  type: "Deduction"
  accounts[]:
    company: "Bena Construction (Demo)"
    account: "2120 - Payroll Payable - BCD"   # Deductions → Payroll Payable

# 2. Salary Structure (submitted)
Salary Structure:
  name: "BCD Standard Salary"
  company: "Bena Construction (Demo)"
  payroll_frequency: "Monthly"
  is_active: "Yes"
  earnings[]:
    - salary_component: "Basic Salary", amount_based_on_formula: 0
    - salary_component: "Housing Allowance", formula: "base * 0.25", amount_based_on_formula: 1
    - salary_component: "Transport Allowance", amount: 500, amount_based_on_formula: 0
  deductions[]:
    - salary_component: "GOSI Deduction", formula: "base * 0.0975", amount_based_on_formula: 1
  → Submit (docstatus: 1)

# 3. Salary Structure Assignments (one per employee, submitted)
Salary Structure Assignment:
  employee: "HR-EMP-00002"
  salary_structure: "BCD Standard Salary"
  company: "Bena Construction (Demo)"
  from_date: "2026-01-01"
  base: 12000                                # Drives formula calculations
  → Submit

# 4. Payroll Entry (orchestrator — optional, leave as draft)
Payroll Entry:
  company: "Bena Construction (Demo)"
  payroll_frequency: "Monthly"
  posting_date: "2026-02-28"
  start_date: "2026-02-01"
  end_date: "2026-02-28"
  cost_center: "Main - BCD"
  payment_account: "Demo Bank Account - BCD"
  payroll_payable_account: "2120 - Payroll Payable - BCD"
  employees[]: [{employee: "HR-EMP-00002"}, ...]
  # Do NOT submit — see lesson below

# 5. Salary Slips (one per employee, submitted)
Salary Slip:
  employee: "HR-EMP-00002"
  company: "Bena Construction (Demo)"
  posting_date: "2026-02-28"
  start_date: "2026-02-01"
  end_date: "2026-02-28"
  salary_structure: "BCD Standard Salary"
  payroll_entry: "HR-PRUN-2026-00001"        # Links back to Payroll Entry
  earnings[]:
    - salary_component: "Basic Salary", amount: 12000
    - salary_component: "Housing Allowance", amount: 3000
    - salary_component: "Transport Allowance", amount: 500
  deductions[]:
    - salary_component: "GOSI Deduction", amount: 1170
  → Submit
```

### Employee Base Salaries

| Employee | Role | Base (SAR) | Gross | Net |
|----------|------|-----------|-------|-----|
| Ahmed Al-Rashid | Project Manager | 12,000 | 15,500 | 14,330 |
| Layla Ibrahim | Cost Engineer | 9,500 | 12,375 | 11,449 |
| Omar Saeed | Quantity Surveyor | 10,000 | 13,000 | 12,025 |
| Khalid Hassan | Site Engineer | 9,000 | 11,750 | 10,873 |
| Fatima Nasser | QA Inspector | 8,500 | 11,125 | 10,296 |
| Youssef El-Sayed | Safety Officer | 8,000 | 10,500 | 9,720 |

**Gross** = Base + HRA (25%) + Transport (500). **Net** = Gross - GOSI (9.75% of base).

---

## Lessons Learned (All Sessions)

### API & Validation

1. **`-g` flag required for curl on Windows** — brackets in URL filters are interpreted as range specs without `--globoff` (`-g`)
2. **Field not permitted in query** — Frappe REST API restricts which fields can be used in filters/fields. Custom fields and some standard fields are blocked. Use `frappe.client.get_count` or get the full document instead.
3. **Select field validation is strict** — Must use exact option values from the DocType JSON. Check with the API error message which values are valid.
4. **Disabled items block ALL transactions** — Check `Item.disabled` before using in any demo data.

### Workflows

5. **Workflow vs Status mismatch** — `workflow_state` and `status` are separate fields. Reports may query one or the other. Always sync both.
6. **Workflow conditions can reference non-existent fields** — The Change Request workflow had `doc.complexity == 'Simple'` but no `complexity` field exists. Clear broken conditions.
7. **RFP workflow requires 7 steps** — Can't skip from Draft to Won. Must walk through each transition.

### Doc Events & Hooks

8. **`_` variable shadowing** — Never use `_` in tuple unpacking (`x, _ = func()`) if `frappe._` is used later in the same function. Python treats `_` as local throughout the function scope. Use `_unused` or `_fy_end` instead.
9. **Purchase Invoice posts costs, not Purchase Receipt** — The `post_actual_cost_to_wbs` hook is on PI, not PR.
10. **Stock Entry and JE share the same fiscal year bug** — Both call `_get_fiscal_year()` from `purchase_requisition.py`.

### NestedSet & Trees

11. **Bid Estimation is NestedSet** — Use the `add_estimation` whitelisted API, not direct DocType insert. Direct insert leaves `lft=0, rgt=0`.
12. **Item Roots must have children** — Empty group nodes block Bid submit ("Cannot submit empty estimation").
13. **`item_code` on estimations must be valid** — `ensure_estimations_linked()` sets `item_code` to `f"{bid_name}-{index:03d}"` which doesn't exist in Item doctype.

### Financial

14. **P&L Revenue comes from Payment Certificate**, not Sales Invoice. Budget/Cost comes from WBS Budget Line.
15. **Paid Amount requires PC status IN ('Paid', 'Invoiced')** — If `workflow_state` is "Paid" but `status` is still "Draft", paid amount shows zero.
16. **Budget Adjustment can't submit** — `UpdateAfterSubmitError` when modifying submitted Budget Lines.
17. **Change Order stores DELTA values** — The `contract_value` on a Change Order is the change amount, not the total.
18. **Negative stock blocks DN and SE submit** — Must receive stock before you can issue or deliver it.

### Journal Entries

19. **JE `project` lives on child rows, not header** — Reports query `tabJournal Entry Account` (child), not `tabJournal Entry` (parent). Always set `project` on the account rows.
20. **Creditors account requires party** — `2110 - Creditors - BCD` (Payable type) requires `party_type` + `party` on the row. Use Cash (`1110`) or Bank (`Demo Bank Account`) for simpler JE demo data.
21. **`wbs_element` only on debit rows** — The expense (debit) row links to WBS for cost tracking. Credit (cash/bank) rows don't need `wbs_element`.
22. **Spread JEs across 6+ months** — Cash Flow and WIP Schedule reports show temporal patterns. 15+ JEs across Jul-Dec produces realistic charts. Single-month clusters look artificial.
23. **Use varied expense accounts** — Mix Administrative, Freight, Utilities, Miscellaneous, and COGS accounts across JEs. Single-account JEs make cost breakdowns useless.

### HRMS & Assets

24. **Designation field name is `designation_name`** — Not `designation`. The DocType autoname is from `designation_name`.
25. **Employee `employee_name` is mandatory on Bid Team Member** — When populating `custom_project_team` on Project, you must supply `employee_name` explicitly — it's not auto-fetched from the employee link.
26. **Customer Focal Point needs Contact link** — The `contact` field is mandatory and must reference a full Contact record (named `"FirstName LastName-CustomerName"`).
27. **Expense Claim Type needs default account per company** — Without `accounts[].default_account` set for your company, Expense Claim creation fails.
28. **Expense Claim rows need `cost_center`** — Each expense row requires `cost_center` for GL posting on submit. It's not inherited from the header.
29. **Leave Allocation BEFORE Leave Application** — HRMS requires allocated leave balance before an application can be submitted. Create Leave Type → Leave Allocation → Leave Application.
30. **Asset requires Item with `is_fixed_asset=1`** — Assets cannot be created without a backing Item record flagged as fixed asset. Also set `is_stock_item=0`.
31. **Asset Category needs 3 accounts** — `fixed_asset_account`, `depreciation_expense_account`, and `accumulated_depreciation_account` per company.
32. **Holiday List should be created before Employees** — Employee `holiday_list` field determines which days are holidays for attendance and leave calculations.
33. **Location is a NestedSet tree** — Create Location records before Assets if you want to track equipment location per project site.

### Payroll

34. **Salary Component needs accounts per company** — Each Salary Component must have an entry in its `accounts` child table mapping to the company. Earnings → expense account (e.g., `5213 - Salary`). Deductions → liability account (e.g., `2120 - Payroll Payable`). Without this, Salary Slip submit fails with "no account found".
35. **Salary Structure must be submitted** — Cannot create Salary Structure Assignments against a draft Salary Structure. Submit it first.
36. **SSA `base` field drives formula calculations** — The `base` value on Salary Structure Assignment is what formulas like `base * 0.25` reference. Each employee can have a different base salary.
37. **Payroll Entry submit conflicts with pre-created Salary Slips** — If you create Salary Slips directly via API, the Payroll Entry's submit tries to create them again and fails with "Salary Slip already exists". Either: (a) create slips via Payroll Entry submit, or (b) create slips manually and leave Payroll Entry as draft.
38. **Create Salary Slips directly for demo data** — It's simpler to create Salary Slips via `POST /api/resource/Salary Slip` with explicit earnings/deductions than to use the Payroll Entry orchestrator (which has non-whitelisted methods). Set `payroll_entry` field to link them back.
39. **`create_salary_slips_for_employees` is not whitelisted** — The HRMS method for creating slips from a Payroll Entry cannot be called via REST API. Create Salary Slips directly instead.

---

## Phase 15: Time Tracking & Projects Module Reports (DONE)

### Dependency Chain

```
Activity Type → Activity Cost (per employee per activity)
Employee + Activity Type + Project + Task → Timesheet (with time_logs[])
```

### Records Created

| DocType | Records | Details |
|---------|---------|---------|
| Activity Costs | 12 | 3 employees x 4 activity types (Execution, Planning, Concrete Works, Electrical) |
| Timesheets | 10 | All submitted, 5 employees, dates span Feb 1 - Apr 1, 2026 |

### Creation Sequence

```python
# 1. Activity Costs (costing/billing rates per employee per activity)
Activity Cost:
  employee: "HR-EMP-00001"
  activity_type: "Execution"
  costing_rate: 150    # Internal cost per hour
  billing_rate: 250    # Client-facing rate per hour

# Create for 3 employees x 4 activities = 12 records
# Rates: Execution (150/250), Planning (120/200), Concrete Works (130/220), Electrical (140/240)

# 2. Timesheets (with billable time_logs linked to project + task)
Timesheet:
  employee: "HR-EMP-00002"
  company: "Bena Construction (Demo)"
  time_logs[]:
    - activity_type: "Concrete Works"
      from_time: "2026-02-03 07:00:00"
      to_time: "2026-02-03 16:00:00"
      hours: 9
      project: "PROJ-0003"
      task: "TASK-2026-00002"
      is_billable: 1
      billing_rate: 220      # Matches Activity Cost
      costing_rate: 130
  → Submit (docstatus: 1)
```

### Timesheet Schedule (10 Timesheets)

| # | Employee | Activity | Dates | Hours | Billable |
|---|----------|----------|-------|-------|----------|
| TS-01 | eslam (EMP-001) | Execution + Planning | Feb 1-2 | 17 | No |
| TS-02 | eslam (EMP-001) | Execution + Planning | Mar 10 | 19 | No |
| TS-03 | eslam (EMP-001) | Concrete Works | Apr 1 | 9 | No |
| TS-04 | eslam (EMP-001) | (pre-existing) | Mar 3 | 23 | No |
| TS-05 | Ahmed (EMP-002) | Concrete Works | Feb 3-4 | 17 | Yes |
| TS-06 | Khalid (EMP-003) | Planning + Execution | Feb 5-6 | 18 | Yes |
| TS-07 | Ahmed (EMP-002) | Electrical | Feb 10-11 | 17 | Yes |
| TS-08 | eslam (EMP-001) | Execution | Feb 15-16 | 19 | Yes |
| TS-09 | Fatima (EMP-004) | Planning | Feb 20 | 8 | Yes |
| TS-10 | Omar (EMP-005) | Execution | Mar 1-2 | 19 | Yes |

**Total**: 166 hours, ~SAR 20K costing, 5 different employees, 8 different dates

### Reports Fed

| Report | What It Needs | Status |
|--------|--------------|--------|
| Daily Timesheet Summary | Submitted timesheets with dates | Working |
| Project Billing Summary | Timesheets with costing + Sales Invoices with project | Working |
| Project wise Stock Tracking | Stock Entries (Material Issue) with project | Working |
| Delayed Tasks Summary | Tasks past exp_end_date with non-Completed status | Working |

### Lesson: Activity Cost Before Timesheet

40. **Create Activity Cost BEFORE Timesheets** — When a Timesheet is created with `is_billable=1`, Frappe auto-looks up the Activity Cost record to populate `costing_rate` and `billing_rate`. If no Activity Cost exists, rates stay at 0 even though `is_billable=1`. Create Activity Costs first.
41. **Timesheet `project` is on child rows** — Like JE accounts, the `project` field is on `time_logs` (child table), not the parent Timesheet. Reports query the child table.
42. **Timesheet `project` field blocked in REST filters** — `Field not permitted in query: project`. Use other filters (employee, dates) or fetch all and filter client-side.

---

## Phase 16: Project Updates & Site Data (DONE)

### Records Created

| DocType | Records | Details |
|---------|---------|---------|
| Project Updates | 15 | All enriched with labor/equipment/materials logs |
| Project Equipment | 8 | 3 Owned (from Assets), 3 Rented, 2 Owned direct |
| Customer Team Members | 3 | With contacts and roles |
| Issues | 4 | Mixed priorities (Critical, High, Medium, Low) |

### Project Update Coverage

All 15 Project Updates (PROJ-UPD-2026-00001 to 00015) have:
- `expected_qty`, `actual_qty`, `progress_percentage`, `variance`, `update_qty`, `update_amount`
- 14/15 have `labor_log` entries (workers_count, hours, trade, supervisor)
- 13/15 have `equipment_log` entries (equipment_type, hours_used, rate, amount, status)
- 10/15 have `materials_log` entries (item, qty, uom, type)
- PU-10: Weather delay (weather_delay=1, lost_hours=8, delay_days=1)
- PU-9: Safety incident (incident_severity="Near Miss", body_part="Head")

### Valid Field Options (from DocType JSONs)

```
Project Update:
  log_category: "Work Activities" | "Equipment" | "Materials" | "Weather" | "Safety"

Project Update Labor:
  labor_type: "Own Workers" | "Subcontractor"
  trade: Link to Activity Type

Project Update Equipment:
  equipment_type: "Owned Asset" | "Rented" | "Consumable"
  status: "Working" | "Breakdown" | "Idle" | "Maintenance"

Project Update Material:
  type: "Used" | "Needed" | "Delivered" | "Requested"

Project Equipment (Bid Equipment child table):
  equipment_source: "Asset" | "Item Master" | "Direct Entry"
  ownership_status: "Owned" | "Rented" | "Leased" | "To be Procured" | "Subcontractor Provided"
```

---

## Full Data Inventory (PROJ-0003 on accbuilddev.mvpstorm.com)

### Company & Fiscal

| Item | Value |
|------|-------|
| Company | Bena Construction (Demo) (BCD) |
| Currency | SAR |
| Fiscal Year | FY 2025-2026 (Jul 2025 - Jun 2026) |
| Cost Center | Main - BCD |
| Warehouses | Stores, Work In Progress, Finished Goods (all - BCD) |

### All Record Counts

| DocType | Count | Key Details |
|---------|-------|-------------|
| **Master Data** | | |
| Employees | 7 | HR-EMP-00001 to 00007 |
| Activity Types | 20+ | Construction-specific |
| Activity Costs | 12 | 3 employees x 4 activities |
| Items (stock) | 10+ | Active construction materials |
| Items (fixed asset) | 3 | Excavator, Hilux, Total Station |
| **Project Records** | | |
| Tasks | 10 | 4 Completed, 5 Working, 1 Overdue (40%) |
| Project Updates | 15 | All enriched with logs |
| Timesheets | 10 | All submitted, 166 total hours |
| WIRs | 7 | Mixed statuses |
| Construction Contracts | 4 | 1 main + 3 subcontracts |
| Payment Certificates | 11 | Most submitted |
| Issues | 4 | Mixed priorities |
| Equipment | 8 | Owned + Rented |
| Customer Team | 3 | With contacts |
| Project Team | 6 | With roles |
| RFIs | 3 | Open/Responded/Closed |
| Submittals | 3 | Shop Drawing/Product Data/Sample |
| **Financial** | | |
| Sales Invoices | 5 (PROJ) | ~SAR 280,000 |
| Purchase Invoices | 3 (PROJ) | ~SAR 44,000 |
| Stock Entries | 6 | 3 Receipt + 2 Issue + 1 Transfer |
| Journal Entries | 15+ | Spread across 6 months |
| Payment Entries | Multiple | Customer + Supplier |
| Budgets | 1 | Cost Center, FY 2025-2026 |
| Bank Account | 1 | Rajhi Bank |
| **HR & Payroll** | | |
| Attendance | 18 | 6 employees x 3 days |
| Leave Allocations | 7 | Annual + Sick |
| Leave Applications | 2 | Approved |
| Expense Claims | 2 | Submitted |
| Assets | 3 | With depreciation |
| Salary Components | 4 | 3 Earning + 1 Deduction |
| Salary Structure | 1 | Submitted with formulas |
| Salary Slips | 6 | Feb 2026, ~SAR 68K net |

### Reports Coverage (55 total)

**AccuBuild Custom (5):** Project P&L by WBS, RFP Pipeline, Material Takeoff, Subcontractor Reconciliation, WIP Schedule

**Projects Module (4):** Daily Timesheet Summary, Project wise Stock Tracking, Project Billing Summary, Delayed Tasks Summary

**ERPNext Financial (46):** Trial Balance, P&L, Balance Sheet, General Ledger, Cash Flow, Accounts Receivable/Payable, Budget Variance, Stock Ledger, Stock Balance, and all other standard reports

---

## Recommended Demo Data Script Architecture

```
accubuild_core/demo/
  seed/                    # Phase 1: Foundation data (existing)
  data/                    # Phase 2-3: JSON records (existing, 11 files)
  demo_project/            # NEW: Full project lifecycle
    phase_03_project.py    # Project + RFP workflow + Bid + estimation tree
    phase_04_contract.py   # Contract + WBS + Budget Lines
    phase_05_procurement.py # MR → PO → PR → PI chain
    phase_06_sales.py      # SO → DN → SI chain
    phase_07_stock.py      # Stock Receipt → Transfer → Issue
    phase_08_site_ops.py   # WIR + Timesheet
    phase_09_financial.py  # Payment Cert + Payment Entry + JE
    phase_10_changes.py    # Change Request + Change Order
    phase_11_documents.py  # Construction Doc + RFI + Submittal
    phase_12_budget_adj.py # Budget Adjustment
    phase_13_hr_assets.py  # Holiday List, Dept, Desig, Employee, Attendance, Leave, Expense Claim, Assets
    phase_14_payroll.py    # Salary Components, Structure, SSA, Payroll Entry, Salary Slips
    runner.py              # Orchestrates all phases in order
```

Each phase script should:
- Be idempotent (check if records exist before creating)
- Log what it creates
- Return a summary dict
- Handle errors gracefully (log and continue)

Register as a bench command:

```python
@click.command("accubuild-seed-demo-project")
@click.option("--project", default="PROJ-DEMO", help="Project ID to create")
@click.option("--phase", type=int, default=0, help="Run specific phase (0=all)")
@pass_context
def seed_demo_project(context, project, phase):
    """Create a complete demo project with all DocType connections."""
```

---

## Quick Checklist

Before presenting a demo, verify all these show data:

- [ ] Project form → Connections panel shows all DocType counts
- [ ] Bid form → Estimation tree has nodes at 2+ levels
- [ ] Bid form → All tabs populated (Details, Financial, Taxes, Terms, Milestones, Team, Attachments)
- [ ] WBS Budget Lines → 3+ cost categories with planned + actual amounts
- [ ] P&L Report → Revenue, Direct Cost, Overhead, Gross Profit all non-zero
- [ ] P&L Report → Chart shows bars
- [ ] P&L Report → Summary cards show totals
- [ ] Payment Certificate → At least one in "Paid" status
- [ ] Procurement chain → MR → PO → PR → PI all submitted
- [ ] Journal Entries → 15+ submitted, spread across 6 months, hitting 9+ WBS elements
- [ ] At least one Payment Entry (Receive) from client
- [ ] At least one Payment Entry (Pay) to supplier
- [ ] RFI, Submittal, Construction Document → at least 1 each
- [ ] Timesheet → 10 submitted, 5 employees, billable rates populated
- [ ] Activity Costs → 12 records (3 employees x 4 activities)
- [ ] Daily Timesheet Summary report → returns data for Feb-Mar 2026
- [ ] Project Billing Summary → shows costing + billing
- [ ] Delayed Tasks Summary → shows TASK-2026-00006 (Overdue)
- [ ] Project wise Stock Tracking → shows Material Issues for PROJ-0003
- [ ] WIR → at least 1 approved
- [ ] Project Updates → 15 with labor/equipment/materials logs
- [ ] Project Equipment → 8 items (Owned + Rented)
- [ ] Project Issues → 4 mixed priorities
- [ ] Project → custom_project_team has 3+ employees with roles
- [ ] Project → custom_customer_focal_points has 1+ contact
- [ ] Employee list → 5+ active employees with departments
- [ ] Attendance → records for 3+ days
- [ ] Leave Application → at least 1 approved (annual + sick)
- [ ] Expense Claim → at least 1 submitted with project link
- [ ] Asset → at least 1 submitted with project + custodian
- [ ] Asset Categories → 2+ with depreciation schedules
- [ ] Salary Components → 3+ earnings + 1+ deduction with accounts mapped
- [ ] Salary Structure → 1 submitted with formula-based components
- [ ] Salary Structure Assignments → 1 per active employee, submitted
- [ ] Salary Slips → 6 submitted for one month (Feb 2026), total net ~SAR 68K
- [ ] Employee → Connections panel shows: Attendance, Leave, Salary Slip, Expense Claim
