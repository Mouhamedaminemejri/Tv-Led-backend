# Backend API & Search Update Instructions

## 1. Updated Product Schema
We have significantly updated the product database schema. Please update your frontend interfaces and display logic to include these fields:

### Core Fields:
*   **`suk`** *(String)*: Internal Reference / SKU from Excel "SUK" column.
*   **`reference`** *(String)*: Main product reference.
*   **`brand`** *(String)*: Product brand.
*   **`title`** *(String)*: Auto-generated formatted title (see format below).

### Technical Specifications:
*   **`tvSizeInch`** *(Number)*: TV size in inches (renamed from `size`).
*   **`tvBacklightType`** *(String)*: TV backlight type identifier (renamed from `ledType`).
*   **`tvPanelType`** *(String)*: TV panel type (NEW field).
*   **`stripCount`** *(String)*: Number of LED strips (stored as text).
*   **`ledCount`** *(String)*: Number of LEDs (stored as text).
*   **`voltage`** *(Float)*: Voltage specification.
*   **`length`** *(String)*: Physical length/dimensions.
*   **`models`** *(String)*: Compatible TV models list.

### Removed Fields:
*   ~~`dimensions`~~ - Removed from schema
*   ~~`size`~~ - Renamed to `tvSizeInch`
*   ~~`ledType`~~ - Renamed to `tvBacklightType`

## 2. Title Format
Product titles are now auto-generated in this format:
```
Led Backlight {suk} - {tvSizeInch}" | {stripCount} - {ledCount} - {voltage} (V) - {length}
```

Example: `Led Backlight 12345 - 55" | 8 - 96 - 12 (V) - 1200mm`

**Note**: If you need to update a product title, you can still send a custom title via the API, but the import script generates this format automatically.

## 3. Enhanced Search Capabilities
The backend search logic (`GET /api/products`) now performs deep search across ALL these fields:

1.  **title**
2.  **reference**
3.  **suk** (Internal Reference)
4.  **models** (Compatible Models)
5.  **tvBacklightType** (LED Type)
6.  **brand**

### How to use:
Simply send the search term via the `search` query param:
```
GET /api/products?search=Samsung 55
```

The backend automatically matches any of the above fields. No complex client-side filtering needed!

## 4. Product Details API
When fetching a single product (`GET /api/products/:id`), the API returns the complete product object including all the new fields listed above. 

**Action Required**: Update your Product Details page to display:
- TV Size (tvSizeInch)
- Backlight Type (tvBacklightType)
- Panel Type (tvPanelType)
- Strip Count
- LED Count
- Voltage
- Length
- Compatible Models

## 5. Filter Data API
The filter data endpoint (`GET /api/products/filter-data`) now returns `tvSizeInch` instead of `size`. Update your filter UI accordingly.
