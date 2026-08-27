export type MockFixtureCyclePolicy = 'allow' | 'forbid';

export interface MockFixtureReferenceRule {
  field: string;
  targetCollection?: string;
  targetCollectionField?: string;
  targetCollectionMap?: Readonly<Record<string, string>>;
  targetField?: string;
  optional?: boolean;
  cyclePolicy?: MockFixtureCyclePolicy;
}

export interface MockFixtureCollectionDefinition {
  name: string;
  records: readonly unknown[];
  idField?: string | null;
  references?: readonly MockFixtureReferenceRule[];
}

export interface MockFixtureIntegrityIssue {
  collection: string;
  record: string;
  field?: string;
  message: string;
}

export interface MockFixtureIntegrityReport {
  valid: boolean;
  collectionCount: number;
  recordCount: number;
  creationOrder: string[];
  issues: MockFixtureIntegrityIssue[];
  summary: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function keyOf(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function recordLabel(
  collection: MockFixtureCollectionDefinition,
  record: Record<string, unknown>,
  index: number,
): string {
  const idField = collection.idField === undefined ? 'id' : collection.idField;
  if (idField) {
    const key = keyOf(record[idField]);
    if (key) return key;
  }
  return `#${index + 1}`;
}

function resolveTargetCollection(
  record: Record<string, unknown>,
  rule: MockFixtureReferenceRule,
): string | null {
  if (rule.targetCollection) return rule.targetCollection;

  if (!rule.targetCollectionField || !rule.targetCollectionMap) return null;
  const discriminator = record[rule.targetCollectionField];
  if (typeof discriminator !== 'string') return null;
  return rule.targetCollectionMap[discriminator] ?? null;
}

function buildCreationOrder(
  definitions: readonly MockFixtureCollectionDefinition[],
  issues: MockFixtureIntegrityIssue[],
): string[] {
  const known = new Set(definitions.map((definition) => definition.name));
  const dependencies = new Map<string, Set<string>>();

  for (const definition of definitions) {
    const collectionDependencies = new Set<string>();
    for (const rule of definition.references ?? []) {
      const targets = rule.targetCollection
        ? [rule.targetCollection]
        : Object.values(rule.targetCollectionMap ?? {});
      for (const target of targets) {
        if (target !== definition.name) collectionDependencies.add(target);
      }
    }
    dependencies.set(definition.name, collectionDependencies);
  }

  const order: string[] = [];
  const remaining = new Set(definitions.map((definition) => definition.name));

  while (remaining.size > 0) {
    const next = definitions.find((definition) => {
      if (!remaining.has(definition.name)) return false;
      const required = dependencies.get(definition.name) ?? new Set<string>();
      return [...required].every(
        (dependency) => !known.has(dependency) || order.includes(dependency),
      );
    });

    if (!next) {
      issues.push({
        collection: 'fixture-graph',
        record: 'collections',
        message: `Circular collection dependency: ${[...remaining].join(', ')}`,
      });
      order.push(...remaining);
      break;
    }

    order.push(next.name);
    remaining.delete(next.name);
  }

  return order;
}

function detectForbiddenSelfCycles(
  definition: MockFixtureCollectionDefinition,
  rule: MockFixtureReferenceRule,
  issues: MockFixtureIntegrityIssue[],
): void {
  if (rule.cyclePolicy !== 'forbid' || rule.targetCollection !== definition.name) {
    return;
  }

  const idField = definition.idField === undefined ? 'id' : definition.idField;
  if (!idField) return;

  const edges = new Map<string, string>();
  for (const rawRecord of definition.records) {
    const record = asRecord(rawRecord);
    if (!record) continue;
    const source = keyOf(record[idField]);
    const target = keyOf(record[rule.field]);
    if (source && target) edges.set(source, target);
  }

  const completed = new Set<string>();
  for (const start of edges.keys()) {
    if (completed.has(start)) continue;

    const path: string[] = [];
    const positions = new Map<string, number>();
    let current: string | undefined = start;

    while (current && edges.has(current) && !completed.has(current)) {
      const existingPosition = positions.get(current);
      if (existingPosition !== undefined) {
        const cycle = [...path.slice(existingPosition), current];
        issues.push({
          collection: definition.name,
          record: start,
          field: rule.field,
          message: `Forbidden reference cycle: ${cycle.join(' -> ')}`,
        });
        break;
      }

      positions.set(current, path.length);
      path.push(current);
      current = edges.get(current);
    }

    for (const key of path) completed.add(key);
  }
}

export function validateMockFixtureIntegrity(
  definitions: readonly MockFixtureCollectionDefinition[],
): MockFixtureIntegrityReport {
  const issues: MockFixtureIntegrityIssue[] = [];
  const names = new Set<string>();

  for (const definition of definitions) {
    if (names.has(definition.name)) {
      issues.push({
        collection: definition.name,
        record: 'collection',
        message: 'Duplicate fixture collection name',
      });
    }
    names.add(definition.name);
  }

  const indexes = new Map<string, Map<string, number>>();
  for (const definition of definitions) {
    const idField = definition.idField === undefined ? 'id' : definition.idField;
    const index = new Map<string, number>();

    if (idField) {
      definition.records.forEach((rawRecord, recordIndex) => {
        const record = asRecord(rawRecord);
        if (!record) {
          issues.push({
            collection: definition.name,
            record: `#${recordIndex + 1}`,
            message: 'Fixture record must be an object',
          });
          return;
        }

        const key = keyOf(record[idField]);
        if (!key) {
          issues.push({
            collection: definition.name,
            record: `#${recordIndex + 1}`,
            field: idField,
            message: 'Fixture identifier is missing or invalid',
          });
          return;
        }

        if (index.has(key)) {
          issues.push({
            collection: definition.name,
            record: key,
            field: idField,
            message: 'Duplicate fixture identifier',
          });
          return;
        }
        index.set(key, recordIndex);
      });
    }

    indexes.set(definition.name, index);
  }

  for (const definition of definitions) {
    definition.records.forEach((rawRecord, recordIndex) => {
      const record = asRecord(rawRecord);
      if (!record) return;
      const label = recordLabel(definition, record, recordIndex);

      for (const rule of definition.references ?? []) {
        const reference = keyOf(record[rule.field]);
        if (!reference) {
          if (!rule.optional) {
            issues.push({
              collection: definition.name,
              record: label,
              field: rule.field,
              message: 'Required fixture reference is missing or invalid',
            });
          }
          continue;
        }

        const targetCollection = resolveTargetCollection(record, rule);
        if (!targetCollection || !names.has(targetCollection)) {
          issues.push({
            collection: definition.name,
            record: label,
            field: rule.field,
            message: 'Fixture reference target collection is unknown',
          });
          continue;
        }

        const targetDefinition = definitions.find(
          (candidate) => candidate.name === targetCollection,
        );
        if (!targetDefinition) continue;

        const targetField = rule.targetField ?? targetDefinition.idField ?? 'id';
        const found =
          targetField === (targetDefinition.idField ?? 'id')
            ? (indexes.get(targetCollection)?.has(reference) ?? false)
            : targetDefinition.records.some((candidate) => {
                const targetRecord = asRecord(candidate);
                return targetRecord
                  ? keyOf(targetRecord[targetField]) === reference
                  : false;
              });

        if (!found) {
          issues.push({
            collection: definition.name,
            record: label,
            field: rule.field,
            message: `Dangling fixture reference to ${targetCollection}.${targetField}: ${reference}`,
          });
        }
      }
    });

    for (const rule of definition.references ?? []) {
      detectForbiddenSelfCycles(definition, rule, issues);
    }
  }

  const creationOrder = buildCreationOrder(definitions, issues);
  const recordCount = definitions.reduce(
    (total, definition) => total + definition.records.length,
    0,
  );
  const valid = issues.length === 0;
  const summary = valid
    ? `Mock fixture integrity OK: ${recordCount} records across ${definitions.length} collections. Creation order: ${creationOrder.join(' -> ')}`
    : `Mock fixture integrity failed with ${issues.length} issue(s): ${issues
        .map(
          (issue) =>
            `${issue.collection}[${issue.record}]${issue.field ? `.${issue.field}` : ''}: ${issue.message}`,
        )
        .join('; ')}`;

  return {
    valid,
    collectionCount: definitions.length,
    recordCount,
    creationOrder,
    issues,
    summary,
  };
}

export function assertMockFixtureIntegrity(
  definitions: readonly MockFixtureCollectionDefinition[],
): MockFixtureIntegrityReport {
  const report = validateMockFixtureIntegrity(definitions);
  if (!report.valid) throw new Error(report.summary);
  return report;
}
