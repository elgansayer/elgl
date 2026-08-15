import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflowDir = join(process.cwd(), '.github', 'workflows');
const workflowFiles = readdirSync(workflowDir)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .sort();

const actionRefs = new Map();
const violations = [];

for (const file of workflowFiles) {
  const path = join(workflowDir, file);
  const source = readFileSync(path, 'utf8');

  if (/^\s*pull_request_target\s*:/m.test(source)) {
    violations.push(
      `${file}: pull_request_target is not allowed by the workflow security policy`,
    );
  }

  for (const match of source.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)\s*$/gm)) {
    const ref = match[1];
    const files = actionRefs.get(ref) ?? new Set();
    files.add(file);
    actionRefs.set(ref, files);
  }
}

const inventory = [...actionRefs.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([ref, files]) => ({ ref, files: [...files].sort() }));

console.log(`Scanned ${workflowFiles.length} workflow files.`);
console.log(`Found ${inventory.length} unique action references:`);
for (const { ref, files } of inventory) {
  console.log(`- ${ref} (${files.join(', ')})`);
}

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  const rows = inventory
    .map(
      ({ ref, files }) =>
        `| \`${ref}\` | ${files.map((file) => `\`${file}\``).join(', ')} |`,
    )
    .join('\n');
  appendFileSync(
    summaryPath,
    `## GitHub Actions inventory\n\nScanned ${workflowFiles.length} workflow files and found ${inventory.length} unique action references.\n\n| Action reference | Workflow files |\n| --- | --- |\n${rows}\n`,
  );
}

if (violations.length > 0) {
  for (const violation of violations) console.error(`ERROR: ${violation}`);
  process.exit(1);
}
