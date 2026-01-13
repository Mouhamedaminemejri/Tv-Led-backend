/**
 * Lightweight product data for crossfilter initialization
 * Contains only fields needed for filtering, not full product details
 * Used to calculate accurate facet counts across the entire catalog
 */
export interface FilterDataDto {
  id: string;
  brand: string;
  size: number | null;
  price: number;
  stock: number;
  tags: string[];
}
