import { IsString } from 'class-validator';

export class GetCartDto {
  @IsString()
  userId: string; // Will be extracted from JWT token when auth is implemented
}

