import { IsNotEmpty, IsString } from 'class-validator';

export class RenameGroupDto {
  @IsString()
  @IsNotEmpty()
  newName!: string;
}
