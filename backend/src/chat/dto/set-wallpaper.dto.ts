import { IsString, IsNotEmpty } from 'class-validator';

export class SetWallpaperDto {
  @IsString()
  @IsNotEmpty()
  wallpaperUrl!: string;
}
