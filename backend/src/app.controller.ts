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
  MockClockSnapshot,
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

interface MockClockRequest {
  namespace?: string;
}

interface FreezeMockClockRequest extends MockClockRequest {
  now?: unknown;
  timeZone?: unknown;
}

interface ShiftMockClockRequest extends MockClockRequest {
  milliseconds?: unknown;
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

  @Get('mock/clock')
  getMockClock(@Query('namespace') namespace?: string): MockClockSnapshot {
    this.assertMockClockEnabled();
    return this.appService.getMockClock(namespace);
  }

  @Post('mock/clock/freeze')
  freezeMockClock(@Body() body?: FreezeMockClockRequest): MockClockSnapshot {
    this.assertMockClockEnabled();
    return this.appService.freezeMockClock(
      body?.now,
      body?.namespace,
      body?.timeZone,
    );
  }

  @Post('mock/clock/advance')
  advanceMockClock(@Body() body?: ShiftMockClockRequest): MockClockSnapshot {
    this.assertMockClockEnabled();
    return this.appService.advanceMockClock(
      body?.milliseconds,
      body?.namespace,
    );
  }

  @Post('mock/clock/rewind')
  rewindMockClock(@Body() body?: ShiftMockClockRequest): MockClockSnapshot {
    this.assertMockClockEnabled();
    return this.appService.rewindMockClock(body?.milliseconds, body?.namespace);
  }

  @Post('mock/clock/reset')
  resetMockClock(@Body() body?: MockClockRequest): MockClockSnapshot {
    this.assertMockClockEnabled();
    return this.appService.resetMockClock(body?.namespace);
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

  private assertMockClockEnabled(): void {
    if (!isMockBackendEnabled()) {
      throw new NotFoundException();
    }
  }
}
