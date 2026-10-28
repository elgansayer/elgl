import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/** Body for `POST /chat/groups/:roomId/members`. */
export class AddMemberDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(49)
  @IsUUID('all', { each: true })
  memberIds!: string[];
  @IsOptional()
  @IsString()
  inviteCode?: string;
}
