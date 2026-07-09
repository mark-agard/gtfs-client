import { cpSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve(process.cwd(), 'dist/client/browser');
const dest = resolve(process.cwd(), '..', 'server', 'public');

if (!existsSync(src)) {
  console.error(`Build output not found at ${src}`);
  process.exit(1);
}

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true });
}

cpSync(src, dest, { recursive: true });
console.log(`Copied client build to ${dest}`);
