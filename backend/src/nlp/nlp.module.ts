import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { NlpController } from './nlp.controller';
import { NlpService } from './nlp.service';

@Module({
  imports: [UsersModule],
  controllers: [NlpController],
  providers: [NlpService],
  exports: [NlpService],
})
export class NlpModule {}
