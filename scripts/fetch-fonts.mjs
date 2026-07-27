// scripts/fetch-fonts.mjs — vendor latin woff2 subsets from Google Fonts (all OFL).
// Run once: node scripts/fetch-fonts.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FAMILIES = [
  { spec: 'Bangers', out: { 400: 'Bangers-400.woff2' } },
  { spec: 'Nunito:wght@400;700', out: { 400: 'Nunito-400.woff2', 700: 'Nunito-700.woff2' } },
  { spec: 'Patrick+Hand', out: { 400: 'PatrickHand-400.woff2' } },
];

await mkdir('src/assets/fonts', { recursive: true });
for (const { spec, out } of FAMILIES) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${spec}&display=swap`, { headers: { 'User-Agent': UA } })).text();
  for (const m of css.matchAll(/\/\* (\w[\w-]*) \*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    if (m[1] !== 'latin') continue;
    const weight = m[2].match(/font-weight:\s*(\d+)/)[1];
    const url = m[2].match(/url\((https:\/\/[^)]+\.woff2)\)/)[1];
    if (!out[weight]) continue;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    await writeFile(`src/assets/fonts/${out[weight]}`, buf);
    console.log(`fetched ${out[weight]} (${(buf.length / 1024) | 0} KB)`);
  }
}
