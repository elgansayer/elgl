import { Injectable } from '@nestjs/common';
import {
  createDeterministicFixtureGenerator,
  getMockFixtureDiagnostics,
  resolveMockFixtureSeed,
  type DeterministicFixtureGenerator,
} from './deterministic-fixtures';

const RESPONSE_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
] as const;
const MAX_SCHEMA_DEPTH = 12;
const MAX_GENERATED_ARRAY_ITEMS = 3;
const LOCAL_FIXTURE_ORIGIN = 'http://127.0.0.1/mock-fixtures';

type ResponseMethod = (typeof RESPONSE_METHODS)[number];
type JsonRecord = Record<string, unknown>;

interface OpenApiDocumentLike extends JsonRecord {
  paths: Record<string, JsonRecord>;
  components?: {
    schemas?: Record<string, OpenApiSchemaLike>;
    responses?: Record<string, unknown>;
  };
}

interface OpenApiSchemaLike extends JsonRecord {
  $ref?: string;
  type?: string;
  format?: string;
  nullable?: boolean;
  enum?: unknown[];
  default?: unknown;
  properties?: Record<string, OpenApiSchemaLike>;
  required?: string[];
  items?: OpenApiSchemaLike;
  allOf?: OpenApiSchemaLike[];
  oneOf?: OpenApiSchemaLike[];
  anyOf?: OpenApiSchemaLike[];
  additionalProperties?: boolean | OpenApiSchemaLike;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean | number;
  exclusiveMaximum?: boolean | number;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  maxProperties?: number;
  readOnly?: boolean;
  writeOnly?: boolean;
}

export interface PublicResponseFactoryDescriptor {
  id: string;
  method: ResponseMethod;
  path: string;
  status: string;
  mediaType: string;
  operationId?: string;
}

export interface CreatePublicResponseFixtureInput {
  method: string;
  path: string;
  status: string;
  seed?: number;
  overrides?: JsonRecord;
}

export interface CreatedPublicResponseFixture {
  descriptor: PublicResponseFactoryDescriptor;
  seed: number;
  seedId: string;
  payload: unknown;
}

export interface TypedFixtureFactory<T extends object> {
  readonly defaults: Readonly<T>;
  create(overrides?: Partial<T>): T;
}

/**
 * Typed fixture helper for DTO-specific factories. Supplying `T` makes every
 * required DTO field mandatory in `defaults`, so TypeScript fails compilation
 * when a required field is added without updating the fixture.
 */
export function defineTypedFixtureFactory<T extends object>(
  defaults: T,
): TypedFixtureFactory<T> {
  const stableDefaults = structuredClone(defaults);
  return {
    defaults: stableDefaults,
    create(overrides: Partial<T> = {}): T {
      return {
        ...structuredClone(stableDefaults),
        ...structuredClone(overrides),
      } as T;
    },
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asSchema(value: unknown, context: string): OpenApiSchemaLike {
  if (!isRecord(value)) {
    throw new Error(`OpenAPI schema is missing or invalid at ${context}`);
  }
  return value as OpenApiSchemaLike;
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'value';
}

function resolveJsonPointer(
  document: OpenApiDocumentLike,
  ref: string,
): unknown {
  if (!ref.startsWith('#/')) {
    throw new Error(`External OpenAPI references are not allowed: ${ref}`);
  }

  let value: unknown = document;
  for (const encodedSegment of ref.slice(2).split('/')) {
    const segment = encodedSegment.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isRecord(value) || !(segment in value)) {
      throw new Error(`Unresolved OpenAPI reference: ${ref}`);
    }
    value = value[segment];
  }
  return value;
}

function resolveSchema(
  document: OpenApiDocumentLike,
  schema: OpenApiSchemaLike,
  context: string,
): OpenApiSchemaLike {
  if (!schema.$ref) return schema;
  return asSchema(
    resolveJsonPointer(document, schema.$ref),
    `${context} -> ${schema.$ref}`,
  );
}

function responseSchema(
  document: OpenApiDocumentLike,
  descriptor: PublicResponseFactoryDescriptor,
): OpenApiSchemaLike {
  const pathItem = document.paths[descriptor.path];
  const operation = pathItem?.[descriptor.method];
  if (!isRecord(operation)) {
    throw new Error(`OpenAPI operation disappeared for ${descriptor.id}`);
  }
  const responses = operation['responses'];
  if (!isRecord(responses)) {
    throw new Error(`OpenAPI responses disappeared for ${descriptor.id}`);
  }

  let response: unknown = responses[descriptor.status];
  if (isRecord(response) && typeof response['$ref'] === 'string') {
    response = resolveJsonPointer(document, response['$ref']);
  }
  if (!isRecord(response)) {
    throw new Error(`OpenAPI response disappeared for ${descriptor.id}`);
  }

  const content = response['content'];
  if (!isRecord(content)) {
    throw new Error(
      `OpenAPI response content disappeared for ${descriptor.id}`,
    );
  }
  const media = content[descriptor.mediaType];
  if (!isRecord(media)) {
    throw new Error(
      `OpenAPI response media type disappeared for ${descriptor.id}`,
    );
  }
  return asSchema(media['schema'], `${descriptor.id} response`);
}

function inferSchemaType(schema: OpenApiSchemaLike): string | undefined {
  if (schema.type) return schema.type;
  if (schema.properties || schema.additionalProperties) return 'object';
  if (schema.items) return 'array';
  return undefined;
}

function normalizeString(
  raw: string,
  schema: OpenApiSchemaLike,
  context: string,
): string {
  const minLength = Math.max(0, schema.minLength ?? 0);
  const maxLength = Math.max(
    minLength,
    schema.maxLength ?? Math.max(64, minLength),
  );
  let value = raw;

  if (value.length < minLength) {
    value = `${value}${'x'.repeat(minLength - value.length)}`;
  }
  if (value.length > maxLength) {
    value = value.slice(0, maxLength);
  }

  if (schema.pattern) {
    let pattern: RegExp;
    try {
      pattern = new RegExp(schema.pattern, 'u');
    } catch {
      throw new Error(`Invalid OpenAPI regex pattern at ${context}`);
    }
    if (!pattern.test(value)) {
      if (typeof schema.default === 'string' && pattern.test(schema.default)) {
        value = schema.default;
      } else {
        throw new Error(
          `Cannot deterministically satisfy OpenAPI pattern at ${context}`,
        );
      }
    }
  }

  return value;
}

function generateString(
  schema: OpenApiSchemaLike,
  generator: DeterministicFixtureGenerator,
  context: string,
): string {
  const key = slugify(context.split('.').at(-1) ?? context);
  let value: string;
  switch (schema.format) {
    case 'uuid':
      value = generator.uuid();
      break;
    case 'date-time':
      value = generator.timestamp();
      break;
    case 'date':
      value = generator.timestamp().slice(0, 10);
      break;
    case 'email':
      value = `fixture-${generator.counter(999_999)}@example.test`;
      break;
    case 'uri':
    case 'url':
    case 'uri-reference':
      value = `${LOCAL_FIXTURE_ORIGIN}/${key}/${generator.counter(999_999)}`;
      break;
    case 'hostname':
      value = 'fixture.example.test';
      break;
    case 'ipv4':
      value = `192.0.2.${generator.integer(1, 254)}`;
      break;
    case 'ipv6':
      value = `2001:db8::${generator.integer(1, 65_535).toString(16)}`;
      break;
    default:
      value = `fixture-${key}-${generator.counter(999_999)}`;
      break;
  }
  return normalizeString(value, schema, context);
}

function numericBounds(schema: OpenApiSchemaLike): {
  min: number;
  max: number;
} {
  let min = Number.isFinite(schema.minimum) ? Number(schema.minimum) : 0;
  let max = Number.isFinite(schema.maximum)
    ? Number(schema.maximum)
    : Math.max(min + 1000, 1000);

  if (typeof schema.exclusiveMinimum === 'number')
    min = Math.max(min, schema.exclusiveMinimum + 1);
  if (typeof schema.exclusiveMaximum === 'number')
    max = Math.min(max, schema.exclusiveMaximum - 1);
  if (schema.exclusiveMinimum === true) min += 1;
  if (schema.exclusiveMaximum === true) max -= 1;
  if (max < min) {
    throw new Error('OpenAPI numeric bounds are contradictory');
  }
  return { min, max };
}

function mergeGeneratedObjects(values: unknown[], context: string): JsonRecord {
  const merged: JsonRecord = {};
  for (const value of values) {
    if (!isRecord(value)) {
      throw new Error(`OpenAPI allOf must resolve to objects at ${context}`);
    }
    Object.assign(merged, value);
  }
  return merged;
}

function generateSchemaValue(
  document: OpenApiDocumentLike,
  schemaInput: OpenApiSchemaLike,
  generator: DeterministicFixtureGenerator,
  context: string,
  depth = 0,
  refStack: string[] = [],
): unknown {
  if (depth > MAX_SCHEMA_DEPTH) {
    throw new Error(
      `OpenAPI fixture schema exceeded ${MAX_SCHEMA_DEPTH} levels at ${context}`,
    );
  }

  if (schemaInput.$ref) {
    if (refStack.includes(schemaInput.$ref)) {
      if (schemaInput.nullable) return null;
      return {};
    }
    return generateSchemaValue(
      document,
      resolveSchema(document, schemaInput, context),
      generator,
      context,
      depth + 1,
      [...refStack, schemaInput.$ref],
    );
  }

  const schema = schemaInput;
  if (schema.enum && schema.enum.length > 0) {
    return structuredClone(schema.enum[0]);
  }
  if (schema.allOf && schema.allOf.length > 0) {
    return mergeGeneratedObjects(
      schema.allOf.map((part, index) =>
        generateSchemaValue(
          document,
          part,
          generator,
          `${context}.allOf[${index}]`,
          depth + 1,
          refStack,
        ),
      ),
      context,
    );
  }
  if (schema.oneOf && schema.oneOf.length > 0) {
    return generateSchemaValue(
      document,
      schema.oneOf[0],
      generator,
      `${context}.oneOf[0]`,
      depth + 1,
      refStack,
    );
  }
  if (schema.anyOf && schema.anyOf.length > 0) {
    return generateSchemaValue(
      document,
      schema.anyOf[0],
      generator,
      `${context}.anyOf[0]`,
      depth + 1,
      refStack,
    );
  }

  switch (inferSchemaType(schema)) {
    case 'object': {
      const result: JsonRecord = {};
      const properties = schema.properties ?? {};
      for (const propertyName of Object.keys(properties).sort()) {
        const propertySchema = properties[propertyName];
        if (!propertySchema || propertySchema.writeOnly) continue;
        result[propertyName] = generateSchemaValue(
          document,
          propertySchema,
          generator,
          `${context}.${propertyName}`,
          depth + 1,
          refStack,
        );
      }

      const required = schema.required ?? [];
      for (const requiredProperty of required) {
        if (!(requiredProperty in result)) {
          throw new Error(
            `Required OpenAPI response property has no schema: ${context}.${requiredProperty}`,
          );
        }
      }

      const minProperties = Math.max(0, schema.minProperties ?? 0);
      if (
        Object.keys(result).length < minProperties &&
        isRecord(schema.additionalProperties)
      ) {
        while (Object.keys(result).length < minProperties) {
          const propertyName = `fixture_${Object.keys(result).length + 1}`;
          result[propertyName] = generateSchemaValue(
            document,
            schema.additionalProperties,
            generator,
            `${context}.${propertyName}`,
            depth + 1,
            refStack,
          );
        }
      }
      return result;
    }
    case 'array': {
      if (!schema.items)
        throw new Error(`OpenAPI array is missing items at ${context}`);
      const minItems = Math.max(0, schema.minItems ?? 1);
      const maxItems = Math.max(
        minItems,
        schema.maxItems ?? MAX_GENERATED_ARRAY_ITEMS,
      );
      const count = Math.min(
        MAX_GENERATED_ARRAY_ITEMS,
        maxItems,
        Math.max(1, minItems),
      );
      return Array.from({ length: count }, (_, index) =>
        generateSchemaValue(
          document,
          schema.items!,
          generator,
          `${context}[${index}]`,
          depth + 1,
          refStack,
        ),
      );
    }
    case 'string':
      return generateString(schema, generator, context);
    case 'integer': {
      const { min, max } = numericBounds(schema);
      return generator.integer(Math.ceil(min), Math.floor(max));
    }
    case 'number': {
      const { min, max } = numericBounds(schema);
      return Number((min + generator.random() * (max - min)).toFixed(6));
    }
    case 'boolean':
      return generator.boolean();
    case undefined:
      if (schema.default !== undefined) return structuredClone(schema.default);
      return {};
    default:
      throw new Error(
        `Unsupported OpenAPI schema type '${schema.type}' at ${context}`,
      );
  }
}

function validateSchemaValue(
  document: OpenApiDocumentLike,
  schemaInput: OpenApiSchemaLike,
  value: unknown,
  context: string,
  depth = 0,
): void {
  if (depth > MAX_SCHEMA_DEPTH)
    throw new Error(`OpenAPI validation exceeded depth at ${context}`);
  const schema = resolveSchema(document, schemaInput, context);

  if (value === null && schema.nullable) return;
  if (schema.enum && !schema.enum.some((entry) => Object.is(entry, value))) {
    throw new Error(`Fixture value is outside OpenAPI enum at ${context}`);
  }
  if (schema.allOf) {
    schema.allOf.forEach((part, index) =>
      validateSchemaValue(
        document,
        part,
        value,
        `${context}.allOf[${index}]`,
        depth + 1,
      ),
    );
    return;
  }
  if (schema.oneOf) {
    const successes = schema.oneOf.filter((part, index) => {
      try {
        validateSchemaValue(
          document,
          part,
          value,
          `${context}.oneOf[${index}]`,
          depth + 1,
        );
        return true;
      } catch {
        return false;
      }
    });
    if (successes.length === 0)
      throw new Error(`Fixture does not satisfy OpenAPI oneOf at ${context}`);
    return;
  }
  if (schema.anyOf) {
    const valid = schema.anyOf.some((part, index) => {
      try {
        validateSchemaValue(
          document,
          part,
          value,
          `${context}.anyOf[${index}]`,
          depth + 1,
        );
        return true;
      } catch {
        return false;
      }
    });
    if (!valid)
      throw new Error(`Fixture does not satisfy OpenAPI anyOf at ${context}`);
    return;
  }

  switch (inferSchemaType(schema)) {
    case 'object': {
      if (!isRecord(value))
        throw new Error(`Expected object fixture at ${context}`);
      for (const requiredProperty of schema.required ?? []) {
        if (!(requiredProperty in value)) {
          throw new Error(
            `Missing required fixture property ${context}.${requiredProperty}`,
          );
        }
      }
      const properties = schema.properties ?? {};
      for (const [key, childValue] of Object.entries(value)) {
        const childSchema = properties[key];
        if (childSchema) {
          validateSchemaValue(
            document,
            childSchema,
            childValue,
            `${context}.${key}`,
            depth + 1,
          );
        } else if (schema.additionalProperties === false) {
          throw new Error(`Unexpected fixture property ${context}.${key}`);
        } else if (isRecord(schema.additionalProperties)) {
          validateSchemaValue(
            document,
            schema.additionalProperties,
            childValue,
            `${context}.${key}`,
            depth + 1,
          );
        }
      }
      const propertyCount = Object.keys(value).length;
      if (
        schema.minProperties !== undefined &&
        propertyCount < schema.minProperties
      ) {
        throw new Error(`Too few fixture properties at ${context}`);
      }
      if (
        schema.maxProperties !== undefined &&
        propertyCount > schema.maxProperties
      ) {
        throw new Error(`Too many fixture properties at ${context}`);
      }
      return;
    }
    case 'array': {
      if (!Array.isArray(value))
        throw new Error(`Expected array fixture at ${context}`);
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        throw new Error(`Too few fixture items at ${context}`);
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        throw new Error(`Too many fixture items at ${context}`);
      }
      if (schema.items) {
        value.forEach((entry, index) =>
          validateSchemaValue(
            document,
            schema.items!,
            entry,
            `${context}[${index}]`,
            depth + 1,
          ),
        );
      }
      return;
    }
    case 'string': {
      if (typeof value !== 'string')
        throw new Error(`Expected string fixture at ${context}`);
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        throw new Error(`Fixture string is shorter than schema at ${context}`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        throw new Error(`Fixture string is longer than schema at ${context}`);
      }
      if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) {
        throw new Error(
          `Fixture string does not match schema pattern at ${context}`,
        );
      }
      return;
    }
    case 'integer':
      if (!Number.isInteger(value))
        throw new Error(`Expected integer fixture at ${context}`);
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Expected finite number fixture at ${context}`);
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean')
        throw new Error(`Expected boolean fixture at ${context}`);
      return;
    default:
      return;
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      throw new Error(`Fixture number is below schema minimum at ${context}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      throw new Error(`Fixture number is above schema maximum at ${context}`);
    }
  }
}

function deepMerge(base: unknown, overrides: JsonRecord | undefined): unknown {
  if (!overrides) return base;
  if (!isRecord(base)) {
    throw new Error(
      'Overrides are only supported for object response fixtures',
    );
  }

  const result: JsonRecord = structuredClone(base);
  for (const [key, overrideValue] of Object.entries(overrides)) {
    const baseValue = result[key];
    result[key] =
      isRecord(baseValue) && isRecord(overrideValue)
        ? deepMerge(baseValue, overrideValue)
        : structuredClone(overrideValue);
  }
  return result;
}

function discoverResponseFactories(
  document: OpenApiDocumentLike,
): PublicResponseFactoryDescriptor[] {
  const descriptors: PublicResponseFactoryDescriptor[] = [];

  for (const path of Object.keys(document.paths).sort()) {
    const pathItem = document.paths[path];
    if (!isRecord(pathItem)) continue;

    for (const method of RESPONSE_METHODS) {
      const operation = pathItem[method];
      if (!isRecord(operation)) continue;
      const responses = operation['responses'];
      if (!isRecord(responses)) continue;

      for (const status of Object.keys(responses).sort()) {
        if (!/^2\d\d$/.test(status)) continue;
        let response: unknown = responses[status];
        if (isRecord(response) && typeof response['$ref'] === 'string') {
          response = resolveJsonPointer(document, response['$ref']);
        }
        if (!isRecord(response) || !isRecord(response['content'])) continue;

        const content = response['content'];
        const mediaType = Object.keys(content).find(
          (candidate) =>
            candidate === 'application/json' || candidate.endsWith('+json'),
        );
        if (
          !mediaType ||
          !isRecord(content[mediaType]) ||
          !isRecord(content[mediaType]['schema'])
        ) {
          continue;
        }

        const operationId =
          typeof operation['operationId'] === 'string'
            ? operation['operationId']
            : undefined;
        descriptors.push({
          id: `${method.toUpperCase()} ${path} ${status}`,
          method,
          path,
          status,
          mediaType,
          ...(operationId ? { operationId } : {}),
        });
      }
    }
  }

  return descriptors;
}

@Injectable()
export class OpenApiFixtureFactoryRegistry {
  private document: OpenApiDocumentLike | null = null;
  private descriptors: PublicResponseFactoryDescriptor[] = [];

  registerDocument(document: unknown): void {
    if (!isRecord(document) || !isRecord(document['paths'])) {
      throw new Error(
        'Cannot register invalid OpenAPI document for mock fixtures',
      );
    }
    this.document = document as OpenApiDocumentLike;
    this.descriptors = discoverResponseFactories(this.document);
  }

  listResponseFactories(): PublicResponseFactoryDescriptor[] {
    this.assertReady();
    return structuredClone(this.descriptors);
  }

  createResponseFixture(
    input: CreatePublicResponseFixtureInput,
  ): CreatedPublicResponseFixture {
    const document = this.assertReady();
    const method = input.method.trim().toLowerCase();
    const descriptor = this.descriptors.find(
      (candidate) =>
        candidate.method === method &&
        candidate.path === input.path &&
        candidate.status === input.status,
    );
    if (!descriptor) {
      throw new Error(
        'Requested response fixture is not present in the authoritative OpenAPI document',
      );
    }

    const seed = input.seed ?? resolveMockFixtureSeed();
    const generator = createDeterministicFixtureGenerator(seed);
    const schema = responseSchema(document, descriptor);
    const generated = generateSchemaValue(
      document,
      schema,
      generator,
      descriptor.id,
    );
    const payload = deepMerge(generated, input.overrides);
    validateSchemaValue(document, schema, payload, descriptor.id);
    const diagnostics = getMockFixtureDiagnostics(seed);

    return {
      descriptor: structuredClone(descriptor),
      seed,
      seedId: diagnostics.seedId,
      payload,
    };
  }

  /** Validate every documented public 2xx JSON response with a deterministic default. */
  validateAllResponseFactories(seed = resolveMockFixtureSeed()): number {
    const descriptors = this.listResponseFactories();
    for (const descriptor of descriptors) {
      this.createResponseFixture({
        method: descriptor.method,
        path: descriptor.path,
        status: descriptor.status,
        seed,
      });
    }
    return descriptors.length;
  }

  private assertReady(): OpenApiDocumentLike {
    if (!this.document) {
      throw new Error('OpenAPI fixture registry has not been initialized');
    }
    return this.document;
  }
}
