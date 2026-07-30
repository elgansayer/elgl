import { Module } from '@nestjs/common';
import { XpModule } from '../xp/xp.module';
import { ProficiencyController } from './proficiency.controller';
import { ProficiencyService } from './proficiency.service';

@Module({
  imports: [XpModule],
  controllers: [ProficiencyController],
  providers: [ProficiencyService],
})
export class ProficiencyModule {}
