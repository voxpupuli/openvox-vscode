import { rm } from 'node:fs/promises';

await Promise.all([
  rm(new URL('../out', import.meta.url), { recursive: true, force: true }),
  rm(new URL('../vendor', import.meta.url), { recursive: true, force: true }),
]);
