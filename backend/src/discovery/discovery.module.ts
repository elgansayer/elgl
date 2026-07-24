import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { SafetyModule } from '../safety/safety.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';

@Module({
  imports: [UsersModule, SafetyModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
