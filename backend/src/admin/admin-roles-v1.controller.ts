import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  AdminRoleAssignmentsListResult,
  AdminRoleAssignmentsService,
} from './admin-role-assignments.service';
import { RequireAdminCapabilities } from './decorators/require-admin-capabilities.decorator';
import { AdminRoleAssignmentsQueryDto } from './dto/admin-role-assignments-query.dto';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';
import { AdminGuard } from './guards/admin.guard';

@ApiTags('Admin v1 roles')
@ApiBearerAuth('bearer')
@Controller('admin/v1/roles')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminRolesV1Controller {
  constructor(private readonly assignments: AdminRoleAssignmentsService) {}

  @Get('assignments')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('roles.read')
  @ApiOperation({
    summary: 'List bounded administrative role assignments',
    description:
      'Returns role assignment grant/expiry metadata without exposing email, credentials or unrelated user profile data.',
  })
  @ApiOkResponse({ description: 'Paginated role assignments' })
  listAssignments(
    @Query() query: AdminRoleAssignmentsQueryDto,
  ): Promise<AdminRoleAssignmentsListResult> {
    return this.assignments.list(query);
  }
}
