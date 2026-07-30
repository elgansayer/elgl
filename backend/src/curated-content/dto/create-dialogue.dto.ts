import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DialogueLine {
  @IsString()
  speaker!: string;

  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  translation?: string;

  @IsOptional()
  @IsString()
  audioUrl?: string;
}

export class CreateDialogueDto {
  @IsString()
  title!: string;

  @IsString()
  cefrLevel!: string;

  @IsString()
  language!: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DialogueLine)
  lines!: DialogueLine[];

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
