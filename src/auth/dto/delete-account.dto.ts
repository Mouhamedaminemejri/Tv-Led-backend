import { IsOptional, IsString, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  password: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
