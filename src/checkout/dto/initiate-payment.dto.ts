import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsDateString,
  ValidateNested,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';
import {
  BillingAddressDto,
  ShippingAddressDto,
} from '../../orders/dto/create-order.dto';

export class InitiatePaymentDto {
  @IsString()
  userId: string; // Will be extracted from JWT token when auth is implemented

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

