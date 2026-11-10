import { build } from 'esbuild';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const result = await build({
  absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
  entryPoints: ['src/extension.ts'],
  outfile: 'out/extension.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  sourcemap: false,
  minify: false,
  metafile: true,
});

// Keep the upstream license texts when node_modules is excluded from the VSIX.
const packages = new Set(Object.keys(result.metafile.inputs)
  .map((input) => input.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)\//)?.[1])
  .filter(Boolean));
const notices = [];
for (const name of [...packages].sort()) {
  const directory = new URL(`../node_modules/${name}/`, import.meta.url);
  const files = (await readdir(directory)).filter((file) => /^(license|copying)(\..*)?$/i.test(file));
  if (files.length === 0) {
    throw new Error(`Missing license text for bundled dependency ${name}`);
  }
  for (const file of files.sort()) {
    notices.push(`${name} — ${file}\n\n${await readFile(new URL(file, directory), 'utf8')}`);
  }
}
await writeFile(new URL('../out/extension.LICENSE.txt', import.meta.url), notices.join('\n\n'));
