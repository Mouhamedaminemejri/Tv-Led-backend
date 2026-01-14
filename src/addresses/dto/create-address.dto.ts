import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
} from 'class-validator';
import { AddressType } from '@prisma/client';

export class CreateAddressDto {
  @IsEnum(AddressType)
  type: AddressType;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  @MinLength(1)
  streetAddress: string;

  @IsOptional()
  @IsString()
  apartment?: string;

  @IsString()
  @MinLength(1)
  city: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsString()
  @MinLength(1)
  postalCode: string;

  @IsOptional()
  @IsString()
  country?: string;
}
