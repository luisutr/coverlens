#!/usr/bin/env node
/**
 * Genera docs/privacidad/index.html desde docs/PRIVACY_POLICY_ES.md
 * Uso: node scripts/build-privacy-html.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mdPath = join(root, 'docs/PRIVACY_POLICY_ES.md');
const outDir = join(root, 'docs/privacidad');
const outPath = join(outDir, 'index.html');

const md = readFileSync(mdPath, 'utf8');

function mdToHtml(text) {
  const lines = text.split('\n');
  const parts = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      parts.push('</ul>');
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    if (trimmed.startsWith('# ')) {
      closeList();
      parts.push(`<h1>${escapeHtml(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      closeList();
      parts.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      closeList();
      parts.push(`<h3>${escapeHtml(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        parts.push('<ul>');
        inList = true;
      }
      parts.push(`<li>${inlineFormat(trimmed.slice(2))}</li>`);
      continue;
    }
    closeList();
    parts.push(`<p>${inlineFormat(trimmed)}</p>`);
  }
  closeList();
  return parts.join('\n');
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineFormat(s) {
  let out = escapeHtml(s);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`(.*?)`/g, '<code>$1</code>');
  out = out.replace(
    /(https:\/\/[^\s<]+)/g,
    '<a href="$1" rel="noopener noreferrer">$1</a>'
  );
  return out;
}

const body = mdToHtml(md);

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Política de privacidad de CoverLens — app de catalogación de videojuegos." />
  <title>Política de privacidad — CoverLens</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      padding: 24px 16px 48px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      line-height: 1.6;
      background: #0a0a0a;
      color: #e8e8e8;
      max-width: 720px;
      margin-inline: auto;
    }
    h1 { font-size: 1.75rem; margin-bottom: 0.5rem; color: #fff; }
    h2 { font-size: 1.15rem; margin-top: 2rem; color: #007fff; }
    h3 { font-size: 1rem; margin-top: 1.25rem; color: #ccc; }
    p, li { color: #ccc; }
    a { color: #007fff; }
    code { background: #1a1a1a; padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; }
    ul { padding-left: 1.25rem; }
  </style>
</head>
<body>
${body}
</body>
</html>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, html, 'utf8');
console.log('Written', outPath);
