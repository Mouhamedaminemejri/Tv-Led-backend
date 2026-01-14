import { IsEmail, IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  rememberMe?: boolean; // If true, token expires in 30 days, otherwise uses default (7 days)

  @IsOptional()
  @IsString()
  guestSessionId?: string; // Guest token to migrate cart from
}
