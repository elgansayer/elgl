#!/usr/bin/env node
/**
 * verify-constitution.mjs
 * Enforces the HelloTalk Engineering Constitution (AGENTS.md).
 * Checks for:
 * 1. Banned punctuation (no em dashes '-')
 * 2. British English spelling enforcement (`colour`, `favourite`, `monetisation`, `tokenise`)
 * 3. Logical Tailwind CSS properties (`ps-`, `pe-`, `ms-`, `me-`, `border-s`) in frontend/
 * 4. API-First mandate (no direct @supabase/supabase-js createClient calls in frontend/)
 * 5. Native Angular control flow only (no *ngIf, *ngFor, *ngSwitch)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Ensure npm is available before proceeding
try {
  execSync('which npm', { stdio: 'ignore' });
} catch {
  console.error('❌ npm is not installed. Please install Node.js and npm.');
  process.exit(1);
}

const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const BANNED_AMERICAN_WORDS = [
  {
    pattern: /\b(color|colors)\b/i,
    replacement: 'colour/colours',
    excludeFiles: ['tailwind.config.js', 'package.json', 'package-lock.json', '.scss'],
  },
  { pattern: /\b(favorite|favorites)\b/i, replacement: 'favourite/favourites', excludeFiles: [] },
  {
    pattern: /\b(monetization|monetize)\b/i,
    replacement: 'monetisation/monetise',
    excludeFiles: [],
  },
  {
    pattern: /\b(tokenize|tokenized|tokenization)\b/i,
    replacement: 'tokenise/tokenised/tokenisation',
    excludeFiles: [],
  },
];

const PHYSICAL_CSS_REGEX =
  /\b(pl-\d+|pr-\d+|ml-\d+|mr-\d+|border-l(-\d+)?|border-r(-\d+)?|text-left|text-right)\b/;
const LEGACY_ANGULAR_FLOW_REGEX = /\*(ngIf|ngFor|ngSwitch|ngSwitchCase|ngSwitchDefault)\b/;
const SUPABASE_DB_QUERY_REGEX = /\b(supabase|client)\.from\s*\(/;
const SUPABASE_CLIENT_REGEX = /import\s+.*createClient.*from\s+['"]@supabase\/supabase-js['"]/;
const EM_DASH_REGEX = /\u2014/;

let totalErrors = 0;
let totalWarnings = 0;
let checkedFilesCount = 0;

function getTrackedFiles() {
  const output = execSync('git ls-files -z', { cwd: ROOT_DIR, encoding: 'utf8' });
  return output
    .split('\0')
    .filter(Boolean)
    .filter((file) =>
      ['.ts', '.html', '.scss', '.sql', '.md', '.json', '.mdc'].includes(
        path.extname(file).toLowerCase(),
      ),
    )
    .map((file) => path.join(ROOT_DIR, file));
}

function checkFile(filePath) {
  const relPath = path.relative(ROOT_DIR, filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const isFrontend = relPath.startsWith('frontend/src/');
  const isTestFixture =
    relPath.endsWith('.spec.ts') ||
    relPath.endsWith('.test.ts') ||
    relPath.endsWith('.cy.ts') ||
    relPath.includes('.verification.spec.ts');
  const isFrontendProduction = isFrontend && !isTestFixture;
  const isDoc = relPath.endsWith('.md') || relPath.endsWith('.mdc');

  checkedFilesCount++;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // Check 1: Em dash check
    if (!isTestFixture && EM_DASH_REGEX.test(line)) {
      console.error(`❌ [EM DASH VIOLATION] ${relPath}:${lineNum}`);
      console.error(
        `   Found em dash ('-'). Use standard hyphens or colons instead (AGENTS.md Section 2).`,
      );
      totalErrors++;
    }

    // Check 2: Physical Tailwind directions in frontend
    if (
      isFrontendProduction &&
      (relPath.endsWith('.html') || relPath.endsWith('.ts') || relPath.endsWith('.scss'))
    ) {
      const match = line.match(PHYSICAL_CSS_REGEX);
      if (match) {
        console.error(`❌ [RTL VIOLATION] ${relPath}:${lineNum}`);
        console.error(
          `   Found physical direction utility '${match[0]}'. Strictly use logical properties (ps-, pe-, ms-, me-, border-s, border-e) (AGENTS.md Section 3).`,
        );
        totalErrors++;
      }
    }

    // Check 3: Legacy Angular control flow in frontend
    if (isFrontendProduction && (relPath.endsWith('.html') || relPath.endsWith('.ts'))) {
      const match = line.match(LEGACY_ANGULAR_FLOW_REGEX);
      if (match && !line.includes('// ignore-check')) {
        console.error(`❌ [CONTROL FLOW VIOLATION] ${relPath}:${lineNum}`);
        console.error(
          `   Found legacy control flow '*${match[1]}'. Strictly use native control flow (@if, @for, @switch) (frontend/AGENTS.md, Templates).`,
        );
        totalErrors++;
      }
    }

    // Check 4: Direct Supabase database queries or unauthorized client creation in frontend
    if (isFrontend && relPath.endsWith('.ts')) {
      if (SUPABASE_DB_QUERY_REGEX.test(line)) {
        console.error(`❌ [API-FIRST VIOLATION] ${relPath}:${lineNum}`);
        console.error(
          `   Direct database query (.from) call in frontend. All database queries must route via NestJS REST or Centrifugo (AGENTS.md Section 4).`,
        );
        totalErrors++;
      }
      if (SUPABASE_CLIENT_REGEX.test(line) && !relPath.endsWith('supabase.service.ts')) {
        console.error(`❌ [API-FIRST VIOLATION] ${relPath}:${lineNum}`);
        console.error(
          `   Direct @supabase/supabase-js client import in ${relPath}. Only SupabaseService may instantiate auth client (AGENTS.md Section 4).`,
        );
        totalErrors++;
      }
    }

    // Check 5: British English spelling (Warnings / Errors)
    if (!relPath.includes('node_modules') && !relPath.includes('dist')) {
      for (const rule of BANNED_AMERICAN_WORDS) {
        const isExcluded = rule.excludeFiles.some((ex) => relPath.endsWith(ex));
        if (!isExcluded) {
          const match = line.match(rule.pattern);
          // Allow standard DOM/CSS or Tailwind words like canvas.color, transition-colors, background-color
          const isCssOrDomProperty =
            relPath.endsWith('.scss') ||
            line.includes('background-color') ||
            line.includes('border-color') ||
            line.includes('transition-colors') ||
            line.includes('color:');
          if (match && !isCssOrDomProperty && !line.includes('ignore-spelling')) {
            // If in documentation or schema file where we explicitly enforce British English, warn or error
            if (isDoc || relPath.endsWith('.sql')) {
              console.warn(
                `⚠️  [SPELLING WARNING] ${relPath}:${lineNum} -> Found '${match[0]}', prefer British English '${rule.replacement}'.`,
              );
              totalWarnings++;
            }
          }
        }
      }
    }
  }
}

function main() {
  console.log('🛡️  Running HelloTalk Engineering Constitution Verification...');
  const targetFiles = process.argv.slice(2);
  const filesToCheck =
    targetFiles.length > 0
      ? targetFiles.map((f) => path.resolve(ROOT_DIR, f)).filter((f) => fs.existsSync(f))
      : getTrackedFiles();

  for (const filePath of filesToCheck) {
    checkFile(filePath);
  }

  console.log(`\n📊 Verification Complete: Checked ${checkedFilesCount} files.`);
  if (totalWarnings > 0) {
    console.log(`⚠️  Warnings generated: ${totalWarnings}`);
  }
  if (totalErrors > 0) {
    console.error(`❌ FAILED: ${totalErrors} constitution violations found.`);
    process.exit(1);
  } else {
    console.log('✅ SUCCESS: Zero constitution violations detected.');
    process.exit(0);
  }
}

main();
