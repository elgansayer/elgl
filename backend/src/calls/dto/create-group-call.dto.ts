import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMinSize,
  Min,
} from 'class-validator';

export class CreateGroupCallDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  participant_ids: string[];

  @IsNumber()
  @Min(2)
  participant_limit: number;
}
