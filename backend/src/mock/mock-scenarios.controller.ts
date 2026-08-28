import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Put,
} from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';
import { isMockBackendEnabled } from '../config/mock-backend-mode';
import { MockScenariosService } from './mock-scenarios.service';

export class SelectMockScenariosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  packs!: string[];
}

@Controller('mock/scenarios')
export class MockScenariosController {
  constructor(private readonly scenarios: MockScenariosService) {}

  @Get()
  list() {
    this.assertEnabled();
    return this.scenarios.list();
  }

  @Get(':namespace')
  get(@Param('namespace') namespace: string) {
    this.assertEnabled();
    return this.scenarios.get(namespace);
  }

  @Get(':namespace/fixtures')
  snapshot(@Param('namespace') namespace: string) {
    this.assertEnabled();
    return this.scenarios.snapshot(namespace);
  }

  @Put(':namespace')
  select(
    @Param('namespace') namespace: string,
    @Body() body: SelectMockScenariosDto,
  ) {
    this.assertEnabled();
    return this.scenarios.select(namespace, body.packs);
  }

  @Delete(':namespace')
  reset(@Param('namespace') namespace: string) {
    this.assertEnabled();
    return this.scenarios.reset(namespace);
  }

  private assertEnabled(): void {
    if (!isMockBackendEnabled()) {
      throw new NotFoundException();
    }
  }
}
