import { IsString, IsOptional, IsNumber, IsArray, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QuickAddProductDto {
  @IsString()
  reference: string;

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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  price?: number;

  @IsOptional()
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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  voltage?: number;

  @IsOptional()
  @IsString()
  length?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

