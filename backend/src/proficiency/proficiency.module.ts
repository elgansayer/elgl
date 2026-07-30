import { Module } from '@nestjs/common';
import { ProficiencyController } from './proficiency.controller';
import { ProficiencyService } from './proficiency.service';

@Module({
  controllers: [ProficiencyController],
  providers: [ProficiencyService],
})
export class ProficiencyModule {}
