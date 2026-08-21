import { IsIn } from 'class-validator';

export class UpdateStatusVisibilityDto {
  @IsIn(['public', 'followers', 'only_me'])
  status_visibility!: 'public' | 'followers' | 'only_me';
}
