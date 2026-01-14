import { IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  orderUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  promotions?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  newsletter?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  smsNotifications?: boolean;
}
