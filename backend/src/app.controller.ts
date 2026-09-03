import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { AppService, MockClockSnapshot } from './app.service';
import { isMockBackendEnabled } from './config/mock-backend-mode';

interface MockClockRequest {
  namespace?: string;
}

interface FreezeMockClockRequest extends MockClockRequest {
  now: string;
  timeZone?: string;
}

interface ShiftMockClockRequest extends MockClockRequest {
  milliseconds: number;
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
  freezeMockClock(@Body() body: FreezeMockClockRequest): MockClockSnapshot {
    this.assertMockClockEnabled();
    return this.appService.freezeMockClock(
      body.now,
      body.namespace,
      body.timeZone,
    );
  }

  @Post('mock/clock/advance')
  advanceMockClock(@Body() body: ShiftMockClockRequest): MockClockSnapshot {
    this.assertMockClockEnabled();
    return this.appService.advanceMockClock(body.milliseconds, body.namespace);
  }

  @Post('mock/clock/rewind')
  rewindMockClock(@Body() body: ShiftMockClockRequest): MockClockSnapshot {
    this.assertMockClockEnabled();
    return this.appService.rewindMockClock(body.milliseconds, body.namespace);
  }

  @Post('mock/clock/reset')
  resetMockClock(@Body() body: MockClockRequest): MockClockSnapshot {
    this.assertMockClockEnabled();
    return this.appService.resetMockClock(body.namespace);
  }

  private assertMockClockEnabled(): void {
    if (!isMockBackendEnabled()) {
      throw new NotFoundException();
    }
  }
}
