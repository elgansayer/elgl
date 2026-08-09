import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AudioIntroService {
  constructor(private readonly supabase: SupabaseService) {}

  async getAudioIntro(userId: string): Promise<{ audio_url: string | null }> {
    const { data, error } = await this.supabase
      .getClient()
      .from('users')
      .select('audio_intro_url')
      .eq('id', userId)
      .single();
    if (error) throw new Error(error.message);
    return { audio_url: data?.audio_intro_url ?? null };
  }

  async updateAudioIntro(userId: string, audioUrl: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('users')
      .update({ audio_intro_url: audioUrl })
      .eq('id', userId);
    if (error) throw new Error(error.message);
  }

  async getPresignedUploadUrl(
    filename: string,
    _contentType: string,
  ): Promise<{ uploadUrl: string; mediaUrl: string }> {
    const supabase = this.supabase.getClient();
    const bucket = 'audio'; // ensure this bucket exists in Supabase storage
    const objectKey = `audio-intros/${Date.now()}_${filename}`;
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(objectKey);
    if (error) throw new Error(error.message);
    const publicUrlResp = supabase.storage.from(bucket).getPublicUrl(objectKey);
    const mediaUrl = publicUrlResp.data?.publicUrl ?? '';
    return { uploadUrl: data.signedUrl, mediaUrl };
  }
}
