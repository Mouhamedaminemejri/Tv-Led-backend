import { IsString, IsNumber, IsArray, IsOptional, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  tvBacklightType?: string;

  @IsString()
  @IsOptional()
  tvPanelType?: string;

  @IsString()
  @IsOptional()
  tvFullName?: string;

  // Legacy alias for backward compatibility.
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString()
  adminReference?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  // Legacy frontend field; accepted for compatibility and ignored by service.
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString()
  number?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  purchasePrice?: number;

  @IsString()
  @IsOptional()
  supplier?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  salePrice?: number;

  @IsString()
  @IsOptional()
  config?: string;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  price?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tvSizeInch?: number;

  @IsString()
  @IsOptional()
  stripCount?: string;

  @IsString()
  @IsOptional()
  ledCount?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  voltage?: number;

  @IsString()
  @IsOptional()
  length?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

