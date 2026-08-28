import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { isMockBackendEnabled } from '../config/mock-backend-mode';
import { getMockFixtureDiagnostics } from './deterministic-fixtures';
import {
  OpenApiFixtureFactoryRegistry,
  type CreatedPublicResponseFixture,
  type PublicResponseFactoryDescriptor,
} from './openapi-fixture-factory';

const UINT32_MAX = 0xffff_ffff;
const MOCK_RESPONSE_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
] as const;

class CreateMockResponseFixtureDto {
  @IsString()
  @IsIn(MOCK_RESPONSE_METHODS)
  method!: string;

  @IsString()
  @Length(1, 256)
  @Matches(/^\/[A-Za-z0-9_{}./:-]*$/)
  path!: string;

  @IsString()
  @Matches(/^2\d\d$/)
  status!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(UINT32_MAX)
  seed?: number;

  @IsOptional()
  @IsObject()
  overrides?: Record<string, unknown>;
}

interface MockResponseFactoryIndex {
  seedId: string;
  factories: PublicResponseFactoryDescriptor[];
}

@ApiExcludeController()
@Controller('mock/schema-fixtures')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class OpenApiFixtureFactoryController {
  constructor(private readonly registry: OpenApiFixtureFactoryRegistry) {}

  @Get('responses')
  @Header('Cache-Control', 'no-store, private')
  listResponseFactories(): MockResponseFactoryIndex {
    this.assertMockMode();
    return {
      seedId: getMockFixtureDiagnostics().seedId,
      factories: this.registry.listResponseFactories(),
    };
  }

  @Post('responses')
  @Header('Cache-Control', 'no-store, private')
  createResponseFixture(
    @Body() request: CreateMockResponseFixtureDto,
  ): CreatedPublicResponseFixture {
    this.assertMockMode();
    return this.registry.createResponseFixture({
      method: request.method,
      path: request.path,
      status: request.status,
      ...(request.seed === undefined ? {} : { seed: request.seed }),
      ...(request.overrides ? { overrides: request.overrides } : {}),
    });
  }

  @Post('responses/validate-all')
  @Header('Cache-Control', 'no-store, private')
  validateAllResponseFactories(): { validated: number; seedId: string } {
    this.assertMockMode();
    const diagnostics = getMockFixtureDiagnostics();
    return {
      validated: this.registry.validateAllResponseFactories(diagnostics.seed),
      seedId: diagnostics.seedId,
    };
  }

  private assertMockMode(): void {
    if (!isMockBackendEnabled()) {
      // Hide test-only capabilities completely outside an explicit mock profile.
      throw new NotFoundException();
    }
  }
}
