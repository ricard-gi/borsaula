#!/usr/bin/env node

// generate-index.js
// Llegeix tots els arxius .md de les carpetes configurades, extreu el front-matter
// YAML i escriu el resultat a index.json.

const fs = require('fs');
const path = require('path');

// Carpetes on buscar arxius .md (relatives a l'arrel del repositori)
const SEARCH_DIRS = ['blog', 'accions', 'cursos'];

// Usuari i repo de GitHub per construir la contentUrl
const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/ricard-gi/borsaula/refs/heads/main';

/**
 * Extreu el bloc front-matter YAML d'un string Markdown.
 * Retorna un objecte amb les claus trobades, o null si no hi ha front-matter.
 */
function parseFrontMatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result = {};

  for (const line of yaml.split(/\r?\n/)) {
    // Clau que inicia un array:  tags:  (sense valor) — cal comprovar abans que l'escalar
    const arrayKey = line.match(/^(\w+):\s*$/);
    if (arrayKey) {
      result[arrayKey[1]] = [];
      continue;
    }

    // Element de llista:  - valor
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem) {
      const keys = Object.keys(result);
      const lastKey = keys[keys.length - 1];
      if (Array.isArray(result[lastKey])) {
        result[lastKey].push(listItem[1].trim());
      }
      continue;
    }

    // Clau simple:  key: value
    const scalar = line.match(/^(\w+):\s*"?([^"#\n]*?)"?\s*$/);
    if (scalar) {
      const [, key, value] = scalar;
      // Converteix readTime a número si escau
      result[key] = key === 'readTime' ? Number(value) : value.trim();
    }
  }

  return result;
}

/**
 * Construeix la contentUrl a partir del path relatiu de l'arxiu.
 */
function buildContentUrl(relPath) {
  // Normalitza separadors a '/'
  return `${GITHUB_RAW_BASE}/${relPath.replace(/\\/g, '/')}`;
}

function main() {
  const entries = [];

  for (const dir of SEARCH_DIRS) {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const fm = parseFrontMatter(content);

      if (!fm || !fm.id) {
        console.warn(`  [skip] ${dir}/${file} — sense front-matter o sense "id"`);
        continue;
      }

      if (fm.publish === '0' || fm.publish === 'no') {
        console.log(`  [skip] ${dir}/${file} — publish: ${fm.publish}`);
        continue;
      }

      const entry = {
        id: fm.id,
        title: fm.title || '',
        ...(fm.description ? { description: fm.description } : {}),
        category: fm.category || '',
        tags: fm.tags || [],
        date: fm.date || '',
        ...(fm.readTime ? { readTime: fm.readTime } : {}),
        contentUrl: buildContentUrl(`${dir}/${file}`),
      };

      entries.push(entry);
      console.log(`  [ok]   ${dir}/${file} → ${fm.id}`);
    }
  }

  // Ordena per data descendent
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const outputPath = path.join(__dirname, 'index.json');
  fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  console.log(`\nindex.json actualitzat amb ${entries.length} entrades.`);
}

main();
