import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class RsvpDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['attending', 'interested'])
  status!: 'attending' | 'interested';
}
