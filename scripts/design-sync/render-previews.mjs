#!/usr/bin/env node
// Renders every design preview headlessly and audits what a static scan cannot see.
//
//   node scripts/design-sync/render-previews.mjs [--only <substring>] [--no-screens]
//
// For each preview × {light, dark} × {ltr, rtl} at a 390px viewport (plus light/ltr at 1280px):
//   - horizontal overflow at 390px (the Relay mobile baseline)
//   - interactive elements smaller than 44×44 CSS px (WCAG 2.5.5 / Relay touch target)
//   - text whose computed contrast against its effective background is below 4.5:1
// Screenshots go to reports/design-screens/, findings to reports/design-render-audit.json.
// Requires Playwright's Chromium: `npx playwright install chromium`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { previewFiles, root, sha256 } from './lib.mjs';

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : null;
const screens = !process.argv.includes('--no-screens');
const outDir = resolve(root, 'reports/design-screens');
mkdirSync(outDir, { recursive: true });

const findings = [];
const add = (severity, rule, file, detail) =>
  findings.push({
    id: sha256(`${rule}|${file}|${detail}`).slice(0, 12),
    severity,
    rule,
    file,
    detail,
  });

// Runs inside the page: collects layout and contrast problems.
function inspect() {
  // Normalise any CSS colour (rgb, oklch, color-mix, ...) to sRGB bytes + alpha via canvas.
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const parse = (c) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const lum = ([r, g, b]) =>
    [r, g, b]
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  // Composite translucent backgrounds from the element up to the first opaque layer.
  const background = (el) => {
    const layers = [];
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage !== 'none') return null; // gradients/images: not measurable
      const [r, g, b, a] = parse(style.backgroundColor);
      if (a > 0) layers.push([r, g, b, a]);
      if (a >= 0.999) break;
    }
    let out =
      layers.length && layers[layers.length - 1][3] >= 0.999
        ? layers.pop().slice(0, 3)
        : [255, 255, 255];
    for (const [r, g, b, a] of layers.reverse())
      out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)];
    return out;
  };
  const label = (el) => {
    const spec = el.closest('[data-component]');
    const text = (el.getAttribute('aria-label') || el.textContent || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40);
    return `${spec ? spec.dataset.component : 'page'} › <${el.tagName.toLowerCase()}> "${text}"`;
  };

  const overflow = document.documentElement.scrollWidth - window.innerWidth;
  const small = [];
  for (const el of document.querySelectorAll(
    'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch]',
  )) {
    if (el.closest('.page-head')) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    if (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')) continue;
    if (box.width < 44 || box.height < 44)
      small.push(`${label(el)} ${Math.round(box.width)}×${Math.round(box.height)}`);
  }
  const lowContrast = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement;
    if (!el || seen.has(el) || !walker.currentNode.textContent.trim() || el.closest('.page-head'))
      continue;
    seen.add(el);
    const style = getComputedStyle(el);
    if (
      style.visibility === 'hidden' ||
      Number(style.opacity) < 0.6 ||
      el.closest('[aria-hidden=true], [disabled], .btn[disabled]')
    )
      continue;
    const bg = background(el);
    if (!bg) continue;
    const [r0, g0, b0, a] = parse(style.color);
    if (a < 0.3) continue;
    const [r, g, b] = [
      r0 * a + bg[0] * (1 - a),
      g0 * a + bg[1] * (1 - a),
      b0 * a + bg[2] * (1 - a),
    ];
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    const value = ratio([r, g, b], bg);
    if (value < (large ? 3 : 4.5)) lowContrast.push(`${label(el)} ${value.toFixed(2)}:1`);
  }
  return { overflow, small, lowContrast };
}

const browser = await chromium.launch();
const files = previewFiles().filter((file) => !only || file.includes(only));
const variants = [
  { theme: 'light', dir: 'ltr', width: 390 },
  { theme: 'dark', dir: 'ltr', width: 390 },
  { theme: 'light', dir: 'rtl', width: 390 },
  { theme: 'dark', dir: 'rtl', width: 390 },
  { theme: 'light', dir: 'ltr', width: 1280 },
];

for (const file of files) {
  const page = await browser.newPage();
  await page.route(/^https?:\/\/(?!cdn\.tailwindcss\.com)/, (route) => route.abort());
  for (const variant of variants) {
    await page.setViewportSize({ width: variant.width, height: 900 });
    await page.goto(pathToFileURL(resolve(root, file)).href, { waitUntil: 'load' }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.addStyleTag({
      content:
        '*, *::before, *::after { transition: none !important; animation: none !important; }',
    });
    await page.evaluate(({ theme, dir }) => {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.dir = dir;
    }, variant);
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    const tag = `${variant.theme}/${variant.dir}/${variant.width}`;
    const result = await page.evaluate(inspect);
    if (variant.width === 390 && result.overflow > 1)
      add(
        'error',
        'render-overflow-390',
        file,
        `${tag}: page scrolls horizontally by ${result.overflow}px`,
      );
    if (variant.dir === 'ltr' && variant.width === 390) {
      for (const hit of result.lowContrast)
        add('error', 'render-contrast', file, `${variant.theme}: ${hit}`);
    }
    if (variant.theme === 'light' && variant.dir === 'ltr' && variant.width === 390) {
      for (const hit of result.small) add('warning', 'render-tap-target', file, hit);
    }
    if (screens) {
      const name = `${file.replace('frontend/design-preview/', '').replaceAll('/', '__').replace('.html', '')}--${variant.theme}-${variant.dir}-${variant.width}.png`;
      await page.screenshot({ path: resolve(outDir, name), fullPage: true });
    }
  }
  await page.close();
}
await browser.close();

const counts = findings.reduce(
  (acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] ?? 0) + 1 }),
  {},
);
writeFileSync(
  resolve(root, 'reports/design-render-audit.json'),
  `${JSON.stringify({ generated: new Date().toISOString(), counts, findings }, null, 2)}\n`,
);
console.log(
  `Render audit: ${files.length} preview(s), ${findings.length} finding(s) - ${counts.error ?? 0} error, ${counts.warning ?? 0} warning.`,
);
const byRuleFile = Object.groupBy(findings, (f) => `${f.rule} ${f.file}`);
for (const [key, list] of Object.entries(byRuleFile)) console.log(`- ${key}: ${list.length}`);
