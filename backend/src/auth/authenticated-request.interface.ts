import { Request } from 'express';
import { User } from '@supabase/supabase-js';

export interface AuthenticatedRequest extends Request {
  user?: User;
  /**
   * Set by DeveloperApiKeyGuard after a request authenticates with a
   * Developer Tier API key. SupabaseAuthGuard trusts this only for requests
   * already handled in-process, never from a client-supplied header.
   */
  developerApiKeyAuthenticated?: boolean;
}
