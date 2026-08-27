import { Module } from '@nestjs/common';
import { MockUsersController } from './mock-users.controller';

@Module({
  controllers: [MockUsersController],
})
export class MockModule {}
