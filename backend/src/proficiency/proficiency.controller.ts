import {
  Controller,
  Post,
  Body,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProficiencyService } from './proficiency.service';
import { AssessmentResultDto } from './dto/assessment-result.dto';
import { LanguageSelectionDto } from './dto/language-selection.dto';
import { AssessmentResult } from './interfaces/proficiency.interface';

@Controller('proficiency')
@UseGuards(SupabaseAuthGuard)
export class ProficiencyController {
  constructor(private readonly proficiencyService: ProficiencyService) {}

  @Post('assess')
  async assess(
    @CurrentUser() user: User | null,
    @Body() dto: AssessmentResultDto,
  ): Promise<AssessmentResult> {
    if (!user) throw new UnauthorizedException();
    return this.proficiencyService.assess(dto, user.id);
  }

  @Post('languages')
  async setLanguages(
    @CurrentUser() user: User | null,
    @Body() dto: LanguageSelectionDto,
  ): Promise<{ success: boolean }> {
    if (!user) throw new UnauthorizedException();
    dto.userId = user.id; // override with authenticated user
    await this.proficiencyService.setLanguages(dto);
    return { success: true };
  }
}
