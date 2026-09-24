import { cp, mkdir } from 'node:fs/promises';

for (const name of ['vanilla', 'react', 'vue']) {
  const target = new URL(`./dist/try/${name}/`, import.meta.url);
  await mkdir(target, { recursive: true });
  await cp(new URL(`../examples/${name}/dist/`, import.meta.url), target, { recursive: true });
}
