# ERPNext Data Inserter Config

Project-specific patterns for field mapping and data insertion.

## Common Field Aliases

### Customer/Lead DocTypes
| Input Field | Target Field | DocType |
|-------------|--------------|---------|
| name | customer_name | Customer |
| name | lead_name | Lead |
| company | customer_name | Customer |
| client | customer_name | Customer |
| email | email_id | Customer, Lead |
| phone | phone_no | Customer, Lead |
| mobile | mobile_no | Customer, Lead |
| type | customer_group | Customer |
| category | customer_group | Customer |
| industry | industry | Customer |
| sector | industry | Customer |
| website | website | Customer, Lead |
| tax_id | tax_id | Customer |
| vat | tax_id | Customer |

### Item DocType
| Input Field | Target Field |
|-------------|--------------|
| name | item_name |
| code | item_code |
| sku | item_code |
| description | description |
| price | standard_rate |
| cost | valuation_rate |
| uom | stock_uom |
| category | item_group |
| type | item_group |

### Sales Invoice/Quotation
| Input Field | Target Field |
|-------------|--------------|
| customer | customer |
| client | customer |
| date | posting_date |
| due_date | due_date |
| amount | grand_total |
| total | grand_total |
| items | items (child table) |

## Default Values for Common Required Fields

| Field | Default Value | DocTypes |
|-------|---------------|----------|
| status | Draft | All |
| docstatus | 0 | All |
| territory | All Territories | Customer, Lead |
| customer_group | Individual | Customer |
| currency | USD | All (with currency) |
| price_list | Standard Buying | Purchase, Item |
| item_group | All Item Groups | Item |

## Field Type Validation Rules

### Link Fields
- Must verify linked document exists via `frappe_list_documents`
- Format: exact document name (case-sensitive)

### Select Fields
- Must match one of the options in DocType schema
- Case-insensitive matching allowed

### Date Fields
- Format: `YYYY-MM-DD`
- Accept: ISO dates, common formats (MM/DD/YYYY, DD-MM-YYYY)

### Currency Fields
- Format: number (decimal)
- Accept: numbers with/without currency symbols

### Check (Boolean) Fields
- Accept: true/false, 1/0, yes/no

## Child Table Patterns

### Common Child Table Names
| Input | Target | Parent DocType |
|-------|--------|----------------|
| items | items | Sales Invoice, Purchase Order, Quotation |
| lines | items | Invoice, Order |
| taxes | taxes | Invoice, Order |
| contacts | contacts | Customer, Lead |
| addresses | addresses | Customer, Lead |
| team | timesheet_details | Timesheet |

### Child Table Field Mapping
- Auto-detect: nested arrays in input become child tables
- Field names within child table follow same alias rules
