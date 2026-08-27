import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { AppService } from './app.service';
import { isMockBackendEnabled } from './config/mock-backend-mode';
import { GpsDiscoveryScenarioStore } from './mock/gps-discovery-scenario';
import type { GpsDiscoveryScenario } from './mock/gps-discovery-scenario';

interface MockGpsNamespaceRequest {
  namespace?: string;
}

interface MockGpsVisibilityRequest extends MockGpsNamespaceRequest {
  userId: string;
  hidden: boolean;
}

@Controller()
export class AppController {
  private readonly gpsDiscoveryScenarios = new GpsDiscoveryScenarioStore();

  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  @Get('mock/gps-discovery')
  getMockGpsDiscovery(
    @Query('namespace') namespace?: string,
  ): GpsDiscoveryScenario {
    this.assertMockBackendEnabled();
    return this.gpsDiscoveryScenarios.get(namespace);
  }

  @Post('mock/gps-discovery/location-visibility')
  setMockGpsLocationVisibility(
    @Body() body: MockGpsVisibilityRequest,
  ): GpsDiscoveryScenario {
    this.assertMockBackendEnabled();
    return this.gpsDiscoveryScenarios.setLocationVisibility(
      body.userId,
      body.hidden,
      body.namespace,
    );
  }

  @Post('mock/gps-discovery/reset')
  resetMockGpsDiscovery(
    @Body() body: MockGpsNamespaceRequest,
  ): GpsDiscoveryScenario {
    this.assertMockBackendEnabled();
    return this.gpsDiscoveryScenarios.reset(body.namespace);
  }

  private assertMockBackendEnabled(): void {
    if (!isMockBackendEnabled()) throw new NotFoundException();
  }
}
