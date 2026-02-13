# Frontend Integration Guide: Brand/Supplier Tables + Product API Changes

This file is for frontend implementation after backend normalization of `Product.brand` and `Product.supplier`.

## What changed

- `summary` and `description` are removed from product create/update payloads.
- `brand` and `supplier` are now integrity-backed by lookup tables in DB:
  - `Brand` table
  - `Supplier` table
- Backend still accepts `brand` and `supplier` as strings in product APIs.
- On create/update, backend automatically creates missing brand/supplier rows.
- Price columns are now `numeric(10,2)` in DB and `price` must be `> 0`.

## Product payload contract (frontend)

### Removed fields (do not send)

- `summary`
- `description`

### Required fields for create

- `reference: string`
- `brand: string`
- `price: number` (must be `> 0`)

### Optional fields

- `supplier?: string`
- `salePrice?: number`
- `purchasePrice?: number`
- `tvBacklightType?: string`
- `tvFullName?: string` (renamed from old `adminReference`)
- `tvPanelType?: string`
- `tvSizeInch?: number`
- `stripCount?: string`
- `ledCount?: string`
- `voltage?: number`
- `length?: string`
- `stock?: number`
- `rating?: number` (0..5)
- `images?: string[]`
- `tags?: string[]`
- `config?: string` (valid JSON string)

## Endpoints to use

Base route shown here is `/api/products`.

- `GET /api/products` - paginated products (supports filters)
- `GET /api/products/:id` - single product
- `POST /api/products` - create product (admin)
- `PUT /api/products/:id` - update product (admin)
- `POST /api/products/quick-add` - quick create
- `POST /api/products/scan-and-add` - scan and create/update
- `GET /api/products/brands` - get available brand list

## Create product example

```json
{
  "reference": "3HI43DB",
  "brand": "Samsung",
  "supplier": "Main Supplier",
  "price": 89.9,
  "salePrice": 79.9,
  "tvBacklightType": "Direct LED",
  "tvFullName": "JL.D43081330-324DS-M_V04 / GC43D08-ZC26AG / 303GC430062",
  "tvSizeInch": 43,
  "stripCount": "8",
  "ledCount": "96",
  "voltage": 12,
  "length": "1200mm",
  "stock": 10,
  "rating": 4,
  "tags": ["LED", "TV"]
}
```

## Update product example

```json
{
  "brand": "LG",
  "supplier": "Supplier A",
  "price": 99.5,
  "salePrice": 89.5,
  "tvFullName": "RF-AZ32QE30-0601S-08A2 / 32D3503V2W6C1B54614M",
  "stock": 20
}
```

To clear supplier, send:

```json
{
  "supplier": ""
}
```

Backend converts empty supplier to `null`.

## Important frontend notes

- **Do not send** `summary` or `description` from forms.
- **Brand/Supplier UX**:
  - Brand selector can be populated with `GET /api/products/brands`.
  - Supplier currently has no dedicated list endpoint; use free text input for now.
- **Price validation**:
  - Validate `price > 0` client-side before submit.
  - Keep `rating` within 0..5.
- **Decimal values in responses**:
  - Depending on serializer, decimal fields can appear as numbers or strings.
  - Safest approach in UI: parse with `Number(value)` before calculations/formatting.

## Suggested frontend TypeScript interface

```ts
export interface ProductUpsertPayload {
  reference?: string;
  brand?: string;
  supplier?: string;
  price?: number;
  salePrice?: number;
  purchasePrice?: number;
  tvBacklightType?: string;
  tvFullName?: string;
  tvPanelType?: string;
  tvSizeInch?: number;
  stripCount?: string;
  ledCount?: string;
  voltage?: number;
  length?: string;
  stock?: number;
  rating?: number;
  images?: string[];
  tags?: string[];
  config?: string;
}
```

## Migration checklist for frontend

- Remove `summary`/`description` from all product forms and DTOs.
- Keep sending `brand` as string; backend maps it to `Brand` lookup.
- Keep sending `supplier` as string; backend maps it to `Supplier` lookup.
- Send `tvFullName` instead of `adminReference` (old alias is still accepted for compatibility).
- Add client-side validation for positive `price`.
- Confirm product list/details pages still render with new payload shape.
