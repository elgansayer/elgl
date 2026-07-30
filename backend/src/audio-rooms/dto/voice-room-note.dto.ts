import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateVoiceRoomNoteDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  vocabulary?: string;
}
