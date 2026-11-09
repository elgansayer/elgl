import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { SHARE_ENTITY_TYPES, type ShareEntityType } from '../sharing.types';

export class ShareEntityParamsDto {
  @IsIn([...SHARE_ENTITY_TYPES])
  entityType!: ShareEntityType;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'entityId contains unsupported characters',
  })
  entityId!: string;
}
