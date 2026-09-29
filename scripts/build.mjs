import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const source = await fs.readFile(path.join(root, 'src/collector.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const output = path.join(root, '.tmp-collector.mjs');
try {
  await fs.writeFile(output, js);
  const { collectConcerts } = await import(pathToFileURL(output).href);
  const concerts = await collectConcerts();
  if (!Array.isArray(concerts) || concerts.length === 0) throw new Error('Inga konserter kunde hämtas; publicering avbruten.');
  const sources = new Set(concerts.flatMap(c => c.source.split(' · ')));
  if (sources.size < 3) throw new Error('För få konsertkällor svarade; publicering avbruten.');
  const data = { updated: new Date().toISOString(), concerts };
  await fs.mkdir(path.join(root, 'site/data'), { recursive: true });
  await fs.writeFile(path.join(root, 'site/data/concerts.json'), JSON.stringify(data));
  console.log(`Publiceringsdata: ${concerts.length} konserter.`);
} finally { await fs.rm(output, { force: true }); }
