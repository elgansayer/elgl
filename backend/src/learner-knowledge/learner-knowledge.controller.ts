import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LearnerKnowledgeService, LearnerKnowledgeProfile } from './learner-knowledge.service';

interface AuthenticatedRequest {
  user?: { id: string };
}

@ApiTags('Learner Knowledge')
@Controller('learner-knowledge')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class LearnerKnowledgeController {
  constructor(private readonly learnerKnowledgeService: LearnerKnowledgeService) {}

  @Get(':language')
  @ApiOperation({
    summary: 'Get unified learner knowledge profile',
    description: 'Returns a comprehensive profile of what the user knows, is learning, and their recent encounters for a specific language.',
  })
  @ApiResponse({
    status: 200,
    description: 'The learner knowledge profile.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT.',
  })
  async getProfile(
    @Req() req: AuthenticatedRequest,
    @Param('language') language: string,
  ): Promise<LearnerKnowledgeProfile> {
    const userId = req.user!.id;
    return this.learnerKnowledgeService.getProfile(userId, language);
  }
}
