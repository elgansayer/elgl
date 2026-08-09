import { IsString } from 'class-validator';

export class AddGroupDto {
  @IsString()
  groupId!: string;
}
