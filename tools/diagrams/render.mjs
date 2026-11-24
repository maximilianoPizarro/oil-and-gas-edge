#!/usr/bin/env node
// Renders every documentation figure to docs/images/<id>-<lang>.png.
//
//   node tools/diagrams/render.mjs            # all diagrams, both languages
//   node tools/diagrams/render.mjs data-flow  # one diagram
//
// The renderer drives a headless Chromium over a generated HTML page, so the
// figures are reproducible from source instead of being hand-drawn binaries.
// Set CHROME_PATH when the browser is not in one of the default locations.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

import { DIAGRAMS, STRINGS } from './diagrams.mjs';
import { FONTS, STAGE, css, stage } from './theme.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const ASSETS = join(HERE, 'assets');
const CACHE = join(HERE, '.cache');
const FONT_DIR = join(CACHE, 'fonts');
const OUT_DIR = join(REPO, 'docs', 'images');

const FONT_BASE = 'https://raw.githubusercontent.com/RedHatOfficial/RedHatFont/master/fonts';
const FONT_PATHS = {
  RedHatDisplay: 'Proportional/RedHatDisplay/ttf',
  RedHatText: 'Proportional/RedHatText/ttf',
  RedHatMono: 'Mono/RedHatMono/ttf',
};

const MIME = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
};

function dataUri(file) {
  const ext = file.slice(file.lastIndexOf('.'));
  const mime = MIME[ext];
  if (!mime) throw new Error(`unknown asset type: ${file}`);
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

/** Red Hat fonts are fetched once into a gitignored cache. */
async function ensureFonts() {
  mkdirSync(FONT_DIR, { recursive: true });
  for (const { file } of FONTS) {
    const target = join(FONT_DIR, file);
    if (existsSync(target)) continue;
    const family = file.split('-')[0];
    const url = `${FONT_BASE}/${FONT_PATHS[family]}/${file}`;
    process.stdout.write(`fetching ${file}\n`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
    writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  }
}

function fontFaces() {
  return FONTS.map(
    ({ family, weight, file }) => `@font-face {
  font-family: "${family}";
  font-weight: ${weight};
  font-style: normal;
  src: url(${dataUri(join(FONT_DIR, file))}) format("truetype");
}`,
  ).join('\n');
}

function chromeBinary() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error('no Chromium found. Set CHROME_PATH to a Chrome or Chromium binary.');
  }
  return found;
}

function page({ title, body, styles }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>${title}</title>
<style>${styles}</style></head><body>${body}</body></html>`;
}

function shoot(chrome, htmlFile, outFile) {
  const result = spawnSync(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=00000000',
      `--window-size=${STAGE.w},${STAGE.h}`,
      '--virtual-time-budget=4000',
      `--screenshot=${outFile}`,
      pathToFileURL(htmlFile).href,
    ],
    { encoding: 'utf8' },
  );
  if (!existsSync(outFile)) {
    throw new Error(`screenshot failed for ${outFile}\n${result.stderr || result.stdout}`);
  }
}

async function main() {
  const only = process.argv.slice(2);
  const wanted = only.length ? DIAGRAMS.filter((d) => only.includes(d.id)) : DIAGRAMS;
  if (!wanted.length) {
    throw new Error(`no diagram matches ${only.join(', ')}`);
  }

  await ensureFonts();
  const chrome = chromeBinary();
  const styles = css(fontFaces());
  const cachedAssets = new Map();
  const asset = (name) => {
    if (!cachedAssets.has(name)) cachedAssets.set(name, dataUri(join(ASSETS, name)));
    return cachedAssets.get(name);
  };
  const logo = asset('redhat-logo-on-dark.svg');

  mkdirSync(join(CACHE, 'html'), { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  for (const diagram of wanted) {
    for (const lang of ['en', 'es']) {
      const strings = STRINGS[lang][diagram.key];
      const spec = diagram.build(asset, strings);
      const body = stage({ ...spec, logo });
      const htmlFile = join(CACHE, 'html', `${diagram.id}-${lang}.html`);
      const outFile = join(OUT_DIR, `${diagram.id}-${lang}.png`);
      writeFileSync(htmlFile, page({ title: spec.title, body, styles }), 'utf8');
      shoot(chrome, htmlFile, outFile);
      process.stdout.write(`rendered docs/images/${diagram.id}-${lang}.png\n`);
    }
  }
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
