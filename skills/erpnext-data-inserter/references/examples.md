# ERPNext Data Inserter Examples

Real-world examples of using the data inserter skill.

## Example 1: Quick Customer Creation

### User Input
```
name: ABC Construction, email: info@abc.com, phone: 555-1234, type: Commercial
```

### Skill Flow
1. Parse data into key-value pairs
2. Ask: "Which DocType?" → User: "Customer"
3. Fetch Customer schema
4. Auto-map:
   - name → customer_name
   - email → email_id
   - phone → phone_no
   - type → customer_group
5. Check required fields: territory is missing
6. Ask: "Set territory?" → User: "All Territories"
7. Insert document
8. Return: "Customer CUST-00001 created"

---

## Example 2: Sales Invoice from JSON

### User Input
```json
{
  "customer": "CUST-00001",
  "date": "2026-03-11",
  "due_date": "2026-04-10",
  "items": [
    {"item": "SERV-001", "qty": 5, "rate": 100},
    {"item": "SERV-002", "qty": 2, "rate": 250}
  ]
}
```

### Skill Flow
1. Parse JSON structure
2. Ask: "Which DocType?" → User: "Sales Invoice"
3. Fetch Sales Invoice schema
4. Map fields:
   - customer → customer
   - date → posting_date
   - due_date → due_date
   - items → items (child table)
5. Verify customer "CUST-00001" exists
6. Verify items "SERV-001" and "SERV-002" exist
7. Map child table fields:
   - item → item_code
   - qty → qty
   - rate → rate
8. Insert with calculated totals
9. Return: "Sales Invoice SINV-00001 created"

---

## Example 3: Natural Language

### User Input
```
Create a new lead called TechStartup with email hello@tech.co,
phone 555-9999, source is Website, status is Contacted
```

### Skill Flow
1. Extract key-value pairs using NLP:
   - name = TechStartup
   - email = hello@tech.co
   - phone = 555-9999
   - source = Website
   - status = Contacted
2. Ask: "Which DocType?" → User: "Lead"
3. Fetch Lead schema
4. Map:
   - name → lead_name
   - email → email_1
   - phone → phone
   - source → source
   - status → status
5. Validate "Website" is a valid source option
6. Validate "Contacted" is a valid status
7. Insert document
8. Return: "Lead LDEAD-00001 created"

---

## Example 4: Bulk Insert from Excel

### User Input
```
Insert data from C:\data\customers.xlsx into Customer DocType
```

### Skill Flow
1. Read Excel file
2. Show preview:
   ```
   Row 1: Company, Email, Phone, Type
   Row 2: Acme Corp, acme@.com, 555-0001, Commercial
   Row 3: Beta Inc, beta@.com, 555-0002, Retail
   ...
   ```
3. Fetch Customer schema
4. Map columns:
   - Company → customer_name
   - Email → email_id
   - Phone → phone_no
   - Type → customer_group
5. Confirm mapping with user
6. Check for missing required (territory)
7. Ask: "Use default territory 'All Territories' for all?" → User: "Yes"
8. Insert all rows
9. Report: "15 customers created, 0 failed"

---

## Example 5: Item with Attributes

### User Input
```
code: ITEM-001, name: Steel Beam, uom: pcs, rate: 500,
item_group: Structural Materials, stock_uom: nos
```

### Skill Flow
1. Parse data
2. Ask: "Which DocType?" → User: "Item"
3. Fetch Item schema
4. Map fields directly (most match exactly)
5. Validate item_group exists
6. Validate uom "pcs" exists in UOM DocType
7. Insert document
8. Return: "Item ITEM-001 created"

---

## Example 6: Project with Tasks

### User Input
```json
{
  "project_name": "Building A Construction",
  "customer": "CUST-00001",
  "start_date": "2026-03-15",
  "expected_end": "2026-12-31",
  "tasks": [
    {"task": "Foundation", "start": "2026-03-15", "end": "2026-04-30"},
    {"task": "Structure", "start": "2026-05-01", "end": "2026-08-31"}
  ]
}
```

### Skill Flow
1. Parse JSON with nested array
2. Ask: "Which DocType?" → User: "Project"
3. Fetch Project schema
4. Map parent fields
5. Detect nested "tasks" array → confirm child table field
6. Map child table fields
7. Insert project first, then tasks
8. Return: "Project PROJ-00001 created with 2 tasks"

---

## Example 7: Fixing Failed Mapping

### User Input
```
client: BigCorp, contact_email: john@bigcorp.com,
contact_person: John Smith
```

### Skill Flow
1. Ask DocType → User: "Customer"
2. Auto-map attempt:
   - client → customer_name ✓
   - contact_email → ??? (no direct match)
   - contact_person → ??? (no direct match)
3. Skill asks:
   ```
   Unmapped fields:
   - contact_email → Which field? [email_id / other / skip]
   - contact_person → Which field? [skip / other]
   ```
4. User confirms:
   - contact_email → email_id
   - contact_person → skip
5. Insert with mapped data
6. Return: "Customer CUST-00002 created"
