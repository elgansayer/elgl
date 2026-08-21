#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY ?? 'elgansayer/elgl';
const [owner, repo] = repository.split('/');
const firstId = 1;
const lastId = 1050;

if (!token) {
  throw new Error('GITHUB_TOKEN is required');
}

const seen = new Set();
let page = 1;

while (true) {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100&page=${page}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'elgl-spartan-ui-backlog-verifier',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub issue verification failed with HTTP ${response.status}`);
  }

  const items = await response.json();
  for (const item of items) {
    if (item.pull_request) continue;
    const match = /^\[Spartan UI (\d{4})\]/.exec(item.title);
    if (match) seen.add(Number(match[1]));
  }

  if (items.length < 100) break;
  page += 1;
}

const missing = [];
for (let id = firstId; id <= lastId; id += 1) {
  if (!seen.has(id)) missing.push(String(id).padStart(4, '0'));
}

if (missing.length) {
  console.error(
    `Spartan UI backlog incomplete: ${missing.length} IDs missing: ${missing.slice(0, 40).join(', ')}${missing.length > 40 ? ', ...' : ''}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Verified all Spartan UI tickets ${String(firstId).padStart(4, '0')} through ${lastId} exist with no numbered gaps.`,
  );
}
