import { IsOptional, IsInt, Min, Max, IsArray, IsString, IsNumber, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ProductsQueryDto {
  // Pagination parameters
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  // Filter parameters
  /**
   * Comma-separated brand names
   * Example: "LG,Samsung" -> ["LG", "Samsung"]
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }
    return value;
  })
  brands?: string[];

  /**
   * Comma-separated sizes as strings
   * Example: "32,43,55" -> ["32", "43", "55"]
   * Note: Will be converted to numbers in service layer
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }
    return value;
  })
  sizes?: string[];

  /**
   * Minimum price filter
   * Products with price >= minPrice
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  /**
   * Maximum price filter
   * Products with price <= maxPrice
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  /**
   * Stock availability filter
   * true = only products with stock > 0
   * false = only products with stock === 0
   * undefined = all products
   */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  inStock?: boolean;

  /**
   * Search query
   * Searches in title and reference fields (case-insensitive)
   */
  @IsOptional()
  @IsString()
  search?: string;
}

