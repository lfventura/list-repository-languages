/**
 * Returns true when the checkout contains at least one workflow YAML file
 * under .github/workflows/ — the filesystem equivalent of the Contents-API
 * check used by the gh-api detection method for the `actions` pseudo-language.
 */
export declare function hasWorkflowYaml(rootDir: string): boolean;
/**
 * Walks the checkout and returns the set of lowercase file extensions present
 * (e.g. ".py", ".ts"). Only `.git` is skipped: pruning must only remove a
 * language when there is truly NO matching file anywhere in the working tree.
 */
export declare function collectExtensions(rootDir: string): Set<string>;
