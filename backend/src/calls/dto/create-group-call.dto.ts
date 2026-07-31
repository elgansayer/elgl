import {
  IsArray,
  IsNumber,
  IsString,
  ArrayMinSize,
  Min,
  IsOptional,
} from 'class-validator';

export class CreateGroupCallDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  participant_ids: string[];

  @IsOptional()
  @IsNumber()
  @Min(2)
  participant_limit?: number;
}
