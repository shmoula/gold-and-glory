import { defineConfig } from 'vite';
import { readdirSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// The vendored woff2 subsets are OFL font software, and Vite emits them into dist/assets/ by
// hashing the `url('../assets/fonts/…woff2')` references in tokens.css. The `OFL-*.txt` licenses
// beside them in src/assets/fonts are referenced by nothing, so the build dropped them and dist/
// shipped fonts with no accompanying license — the OFL requires the license to travel with
// redistributed font software, and a deployed dist/ is a redistribution. This copies each
// family's license into dist/assets next to the fonts. The set is derived from what is on disk
// (every `OFL-*.txt`), so a fourth family vendored by scripts/fetch-fonts.mjs is carried for free.
// The CI "Font licenses present in build" step asserts the result; tests/styles.test.js still
// guards the source-tree copies without depending on a build.
function copyFontLicenses() {
  const srcDir = resolve('src/assets/fonts');
  return {
    name: 'copy-font-licenses',
    apply: 'build',
    writeBundle(options) {
      const dest = resolve(options.dir ?? resolve('dist'), 'assets');
      mkdirSync(dest, { recursive: true });
      for (const file of readdirSync(srcDir)) {
        if (/^OFL-.*\.txt$/.test(file)) copyFileSync(resolve(srcDir, file), resolve(dest, file));
      }
    },
  };
}

export default defineConfig({
  plugins: [copyFontLicenses()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
