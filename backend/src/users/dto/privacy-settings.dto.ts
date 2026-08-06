import { IsBoolean, IsIn, IsOptional } from 'class-validator';

const visibilityValues = ['everyone', 'contacts', 'nobody'] as const;
const statusVisibilityValues = ['public', 'followers', 'only_me'] as const;

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

  @IsOptional()
  @IsIn(statusVisibilityValues)
  status_visibility?: string;


  // VIP-only: suppresses profile_visits records when this user visits others.
  @IsOptional()
  @IsBoolean()
  incognito_visits?: boolean;

  @IsOptional()
  @IsBoolean()
  privacy_hide_exact_location?: boolean;

  @IsOptional()
  @IsBoolean()
  privacy_hide_online_status?: boolean;

  @IsOptional()
  @IsBoolean()
  privacy_hide_vip_status?: boolean;
}
