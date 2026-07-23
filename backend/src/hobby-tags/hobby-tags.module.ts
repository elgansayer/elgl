import { Module } from '@nestjs/common';
import { HobbyTagsController } from './hobby-tags.controller';
import { HobbyTagsService } from './hobby-tags.service';

@Module({
  controllers: [HobbyTagsController],
  providers: [HobbyTagsService],
  exports: [HobbyTagsService],
})
export class HobbyTagsModule {}
