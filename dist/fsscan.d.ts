/**
 * Splits the `linguist_exclude_folders` input into gitignore-style patterns.
 * Accepts comma AND newline separators; blank entries are dropped.
 */
export declare function parseExcludePatterns(raw: string): string[];
/**
 * Minimal parse of the ROOT .gitattributes (nested .gitattributes files are
 * intentionally NOT read): returns the patterns whose attributes mark paths
 * as `linguist-vendored` or `linguist-generated` in the set (`linguist-vendored`)
 * or explicit-true (`linguist-vendored=true`) form. The negated form
 * (`-linguist-vendored`, used to UN-vendor paths) is honoured the other way:
 * a pattern carrying a negated linguist attribute is never excluded, and a
 * later negated line overrides an earlier positive one for the same pattern.
 * These patterns are gitignore-compatible enough to be fed to the `ignore`
 * package, which is exactly how the prune scan consumes them.
 */
export declare function gitattributesLinguistExcludes(rootDir: string): string[];
/**
 * Returns true when the checkout contains at least one workflow YAML file
 * under .github/workflows/ — the filesystem equivalent of the Contents-API
 * check used by the gh-api detection method for the `actions` pseudo-language.
 */
export declare function hasWorkflowYaml(rootDir: string): boolean;
/**
 * Walks the checkout and returns the set of lowercase file extensions present
 * (e.g. ".py", ".ts"). Only `.git` is skipped unconditionally: pruning must
 * only remove a language when there is truly NO matching file anywhere in the
 * working tree. `excludePatterns` (gitignore-style, matched with the `ignore`
 * package against repo-root-relative paths) additionally filters paths out —
 * used for `linguist_exclude_folders` and for root-.gitattributes
 * linguist-vendored/linguist-generated patterns.
 */
export declare function collectExtensions(rootDir: string, excludePatterns?: string[]): Set<string>;
