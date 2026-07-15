export type LanguageBytes = {
    [language: string]: number;
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
export declare function detectLocalLanguages(rootDir: string, excludePatterns?: string[]): Promise<LanguageBytes>;
