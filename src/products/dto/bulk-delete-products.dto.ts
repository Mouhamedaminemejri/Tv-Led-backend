import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class BulkDeleteProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids: string[];
}

