import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import {
  AppService,
  MockFixtureMutationResponse,
  MockFixtureStateResponse,
} from './app.service';
import { isMockBackendEnabled } from './config/mock-backend-mode';

interface MockFixtureNamespaceRequest {
  namespace?: string;
}

interface ReseedMockFixturesRequest extends MockFixtureNamespaceRequest {
  seed: number;
}

interface MockFixtureCheckpointRequest extends MockFixtureNamespaceRequest {
  checkpoint: string;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  @Get('mock/fixtures')
  getMockFixtures(
    @Query('namespace') namespace?: string,
  ): MockFixtureStateResponse {
    this.assertMockFixturesEnabled();
    return this.appService.getMockFixtures(namespace);
  }

  @Post('mock/fixtures/reset')
  resetMockFixtures(
    @Body() body: MockFixtureNamespaceRequest,
  ): MockFixtureMutationResponse {
    this.assertMockFixturesEnabled();
    return this.appService.resetMockFixtures(body.namespace);
  }

  @Post('mock/fixtures/reseed')
  reseedMockFixtures(
    @Body() body: ReseedMockFixturesRequest,
  ): MockFixtureMutationResponse {
    this.assertMockFixturesEnabled();
    return this.appService.reseedMockFixtures(body.seed, body.namespace);
  }

  @Post('mock/fixtures/snapshot')
  captureMockFixtureSnapshot(
    @Body() body: MockFixtureCheckpointRequest,
  ): MockFixtureMutationResponse {
    this.assertMockFixturesEnabled();
    return this.appService.captureMockFixtureSnapshot(
      body.checkpoint,
      body.namespace,
    );
  }

  @Post('mock/fixtures/restore')
  restoreMockFixtureSnapshot(
    @Body() body: MockFixtureCheckpointRequest,
  ): MockFixtureMutationResponse {
    this.assertMockFixturesEnabled();
    return this.appService.restoreMockFixtureSnapshot(
      body.checkpoint,
      body.namespace,
    );
  }

  private assertMockFixturesEnabled(): void {
    if (!isMockBackendEnabled()) {
      throw new NotFoundException();
    }
  }
}
