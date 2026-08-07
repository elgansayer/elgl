import { IsIn, IsOptional, IsString } from 'class-validator';

export class VoiceNoteUploadDto {
  @IsString()
  @IsOptional()
  @IsIn(['ogg', 'm4a'])
  format?: 'ogg' | 'm4a';
}