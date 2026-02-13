import { IsOptional, IsString, IsNumber, IsArray, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ScanAndAddDto {
  @IsOptional()
  @IsString()
  reference?: string;

  // Legacy frontend field; accepted for compatibility and ignored by service.
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  tvBacklightType?: string;

  @IsOptional()
  @IsString()
  tvFullName?: string;

  // Legacy alias for backward compatibility.
  @IsOptional()
  @IsString()
  adminReference?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? undefined : num;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? undefined : num;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? undefined : num;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  price?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    return isNaN(num) ? undefined : num;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tvSizeInch?: number;

  @IsOptional()
  @IsString()
  stripCount?: string;

  @IsOptional()
  @IsString()
  ledCount?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? undefined : num;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  voltage?: number;

  @IsOptional()
  @IsString()
  length?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? undefined : num;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? undefined : num;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      }
    }
    return value;
  })
  tags?: string[];
}

