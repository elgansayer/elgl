import { IsString, IsNotEmpty } from 'class-validator';

export class AddGroupToCommunityDto {
  @IsString()
  @IsNotEmpty()
  groupId!: string;
}
