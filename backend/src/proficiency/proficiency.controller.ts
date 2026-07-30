import { Controller, Post, Body } from '@nestjs/common';
import { ProficiencyService } from './proficiency.service';
import { AssessmentResultDto } from './dto/assessment-result.dto';
import { AssessmentResult } from './interfaces/proficiency.interface';

@Controller('proficiency')
export class ProficiencyController {
  constructor(private readonly proficiencyService: ProficiencyService) {}

  @Post('assess')
  async assess(@Body() dto: AssessmentResultDto): Promise<AssessmentResult> {
    return this.proficiencyService.assess(dto);
  }
}
