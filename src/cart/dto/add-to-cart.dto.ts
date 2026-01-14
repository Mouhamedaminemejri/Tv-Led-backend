import { IsString, IsNumber, Min } from 'class-validator';

export class AddToCartDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

// Internal DTO used by service (includes userId from authenticated user)
export interface AddToCartWithUserIdDto extends AddToCartDto {
  userId: string;
}
