import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface OpenApiOperation {
  tags?: string[];
  security?: Array<Record<string, unknown>>;
  parameters?: Array<Record<string, unknown>>;
  responses?: Record<string, unknown>;
  ['x-requires-2fa']?: boolean;
}

interface OpenApiDocument {
  openapi: string;
  servers?: Array<{ url?: string }>;
  security?: Array<Record<string, unknown>>;
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: {
    securitySchemes?: Record<string, unknown>;
    parameters?: Record<string, Record<string, unknown>>;
    schemas?: Record<string, Record<string, unknown>>;
    responses?: Record<string, Record<string, unknown>>;
  };
}

const repositoryRoot = resolve(__dirname, '../../..');
const contractPath = resolve(
  repositoryRoot,
  'docs/api/user-profiles.openapi.json',
);
const usersModulePath = resolve(
  repositoryRoot,
  'backend/src/users/users.module.ts',
);
const controllerPath = resolve(
  repositoryRoot,
  'backend/src/users/users.controller.ts',
);

const contract = JSON.parse(
  readFileSync(contractPath, 'utf8'),
) as OpenApiDocument;
const usersModuleSource = readFileSync(usersModulePath, 'utf8');
const controllerSource = readFileSync(controllerPath, 'utf8');

const documentedOperations = Object.values(contract.paths).flatMap((path) =>
  Object.entries(path)
    .filter(([method]) =>
      ['get', 'post', 'put', 'patch', 'delete'].includes(method),
    )
    .map(([, operation]) => operation),
);

describe('User Profiles OpenAPI architecture contract', () => {
  it('is a versioned OpenAPI document served below the application API prefix', () => {
    expect(contract.openapi).toMatch(/^3\./);
    expect(contract.servers).toEqual(
      expect.arrayContaining([expect.objectContaining({ url: '/api' })]),
    );
  });

  it('documents the Supabase bearer boundary globally', () => {
    expect(contract.security).toEqual([{ bearer: [] }]);
    expect(contract.components?.securitySchemes?.['bearer']).toEqual(
      expect.objectContaining({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      }),
    );
  });

  it('keeps live Swagger metadata attached to UsersController', () => {
    expect(usersModuleSource).toContain(
      "ApiTags('User Profiles')(UsersController)",
    );
    expect(usersModuleSource).toContain(
      "ApiBearerAuth('bearer')(UsersController)",
    );
  });

  it('tags every documented operation as User Profiles', () => {
    expect(documentedOperations.length).toBeGreaterThan(20);
    for (const operation of documentedOperations) {
      expect(operation.tags).toContain('User Profiles');
    }
  });

  it('covers every current UsersController route family', () => {
    const requiredPaths = [
      '/users/me',
      '/users/me/permanent',
      '/users/me/restore',
      '/users/me/export',
      '/users/me/stats',
      '/users/me/xp',
      '/users/me/assess-proficiency',
      '/users/me/greeting',
      '/users/me/away',
      '/users/me/avatar/presigned-url',
      '/users/me/cover-photo/presigned-url',
      '/users/me/cover-photo',
      '/users/me/visitors',
      '/users/status/{statusId}/viewers',
      '/users/me/status-viewers',
      '/users/hobbies',
      '/users/interests',
      '/users/search',
      '/users/me/badges',
      '/users/{id}',
      '/users/{id}/stats',
      '/users/{id}/followers',
      '/users/{id}/following',
      '/users/{id}/follow',
      '/users/block/{id}',
      '/users/report',
      '/users/me/privacy-settings',
      '/users/me/privacy',
      '/users/me/message-filters',
      '/users/me/business',
      '/users/me/dnd',
      '/users/me/status-visibility',
      '/users/me/contact-sharing',
      '/users/me/notification-preferences',
    ];

    for (const path of requiredPaths) {
      expect(contract.paths).toHaveProperty(path);
    }
  });

  it('keeps destructive and protected self-profile operations marked for 2FA', () => {
    expect(contract.paths['/users/me']?.['patch']?.['x-requires-2fa']).toBe(
      true,
    );
    expect(contract.paths['/users/me']?.['delete']?.['x-requires-2fa']).toBe(
      true,
    );
    expect(
      contract.paths['/users/me/permanent']?.['delete']?.['x-requires-2fa'],
    ).toBe(true);
    expect(
      contract.paths['/users/me/restore']?.['post']?.['x-requires-2fa'],
    ).toBe(true);
  });

  it('documents bounded social graph and search collection parameters', () => {
    const limit = contract.components?.parameters?.['Limit'];
    const offset = contract.components?.parameters?.['Offset'];
    expect(limit?.['schema']).toEqual(
      expect.objectContaining({
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
      }),
    );
    expect(offset?.['schema']).toEqual(
      expect.objectContaining({
        type: 'integer',
        minimum: 0,
        maximum: 10_000,
        default: 0,
      }),
    );

    const searchParameters = contract.paths['/users/search']?.['get']
      ?.parameters as Array<Record<string, unknown>>;
    expect(searchParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'q', in: 'query', required: true }),
        expect.objectContaining({ name: 'limit', in: 'query' }),
      ]),
    );
    const searchLimit = searchParameters.find(
      (parameter) => parameter['name'] === 'limit',
    );
    expect(searchLimit?.['schema']).toEqual(
      expect.objectContaining({
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 10,
      }),
    );
  });

  it('documents privacy-sensitive profile projections and stable failures', () => {
    expect(contract.components?.schemas?.['PrivacySettings']).toBeDefined();
    expect(contract.components?.schemas?.['ProfileVisitor']).toBeDefined();
    expect(contract.components?.schemas?.['MessageFilters']).toBeDefined();
    expect(contract.components?.responses?.['Unauthorized']).toBeDefined();
    expect(contract.components?.responses?.['Forbidden']).toBeDefined();
    expect(contract.components?.responses?.['TooManyRequests']).toBeDefined();
  });

  it('stays aligned with the actual route decorators for critical operations', () => {
    expect(controllerSource).toContain("@Controller('users')");
    expect(controllerSource).toContain("@Get('me')");
    expect(controllerSource).toContain("@Patch('me')");
    expect(controllerSource).toContain("@Delete('me')");
    expect(controllerSource).toContain("@Delete('me/permanent')");
    expect(controllerSource).toContain("@Post('me/restore')");
    expect(controllerSource).toContain("@Get(':id/followers')");
    expect(controllerSource).toContain("@Get(':id/following')");
    expect(controllerSource).toContain("@Post('block/:id')");
    expect(controllerSource).toContain("@Post('report')");
    expect(controllerSource).toContain("@Patch('me/privacy')");
    expect(controllerSource).toContain("@Patch('me/notification-preferences')");
  });
});
