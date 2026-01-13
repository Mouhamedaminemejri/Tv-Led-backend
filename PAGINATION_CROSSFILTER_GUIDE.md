# Pagination & Crossfilter Integration Guide

This guide explains how to use the paginated products API with Crossfilter for efficient filtering and pagination.

## API Endpoints

### 1. Paginated Products Endpoint
**GET** `/api/products?page=1&limit=10`

**Query Parameters:**
- `page` (optional, default: 1) - Page number (starts from 1)
- `limit` (optional, default: 10, max: 100) - Number of products per page

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Product Title",
      "brand": "Brand Name",
      "price": 99.99,
      "images": ["url1", "url2"],
      // ... full product data
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 2. Filter Data Endpoint (for Crossfilter)
**GET** `/api/products/filter-data`

**Response:**
```json
[
  {
    "id": "uuid",
    "brand": "Brand Name",
    "size": 43,
    "price": 99.99,
    "salePrice": 89.99,
    "stock": 10,
    "rating": 4,
    "reference": "REF123",
    "title": "Product Title"
  }
  // ... all products with minimal data
]
```

## Frontend Implementation Example

### React/TypeScript Example with Crossfilter

```typescript
import { useEffect, useState, useMemo } from 'react';
import * as crossfilter from 'crossfilter2';

interface Product {
  id: string;
  title: string;
  brand: string;
  price: number;
  salePrice: number | null;
  size: number | null;
  stock: number;
  rating: number;
  images: string[];
  // ... other fields
}

interface FilterData {
  id: string;
  brand: string;
  size: number | null;
  price: number;
  salePrice: number | null;
  stock: number;
  rating: number;
  reference: string;
  title: string;
}

interface PaginatedResponse {
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [pagination, setPagination] = useState<PaginatedResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterData, setFilterData] = useState<FilterData[]>([]);
  
  // Crossfilter dimensions
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [sizeFilter, setSizeFilter] = useState<number[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [stockFilter, setStockFilter] = useState<boolean>(false); // in stock only

  // Initialize Crossfilter with filter data
  const cf = useMemo(() => {
    if (filterData.length === 0) return null;
    
    const ndx = crossfilter(filterData);
    
    // Create dimensions
    const brandDim = ndx.dimension(d => d.brand);
    const sizeDim = ndx.dimension(d => d.size);
    const priceDim = ndx.dimension(d => d.price);
    const stockDim = ndx.dimension(d => d.stock > 0);
    
    return {
      ndx,
      brandDim,
      sizeDim,
      priceDim,
      stockDim,
    };
  }, [filterData]);

  // Apply filters to crossfilter
  useEffect(() => {
    if (!cf) return;

    // Clear all filters first
    cf.brandDim.filterAll();
    cf.sizeDim.filterAll();
    cf.priceDim.filterAll();
    cf.stockDim.filterAll();

    // Apply brand filter
    if (brandFilter.length > 0) {
      cf.brandDim.filter(d => brandFilter.includes(d));
    }

    // Apply size filter
    if (sizeFilter.length > 0) {
      cf.sizeDim.filter(d => sizeFilter.includes(d));
    }

    // Apply price range filter
    if (priceRange) {
      cf.priceDim.filter(d => d >= priceRange[0] && d <= priceRange[1]);
    }

    // Apply stock filter
    if (stockFilter) {
      cf.stockDim.filter(d => d === true);
    }

    // Get filtered product IDs
    const filteredIds = new Set(
      cf.ndx.allFiltered().map(d => d.id)
    );

    // Fetch paginated products, but only show filtered ones
    fetchPaginatedProducts(filteredIds);
  }, [brandFilter, sizeFilter, priceRange, stockFilter, page, cf]);

  // Load filter data on mount (for crossfilter)
  useEffect(() => {
    async function loadFilterData() {
      try {
        const response = await fetch('/api/products/filter-data');
        const data: FilterData[] = await response.json();
        setFilterData(data);
      } catch (error) {
        console.error('Failed to load filter data:', error);
      }
    }
    loadFilterData();
  }, []);

  // Fetch paginated products
  async function fetchPaginatedProducts(filteredIds?: Set<string>) {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/products?page=${page}&limit=${limit}`
      );
      const result: PaginatedResponse = await response.json();
      
      // If we have filtered IDs, filter the results client-side
      if (filteredIds && filteredIds.size > 0) {
        const filtered = result.data.filter(p => filteredIds.has(p.id));
        setProducts(filtered);
        // Update pagination to reflect filtered count
        setPagination({
          ...result.pagination,
          total: filteredIds.size,
          totalPages: Math.ceil(filteredIds.size / limit),
        });
      } else {
        setProducts(result.data);
        setPagination(result.pagination);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  }

  // Get available filter options from crossfilter
  const availableBrands = useMemo(() => {
    if (!cf) return [];
    return cf.brandDim.group().all()
      .map(d => ({ brand: d.key, count: d.value }))
      .sort((a, b) => b.count - a.count);
  }, [cf]);

  const availableSizes = useMemo(() => {
    if (!cf) return [];
    return cf.sizeDim.group().all()
      .map(d => ({ size: d.key, count: d.value }))
      .filter(d => d.size !== null)
      .sort((a, b) => (a.size || 0) - (b.size || 0));
  }, [cf]);

  const priceRangeStats = useMemo(() => {
    if (!cf) return { min: 0, max: 0 };
    const prices = cf.priceDim.group().all().map(d => d.key);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [cf]);

  return (
    <div>
      {/* Filter Sidebar */}
      <aside>
        <h3>Filters</h3>
        
        {/* Brand Filter */}
        <div>
          <h4>Brand</h4>
          {availableBrands.map(({ brand, count }) => (
            <label key={brand}>
              <input
                type="checkbox"
                checked={brandFilter.includes(brand)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setBrandFilter([...brandFilter, brand]);
                  } else {
                    setBrandFilter(brandFilter.filter(b => b !== brand));
                  }
                }}
              />
              {brand} ({count})
            </label>
          ))}
        </div>

        {/* Size Filter */}
        <div>
          <h4>Size (inches)</h4>
          {availableSizes.map(({ size, count }) => (
            <label key={size}>
              <input
                type="checkbox"
                checked={sizeFilter.includes(size!)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSizeFilter([...sizeFilter, size!]);
                  } else {
                    setSizeFilter(sizeFilter.filter(s => s !== size));
                  }
                }}
              />
              {size}" ({count})
            </label>
          ))}
        </div>

        {/* Price Range Filter */}
        <div>
          <h4>Price Range</h4>
          <input
            type="range"
            min={priceRangeStats.min}
            max={priceRangeStats.max}
            value={priceRange?.[1] || priceRangeStats.max}
            onChange={(e) => {
              setPriceRange([
                priceRange?.[0] || priceRangeStats.min,
                parseInt(e.target.value),
              ]);
            }}
          />
          <span>
            ${priceRange?.[0] || priceRangeStats.min} - 
            ${priceRange?.[1] || priceRangeStats.max}
          </span>
        </div>

        {/* Stock Filter */}
        <div>
          <label>
            <input
              type="checkbox"
              checked={stockFilter}
              onChange={(e) => setStockFilter(e.target.checked)}
            />
            In Stock Only
          </label>
        </div>
      </aside>

      {/* Products Grid */}
      <main>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            <div className="products-grid">
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination && (
              <div className="pagination">
                <button
                  disabled={!pagination.hasPrev}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {pagination.page} of {pagination.totalPages}
                  ({pagination.total} products)
                </span>
                <button
                  disabled={!pagination.hasNext}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
```

## Alternative Approach: Server-Side Filtering

If you prefer server-side filtering (better for very large datasets), you can extend the API:

```typescript
// In products.service.ts - add filtering support
async findPaginated(
  page: number = 1,
  limit: number = 10,
  filters?: {
    brands?: string[];
    sizes?: number[];
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
  }
) {
  const skip = (page - 1) * limit;
  
  const where: any = {};
  
  if (filters?.brands && filters.brands.length > 0) {
    where.brand = { in: filters.brands };
  }
  
  if (filters?.sizes && filters.sizes.length > 0) {
    where.size = { in: filters.sizes };
  }
  
  if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
    where.price = {};
    if (filters.minPrice !== undefined) {
      where.price.gte = filters.minPrice;
    }
    if (filters.maxPrice !== undefined) {
      where.price.lte = filters.maxPrice;
    }
  }
  
  if (filters?.inStock) {
    where.stock = { gt: 0 };
  }

  const [data, total] = await Promise.all([
    this.prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.product.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
```

## Benefits of This Approach

1. **Performance**: Only loads 10 products at a time (reduces initial load)
2. **Crossfilter**: Uses lightweight filter data for instant filtering
3. **Scalability**: Works with thousands of products
4. **User Experience**: Fast filtering without loading all product images
5. **Flexibility**: Can switch to server-side filtering if needed

## Usage Tips

1. **Initial Load**: Load filter data first, then load first page of products
2. **Filter Changes**: When filters change, reset to page 1
3. **Cache**: Consider caching filter data since it changes less frequently
4. **Loading States**: Show loading indicators when filters are applied
5. **Empty States**: Handle cases where filters return no results

