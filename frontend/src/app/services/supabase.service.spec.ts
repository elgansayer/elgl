import { describe, expect, it, vi } from 'vitest';

import { environment } from '../../environments/environment';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  it('defers reading browser runtime configuration until the client is used', () => {
    const supabaseUrl = vi.fn(() => 'https://test.supabase.co');
    const supabaseAnonKey = vi.fn(() => 'test-anon-key');
    Object.defineProperties(environment, {
      supabaseUrl: { configurable: true, get: supabaseUrl },
      supabaseAnonKey: { configurable: true, get: supabaseAnonKey },
    });
    const service = new SupabaseService();

    expect(supabaseUrl).not.toHaveBeenCalled();
    expect(supabaseAnonKey).not.toHaveBeenCalled();

    const client = service.getClient();

    expect(supabaseUrl).toHaveBeenCalledTimes(1);
    expect(supabaseAnonKey).toHaveBeenCalledTimes(1);
    expect(service.getClient()).toBe(client);
    expect(supabaseUrl).toHaveBeenCalledTimes(1);
    expect(supabaseAnonKey).toHaveBeenCalledTimes(1);
  });
});
