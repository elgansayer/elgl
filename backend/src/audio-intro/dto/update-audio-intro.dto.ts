import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateAudioIntroDto {
  @IsString()
  @IsNotEmpty()
  audio_url!: string;
}
