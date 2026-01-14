import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsDateString,
  ValidateNested,
  IsArray,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class BillingAddressDto {
  @IsString()
  @MinLength(1)
  streetAddress: string;

  @IsString()
  @MinLength(1)
  city: string;

  @IsString()
  @MinLength(1)
  postalCode: string;
}

export class ShippingAddressDto {
  @IsString()
  @MinLength(1)
  streetAddress: string;

  @IsString()
  @MinLength(1)
  city: string;

  @IsString()
  @MinLength(1)
  postalCode: string;
}

export class CreateOrderDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  // User Information
  @IsString()
  @MinLength(1)
  fullName: string;

  @IsString()
  @IsOptional()
  cin?: string; // Carte d'Identité Nationale

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  phoneNumber: string;

  // Billing Address
  @ValidateNested()
  @Type(() => BillingAddressDto)
  billingAddress: BillingAddressDto;

  // Shipping Address
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;
}

// Internal DTO used by service (includes userId from authenticated user)
export interface CreateOrderWithUserIdDto extends CreateOrderDto {
  userId: string;
}


