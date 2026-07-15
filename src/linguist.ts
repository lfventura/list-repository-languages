import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

export type LanguageBytes = { [language: string]: number };

/**
 * Options shared by every linguist-js pass:
 * - offline: use the languages.yml/vendor.yml/... data files shipped inside the
 *   linguist-js package — the action makes ZERO network/GitHub API calls.
 * - categories programming+markup: the GitHub /languages API only reports
 *   languages of type `programming` and `markup`, so filtering here keeps the
 *   linguist result byte-shape-identical ({LanguageName: bytes}) and
 *   name-identical (both derive from linguist's languages.yml) to the API.
 * - calculateLines off: only byte counts are needed.
 */
const baseOptions = {
  offline: true,
  categories: ['programming', 'markup'] as ('programming' | 'markup')[],
  calculateLines: false,
};

/**
 * Detects the languages of the LOCAL working tree with linguist-js, returning
 * the same {LanguageName: bytes} map the GitHub /languages API returns.
 *
 * Real Linguist (and therefore linguist-js) marks everything under `.github/`
 * as vendored, but for CodeQL purposes code living in .github (helper scripts,
 * composite actions) MUST count. Mechanism: two passes —
 *  1. the repository root with default vendor rules (.github/, node_modules/,
 *     vendor/, dist/... excluded);
 *  2. a second pass ROOTED AT `.github/` itself: paths become relative to
 *     .github (e.g. `workflows/ci.yml`), so the `(^|/)\.github/` vendor rule
 *     no longer matches, while every other vendor rule (e.g. node_modules/
 *     nested inside .github) still applies.
 * The passes are merged per FILE (union keyed on the absolute file path, so
 * nothing can ever be double-counted), then byte counts are summed per
 * language from the file sizes — the same blob-byte semantics the GitHub
 * /languages API uses.
 *
 * `excludePatterns` (gitignore-style, from the `linguist_exclude_folders`
 * input) is applied as a post-filter on the MERGED per-file results, before
 * byte summing. linguist-js returns absolute file paths from both passes
 * (including the pass rooted at `.github/`), so every path is relativized
 * against the REPO ROOT (`path.relative(rootDir, file)` → e.g.
 * `.github/scripts/tool.py`, never `scripts/tool.py`) before matching with
 * the `ignore` package — patterns therefore always match repo-root-relative
 * paths regardless of which pass found the file.
 */
export async function detectLocalLanguages(
  rootDir: string,
  excludePatterns: string[] = []
): Promise<LanguageBytes> {
  const linguist = (await import('linguist-js')).default;

  // absolute file path -> language name
  const fileLanguages: { [file: string]: string } = {};
  const addPass = (pass: {
    files: { results: { [file: string]: string | null } };
    languages: { results: { [language: string]: unknown } };
  }): void => {
    // languages.results is already category-filtered (programming+markup);
    // files.results is not — keep only files whose language survived.
    const kept = new Set(Object.keys(pass.languages.results));
    for (const [file, language] of Object.entries(pass.files.results)) {
      if (language && kept.has(language)) {
        fileLanguages[file] = language;
      }
    }
  };

  addPass(await linguist.analyseFolders([rootDir], baseOptions));

  const githubDir = path.join(rootDir, '.github');
  if (fs.existsSync(githubDir) && fs.lstatSync(githubDir).isDirectory()) {
    addPass(await linguist.analyseFolders([githubDir], baseOptions));
  }

  const matcher = excludePatterns.length > 0 ? ignore().add(excludePatterns) : null;
  const merged: LanguageBytes = {};
  for (const [file, language] of Object.entries(fileLanguages)) {
    if (matcher) {
      // Relativize to the repo root (posix separators): correct for BOTH
      // passes because linguist-js reports absolute paths.
      const rel = path.relative(rootDir, file).split(path.sep).join('/');
      if (rel && !rel.startsWith('..') && matcher.ignores(rel)) continue;
    }
    let bytes: number;
    try {
      bytes = fs.statSync(file).size;
    } catch {
      continue; // file vanished between analysis and stat — skip it
    }
    merged[language] = (merged[language] ?? 0) + bytes;
  }
  return merged;
}
