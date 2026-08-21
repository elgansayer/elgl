#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY ?? 'elgansayer/elgl';
const [owner, name] = repository.split('/');
const apiUrl = 'https://api.github.com/graphql';
const targetLastId = 1050;
const batchSize = 20;

if (!token) {
  throw new Error('GITHUB_TOKEN is required');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function graphql(query, variables, attempt = 0) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'elgl-spartan-ui-backlog-seeder',
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json().catch(() => ({}));
  const messages = (payload.errors ?? []).map((error) => error.message).join(' | ');
  const rateLimited =
    response.status === 403 ||
    response.status === 429 ||
    /rate limit|secondary rate|abuse/i.test(messages);

  if (rateLimited && attempt < 5) {
    const retryAfter = Number(response.headers.get('retry-after') ?? 65);
    await sleep(Math.max(retryAfter, 65) * 1000);
    return graphql(query, variables, attempt + 1);
  }

  if (!response.ok || payload.errors?.length) {
    throw new Error(
      `GitHub GraphQL request failed (${response.status}): ${messages || JSON.stringify(payload)}`,
    );
  }

  return payload.data;
}

async function getRepositoryAndExistingTitles() {
  const titles = new Set();
  let cursor = null;
  let repositoryId = null;

  do {
    const data = await graphql(
      `query ExistingIssues($owner: String!, $name: String!, $cursor: String) {
        repository(owner: $owner, name: $name) {
          id
          issues(first: 100, after: $cursor, orderBy: {field: CREATED_AT, direction: ASC}) {
            nodes { title }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`,
      { owner, name, cursor },
    );

    if (!data.repository) {
      throw new Error(`Repository ${repository} was not found`);
    }

    repositoryId ??= data.repository.id;
    for (const issue of data.repository.issues.nodes) {
      if (issue.title.startsWith('[Spartan UI ')) {
        titles.add(issue.title);
      }
    }

    cursor = data.repository.issues.pageInfo.hasNextPage
      ? data.repository.issues.pageInfo.endCursor
      : null;
  } while (cursor);

  return { repositoryId, titles };
}

function listSurfaceDirectories() {
  const roots = [
    'frontend/src/app/components',
    'frontend/src/app/pages',
    'frontend/src/app/audio-rooms',
  ];
  const dirs = new Set();

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    const hasUiFile = files.some(
      (file) =>
        /\.(component\.)?(ts|html|scss)$/.test(file) &&
        !file.endsWith('.spec.ts') &&
        !file.endsWith('.verification.spec.ts'),
    );

    if (hasUiFile) {
      dirs.add(dir.replaceAll('\\', '/'));
    }

    for (const entry of entries) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
    }
  }

  roots.forEach(walk);
  return [...dirs].sort();
}

function listRoutes() {
  const routeFile = 'frontend/src/app/app.routes.ts';
  if (!fs.existsSync(routeFile)) return [];
  const content = fs.readFileSync(routeFile, 'utf8');
  const routes = [];
  for (const match of content.matchAll(/path:\s*['"]([^'"]*)['"]/g)) {
    const route = match[1] || '(root)';
    if (!routes.includes(route)) routes.push(route);
  }
  return routes;
}

function slugFromSurface(surface) {
  return surface
    .replace(/^frontend\/src\/app\//, '')
    .replaceAll('/', ' / ')
    .replaceAll('-', ' ');
}

const foundationAreas = [
  'design token ownership',
  'typography and multilingual font fallback',
  'semantic colour roles',
  'surface and elevation model',
  'radius hierarchy',
  'spacing and density scale',
  'motion durations and easing',
  'iconography and icon sizing',
  'compact and comfortable density',
  'theme service integration',
  'per-user primary accent handling',
  'dark theme parity',
  'forced-colours and high-contrast mode',
  'focus ring system',
  'prefers-reduced-motion support',
  'RTL logical properties',
  'translation-safe component APIs',
  'CJK content rendering',
  'Arabic content rendering',
  'Devanagari and complex-script rendering',
  '390px mobile baseline',
  'tablet responsive breakpoints',
  'desktop responsive breakpoints',
  'touch target sizing',
  'keyboard interaction standards',
  'screen-reader naming and relationships',
  '200 percent zoom behaviour',
  '400 percent zoom and reflow behaviour',
  'SSR compatibility',
  'hydration compatibility',
  'interaction performance budget',
  'bundle-size budget',
  'Spartan tree-shaking policy',
  'lazy-loaded route integration',
  'animation performance',
  'form-field composition',
  'validation and error messaging',
  'error-state presentation',
  'loading-state presentation',
  'empty-state presentation',
  'offline-state presentation',
  'skeleton loading consistency',
  'toast and notification semantics',
  'overlay positioning',
  'z-index and layer contract',
  'portal and focus restoration',
  'Angular component test harnesses',
  'visual regression baselines',
  'Claude Design source-of-truth sync',
];

const surfaceWorkstreams = [
  {
    key: 'audit',
    title: 'Audit and map UI to Spartan/Relay primitives',
    objective:
      'Inventory every control, state, overlay and bespoke utility in this surface. Map each to a Spartan Brain capability or an approved Relay primitive before implementation.',
    acceptance: [
      'No interactive element is omitted from the mapping.',
      'Existing behaviour, analytics hooks and route contracts are recorded.',
      'Migration risks and prerequisite primitive work are identified.',
    ],
  },
  {
    key: 'convert',
    title: 'Convert controls and interactions to Spartan UI',
    objective:
      'Replace hand-rolled interaction behaviour with approved Spartan Brain primitives wrapped by Relay presentation components where applicable.',
    acceptance: [
      'Keyboard, focus, disabled and error behaviour is preserved or improved.',
      'Feature code does not duplicate behaviour already owned by a Relay/Spartan primitive.',
      'No unrelated product behaviour is changed.',
    ],
  },
  {
    key: 'visual',
    title: 'Apply Relay tokens, responsive layout and theme parity',
    objective:
      'Remove off-token visual styling and align the surface with the Relay duet design while retaining first-class light and dark themes.',
    acceptance: [
      'No new hardcoded product colours are introduced.',
      'Primary/secondary duet and text-on-fill rules are followed.',
      '390px mobile, tablet and desktop layouts are verified.',
    ],
  },
  {
    key: 'a11y',
    title: 'Complete accessibility, RTL, zoom and input-method pass',
    objective:
      'Verify the converted surface under keyboard, screen reader semantics, RTL, touch, reduced motion and high zoom/reflow requirements.',
    acceptance: [
      'Logical properties are used for directional layout.',
      'Focus order and visible focus are deterministic.',
      '200% and 400% zoom do not hide required actions or content.',
    ],
  },
  {
    key: 'verify',
    title: 'Add regression tests and sync Claude Design preview',
    objective:
      'Lock the conversion with unit/integration coverage and update the HelloTalk Design System Claude Design representation for this surface.',
    acceptance: [
      'Relevant Angular tests cover key states and interactions.',
      'Light/dark and responsive visual states are represented in the design preview.',
      'DESIGN.md/audit status is updated when the surface is complete.',
    ],
  },
];

function makeTicket(id, title, body) {
  const padded = String(id).padStart(4, '0');
  return {
    id,
    title: `[Spartan UI ${padded}] ${title}`,
    body: [
      'Program: Spartan UI + Claude Design conversion.',
      '',
      'Program dependency: #5462 (`Spartan UI 0001`).',
      '',
      body,
      '',
      'Global definition of done:',
      '- Follow `DESIGN.md`, `AGENTS.md`, and `docs/design-redesign-audit.md`.',
      '- Preserve Angular 22 standalone/lazy-loading conventions and Tailwind 4 usage.',
      '- Preserve first-class light/dark themes and per-user primary accent behaviour.',
      '- Use logical direction utilities/properties for RTL.',
      '- Do not introduce hardcoded product colours where Relay tokens exist.',
      '- Add/update tests for changed behaviour and run the frontend verification gate.',
      '- Update Claude Design/design-preview coverage when this ticket changes a visual contract.',
    ].join('\n'),
  };
}

function buildTickets() {
  const tickets = [];
  let id = 3;

  for (const area of foundationAreas) {
    tickets.push(
      makeTicket(
        id++,
        `Define architecture standard for ${area}`,
        `Scope: establish the canonical Spartan/Relay implementation contract for ${area}.\n\nAcceptance criteria:\n- Current implementation is audited.\n- Target API/token/interaction contract is documented.\n- Migration examples and prohibited patterns are included.\n- Any required lint/test guard is identified.`,
      ),
    );
    tickets.push(
      makeTicket(
        id++,
        `Add migration verification gate for ${area}`,
        `Scope: make regressions in ${area} detectable during the migration.\n\nAcceptance criteria:\n- Add the smallest effective automated check or focused test suite.\n- Cover both light/dark and relevant accessibility states.\n- Document the verification command and expected failure mode.`,
      ),
    );
  }

  const surfaces = listSurfaceDirectories();
  for (const surface of surfaces) {
    const name = slugFromSurface(surface);
    for (const workstream of surfaceWorkstreams) {
      if (id > targetLastId) break;
      tickets.push(
        makeTicket(
          id++,
          `${workstream.title}: ${name}`,
          [
            `Target: \`${surface}\``,
            '',
            `Objective: ${workstream.objective}`,
            '',
            'Acceptance criteria:',
            ...workstream.acceptance.map((item) => `- ${item}`),
          ].join('\n'),
        ),
      );
    }
    if (id > targetLastId) break;
  }

  if (id <= targetLastId) {
    for (const route of listRoutes()) {
      for (const workstream of surfaceWorkstreams) {
        if (id > targetLastId) break;
        tickets.push(
          makeTicket(
            id++,
            `${workstream.title}: route ${route}`,
            [
              `Target route: \`${route}\``,
              '',
              `Objective: ${workstream.objective}`,
              '',
              'Acceptance criteria:',
              ...workstream.acceptance.map((item) => `- ${item}`),
            ].join('\n'),
          ),
        );
      }
      if (id > targetLastId) break;
    }
  }

  if (id <= targetLastId) {
    throw new Error(
      `Only generated ${id - 1} numbered migration tickets. Expected enough live UI surfaces to reach ${targetLastId}.`,
    );
  }

  return tickets;
}

async function createIssueBatch(repositoryId, batch) {
  const variableDefinitions = ['$repositoryId: ID!'];
  const variables = { repositoryId };
  const mutations = [];

  batch.forEach((ticket, index) => {
    variableDefinitions.push(`$title${index}: String!`, `$body${index}: String!`);
    variables[`title${index}`] = ticket.title;
    variables[`body${index}`] = ticket.body;
    mutations.push(
      `issue${index}: createIssue(input: {repositoryId: $repositoryId, title: $title${index}, body: $body${index}}) { issue { number url title } }`,
    );
  });

  const query = `mutation SeedSpartanIssues(${variableDefinitions.join(', ')}) {\n${mutations.join('\n')}\n}`;
  const data = await graphql(query, variables);
  return Object.values(data).map((result) => result.issue);
}

async function main() {
  const allTickets = buildTickets();
  const { repositoryId, titles: existingTitles } = await getRepositoryAndExistingTitles();
  const pending = allTickets.filter((ticket) => !existingTitles.has(ticket.title));

  console.log(
    `Spartan UI backlog: ${allTickets.length + 2} numbered tickets planned including 0001/0002; ${pending.length} need creation.`,
  );

  let created = 0;
  for (let index = 0; index < pending.length; index += batchSize) {
    const batch = pending.slice(index, index + batchSize);
    const issues = await createIssueBatch(repositoryId, batch);
    created += issues.length;
    console.log(
      `Created ${created}/${pending.length}; latest #${issues.at(-1)?.number} ${issues.at(-1)?.title}`,
    );
    // GitHub recommends serial mutative requests with a pause to avoid secondary limits.
    if (index + batchSize < pending.length) await sleep(1100);
  }

  console.log(`Done. Created ${created} issues; ${allTickets.length + 2} numbered Spartan UI tickets now planned.`);
}

await main();
