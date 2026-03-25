# Comprehensive Bilingual Seed Data Reference

Complete master data templates for ERPNext bilingual implementation (English + Arabic).

## Customer - Standard Level (12+ fields)

### English Customers

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

### Arabic Customers

```json
{
  "customer_name": "شركة الراجحي للإنشاءات",
  "customer_type": "Company",
  "customer_group": "Commercial",
  "territory": "Saudi Arabia",
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

### Customer Name Pairs (EN/AR)

| English | Arabic |
|---------|--------|
| Al-Rajhi Construction Company | شركة الراجحي للإنشاءات |
| Saudi Trade Center | مركز التجارة السعودي |
| United Supplies Company | الشركة المتحدة للتوريدات |
| Gulf Contractors | مقاولات الخليج العربي |
| Al-Amal Trading | شركة الأمل للتجارة |
| National Building Supplies | الشركة الوطنية لمواد البناء |
| Eastern Province Contractors | مقاولات المنطقة الشرقية |
| Riyadh Hardware Store | متجر الرياض للأدوات |
| Jeddah Building Materials | مواد البناء جدة |
| Dammam Trade Center | مركز التجارة الدمام |

## Customer Groups (Bilingual)

```json
{"customer_group_name": "Commercial", "is_group": 0, "parent_customer_group": "All Customer Groups"}
{"customer_group_name": "تجاري", "is_group": 0, "parent_customer_group": "All Customer Groups"}
{"customer_group_name": "Retail", "is_group": 0, "parent_customer_group": "All Customer Groups"}
{"customer_group_name": "قطاع التجزئة", "is_group": 0, "parent_customer_group": "All Customer Groups"}
{"customer_group_name": "Wholesale", "is_group": 0, "parent_customer_group": "All Customer Groups"}
{"customer_group_name": "جملة", "is_group": 0, "parent_customer_group": "All Customer Groups"}
{"customer_group_name": "Government", "is_group": 0, "parent_customer_group": "All Customer Groups"}
{"customer_group_name": "حكومي", "is_group": 0, "parent_customer_group": "All Customer Groups"}
```

## Territories (Saudi Regions)

```json
{"territory_name": "Saudi Arabia", "is_group": 0, "parent_territory": "All Territories"}
{"territory_name": "السعودية", "is_group": 0, "parent_territory": "All Territories"}
{"territory_name": "Riyadh", "is_group": 0, "parent_territory": "Saudi Arabia"}
{"territory_name": "الرياض", "is_group": 0, "parent_territory": "Saudi Arabia"}
{"territory_name": "Jeddah", "is_group": 0, "parent_territory": "Saudi Arabia"}
{"territory_name": "جدة", "is_group": 0, "parent_territory": "Saudi Arabia"}
{"territory_name": "Dammam", "is_group": 0, "parent_territory": "Saudi Arabia"}
{"territory_name": "الدمام", "is_group": 0, "parent_territory": "Saudi Arabia"}
{"territory_name": "Eastern Province", "is_group": 0, "parent_territory": "Saudi Arabia"}
{"territory_name": "المنطقة الشرقية", "is_group": 0, "parent_territory": "Saudi Arabia"}
```

## Payment Terms (Common)

```json
{"name": "NET 15", "description": "Payment within 15 days", "credit_days": 15, "due_date_based_on": "Delivery Date"}
{"name": "NET 30", "description": "Payment within 30 days", "credit_days": 30, "due_date_based_on": "Delivery Date"}
{"name": "NET 45", "description": "Payment within 45 days", "credit_days": 45, "due_date_based_on": "Delivery Date"}
{"name": "NET 60", "description": "Payment within 60 days", "credit_days": 60, "due_date_based_on": "Delivery Date"}
{"name": "Cash on Delivery", "description": "الدفع عند الاستلام", "credit_days": 0, "due_date_based_on": "Delivery Date"}
{"name": "Advance Payment", "description": "دفعة مقدمة", "credit_days": 0, "due_date_based_on": "Delivery Date"}
```

## Supplier - Standard Level

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

## Item - Construction Materials

### Cement Products
```json
{"item_code": "MAT-CEM-001", "item_name": "Portland Cement 50KG", "item_group": "Construction Materials", "stock_uom": "Nos", "is_stock_item": 1, "standard_rate": 25.00}
{"item_code": "MAT-CEM-002", "item_name": "White Cement 50KG", "item_group": "Construction Materials", "stock_uom": "Nos", "is_stock_item": 1, "standard_rate": 35.00}
{"item_code": "MAT-CEM-003", "item_name": "Sulphate Resistant Cement", "item_group": "Construction Materials", "stock_uom": "Nos", "is_stock_item": 1, "standard_rate": 28.00}
```

### Steel Products
```json
{"item_code": "MAT-STL-001", "item_name": "Steel Bar 12mm", "item_group": "Steel", "stock_uom": "Mtr", "is_stock_item": 1, "standard_rate": 18.50}
{"item_code": "MAT-STL-002", "item_name": "Steel Bar 16mm", "item_group": "Steel", "stock_uom": "Mtr", "is_stock_item": 1, "standard_rate": 28.00}
{"item_code": "MAT-STL-003", "item_name": "Steel Mesh 4x4m", "item_group": "Steel", "stock_uom": "Nos", "is_stock_item": 1, "standard_rate": 150.00}
```

### Tiles & Stone
```json
{"item_code": "MAT-TIL-001", "item_name": "Porcelain Floor Tile 60x60", "item_group": "Tiles", "stock_uom": "Sqft", "is_stock_item": 1, "standard_rate": 35.00}
{"item_code": "MAT-TIL-002", "item_name": "Ceramic Wall Tile 30x60", "item_group": "Tiles", "stock_uom": "Sqft", "is_stock_item": 1, "standard_rate": 25.00}
{"item_code": "MAT-TIL-003", "item_name": "Marble Slab 2cm", "item_group": "Stone", "stock_uom": "Sqft", "is_stock_item": 1, "standard_rate": 120.00}
```

### Paint & Finishes
```json
{"item_code": "MAT-PNT-001", "item_name": "Interior Paint White 18L", "item_group": "Paint", "stock_uom": "Ltr", "is_stock_item": 1, "standard_rate": 85.00}
{"item_code": "MAT-PNT-002", "item_name": "Exterior Paint 18L", "item_group": "Paint", "stock_uom": "Ltr", "is_stock_item": 1, "standard_rate": 145.00}
{"item_code": "MAT-PNT-003", "item_name": "Varnish Clear 4L", "item_group": "Paint", "stock_uom": "Ltr", "is_stock_item": 1, "standard_rate": 95.00}
```

## UOM (Common Units)

```json
{"uom_name": "Nos"}
{"uom_name": "Pcs"}
{"uom_name": "Kg"}
{"uom_name": "Mtr"}
{"uom_name": "Ltr"}
{"uom_name": "Box"}
{"uom_name": "Set"}
{"uom_name": "Hr"}
{"uom_name": "Day"}
{"uom_name": "Sqft"}
```

## PowerShell Insert Script Template

```powershell
# Configuration
$siteUrl = "http://erp-uat.scccerp.mysccc.cloud"
$apiToken = "df38105f0d0360e:505547b55ed0f2e"
$headers = @{'Authorization' = "token $apiToken"}

# Comprehensive Customer Data
$customers = @(
    @{
        customer_name = "Al-Rajhi Construction Company"
        customer_type = "Company"
        customer_group = "Commercial"
        territory = "Saudi Arabia"
        email_id = "info@alrajhi.sa"
        phone_no = "+966-11-2345678"
        mobile_no = "+966-50-1234567"
        language = "en"
        default_currency = "SAR"
        payment_terms = "NET 30"
        credit_limit = 500000
        tax_id = "300123456700003"
        website = "www.alrajhi.sa"
    },
    @{
        customer_name = "شركة الراجحي للإنشاءات"
        customer_type = "Company"
        customer_group = "Commercial"
        territory = "Saudi Arabia"
        email_id = "info@alrajhi.sa"
        phone_no = "+966-11-2345678"
        mobile_no = "+966-50-1234567"
        language = "ar"
        default_currency = "SAR"
        payment_terms = "NET 30"
        credit_limit = 500000
    }
)

$successCount = 0
$errorCount = 0

foreach ($cust in $customers) {
    $body = $cust | ConvertTo-Json
    try {
        $result = Invoke-RestMethod -Uri "$siteUrl/api/resource/Customer" -Method Post -Headers $headers -Body $body -ContentType 'application/json; charset=utf-8'
        Write-Host "✓ $($cust.customer_name)" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "✗ $($cust.customer_name): $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Success: $successCount"
Write-Host "Errors: $errorCount"
```

---

## Data Quality Validation Checklist

### Before Insert - Validate Your Data
- [ ] No "test", "demo", "sample" in names
- [ ] No "????" characters (Arabic encoding issue)
- [ ] Company names are realistic for Saudi region
- [ ] Phone numbers follow +966 format
- [ ] Emails use .sa or .com.sa domains
- [ ] VAT numbers are 15 digits starting with 3
- [ ] Payment terms exist in system (NET 15/30/45/60)

### After Insert - Cleanup Required
**Delete these via UI if present:**
- Any record with "test", "demo", "sample" in name
- Records showing "????" instead of Arabic
- Generic names like "ABC123", "XXX Company", "Test Company"

**Keep only realistic records:**
- Proper company names (Al-Rajhi, Saudi Trade, National, etc.)
- Valid contact information
- Correct Customer Group and Territory

### Validation Query Examples
```powershell
# Find test/demo records
Invoke-RestMethod -Uri "$site/api/resource/Customer?filters=[[\"customer_name\",\"like\",\"%test%\"]]" -Headers $headers

# Count total customers
Invoke-RestMethod -Uri "$site/api/resource/Customer?limit_page_length=300" -Headers $headers | Select-Object -ExpandProperty data | Measure-Object
```
