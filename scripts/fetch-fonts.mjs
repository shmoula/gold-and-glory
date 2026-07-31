// scripts/fetch-fonts.mjs — vendor latin woff2 subsets from Google Fonts (all OFL).
// Run once: node scripts/fetch-fonts.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// `ofl` is the family's directory in github.com/google/fonts, whose OFL.txt carries the real
// copyright line. `license` is what it is vendored as. One per family, never shared: the three
// families have three different copyright holders, and a single file can only name one of them.
const FAMILIES = [
  {
    spec: 'Bangers',
    ofl: 'bangers',
    license: 'OFL-Bangers.txt',
    out: { 400: 'Bangers-400.woff2' },
  },
  {
    spec: 'Nunito:wght@400;700',
    ofl: 'nunito',
    license: 'OFL-Nunito.txt',
    out: { 400: 'Nunito-400.woff2', 700: 'Nunito-700.woff2' },
  },
  {
    spec: 'Patrick+Hand',
    ofl: 'patrickhand',
    license: 'OFL-PatrickHand.txt',
    out: { 400: 'PatrickHand-400.woff2' },
  },
];
const GF_RAW = 'https://raw.githubusercontent.com/google/fonts/main/ofl';

// One lifetime-bounded signal covers both the header fetch and the body read that follows it
// (res.text()/res.arrayBuffer()). AbortSignal.timeout keeps ticking after the response arrives,
// so a stalled body aborts exactly like a stalled connection and `npm run fonts` can never hang
// waiting on a download that opened but never finished. A caller may pass its own signal.
const get = async (url, init = {}) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), ...init });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res;
};

await mkdir('src/assets/fonts', { recursive: true });
const written = [];
for (const { spec, out } of FAMILIES) {
  const css = await (
    await get(`https://fonts.googleapis.com/css2?family=${spec}&display=swap`, {
      headers: { 'User-Agent': UA },
    })
  ).text();
  for (const m of css.matchAll(/\/\* (\w[\w-]*) \*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    if (m[1] !== 'latin') continue;
    const weight = m[2].match(/font-weight:\s*(\d+)/)?.[1];
    const url = m[2].match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
    if (!weight || !url || !out[weight]) continue;
    const buf = Buffer.from(await (await get(url)).arrayBuffer());
    await writeFile(`src/assets/fonts/${out[weight]}`, buf);
    written.push(out[weight]);
    console.log(`fetched ${out[weight]} (${(buf.length / 1024) | 0} KB)`);
  }
}

// Every declared file must land — a silent miss means Google changed the css2 response
// shape (e.g. collapsed 400+700 into one ranged block) and the regex needs updating.
const expected = FAMILIES.flatMap(({ out }) => Object.values(out));
const missing = expected.filter((f) => !written.includes(f));
if (missing.length) throw new Error(`never written: ${missing.join(', ')}`);

// The OFL requires the license to travel with redistributed font software, and these woff2
// files are redistributed in both git and dist/ — the latter via vite.config.js's
// copy-font-licenses plugin, which lifts these files into the built artifact beside the fonts.
// It must be each family's *own* OFL.txt, not
// the canonical template: the template's copyright line is the unfilled placeholder
// `Copyright (c) <dates>, <Copyright Holder>`, which satisfies "a license accompanies the
// software" while attributing nobody. Upstream's copy is the only one that names the authors,
// so it is fetched rather than hand-written — a copyright line written from memory is a
// guess about somebody else's legal notice.
for (const { ofl, license } of FAMILIES) {
  const text = await (await get(`${GF_RAW}/${ofl}/OFL.txt`)).text();
  // A 404 on raw.githubusercontent is a 404, but a renamed directory could still serve some
  // other document. Require the OFL 1.1 marker (so an unrelated file with a copyright line
  // cannot pass), the placeholder gone, and a real holder present — the same three conditions
  // tests/styles.test.js asserts over the written file, so the gate and the check agree.
  if (
    !text.includes('SIL OPEN FONT LICENSE Version 1.1') ||
    /<Copyright Holder>/.test(text) ||
    !/^Copyright \S+/m.test(text)
  ) {
    throw new Error(`${ofl}/OFL.txt is not the family's filled-in OFL 1.1`);
  }
  await writeFile(`src/assets/fonts/${license}`, text);
  console.log(`fetched ${license} (${(text.length / 1024) | 0} KB) — ${text.split('\n')[0]}`);
}
