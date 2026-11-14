import { IsIn } from 'class-validator';
import { SUPPORTED_UI_LOCALES } from '../../i18n/backend-dictionary';

export class UpdateUiLocaleDto {
  @IsIn(SUPPORTED_UI_LOCALES as readonly string[])
  locale!: string;
}
