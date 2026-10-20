import { NestFactory } from '@nestjs/core';
import { AppModule } from './backend/src/app.module';
import { SupabaseService } from './backend/src/supabase/supabase.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const supabaseService = app.get(SupabaseService);
  const supabase = supabaseService.getClient();

  const { data, error, count } = await supabase
    .from('moment_likes')
    .select('id, moments!inner(id)', { count: 'exact', head: true })
    .eq('moments.author_id', 'user-1');

  console.log('Error:', error);
  console.log('Count:', count);
  await app.close();
}
bootstrap();
