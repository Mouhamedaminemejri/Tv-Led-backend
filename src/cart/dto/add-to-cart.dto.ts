import { IsString, IsNumber, Min } from 'class-validator';

export class AddToCartDto {
  @IsString()
  userId: string; // Will be extracted from JWT token when auth is implemented

  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}
