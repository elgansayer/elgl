import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class DeleteMessageDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['self', 'everyone'])
  scope!: 'self' | 'everyone';
}
