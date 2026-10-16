import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class ForwardMessageDto {
  @IsArray()
  @IsUUID('all', { each: true })
  @IsNotEmpty()
  room_ids!: string[];
}
