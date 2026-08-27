import { IsBoolean, IsNotEmpty } from 'class-validator';

export class DeleteAccountDto {
  @IsBoolean()
  @IsNotEmpty()
  confirm_delete!: boolean;
}
