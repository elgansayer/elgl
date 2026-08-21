import { Test } from '@nestjs/testing';
import { UserStatisticsModule } from './user-statistics.module';
import { UserStatisticsController } from './user-statistics.controller';
import { UserStatisticsService } from './user-statistics.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';

const mockSupabaseService = { getClient: () => ({}) };

describe('UserStatisticsModule', () => {
  describe('module compilation', () => {
    it('should compile the module', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          UserStatisticsModule,
          ConfigModule.forRoot({ isGlobal: true }),
        ],
      })
        .overrideProvider(SupabaseService)
        .useValue(mockSupabaseService)
        .overrideProvider(ConfigService)
        .useValue({})
        .compile();

      expect(moduleRef).toBeDefined();
    });

    it('should instantiate the controller and the service', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          UserStatisticsModule,
          ConfigModule.forRoot({ isGlobal: true }),
        ],
      })
        .overrideProvider(SupabaseService)
        .useValue(mockSupabaseService)
        .overrideProvider(ConfigService)
        .useValue({})
        .compile();

      const controller = moduleRef.get(UserStatisticsController);
      const service = moduleRef.get(UserStatisticsService);

      expect(controller).toBeInstanceOf(UserStatisticsController);
      expect(service).toBeInstanceOf(UserStatisticsService);
    });
  });
});
