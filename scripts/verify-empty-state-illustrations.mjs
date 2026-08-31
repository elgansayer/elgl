import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const illustrationContracts = [
  {
    name: 'No Messages',
    asset: 'frontend/public/assets/illustrations/no-messages.svg',
    template: 'frontend/src/app/components/chat-list/chat-list.component.html',
    publicPath: '/assets/illustrations/no-messages.svg',
  },
  {
    name: 'No Moments Found',
    asset: 'frontend/public/assets/illustrations/no-moments.svg',
    template: 'frontend/src/app/components/moments-feed/moments-feed.component.html',
    publicPath: '/assets/illustrations/no-moments.svg',
  },
  {
    name: 'No Users Nearby',
    asset: 'frontend/public/assets/illustrations/no-users-nearby.svg',
    template: 'frontend/src/app/components/discovery/discovery.component.html',
    publicPath: '/assets/illustrations/no-users-nearby.svg',
  },
];

const forbiddenSvgPatterns = [
  { label: 'scripts', pattern: /<script\b/i },
  { label: 'foreignObject content', pattern: /<foreignObject\b/i },
  { label: 'embedded raster images', pattern: /<image\b/i },
  { label: 'inline event handlers', pattern: /\son[a-z]+\s*=/i },
  {
    label: 'external or embedded resource references',
    pattern: /\b(?:href|xlink:href)\s*=\s*["'](?:https?:|\/\/|data:)/i,
  },
  { label: 'localised text baked into artwork', pattern: /<text\b/i },
  { label: 'animation', pattern: /<(?:animate|animateTransform|set)\b/i },
];

export function validateIllustrationSvg(svg, name = 'illustration') {
  const errors = [];
  const byteLength = Buffer.byteLength(svg, 'utf8');

  if (!/^\s*<svg\b/i.test(svg)) {
    errors.push(`${name}: file must contain an SVG root element`);
  }
  if (!/\bviewBox=["']0 0 240 160["']/i.test(svg)) {
    errors.push(`${name}: expected responsive viewBox="0 0 240 160"`);
  }
  if (!/\baria-hidden=["']true["']/i.test(svg)) {
    errors.push(`${name}: decorative SVG must declare aria-hidden="true"`);
  }
  if (!/\bfocusable=["']false["']/i.test(svg)) {
    errors.push(`${name}: decorative SVG must declare focusable="false"`);
  }
  if (byteLength > 12_000) {
    errors.push(`${name}: SVG is ${byteLength} bytes, exceeding the 12 kB budget`);
  }

  for (const { label, pattern } of forbiddenSvgPatterns) {
    if (pattern.test(svg)) {
      errors.push(`${name}: ${label} are not allowed in decorative illustration assets`);
    }
  }

  return errors;
}

export async function verifyEmptyStateIllustrations(root = repositoryRoot) {
  const errors = [];

  const primitivePath = resolve(
    root,
    'frontend/src/app/components/primitives/empty-state/empty-state.component.ts',
  );
  const primitive = await readFile(primitivePath, 'utf8');
  if (!primitive.includes('[src]="illustration()"')) {
    errors.push('Empty-state primitive must render its illustration input');
  }
  if (!primitive.includes('alt=""')) {
    errors.push('Empty-state illustrations must remain decorative with empty alt text');
  }
  if (!primitive.includes('aria-hidden="true"')) {
    errors.push('Empty-state illustration wrapper must remain hidden from assistive technology');
  }

  for (const contract of illustrationContracts) {
    const asset = await readFile(resolve(root, contract.asset), 'utf8');
    errors.push(...validateIllustrationSvg(asset, contract.name));

    const template = await readFile(resolve(root, contract.template), 'utf8');
    if (!template.includes(contract.publicPath)) {
      errors.push(
        `${contract.name}: ${contract.template} must reference ${contract.publicPath}`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`Empty-state illustration contract failed:\n- ${errors.join('\n- ')}`);
  }

  return {
    count: illustrationContracts.length,
    assets: illustrationContracts.map(({ asset }) => asset),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const result = await verifyEmptyStateIllustrations();
    console.log(`Verified ${result.count} empty-state vector illustrations.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
