import path from 'path';

const DEFAULT_PROJECTS = Object.freeze({
  hellotalk: Object.freeze({
    name: 'HelloTalk Clone',
    repo: process.env.HELLOTALK_GH_REPO || 'elgansayer/elgl',
    stateDir: process.env.HELLOTALK_STATE_DIR || '/factory-state/hellotalk',
  }),
  'workout-agent': Object.freeze({
    name: 'Workout Agent',
    repo: process.env.WORKOUT_AGENT_GH_REPO || 'elgansayer/workout-agent',
    stateDir: process.env.WORKOUT_AGENT_STATE_DIR || '/factory-state/workout-agent',
  }),
});

export function projects() {
  return DEFAULT_PROJECTS;
}

export function projectFor(slug) {
  return Object.hasOwn(DEFAULT_PROJECTS, slug) ? DEFAULT_PROJECTS[slug] : null;
}

export function stateFile(project, filename) {
  if (!/^[a-z0-9_]+\.json$/.test(filename)) {
    throw new Error('Invalid Factory state filename');
  }
  return path.join(project.stateDir, filename);
}
