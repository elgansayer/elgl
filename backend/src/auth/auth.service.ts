import { Injectable, BadRequestException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async requestPasswordReset(email: string): Promise<string> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: '' },
    });

    if (error || !data?.properties?.action_link) {
      throw new BadRequestException(
        error?.message ?? 'Unable to generate reset link',
      );
    }

    const actionLink = data.properties.action_link;
    const url = new URL(actionLink);
    const hash = url.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    if (!accessToken) {
      throw new BadRequestException('Unable to extract reset token');
    }
    return accessToken;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    try {
      const decoded = jwt.decode(token) as { sub: string };
      const userId: string = decoded.sub;

      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (error) {
        throw new BadRequestException(error.message);
      }
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }
  }

  async changePassword(userId: string, newPassword: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (error) {
      throw new BadRequestException(error.message);
    }
  }
}
