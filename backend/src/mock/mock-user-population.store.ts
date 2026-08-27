import { Injectable } from '@nestjs/common';
import { resolveMockFixtureSeed } from './deterministic-fixtures';
import {
  buildGlobalMockUserPopulation,
  MockUserPopulationDataset,
  MockUserPopulationSize,
  MockUserProfile,
} from './global-user-population';
import { UpdateMockUserProfileDto } from './dto/mock-user-profile.dto';

@Injectable()
export class MockUserPopulationStore {
  private readonly overrides = new Map<
    string,
    Map<string, UpdateMockUserProfileDto>
  >();

  getPopulation(
    size: MockUserPopulationSize,
    namespace: string,
  ): MockUserPopulationDataset {
    const seed = resolveMockFixtureSeed();
    const population = buildGlobalMockUserPopulation(size, namespace, seed);
    const namespaceOverrides = this.overrides.get(
      this.getStoreKey(seed, size, namespace),
    );

    if (!namespaceOverrides) {
      return population;
    }

    return {
      ...population,
      profiles: population.profiles.map((profile) => ({
        ...profile,
        ...(namespaceOverrides.get(profile.id) ?? {}),
      })),
    };
  }

  updateProfile(
    size: MockUserPopulationSize,
    namespace: string,
    userId: string,
    changes: UpdateMockUserProfileDto,
  ): MockUserProfile | null {
    const seed = resolveMockFixtureSeed();
    const population = this.getPopulation(size, namespace);
    const current = population.profiles.find((profile) => profile.id === userId);
    if (!current) {
      return null;
    }

    const key = this.getStoreKey(seed, size, namespace);
    const namespaceOverrides = this.overrides.get(key) ?? new Map();
    const previous = namespaceOverrides.get(userId) ?? {};
    const definedChanges = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    ) as UpdateMockUserProfileDto;
    namespaceOverrides.set(userId, { ...previous, ...definedChanges });
    this.overrides.set(key, namespaceOverrides);

    return this.getPopulation(size, namespace).profiles.find(
      (profile) => profile.id === userId,
    ) ?? null;
  }

  resetPopulation(
    size: MockUserPopulationSize,
    namespace: string,
  ): MockUserPopulationDataset {
    const seed = resolveMockFixtureSeed();
    this.overrides.delete(this.getStoreKey(seed, size, namespace));
    return buildGlobalMockUserPopulation(size, namespace, seed);
  }

  private getStoreKey(
    seed: number,
    size: MockUserPopulationSize,
    namespace: string,
  ): string {
    return `${seed}:${size}:${namespace}`;
  }
}
