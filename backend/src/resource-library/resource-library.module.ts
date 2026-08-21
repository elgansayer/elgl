import { Module } from '@nestjs/common';
import { ResourceLibraryController } from './resource-library.controller';
import { ResourceLibraryService } from './resource-library.service';

@Module({
  controllers: [ResourceLibraryController],
  providers: [ResourceLibraryService],
  exports: [ResourceLibraryService],
})
export class ResourceLibraryModule {}
