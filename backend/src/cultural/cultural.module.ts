import { Module } from '@nestjs/common';
import { CulturalController } from './cultural.controller';
import { CulturalService } from './cultural.service';

@Module({
  controllers: [CulturalController],
  providers: [CulturalService],
  exports: [CulturalService],
})
export class CulturalModule {}
