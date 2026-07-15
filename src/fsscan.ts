import * as fs from 'fs';
import * as path from 'path';

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
 * (e.g. ".py", ".ts"). Only `.git` is skipped: pruning must only remove a
 * language when there is truly NO matching file anywhere in the working tree.
 */
export function collectExtensions(rootDir: string): Set<string> {
  const extensions = new Set<string>();
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === '.git') continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext) extensions.add(ext);
      }
    }
  };
  walk(rootDir);
  return extensions;
}
