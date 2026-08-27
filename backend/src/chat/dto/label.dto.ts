import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class AddLabelDto {
  @IsUUID()
  @IsNotEmpty()
  room_id!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;
}

export class RemoveLabelDto {
  @IsUUID()
  @IsNotEmpty()
  room_id!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;
}
