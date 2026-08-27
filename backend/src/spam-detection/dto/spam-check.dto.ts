import { IsString } from 'class-validator';

export class SpamCheckDto {
  @IsString()
  content!: string;
}
