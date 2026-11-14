#!/usr/bin/env node
// Guards the NestJS composition root: every controller must be registered by a
// module reachable from AppModule, every *.module.ts must be reachable from
// AppModule, and every *.service.ts must be imported by non-test code.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const IMPORT_PATTERN = /import\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;
const CONTROLLERS_PATTERN = /controllers:\s*\[([\s\S]*?)\]/g;
const CONTROLLER_CLASS_PATTERN = /@Controller\([\s\S]*?\bclass\s+([A-Za-z0-9_]+)/;

function collectSourceFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectSourceFiles(path, files);
    else if (entry.name.endsWith('.ts')) files.push(path);
  }
  return files;
}

function resolveRelativeImport(fromFile, specifier, knownFiles) {
  const target = resolve(dirname(fromFile), specifier);
  for (const candidate of [`${target}.ts`, join(target, 'index.ts')]) {
    if (knownFiles.has(candidate)) return candidate;
  }
  return null;
}

export function analyzeBackendModuleGraph(sourceDirectory) {
  const sourceRoot = resolve(sourceDirectory);
  const files = collectSourceFiles(sourceRoot);
  const sources = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));

  const edges = new Map();
  for (const file of files) {
    const targets = new Set();
    for (const match of sources.get(file).matchAll(IMPORT_PATTERN)) {
      const target = resolveRelativeImport(file, match[1], sources);
      if (target) targets.add(target);
    }
    edges.set(file, targets);
  }

  const appModule = join(sourceRoot, 'app.module.ts');
  if (!sources.has(appModule)) {
    throw new Error(`AppModule not found at ${appModule}`);
  }

  const reachableFiles = new Set([appModule]);
  const queue = [appModule];
  while (queue.length > 0) {
    const file = queue.pop();
    for (const target of edges.get(file) ?? []) {
      if (reachableFiles.has(target)) continue;
      reachableFiles.add(target);
      queue.push(target);
    }
  }

  const reachableModules = [...reachableFiles].filter((file) => file.endsWith('.module.ts'));

  const registeredControllers = new Set();
  for (const moduleFile of reachableModules) {
    for (const block of sources.get(moduleFile).matchAll(CONTROLLERS_PATTERN)) {
      for (const name of block[1].matchAll(/[A-Z][A-Za-z0-9_]*/g)) {
        registeredControllers.add(name[0]);
      }
    }
  }

  // A registered controller may extend a base controller; Nest inherits the
  // parent's route metadata, so the base class is mounted too.
  const parentOf = new Map();
  for (const source of sources.values()) {
    for (const match of source.matchAll(
      /export\s+class\s+([A-Za-z0-9_]+)\s+extends\s+([A-Za-z0-9_]+)/g,
    )) {
      parentOf.set(match[1], match[2]);
    }
  }
  const pendingParents = [...registeredControllers];
  while (pendingParents.length > 0) {
    const child = pendingParents.pop();
    const parent = parentOf.get(child);
    if (!parent || registeredControllers.has(parent)) continue;
    registeredControllers.add(parent);
    pendingParents.push(parent);
  }

  const orphanControllers = [];
  for (const file of files) {
    if (!file.endsWith('.controller.ts')) continue;
    const source = sources.get(file);
    if (!source.includes('@Controller(')) continue;
    const className = source.match(CONTROLLER_CLASS_PATTERN)?.[1];
    if (!className || !registeredControllers.has(className)) {
      orphanControllers.push(relative(sourceRoot, file));
    }
  }

  const allModules = files.filter((file) => file.endsWith('.module.ts'));
  const orphanModules = allModules
    .filter((file) => !reachableFiles.has(file))
    .map((file) => relative(sourceRoot, file));

  const nonSpecFiles = files.filter((file) => !/\.(spec|e2e-spec)\.ts$/.test(file));
  const importedBy = new Map(files.map((file) => [file, 0]));
  for (const file of nonSpecFiles) {
    for (const target of edges.get(file) ?? []) {
      if (target !== file && importedBy.has(target)) {
        importedBy.set(target, importedBy.get(target) + 1);
      }
    }
  }
  const orphanServices = files
    .filter((file) => file.endsWith('.service.ts'))
    .filter((file) => (importedBy.get(file) ?? 0) === 0)
    .map((file) => relative(sourceRoot, file));

  return { orphanControllers, orphanModules, orphanServices };
}

function main() {
  const sourceDirectory = process.argv[2] ?? 'backend/src';
  if (!existsSync(sourceDirectory)) {
    console.error(`Backend source directory not found: ${sourceDirectory}`);
    process.exit(2);
  }

  const { orphanControllers, orphanModules, orphanServices } =
    analyzeBackendModuleGraph(sourceDirectory);

  const sections = [
    ['Controllers not registered by a reachable module', orphanControllers],
    ['Modules not reachable from AppModule', orphanModules],
    ['Services not imported by non-test code', orphanServices],
  ];
  const failures = sections.reduce((total, [, entries]) => total + entries.length, 0);

  if (failures > 0) {
    for (const [label, entries] of sections) {
      if (entries.length === 0) continue;
      console.error(`\n${label} (${entries.length}):`);
      for (const entry of entries) console.error(`  - ${entry}`);
    }
    process.exit(1);
  }

  console.log(
    'Backend module graph is fully connected: no orphaned controllers, modules or services.',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
