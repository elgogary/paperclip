# AccuBuild Seed Data Reference

Master seed data from AccuBuild Core demo folder. Use as reference when inserting data via ERPNext Data Inserter skill.

## Foundation Data (seed/ folder)

### 1. UOM (Unit of Measure)
```json
{
  "doctype": "UOM",
  "uom_name": "Day|Month|Lump Sum|Trip|Roll|Bag|Bucket|Gallon|Sheet|Pack|Pair|Hectare|Point",
  "must_be_whole_number": 0 or 1
}
```

**Common UOMs:**
- Time: Day, Month
- Quantity: Piece, Bag, Pack, Pair, Roll, Sheet
- Volume: Gallon, Cubic Meter
- Area: Square Meter, Hectare
- Weight: Kilogram, Ton
- Special: Lump Sum, Trip, Point

### 2. Item Group (Hierarchy)
```json
{
  "doctype": "Item Group",
  "item_group_name": "Group Name",
  "is_group": 0 or 1,
  "parent_item_group": "Parent Group Name"
}
```

**Item Group Tree:**
```
All Item Groups
├── Construction Elements
│   ├── Material - MAT
│   │   ├── Steel - MSTL
│   │   ├── Concrete - MCON
│   │   ├── Glass - MGLZ
│   │   ├── Wood & Timber - MWOD
│   │   ├── Insulation - MINS
│   │   ├── Paint & Coating - MPNT
│   │   ├── Tiles & Stone - MTIL
│   │   ├── Plumbing Materials - MPLB
│   │   ├── Electrical Materials - MELC
│   │   └── Aluminum - MALM
│   ├── Equipment - EQP
│   ├── Labor - LBR
│   │   └── Contracted - LBRC
│   ├── Subcontractor - SUB
│   │   └── Earthworks - SBEW
│   └── Service - SRV
├── Bidding Items
└── Fixed Assets
    ├── Heavy Machinery
    ├── Light Equipment
    ├── Office Equipment
    ├── Portables
    └── Vehicles
```

### 3. Work Division
```json
{
  "doctype": "Work Division",
  "name": "WD-XXX",
  "division_code": "XXX",
  "division_name": "English Name - Arabic Name",
  "division_scope": "Description of scope",
  "active": 1,
  "is_group": 0 or 1,
  "parent_work_division": "WD-XXX"
}
```

**Key Work Divisions:**
| Code | Name (EN) | Name (AR) |
|------|-----------|-----------|
| WD-0200/WD-200 | Existing Conditions | الأعمال القائمة |
| WD-0300/WD-300 | Concrete | الخرسانة |
| WD-03 | Mechanical | اعمال الميكانيكا |
| WD-0400/WD-400 | Masonry | البناء |
| WD-42 | Demolition | أعمال التكسير والإزالة |
| WD-500 | Metals | المعادن |
| WD-600 | Wood & Plastics | الأخشاب |
| WD-700/WD-0700 | Thermal Protection | العزل |
| WD-715 | Waterproofing | العزل المائي |
| WD-800 | Openings | الفتحات |
| WD-2200 | Plumbing | السباكة |
| WD-2300 | HVAC | التكييف |
| WD-2600 | Electrical | الكهرباء |
| WD-2700 | Communications & Data | شبكات البيانات |
| WD-3100 | Earthwork | الأعمال الترابية |
| WD-3200 | Exterior Improvements | تحسينات خارجية |
| WD-3300 | Utilities | المرافق |

### 4. Activity Type
```json
{
  "doctype": "Activity Type",
  "activity_type": "Activity Name",
  "activity_name_ar": "الاسم بالعربي",
  "is_group": 0 or 1,
  "disabled": 0,
  "work_division": "WD-XXX"
}
```

**Common Activity Types:**
- Demolition (WD-42): Breaking, Demolition, Dismantling, Surface Stripping
- Concrete (WD-0300): Concrete Works, Formwork & Shoring, Rebar Works
- Masonry (WD-400): Masonry, Blockwork
- Finishes (WD-900): Painting, Plastering, Tiling, Ceilings, Wall Cladding
- MEP: Electrical, Plumbing, HVAC, Smart Home, Solar Energy
- Special: Acoustic Insulation, Thermal Insulation, Waterproofing

### 5. Resource Productivity Rate
```json
{
  "doctype": "Resource Productivity Rate",
  "resource_type": "Labor|Equipment|Material",
  "productivity_rate_list": "Client Standard Rates",
  "work_division": "WD-XXX",
  "activity_type": "Activity Name",
  "crew_size": 2,
  "productivity_uom": "Square Meter|Cubic Meter|Meter|Piece|Day",
  "daily_productivity": 100.0,
  "working_hours_per_day": 8.0,
  "hourly_productivity": 12.5,
  "per_person_productivity": 50.0,
  "time_to_delivery_uom": "Day",
  "notes": "عامل"
}
```

## Core Data Examples (data/ folder)

### Customer
```json
{
  "doctype": "Customer",
  "customer_name": "Demo Property Holdings",
  "customer_type": "Company",
  "customer_group": "Commercial"
}
```

**Field Aliases for Mapping:**
| Input Field | Target Field |
|-------------|--------------|
| name | customer_name |
| type | customer_type |
| group | customer_group |
| company | customer_name |
| client | customer_name |

### Item
```json
{
  "doctype": "Item",
  "item_code": "ITEM-001",
  "item_name": "Steel Beam 12mm",
  "item_group": "Steel - MSTL",
  "stock_uom": "Piece",
  "item_type": "Stockable Product"
}
```

**Field Aliases for Mapping:**
| Input Field | Target Field |
|-------------|--------------|
| name | item_name |
| code | item_code |
| sku | item_code |
| group | item_group |
| uom | stock_uom |

### Supplier
```json
{
  "doctype": "Supplier",
  "supplier_name": "ABC Materials Co",
  "supplier_type": "Company"
}
```

## Common Link Field Dependencies

When inserting records that reference other DocTypes:

| DocType | Link Field | Target DocType | Example Value |
|---------|-----------|---------------|---------------|
| Item | item_group | Item Group | "Steel - MSTL" |
| Item | stock_uom | UOM | "Piece" |
| Activity Type | work_division | Work Division | "WD-300" |
| Productivity Rate | work_division | Work Division | "WD-300" |
| Productivity Rate | activity_type | Activity Type | "Concrete Works" |
| Sales Invoice | customer | Customer | "CUST-00001" |
| Purchase Order | supplier | Supplier | "SUP-00001" |

## Insert Order (Dependencies)

Must insert in this order:

1. **UOM** — No dependencies
2. **Item Group** — Tree structure, start with "All Item Groups" root
3. **Work Division** — Tree structure, root is "01"
4. **Activity Type** — Depends on Work Division
5. **Resource Productivity Rate** — Depends on Work Division, Activity Type
6. **Customer** — No dependencies (for basic records)
7. **Supplier** — No dependencies
8. **Item** — Depends on Item Group, UOM
9. **Sales Invoice** — Depends on Customer, Items
10. **Purchase Order** — Depends on Supplier, Items

## Quick Insert Examples

### Insert UOM
```
fill data uom_name: Square Meter, must_be_whole_number: 0
```

### Insert Item Group
```
fill data item_group_name: Bricks - MBRK, parent_item_group: Material - MAT
```

### Insert Work Division
```
fill data division_code: 0350, division_name: Waterproofing - العزل المائي
```

### Insert Activity Type
```
fill data activity_type: Waterproofing, activity_name_ar: العزل المائي, work_division: WD-715
```

### Insert Customer
```
fill data customer_name: ABC Construction, customer_type: Company, customer_group: Commercial
```

### Insert Item
```
fill data item_code: STEEL-001, item_name: Steel Bar 12mm, item_group: Steel - MSTL, stock_uom: Piece
```
