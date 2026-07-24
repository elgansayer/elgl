import { Global, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

@Global()
@Injectable()
export class SupabaseService implements OnModuleInit {
  private client!: SupabaseClient<any, any, any>;
  private redisClient!: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
      );
    }
    this.client = createClient(supabaseUrl, supabaseKey);

    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    this.redisClient.on('error', (err) => {
      console.error('Redis connection error in SupabaseService:', err.message);
    });
  }

  getClient(): SupabaseClient<any, any, any> {
    return this.client;
  }

  getRedisClient(): Redis {
    return this.redisClient;
  }

  async updateLastActivity(userId: string): Promise<void> {
    const supabase = this.getClient();
    const { error } = await supabase
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error(`Failed to update last_active_at for user ${userId}:`, error.message);
    }
  }
}
