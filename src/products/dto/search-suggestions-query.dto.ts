import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchSuggestionsQueryDto {
  /**
   * Search query string (minimum 2 characters)
   */
  @IsString()
  q: string;

  /**
   * Maximum number of suggestions per category (default: 5)
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;
}

