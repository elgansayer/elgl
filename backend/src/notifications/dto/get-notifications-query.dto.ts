import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export const NOTIFICATION_FILTERS = ['all', 'likes', 'comments', 'follows', 'system'] as const;
export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number];

export class GetNotificationsQueryDto {
  @IsOptional()
  @IsIn([...NOTIFICATION_FILTERS])
  type?: NotificationFilter = 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsISO8601()
  before?: string;
}
