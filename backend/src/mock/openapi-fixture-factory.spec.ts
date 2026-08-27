import { describe, expect, it } from 'vitest';
import {
  OpenApiFixtureFactoryRegistry,
  defineTypedFixtureFactory,
} from './openapi-fixture-factory';

interface TypedResponseFixture {
  id: string;
  displayName: string;
  optionalNote?: string;
}

const OPENAPI_DOCUMENT = {
  openapi: '3.0.0',
  info: { title: 'Fixture test', version: '1.0.0' },
  paths: {
    '/profiles/{id}': {
      get: {
        operationId: 'getProfile',
        responses: {
          '200': {
            description: 'Profile',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProfileResponse' },
              },
            },
          },
        },
      },
    },
    '/profiles': {
      get: {
        operationId: 'listProfiles',
        responses: {
          '200': {
            description: 'Profiles',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  minItems: 2,
                  items: { $ref: '#/components/schemas/ProfileResponse' },
                },
              },
            },
          },
          '204': { description: 'No content' },
        },
      },
    },
  },
  components: {
    schemas: {
      ProfileResponse: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'displayName', 'createdAt', 'score', 'metadata'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          displayName: { type: 'string', minLength: 3, maxLength: 64 },
          createdAt: { type: 'string', format: 'date-time' },
          score: { type: 'integer', minimum: 0, maximum: 100 },
          avatarUrl: { type: 'string', format: 'uri' },
          metadata: { $ref: '#/components/schemas/ProfileMetadata' },
        },
      },
      ProfileMetadata: {
        type: 'object',
        required: ['active'],
        properties: {
          active: { type: 'boolean' },
          tags: {
            type: 'array',
            maxItems: 2,
            items: { type: 'string', maxLength: 40 },
          },
        },
      },
    },
  },
} as const;

function createRegistry(): OpenApiFixtureFactoryRegistry {
  const registry = new OpenApiFixtureFactoryRegistry();
  registry.registerDocument(OPENAPI_DOCUMENT);
  return registry;
}

describe('OpenApiFixtureFactoryRegistry', () => {
  it('discovers every documented public 2xx JSON response with a schema', () => {
    const factories = createRegistry().listResponseFactories();

    expect(factories).toEqual([
      expect.objectContaining({
        id: 'GET /profiles 200',
        operationId: 'listProfiles',
      }),
      expect.objectContaining({
        id: 'GET /profiles/{id} 200',
        operationId: 'getProfile',
      }),
    ]);
  });

  it('creates byte-stable defaults for the same seed', () => {
    const registry = createRegistry();
    const request = {
      method: 'get',
      path: '/profiles/{id}',
      status: '200',
      seed: 7937,
    };

    const first = registry.createResponseFixture(request);
    const second = registry.createResponseFixture(request);

    expect(second).toEqual(first);
    expect(first.payload).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        avatarUrl: expect.stringMatching(/^http:\/\/127\.0\.0\.1\/mock-fixtures\//),
        metadata: expect.objectContaining({ active: expect.any(Boolean) }),
      }),
    );
  });

  it('supports explicit overrides and validates the merged payload against OpenAPI', () => {
    const registry = createRegistry();
    const fixture = registry.createResponseFixture({
      method: 'GET',
      path: '/profiles/{id}',
      status: '200',
      seed: 42,
      overrides: {
        displayName: 'Manual QA Learner',
        metadata: { active: true },
      },
    });

    expect(fixture.payload).toEqual(
      expect.objectContaining({
        displayName: 'Manual QA Learner',
        metadata: expect.objectContaining({ active: true }),
      }),
    );

    expect(() =>
      registry.createResponseFixture({
        method: 'get',
        path: '/profiles/{id}',
        status: '200',
        overrides: { score: 101 },
      }),
    ).toThrow('above schema maximum');
  });

  it('validates the default for every public response factory in one pass', () => {
    expect(createRegistry().validateAllResponseFactories(2026)).toBe(2);
  });

  it('rejects operations that are not present in the authoritative document', () => {
    expect(() =>
      createRegistry().createResponseFixture({
        method: 'post',
        path: '/profiles/{id}',
        status: '200',
      }),
    ).toThrow('not present in the authoritative OpenAPI document');
  });
});

describe('defineTypedFixtureFactory', () => {
  it('preserves valid defaults and applies typed overrides', () => {
    const factory = defineTypedFixtureFactory<TypedResponseFixture>({
      id: 'fixture-id',
      displayName: 'Fixture learner',
    });

    expect(factory.create({ displayName: 'Override learner' })).toEqual({
      id: 'fixture-id',
      displayName: 'Override learner',
    });
  });

  it('makes DTO required-field drift a TypeScript compilation failure', () => {
    // This assertion deliberately belongs in compiled test source: if the
    // generic helper ever stops requiring required DTO fields, ts-expect-error
    // itself becomes a compiler error and the contract fails.
    // @ts-expect-error displayName is a required response field.
    defineTypedFixtureFactory<TypedResponseFixture>({ id: 'fixture-id' });
  });
});
