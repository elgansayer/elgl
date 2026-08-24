import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  AdminNetworkAbuseService,
  AdminNetworkAllowlistEntry,
  AdminNetworkBlock,
  AdminNetworkImpactPreview,
  AdminNetworkReputation,
} from './admin-network-abuse.service';
import { AdminAuditService } from './admin-audit.service';
import { RequireAdminCapabilities } from './decorators/require-admin-capabilities.decorator';
import {
  AdminNetworkImpactDto,
  AdminNetworkLookupDto,
  CreateAdminNetworkAllowlistDto,
  CreateAdminNetworkBlockDto,
} from './dto/admin-network-abuse.dto';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';
import { AdminGuard } from './guards/admin.guard';

interface AdminAuthRequest extends Request {
  user: { id?: string; sub?: string };
}

@ApiTags('Admin v1 - Network abuse')
@ApiBearerAuth('bearer')
@Controller('admin/v1/security/network')
@UseGuards(SupabaseAuthGuard, AdminGuard, AdminCapabilityGuard)
export class AdminNetworkAbuseV1Controller {
  constructor(
    private readonly networkAbuse: AdminNetworkAbuseService,
    private readonly audit: AdminAuditService,
  ) {}

  @Post('reputation')
  @RequireAdminCapabilities('security.network.read')
  @ApiOperation({
    summary: 'Inspect coarse, privacy-minimized network reputation signals',
    description:
      'Accepts the IP in the request body so it is not placed in query strings. Returns bounded internal abuse signals and never persists the lookup IP in the audit log.',
  })
  @ApiOkResponse({ description: 'Coarse network reputation returned' })
  async lookup(
    @Body() input: AdminNetworkLookupDto,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkReputation> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.networkAbuse.lookup(input.ip);
      await this.record(req, actorUserId, {
        action: 'security.network.reputation.read',
        capabilityKey: 'security.network.read',
        outcome: 'success',
        operation: 'reputation-lookup',
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.reputation.read',
        capabilityKey: 'security.network.read',
        outcome: 'failed',
        operation: 'reputation-lookup',
      });
      throw error;
    }
  }

  @Post('impact')
  @RequireAdminCapabilities('security.network.read')
  @ApiOperation({ summary: 'Preview the observed impact of a proposed CIDR block' })
  async impact(
    @Body() input: AdminNetworkImpactDto,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkImpactPreview> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.networkAbuse.preview(input.cidr, input.scope);
      await this.record(req, actorUserId, {
        action: 'security.network.block_impact.read',
        capabilityKey: 'security.network.read',
        outcome: 'success',
        operation: 'impact-preview',
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.block_impact.read',
        capabilityKey: 'security.network.read',
        outcome: 'failed',
        operation: 'impact-preview',
      });
      throw error;
    }
  }

  @Get('blocks')
  @RequireAdminCapabilities('security.network.read')
  async listBlocks(@Req() req: AdminAuthRequest): Promise<AdminNetworkBlock[]> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.networkAbuse.listBlocks();
      await this.record(req, actorUserId, {
        action: 'security.network.blocks.read',
        capabilityKey: 'security.network.read',
        outcome: 'success',
        operation: 'list-blocks',
        resultCount: result.length,
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.blocks.read',
        capabilityKey: 'security.network.read',
        outcome: 'failed',
        operation: 'list-blocks',
      });
      throw error;
    }
  }

  @Get('allowlist')
  @RequireAdminCapabilities('security.network.read')
  async listAllowlist(
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkAllowlistEntry[]> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.networkAbuse.listAllowlist();
      await this.record(req, actorUserId, {
        action: 'security.network.allowlist.read',
        capabilityKey: 'security.network.read',
        outcome: 'success',
        operation: 'list-allowlist',
        resultCount: result.length,
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.allowlist.read',
        capabilityKey: 'security.network.read',
        outcome: 'failed',
        operation: 'list-allowlist',
      });
      throw error;
    }
  }

  @Post('blocks')
  @RequireAdminCapabilities('security.network.manage')
  @ApiOperation({ summary: 'Create a temporary scoped network block' })
  async createBlock(
    @Body() input: CreateAdminNetworkBlockDto,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkBlock> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.networkAbuse.createBlock(actorUserId, input);
      await this.audit.record({
        actorUserId,
        action: 'security.network.block.create',
        capabilityKey: 'security.network.manage',
        targetType: 'network-block',
        targetId: result.id,
        reasonCode: input.reasonCode,
        operatorNote: input.operatorNote,
        outcome: 'success',
        correlationId: this.correlationId(req),
        metadata: { source: 'admin-v1', operation: 'create-network-block' },
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.block.create',
        capabilityKey: 'security.network.manage',
        outcome: 'failed',
        operation: 'create-network-block',
      });
      throw error;
    }
  }

  @Delete('blocks/:id')
  @RequireAdminCapabilities('security.network.manage')
  async revokeBlock(
    @Param('id') id: string,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkBlock> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.networkAbuse.revokeBlock(actorUserId, id);
      await this.record(req, actorUserId, {
        action: 'security.network.block.revoke',
        capabilityKey: 'security.network.manage',
        outcome: 'success',
        operation: 'revoke-network-block',
        targetId: id,
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.block.revoke',
        capabilityKey: 'security.network.manage',
        outcome: 'failed',
        operation: 'revoke-network-block',
        targetId: id,
      });
      throw error;
    }
  }

  @Post('allowlist')
  @RequireAdminCapabilities('security.network.manage')
  async createAllowlist(
    @Body() input: CreateAdminNetworkAllowlistDto,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkAllowlistEntry> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.networkAbuse.createAllowlist(actorUserId, input);
      await this.record(req, actorUserId, {
        action: 'security.network.allowlist.create',
        capabilityKey: 'security.network.manage',
        outcome: 'success',
        operation: 'create-network-allowlist',
        targetId: result.id,
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.allowlist.create',
        capabilityKey: 'security.network.manage',
        outcome: 'failed',
        operation: 'create-network-allowlist',
      });
      throw error;
    }
  }

  @Delete('allowlist/:id')
  @RequireAdminCapabilities('security.network.manage')
  async revokeAllowlist(
    @Param('id') id: string,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkAllowlistEntry> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.networkAbuse.revokeAllowlist(actorUserId, id);
      await this.record(req, actorUserId, {
        action: 'security.network.allowlist.revoke',
        capabilityKey: 'security.network.manage',
        outcome: 'success',
        operation: 'revoke-network-allowlist',
        targetId: id,
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.allowlist.revoke',
        capabilityKey: 'security.network.manage',
        outcome: 'failed',
        operation: 'revoke-network-allowlist',
        targetId: id,
      });
      throw error;
    }
  }

  private actor(req: AdminAuthRequest): string {
    const actorUserId = req.user.id ?? req.user.sub;
    if (!actorUserId) throw new UnauthorizedException();
    return actorUserId;
  }

  private correlationId(req: Request): string | undefined {
    const requestId = req.headers['x-request-id'];
    return Array.isArray(requestId) ? requestId[0] : requestId;
  }

  private async record(
    req: Request,
    actorUserId: string,
    input: {
      action: string;
      capabilityKey: 'security.network.read' | 'security.network.manage';
      outcome: 'success' | 'failed';
      operation: string;
      resultCount?: number;
      targetId?: string;
    },
  ): Promise<void> {
    await this.audit.record({
      actorUserId,
      action: input.action,
      capabilityKey: input.capabilityKey,
      targetType: input.targetId ? 'network-control' : 'network-reputation',
      targetId: input.targetId,
      outcome: input.outcome,
      correlationId: this.correlationId(req),
      metadata: {
        source: 'admin-v1',
        operation: input.operation,
        ...(input.resultCount === undefined
          ? {}
          : { resultCount: input.resultCount }),
      },
    });
  }
}
