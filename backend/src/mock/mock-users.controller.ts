import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { isMockBackendEnabled } from '../config/mock-backend-mode';
import {
  buildGlobalMockUserPopulation,
  MOCK_USER_POPULATION_COUNTS,
  MockUserPopulationDataset,
  MockUserPopulationSize,
} from './global-user-population';

const MOCK_NAMESPACE_PATTERN = /^[a-zA-Z0-9._-]{1,64}$/;

@ApiExcludeController()
@Controller('mock/users')
export class MockUsersController {
  @Get()
  @Header('Cache-Control', 'private, no-store')
  getPopulation(
    @Query('size') requestedSize = 'medium',
    @Query('namespace') requestedNamespace = 'default',
  ): MockUserPopulationDataset {
    if (!isMockBackendEnabled()) {
      throw new NotFoundException();
    }

    if (!(requestedSize in MOCK_USER_POPULATION_COUNTS)) {
      throw new BadRequestException(
        `size must be one of: ${Object.keys(MOCK_USER_POPULATION_COUNTS).join(', ')}`,
      );
    }
    if (!MOCK_NAMESPACE_PATTERN.test(requestedNamespace)) {
      throw new BadRequestException(
        'namespace must be 1-64 letters, numbers, dots, underscores, or hyphens',
      );
    }

    return buildGlobalMockUserPopulation(
      requestedSize as MockUserPopulationSize,
      requestedNamespace,
    );
  }
}
