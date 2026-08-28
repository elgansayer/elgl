/**
 * Factory Dashboard API Server
 *
 * Zero-dependency HTTP server using only Node.js built-ins.
 * Authentication: HTTP Basic Auth enforced on all routes except /health.
 */

import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authorisationMatches, dashboardCredentials } from './auth.js';
import { projectFor, projects, stateFile } from './projects.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT) || 3100;
const GH_TOKEN = process.env.GH_TOKEN || '';
const DASHBOARD_CREDENTIALS = dashboardCredentials();

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

// ---- Helpers ----
function readFactoryJson(project, filename) {
  const filepath = stateFile(project, filename);
  if (!existsSync(filepath)) return null;
  try {
    return JSON.parse(readFileSync(filepath, 'utf8'));
  } catch {
    return null;
  }
}

const cache = new Map();

async function ghFetch(endpoint) {
  const now = Date.now();
  if (cache.has(endpoint)) {
    const cached = cache.get(endpoint);
    // Cache for 60 seconds
    if (now - cached.time < 60000) return cached.data;
  }

  const url = `https://api.github.com/${endpoint}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'factory-dashboard/1.0',
  };
  if (GH_TOKEN) headers['Authorization'] = `Bearer ${GH_TOKEN}`;
  const resp = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);

  const data = await resp.json();
  cache.set(endpoint, { time: now, data });
  return data;
}

function checkAuth(req) {
  return authorisationMatches(req.headers['authorization'], DASHBOARD_CREDENTIALS);
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}

function sendUnauth(res) {
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Factory Dashboard"',
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify({ error: 'Authentication required' }));
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  if (!existsSync(filePath)) {
    // Fall back to index.html for SPA routing
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(404); res.end('Not found');
    }
    return;
  }
  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=60' });
  createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
  });
}

// ---- Route handlers ----
async function handleRoute(req, res) {
  const url = new URL(req.url, `http://localhost`);
  const pathname = url.pathname;

  // Health - unauthenticated
  if (pathname === '/health') {
    return sendJson(res, 200, { ok: true, ts: new Date().toISOString() });
  }

  // Auth gate for everything else
  if (!checkAuth(req)) return sendUnauth(res);

  if (pathname === '/api/projects') {
    return sendJson(res, 200, {
      projects: Object.entries(projects()).map(([slug, project]) => ({
        slug,
        name: project.name,
        repo: project.repo,
      })),
    });
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)(\/.*)$/);
  const projectSlug = projectMatch?.[1] || 'hellotalk';
  const project = projectFor(projectSlug);
  const apiPath = projectMatch?.[2] ? `/api${projectMatch[2]}` : pathname;
  if (!project && pathname.startsWith('/api/projects/')) {
    return sendJson(res, 404, { error: 'Unknown project' });
  }

  // API routes
  if (apiPath === '/api/factory/state') {
    const daemon = readFactoryJson(project, 'daemon.json');
    const health = readFactoryJson(project, 'health.json');
    const agentHealth = readFactoryJson(project, 'agent_health.json');
    const generation = readFactoryJson(project, 'generation.json');
    const controlPanel = readFactoryJson(project, 'control_panel.json');
    return sendJson(res, 200, {
      daemon, health, agent_health: agentHealth, generation,
      control_panel: controlPanel,
      read_at: new Date().toISOString(),
    });
  }

  if (apiPath === '/api/factory/backlog') {
    const backlog = readFactoryJson(project, 'backlog.json');
    if (!backlog) return sendJson(res, 200, { tasks: [], queued: 0, active: 0, total: 0, top_tasks: [] });
    const tasks = backlog.tasks || [];
    const daemon = readFactoryJson(project, 'daemon.json');
    const activeIds = new Set((daemon?.active_jobs || []).map(String));
    return sendJson(res, 200, {
      queued: tasks.filter(t => !activeIds.has(String(t.identifier))).length,
      active: activeIds.size,
      total: tasks.length,
      top_tasks: tasks.slice(0, 10).map(t => ({
        id: t.identifier, title: t.title, priority: t.priority,
        source: t.source, active: activeIds.has(String(t.identifier)),
      })),
    });
  }

  if (apiPath === '/api/github/runs') {
    try {
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 50);
      const data = await ghFetch(`repos/${project.repo}/actions/runs?per_page=${limit}&branch=main`);
      return sendJson(res, 200, {
        runs: data.workflow_runs.map(r => ({
          id: r.id, name: r.name, display_title: r.display_title,
          status: r.status, conclusion: r.conclusion,
          created_at: r.created_at, updated_at: r.updated_at,
          html_url: r.html_url, event: r.event, head_branch: r.head_branch,
        })),
      });
    } catch (err) { return sendJson(res, 502, { error: err.message }); }
  }

  if (apiPath === '/api/github/prs') {
    try {
      const searchRes = await ghFetch(`search/issues?q=repo:${project.repo}+is:pr+is:open`);
      const data = await ghFetch(`repos/${project.repo}/pulls?state=open&per_page=30&sort=updated&direction=desc`);
      return sendJson(res, 200, {
        total_count: searchRes.total_count,
        prs: data.map(pr => ({
          number: pr.number, title: pr.title, state: pr.state,
          draft: pr.draft, created_at: pr.created_at, updated_at: pr.updated_at,
          html_url: pr.html_url, labels: pr.labels.map(l => l.name),
          head_ref: pr.head.ref, user: pr.user.login,
        })),
      });
    } catch (err) { return sendJson(res, 502, { error: err.message }); }
  }

  if (apiPath === '/api/github/commits') {
    try {
      const data = await ghFetch(`repos/${project.repo}/commits?per_page=10&sha=main`);
      return sendJson(res, 200, {
        commits: data.map(c => ({
          sha: c.sha.slice(0, 7), full_sha: c.sha,
          message: c.commit.message.split('\n')[0],
          author: c.commit.author.name,
          date: c.commit.author.date,
          html_url: c.html_url,
        })),
      });
    } catch (err) { return sendJson(res, 502, { error: err.message }); }
  }

  if (apiPath === '/api/github/repo') {
    try {
      const data = await ghFetch(`repos/${project.repo}`);
      return sendJson(res, 200, {
        name: data.name, full_name: data.full_name,
        description: data.description,
        open_issues_count: data.open_issues_count,
        default_branch: data.default_branch,
        html_url: data.html_url, pushed_at: data.pushed_at,
      });
    } catch (err) { return sendJson(res, 502, { error: err.message }); }
  }

  if (apiPath === '/api/github/history') {
    try {
      const jobs = readFactoryJson(project, 'jobs.json');
      if (!jobs || !jobs.jobs) return sendJson(res, 200, { total_count: 0, items: [] });

      const doneJobs = jobs.jobs.filter(j => j.state === 'done' && j.last_error === null);
      doneJobs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

      const items = doneJobs.slice(0, 20).map(j => ({
        number: parseInt(j.task.identifier),
        title: j.task.title,
        html_url: `https://github.com/${project.repo}/${j.task.source === 'github-pull-request' ? 'pull' : 'issues'}/${j.task.identifier}`,
        closed_at: j.updated_at,
        user: 'factory'
      }));

      return sendJson(res, 200, {
        total_count: doneJobs.length,
        items
      });
    } catch (err) { return sendJson(res, 502, { error: err.message }); }
  }

  // Static files
  if (pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'Not found' });
  }

  // Serve static - normalise path to prevent directory traversal
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath === '/' ? 'index.html' : safePath);
  serveStatic(res, filePath);
}

// ---- Server ----
const server = createServer(async (req, res) => {
  try {
    await handleRoute(req, res);
  } catch (err) {
    console.error('Request error:', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Repo Factory dashboard listening on http://0.0.0.0:${PORT}`);
  console.log(`Projects: ${Object.keys(projects()).join(', ')}`);
  console.log(`Auth user: ${DASHBOARD_CREDENTIALS.user}`);
});
