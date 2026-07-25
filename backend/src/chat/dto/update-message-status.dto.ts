import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateMessageStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['delivered', 'read'])
  status!: 'delivered' | 'read';
}
