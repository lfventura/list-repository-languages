import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

/**
 * Splits the `linguist_exclude_folders` input into gitignore-style patterns.
 * Accepts comma AND newline separators; blank entries are dropped.
 */
export function parseExcludePatterns(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map(pattern => pattern.trim())
    .filter(pattern => pattern.length > 0);
}

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
export function gitattributesLinguistExcludes(rootDir: string): string[] {
  let content: string;
  try {
    content = fs.readFileSync(path.join(rootDir, '.gitattributes'), 'utf8');
  } catch {
    return []; // no root .gitattributes — nothing to exclude
  }
  const excluded = new Map<string, boolean>();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const [pattern, ...attrs] = line.split(/\s+/);
    if (!pattern || attrs.length === 0) continue;
    let positive = false;
    let negated = false;
    for (const attr of attrs) {
      if (
        attr === 'linguist-vendored' ||
        attr === 'linguist-generated' ||
        attr === 'linguist-vendored=true' ||
        attr === 'linguist-generated=true'
      ) {
        positive = true;
      } else if (attr === '-linguist-vendored' || attr === '-linguist-generated') {
        negated = true;
      }
    }
    // A negated linguist attribute means "do NOT treat as vendored/generated"
    // — it must never cause exclusion, and it wins over a positive form.
    if (negated) excluded.set(pattern, false);
    else if (positive) excluded.set(pattern, true);
  }
  return Array.from(excluded.entries())
    .filter(([, isExcluded]) => isExcluded)
    .map(([pattern]) => pattern);
}

/**
 * Returns true when the checkout contains at least one workflow YAML file
 * under .github/workflows/ — the filesystem equivalent of the Contents-API
 * check used by the gh-api detection method for the `actions` pseudo-language.
 */
export function hasWorkflowYaml(rootDir: string): boolean {
  const workflowsDir = path.join(rootDir, '.github', 'workflows');
  try {
    return fs
      .readdirSync(workflowsDir, { withFileTypes: true })
      .some(entry => entry.isFile() && /\.ya?ml$/i.test(entry.name));
  } catch {
    // No .github/workflows directory — no workflow files
    return false;
  }
}

/**
 * Walks the checkout and returns the set of lowercase file extensions present
 * (e.g. ".py", ".ts"). Only `.git` is skipped unconditionally: pruning must
 * only remove a language when there is truly NO matching file anywhere in the
 * working tree. `excludePatterns` (gitignore-style, matched with the `ignore`
 * package against repo-root-relative paths) additionally filters paths out —
 * used for `linguist_exclude_folders` and for root-.gitattributes
 * linguist-vendored/linguist-generated patterns.
 */
export function collectExtensions(rootDir: string, excludePatterns: string[] = []): Set<string> {
  const matcher = excludePatterns.length > 0 ? ignore().add(excludePatterns) : null;
  const extensions = new Set<string>();
  const walk = (dir: string, relDir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === '.git') continue;
        // Prune whole subtrees whose directory path is excluded; patterns
        // that only match contents (e.g. `sub/**`) are caught per file below.
        if (matcher && matcher.ignores(rel)) continue;
        walk(path.join(dir, entry.name), rel);
      } else if (entry.isFile()) {
        if (matcher && matcher.ignores(rel)) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (ext) extensions.add(ext);
      }
    }
  };
  walk(rootDir, '');
  return extensions;
}
