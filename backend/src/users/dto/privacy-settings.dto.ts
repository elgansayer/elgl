import { IsBoolean, IsIn, IsOptional } from 'class-validator';

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

  // VIP-only: suppresses profile_visits records when this user visits others.
  @IsOptional()
  @IsBoolean()
  incognito_visits?: boolean;
}
