---
name: import-master-data
description: Import client master data from Excel sheets into AccuBuild DocTypes (Items, Estimation Templates, Productivity Rates). Handles UOM mapping, cross-file joins, deduplication, and bilingual AR/EN data.
argument-hint: "folder_path [--phase 1-5] [--dry-run] [--mode fast|deep]"
---

## Input
Target: $ARGUMENTS

**Required**:
- **folder_path**: Path to folder containing client Excel files

**Optional**:
- **--phase**: Run specific phase only (1-5). Default: all phases in order
- **--dry-run**: Analyze and report without creating records
- **--mode**: "fast" (skip quality checks) or "deep" (full validation + report)

**Fallback behavior**:
- folder_path missing -> Ask user for Excel file location
- Excel files not found -> List expected filenames, ask user to confirm
- Phase dependencies unmet -> Run prerequisite phases first

---

## Context: AccuBuild Master Data Architecture

### Data Flow (dependency order)
```
Phase 1: UOM (standalone, no dependencies)
Phase 2: Item Groups + Items (needs UOMs from Phase 1)
Phase 3: Work Divisions + Activity Types (seeded via bench command, may need updates)
Phase 4: Productivity Rates (needs Activity Types + Work Divisions + UOMs)
Phase 5: Estimation Templates + Resources + Components (needs Items + Activity Types + WDs)
```

### Source Files (3 datasets from client)

**File A: Task List** (`csi_task_list_with_work_dev_and_prodactivty_en_ar.xlsx`)
- 907 rows, 12 columns (B-L)
- Produces: Activity Type leaves, Resource Productivity Rates, Estimation Template parents
- Key columns:
  - C: Main service category (AR) -> Work Division link
  - E: Service name (AR) -> description, JOIN KEY to File B
  - F: Service description (AR)
  - G: English name -> Activity Type name, template_name
  - H: English description
  - I: Crew type (AR), J: Crew count, K: UOM (AR), L: Daily productivity

**File B: Materials & Tools** (`List_of_materials, quantities_and_tools.xlsx`)
- 3,449 rows, 10 columns (B-J)
- Produces: Items (~2,777 unique), Estimation Template Resources (child rows)
- Key columns:
  - B: Service name with number prefix (AR) -> JOIN KEY to File A col E
  - D: Item type (مادة/عدة/معدة) -> resource_type + item_group
  - E: Item name (AR)
  - F: Coverage rate (materials only)
  - G: Depreciation rate (tools only)
  - H: Productivity rate (equipment only)
  - I: UOM (AR), J: Cost (SAR)

**File C: BOQ Assemblies** (`مقايسة اعمال (1).xlsx`)
- 155 rows, 7 columns (B-G)
- Produces: Assembly-type Estimation Templates (scope + element level)
- Key columns:
  - C: Scope (6 unique), D: Element (~20 unique), E: Type, F: Description, G: UOM

### Cross-File Join Logic
```python
# File B -> File A: link materials to tasks
file_b_service = strip_number_prefix(col_B)  # "1. إزالة بلاط..." -> "إزالة بلاط..."
match_to_file_a = fuzzy_match(file_b_service, file_a_col_E)
template_name = file_a_col_G  # English name from matched row
```

### UOM Master Map (Arabic -> ERPNext)
```python
UOM_MAP = {
    'م²': 'Square Meter', 'م2': 'Square Meter', 'm^2': 'Square Meter',
    'م³': 'Cubic Meter', 'م3': 'Cubic Meter', 'm^3': 'Cubic Meter',
    'م.ط': 'Meter', 'متر': 'Meter', 'متر طولي': 'Meter',
    'عدد': 'Nos', 'حبة': 'Nos',
    'يومية': 'Day', 'يوم': 'Day',
    'شهر': 'Month',
    'مقطوع': 'Lump Sum',
    'رد': 'Trip',
    'كجم': 'Kg',
    'طن': 'Ton',
    'لتر': 'Liter',
    'رول': 'Roll', 'لفة': 'Roll',
    'كيس': 'Bag',
    'سطل': 'Bucket',
    'جالون': 'Gallon',
    'علبة': 'Box', 'عبوة': 'Pack',
    'طقم': 'Set',
    'زوج': 'Pair',
    'لوح': 'Sheet',
    'وحدة': 'Unit',
    'ساعة': 'Hour',
    'هكتار': 'Hectare',
}
```

### Item Type Map
```python
ITEM_TYPE_MAP = {
    'مادة':     {'item_group': 'Construction Materials', 'resource_type': 'Material', 'is_stock': 1, 'is_asset': 0},
    'عدة':      {'item_group': 'Construction Tools',     'resource_type': 'Equipment', 'is_stock': 0, 'is_asset': 0},
    'عدة/أداة': {'item_group': 'Construction Tools',     'resource_type': 'Equipment', 'is_stock': 0, 'is_asset': 0},
    'معدة':     {'item_group': 'Construction Equipment',  'resource_type': 'Equipment', 'is_stock': 0, 'is_asset': 1},
}
```

### Quantity Column Selection (File B -> Est. Template Resource)
```python
if item_type == 'مادة':
    quantity = col_F  # coverage rate (direct)
elif item_type in ('عدة', 'عدة/أداة'):
    quantity = 1 / col_G if col_G else 0  # invert depreciation rate
elif item_type == 'معدة':
    quantity = 1 / col_H if col_H else 0  # invert productivity rate
```

---

## Target DocTypes & Field Mapping

### Phase 2: Item (ERPNext built-in + 11 custom fields)
| Excel (File B) | Target Field | Notes |
|---|---|---|
| col E | `item_name` | Arabic name |
| col E | `item_code` | Same as item_name or auto-generate |
| col D | `item_group` | Map via ITEM_TYPE_MAP |
| col D | `custom_resource_type` | Map via ITEM_TYPE_MAP |
| col I | `stock_uom` | Map Arabic UOM |
| col J | `standard_rate` | Cost SAR |
| derived | `is_stock_item` | 1 if مادة |
| derived | `is_fixed_asset` | 1 if معدة |

Dedup key: `normalize(item_name) + item_type`

### Phase 4: Resource Productivity Rate
| Excel (File A) | Target Field |
|---|---|
| hardcoded | `resource_type` = "Labor" |
| col C | `work_division` (map AR name -> WD docname) |
| col G | `activity_type` (EN name = AT docname) |
| col J | `crew_size` (handle "-" as 1) |
| col K | `productivity_uom` (map AR UOM) |
| col L | `daily_productivity` (skip if "-") |
| col I | `notes` (crew type Arabic) |
| hardcoded | `working_hours_per_day` = 8.0 |

### Phase 5a: Estimation Template (parent from File A)
| Excel (File A) | Target Field |
|---|---|
| col G | `template_name` (EN name, unique) |
| hardcoded | `template_type` = "Item" |
| hardcoded | `estimation_category` = "Template" |
| hardcoded | `usage_context` = "All" |
| col K | `base_uom` (map AR UOM) |
| col C | `work_division` (map AR name) |
| col E | `description` (AR service name) |
| col F | `ai_description` (AR description) |
| col G | `matching_keywords` (EN name) |

### Phase 5b: Estimation Template Resource (child from File B)
| Excel (File B) | Target Field |
|---|---|
| col D | `resource_type` (map via ITEM_TYPE_MAP) |
| col E | `item` (Link to Item created in Phase 2) |
| col E | `description` (item name) |
| col I | `uom` (map AR UOM) |
| col F/G/H | `quantity` (depends on item type, see logic above) |
| col J | `rate` (cost SAR) |

Join to parent: strip number prefix from File B col B, match to File A col E, get template_name from col G.

### Phase 5c: Estimation Template Assembly (from File C)
- Scope level (6 records): template_type="Assembly", child `components` link to element-level
- Element level (~20 records): template_type="Assembly", child `components` link to Item-level templates

---

## Data Cleaning Pipeline (runs before import)

### Pipeline Flow
```
Dirty Excel -> read_file_a/b/c() -> clean_and_export() -> cleaned dicts + CSV files -> import phases
```

The `--clean-only` flag exports CSVs without importing. User reviews CSVs, then re-runs without the flag.

### Arabic Text Normalization (`data_cleaner.normalize_arabic`)
- Strip diacritics (tashkeel: fatha, damma, kasra, shadda, sukun, tanween)
- Normalize letter variants: أ/إ/آ→ا, ى→ي, ة→ه, ؤ→و, ئ→ي
- Collapse whitespace
- Used for matching, NOT for display (original Arabic preserved in display fields)

### Item Name Cleaning (`data_cleaner.clean_item_name`)
- Unicode NFC normalization
- Strip leading bullets: "1.", "1-", "1)", "-", "•"
- Collapse whitespace, strip trailing periods
- Applied to: File B item_name_ar, File A service_name_ar, File C scope/element/description

### English Name Cleaning (`data_cleaner.clean_english_name`)
- Title Case (each word capitalized)
- Remove Frappe-breaking chars: / \ # % ?
- Max 140 chars (Frappe Data field limit)
- Applied to: File A english_name (becomes DocType name in Activity Type, Estimation Template)

### UOM Standardization (`data_cleaner.clean_uom`)
Three-tier matching:
1. Exact match in UOM_MAP (40+ entries)
2. Fuzzy match in UOM_FUZZY (30+ entries: typos, English abbreviations, alternate Arabic)
3. Normalized Arabic match (strip diacritics, compare)
4. Fallback: use original text as UOM name

Fuzzy additions beyond UOM_MAP:
```python
UOM_FUZZY = {
    'م 2': 'Square Meter', 'sqm': 'Square Meter', 'sq.m': 'Square Meter',
    'حبه': 'Nos',  # typo for حبة
    'قطعة': 'Nos', 'قطعه': 'Nos', 'pcs': 'Nos', 'ea': 'Nos',
    'يوميه': 'Day', 'ls': 'Lump Sum', 'l.s': 'Lump Sum',
    'lm': 'Meter', 'l.m': 'Meter', 'hr': 'Hour', 'hrs': 'Hour',
    ...
}
```

### Item Type Standardization (`data_cleaner.clean_item_type`)
Fuzzy matching for typos: ماده→مادة, مواد→مادة, عده→عدة, معده→معدة, معدات→معدة, آلة→معدة

### Numeric Standardization (`data_cleaner.clean_rate`)
- Convert to float, default 0.0
- Clamp to [0, 999999999] (reject negatives)
- Round to 4 decimal places
- Handle "-", "N/A", empty as 0.0

### Crew Size Standardization (`data_cleaner.clean_crew_size`)
- Integer >= 1 (minimum 1 worker)
- Handle "-", empty as 1

### CSV Output
Exports to `{folder}/cleaned/`:
- `file_a_cleaned.csv` — with added `uom_en` column (mapped UOM)
- `file_b_cleaned.csv` — with added `item_type_en` and `uom_en` columns
- `file_c_cleaned.csv` — with added `uom_en` column
- `cleaning_report.csv` — fix counts per file per category

### Adding New Cleaning Rules
Add to `data_cleaner.py`:
- New UOM fuzzy entries → add to `UOM_FUZZY` dict
- New item type variants → add to `ITEM_TYPE_FUZZY` dict
- New Arabic normalizations → add to `AR_NORMALIZE_MAP` dict
- New name cleaning rules → modify `clean_item_name()` or `clean_english_name()`

---

## Execution Rules

### Idempotency (CRITICAL)
Every phase MUST be idempotent — safe to re-run:
```python
# Check before insert
if frappe.db.exists("Item", {"item_name": name, "item_group": group}):
    skip  # or update if --force
```

### Error Handling
- UOM not found in map -> log warning, use original Arabic text as UOM name
- Cross-file join fails -> log unmatched rows, continue with matched
- Duplicate item names -> take last occurrence cost, log dedup count
- Empty rate/quantity -> skip row, log as "incomplete data"

### Batch Processing
- Commit every 100 records (not per-record, not at end)
- Print progress: `Items: 250/2777 created (50 skipped)`

### Data Quality Checks (deep mode)
- Report: total rows, matched/unmatched cross-file joins
- Report: UOM mapping coverage
- Report: duplicate items found and resolution
- Report: empty/missing critical fields per phase

---

## Preflight Rules (HARD GATES)

### Gate 1 — File Discovery
1. Scan folder for Excel files (.xlsx)
2. Match to expected patterns:
   - File A: contains "task_list" or "prodactivty" in name
   - File B: contains "materials" or "quantities" in name
   - File C: contains "مقايسة" in name
3. If files not found, list what's in folder and ask user to identify

### Gate 2 — Prerequisites Check
1. Verify seed data exists: `frappe.db.count("Work Division") > 0`
2. If not: "Run `bench --site [site] accubuild-seed-master-data` first"
3. Verify UOMs exist (spot check: Square Meter, Nos, Day)
4. Verify Item Groups exist (Construction Materials, Tools, Equipment)

### Gate 3 — Data Quality Preview
1. Read first 20 rows of each file
2. Verify column structure matches expectations
3. Report: row counts, column counts, sample data
4. Ask user to confirm before proceeding

### Gate 4 — Dry Run Report (deep mode)
1. Full scan without writes
2. Report: records to create per DocType, potential issues, unmatched joins
3. Ask user to approve before creating records

---

## Output Format

### Progress (during execution)
```
Phase 1: UOM
  UOM: 13 created, 0 skipped (already exist)

Phase 2: Items
  Reading File B... 3449 rows
  Deduplicating... 2777 unique items
  Items: 2777 created, 0 updated, 0 errors

Phase 4: Productivity Rates
  Reading File A... 907 rows
  Productivity Rates: 850 created, 57 skipped (no productivity data)

Phase 5: Estimation Templates
  Creating parents from File A... 907 templates
  Linking resources from File B... 3449 child rows (698 matched, 103 unmatched)
  Creating assemblies from File C... 26 assemblies
```

### Final Report
```
=== AccuBuild Master Data Import Complete ===
UOM:                    13 created
Items:                  2,777 created
Work Divisions:         0 (already seeded)
Activity Types:         907 leaves created
Productivity Rates:     850 created
Estimation Templates:   907 Item + 26 Assembly = 933 total
Template Resources:     3,449 child rows (698 matched)

Warnings:
  - 103 File B rows could not match to File A (logged to import_errors.json)
  - 57 File A rows had no productivity data (col L = "-")

Output: demo/import_log_2026-03-06.json
```

---

## Key Files

### App structure (AccuBuild)
```
accubuild_core/
  commands.py                    # bench commands: seed-master-data + import-client-data
  demo/
    import_utils/                # Client data import pipeline
      __init__.py
      data_cleaner.py            # Data cleaning + CSV export (runs before import)
      file_reader.py             # Excel reading + cross-file join logic
      uom_map.py                 # UOM + item type constants
      phase2_items.py            # Phase 2: Item creation from File B
      phase4_productivity.py     # Phase 4: Productivity Rates from File A
      phase5_templates.py        # Phase 5: Estimation Templates from Files A/B/C
    seed/                        # Base seed data (run once, never overwrite)
      work_division.json         # 63 CSI Work Division records
      activity_type.json         # 59 group Activity Types (linked to WDs)
      uom.json                   # 13 missing UOMs
      item_group.json            # 5 construction item groups
    client_master_data_sheets/   # Client Excel files go here
  hooks.py                       # Fixtures: Custom Field, Workspace, Role only
                                 # NOT Work Division, Item Group, Item (those are seeded)
```

### DocType locations
```
accubuild_bidding/doctype/
  estimation_template/           # Parent with resources + components child tables
  estimation_template_resource/  # Child: material/labor/equipment per template
  estimation_template_component/ # Child: sub-template links for assemblies
  work_division/                 # Tree DocType (CSI divisions)
  productivity_rate_list/        # Named list container
  productivity_rate_item/        # Child table of rate list

accubuild_site_ops/doctype/
  activity_type/                 # Tree DocType (construction activities)
  resource_productivity_rate/    # Standalone productivity records
```

### Custom fields on Item (11 total, in fixtures/custom_field.json)
- `custom_resource_type` (Select: Material/Labor/Equipment/Subcontract/Overhead)
- `custom_work_division` (Link -> Work Division)
- `custom_sub_item_group` (Link -> Item Group)
- `custom_has_estimation_template` (Check)
- `custom_estimation_template` (Link -> Estimation Template)
- `custom_default_markup_pct` (Percent)
- `custom_productivity_rate` (Link -> Productivity Rate List)
- `custom_specification` (Text Editor)
- `custom_catalogue_attachment` (Attach)
- `custom_requires_submittal` (Check)

### Fields added for import support
**Work Division** (5 new fields):
- `division_name_en` (Data) - English name
- `sort_order` (Int) - Display order
- `default_uom` (Link -> UOM)
- `icon` (Data) - Font Awesome class
- `color` (Color)

**Activity Type** (6 new fields):
- `activity_name_ar` (Data) - Arabic name
- `description_ar` (Text) - Arabic description
- `default_uom` (Link -> UOM)
- `default_crew_type` (Data) - Crew composition
- `default_crew_size` (Int) - Workers per crew
- `default_productivity` (Float) - Daily output

---

## Fixture vs Seed vs Import Decision Tree

```
Is this data the same for ALL clients?
  YES -> Is it safe to overwrite on migrate?
    YES -> fixtures/ (Custom Field, Workspace, Role, Property Setter)
    NO  -> demo/seed/ + bench command (Work Division, Activity Type, UOM, Item Group)
  NO  -> Client import tool (Items, Est Templates, Productivity Rates, Prices)
```

Never put client-editable data in fixtures. It gets overwritten on `bench migrate`.
