import { Module } from '@nestjs/common';
import { MockScenariosController } from './mock-scenarios.controller';
import { MockScenariosService } from './mock-scenarios.service';

@Module({
  controllers: [MockScenariosController],
  providers: [MockScenariosService],
  exports: [MockScenariosService],
})
export class MockScenariosModule {}
