import { IsIn, IsOptional } from 'class-validator';

const visibilityValues = ['everyone', 'contacts', 'nobody'] as const;

export class PrivacySettingsDto {
  @IsOptional()
  @IsIn(visibilityValues)
  privacy_last_seen?: string;

  @IsOptional()
  @IsIn(visibilityValues)
  privacy_profile_photo?: string;

  @IsOptional()
  @IsIn(visibilityValues)
  privacy_about_info?: string;

  @IsOptional()
  @IsIn(visibilityValues)
  privacy_status?: string;
}
