import { IsString, IsOptional } from 'class-validator';

export class ScrapeProductDto {
  @IsString()
  title: string;

  @IsString()
  reference: string;

  @IsString()
  @IsOptional()
  productId?: string;
}

