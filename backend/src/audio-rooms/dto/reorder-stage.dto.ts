import { IsArray, IsString } from 'class-validator';

export class ReorderStageDto {
  @IsArray()
  @IsString({ each: true })
  speaker_order!: string[];
}
