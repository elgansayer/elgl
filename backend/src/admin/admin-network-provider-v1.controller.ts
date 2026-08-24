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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminAuditService } from './admin-audit.service';
import {
  AdminNetworkProviderAllowlistEntry,
  AdminNetworkProviderBlock,
  AdminNetworkProviderImpactPreview,
  AdminNetworkProviderReputation,
  AdminNetworkProviderService,
} from './admin-network-provider.service';
import { RequireAdminCapabilities } from './decorators/require-admin-capabilities.decorator';
import {
  AdminNetworkProviderImpactDto,
  AdminNetworkProviderLookupDto,
  CreateAdminNetworkProviderAllowlistDto,
  CreateAdminNetworkProviderBlockDto,
} from './dto/admin-network-provider.dto';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';
import { AdminGuard } from './guards/admin.guard';

interface AdminAuthRequest extends Request {
  user: { id?: string; sub?: string };
}

@ApiTags('Admin v1 - Network provider abuse')
@ApiBearerAuth('bearer')
@Controller('admin/v1/security/network/provider')
@UseGuards(SupabaseAuthGuard, AdminGuard, AdminCapabilityGuard)
export class AdminNetworkProviderV1Controller {
  constructor(
    private readonly providers: AdminNetworkProviderService,
    private readonly audit: AdminAuditService,
  ) {}

  @Post('reputation')
  @RequireAdminCapabilities('security.network.read')
  @ApiOperation({
    summary: 'Inspect privacy-minimized ASN / hosting-provider abuse trends',
  })
  async lookup(
    @Body() input: AdminNetworkProviderLookupDto,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkProviderReputation> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.providers.lookup(input.asn);
      await this.record(req, actorUserId, {
        action: 'security.network.provider.reputation.read',
        capabilityKey: 'security.network.read',
        outcome: 'success',
        operation: 'provider-reputation-lookup',
        asn: input.asn,
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.provider.reputation.read',
        capabilityKey: 'security.network.read',
        outcome: 'failed',
        operation: 'provider-reputation-lookup',
        asn: input.asn,
      });
      throw error;
    }
  }

  @Post('impact')
  @RequireAdminCapabilities('security.network.read')
  @ApiOperation({ summary: 'Preview observed impact before applying an ASN block' })
  async impact(
    @Body() input: AdminNetworkProviderImpactDto,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkProviderImpactPreview> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.providers.preview(input.asn, input.scope);
      await this.record(req, actorUserId, {
        action: 'security.network.provider.block_impact.read',
        capabilityKey: 'security.network.read',
        outcome: 'success',
        operation: 'provider-impact-preview',
        asn: input.asn,
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.provider.block_impact.read',
        capabilityKey: 'security.network.read',
        outcome: 'failed',
        operation: 'provider-impact-preview',
        asn: input.asn,
      });
      throw error;
    }
  }

  @Get('blocks')
  @RequireAdminCapabilities('security.network.read')
  async listBlocks(
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkProviderBlock[]> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.providers.listBlocks();
      await this.record(req, actorUserId, {
        action: 'security.network.provider.blocks.read',
        capabilityKey: 'security.network.read',
        outcome: 'success',
        operation: 'list-provider-blocks',
        resultCount: result.length,
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.provider.blocks.read',
        capabilityKey: 'security.network.read',
        outcome: 'failed',
        operation: 'list-provider-blocks',
      });
      throw error;
    }
  }

  @Get('allowlist')
  @RequireAdminCapabilities('security.network.read')
  async listAllowlist(
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkProviderAllowlistEntry[]> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.providers.listAllowlist();
      await this.record(req, actorUserId, {
        action: 'security.network.provider.allowlist.read',
        capabilityKey: 'security.network.read',
        outcome: 'success',
        operation: 'list-provider-allowlist',
        resultCount: result.length,
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.provider.allowlist.read',
        capabilityKey: 'security.network.read',
        outcome: 'failed',
        operation: 'list-provider-allowlist',
      });
      throw error;
    }
  }

  @Post('blocks')
  @RequireAdminCapabilities('security.network.manage')
  @ApiOperation({ summary: 'Create a temporary scoped ASN block' })
  async createBlock(
    @Body() input: CreateAdminNetworkProviderBlockDto,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkProviderBlock> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.providers.createBlock(actorUserId, input);
      await this.audit.record({
        actorUserId,
        action: 'security.network.provider.block.create',
        capabilityKey: 'security.network.manage',
        targetType: 'network-provider-block',
        targetId: result.id,
        reasonCode: input.reasonCode,
        operatorNote: input.operatorNote,
        outcome: 'success',
        correlationId: this.correlationId(req),
        metadata: {
          source: 'admin-v1',
          operation: 'create-provider-block',
          asn: result.asn,
          scope: result.scope,
        },
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.provider.block.create',
        capabilityKey: 'security.network.manage',
        outcome: 'failed',
        operation: 'create-provider-block',
        asn: input.asn,
      });
      throw error;
    }
  }

  @Delete('blocks/:id')
  @RequireAdminCapabilities('security.network.manage')
  async revokeBlock(
    @Param('id') id: string,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkProviderBlock> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.providers.revokeBlock(actorUserId, id);
      await this.record(req, actorUserId, {
        action: 'security.network.provider.block.revoke',
        capabilityKey: 'security.network.manage',
        outcome: 'success',
        operation: 'revoke-provider-block',
        targetId: id,
        asn: result.asn,
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.provider.block.revoke',
        capabilityKey: 'security.network.manage',
        outcome: 'failed',
        operation: 'revoke-provider-block',
        targetId: id,
      });
      throw error;
    }
  }

  @Post('allowlist')
  @RequireAdminCapabilities('security.network.manage')
  async createAllowlist(
    @Body() input: CreateAdminNetworkProviderAllowlistDto,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkProviderAllowlistEntry> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.providers.createAllowlist(actorUserId, input);
      await this.record(req, actorUserId, {
        action: 'security.network.provider.allowlist.create',
        capabilityKey: 'security.network.manage',
        outcome: 'success',
        operation: 'create-provider-allowlist',
        targetId: result.id,
        asn: result.asn,
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.provider.allowlist.create',
        capabilityKey: 'security.network.manage',
        outcome: 'failed',
        operation: 'create-provider-allowlist',
        asn: input.asn,
      });
      throw error;
    }
  }

  @Delete('allowlist/:id')
  @RequireAdminCapabilities('security.network.manage')
  async revokeAllowlist(
    @Param('id') id: string,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminNetworkProviderAllowlistEntry> {
    const actorUserId = this.actor(req);
    try {
      const result = await this.providers.revokeAllowlist(actorUserId, id);
      await this.record(req, actorUserId, {
        action: 'security.network.provider.allowlist.revoke',
        capabilityKey: 'security.network.manage',
        outcome: 'success',
        operation: 'revoke-provider-allowlist',
        targetId: id,
        asn: result.asn,
      });
      return result;
    } catch (error) {
      await this.record(req, actorUserId, {
        action: 'security.network.provider.allowlist.revoke',
        capabilityKey: 'security.network.manage',
        outcome: 'failed',
        operation: 'revoke-provider-allowlist',
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
      asn?: number;
      resultCount?: number;
      targetId?: string;
    },
  ): Promise<void> {
    await this.audit.record({
      actorUserId,
      action: input.action,
      capabilityKey: input.capabilityKey,
      targetType: input.targetId
        ? 'network-provider-control'
        : 'network-provider-reputation',
      targetId: input.targetId,
      outcome: input.outcome,
      correlationId: this.correlationId(req),
      metadata: {
        source: 'admin-v1',
        operation: input.operation,
        ...(input.asn === undefined ? {} : { asn: input.asn }),
        ...(input.resultCount === undefined
          ? {}
          : { resultCount: input.resultCount }),
      },
    });
  }
}
