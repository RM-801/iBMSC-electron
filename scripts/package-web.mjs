import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(process.argv[2] || path.join(root, 'dist/web'));
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.mkdir(output);
for (const file of ['index.html', 'src', 'assets', 'CREDITS.md', 'UPSTREAM-README.md', 'THIRD_PARTY_NOTICES.md'])
  await fs.cp(path.join(root, file), path.join(output, file), { recursive: true });
await fs.writeFile(path.join(output, '.nojekyll'), '');
console.log(output);
