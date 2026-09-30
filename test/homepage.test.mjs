import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'style.css'), 'utf8');

test('homepage preserves search identity and Google verification', () => {
  assert.match(html, /<title>MarkEdit<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/markedit-app\.github\.io\/">/);
  assert.match(html, /<meta name="description" content="[^"]+Markdown editor[^"]+">/);
  assert.match(html, /<meta property="og:site_name" content="MarkEdit">/);
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(data, {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MarkEdit',
    url: 'https://markedit-app.github.io/',
  });
  assert.equal(
    readFileSync(join(root, 'google30cc27057e7192ac.html'), 'utf8').trim(),
    'google-site-verification: google30cc27057e7192ac.html',
  );
});

test('local navigation and image references resolve', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
  for (const [, target] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (target.startsWith('#')) {
      assert.ok(ids.includes(target.slice(1)), `Missing anchor ${target}`);
    } else if (!target.startsWith('/') && !target.startsWith('https://')) {
      assert.ok(existsSync(join(root, target)), `Missing asset ${target}`);
    }
  }
  for (const [, srcset] of html.matchAll(/\bsrcset="([^"]+)"/g)) {
    for (const candidate of srcset.split(',')) {
      assert.ok(existsSync(join(root, candidate.trim().split(/\s+/)[0])));
    }
  }
  assert.match(html, /href="https:\/\/github\.com\/MarkEdit-app\/MarkEdit\/releases\/latest"/);
  assert.match(html, /href="\/extensions\/"/);
});

test('content remains usable without JavaScript', () => {
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  assert.match(html, /class="skip-link" href="#main"/);
  for (const [image] of html.matchAll(/<img\b[^>]*>/g)) {
    assert.match(image, /\balt="[^"]*"/);
    assert.match(image, /\bwidth="\d+"/);
    assert.match(image, /\bheight="\d+"/);
  }
  assert.equal([...html.matchAll(/<details>/g)].length, 3);
  assert.match(html, /<script src="faq\.js" defer><\/script>/);
  assert.match(css, /prefers-color-scheme: dark/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /:focus-visible/);
});

test('screenshots retain their original PNG resolution without WebP alternatives', () => {
  for (const [file, width, height] of [
    ['editor.png', 2560, 1660],
    ['themes.png', 2560, 1660],
    ['extensions.png', 1784, 1384],
  ]) {
    const png = readFileSync(join(root, 'assets', file));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), height);
    assert.ok(html.includes(`src="assets/${file}"`));
  }
  assert.doesNotMatch(html, /\.webp|srcset=/);
  assert.ok(readdirSync(join(root, 'assets')).every(file => !file.endsWith('.webp')));
});

test('typography uses native system families', () => {
  assert.match(css, /--font-sans: system-ui,/);
  assert.match(css, /--font-serif: ui-serif, serif/);
  assert.match(css, /--font-mono: ui-monospace, monospace/);
  assert.doesNotMatch(css, /Georgia|Times New Roman|Consolas|@font-face|@import/);
});

test('original PNG assets stay below 5 MiB in total', () => {
  const bytes = readdirSync(join(root, 'assets'))
    .reduce((sum, file) => sum + statSync(join(root, 'assets', file)).size, 0);
  assert.ok(bytes < 5 * 1024 * 1024, `Image payload is ${bytes} bytes`);
});
