import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import {
  hasWorkflowYaml,
  collectExtensions,
  parseExcludePatterns,
  gitattributesLinguistExcludes,
} from '../src/fsscan';

jest.setTimeout(120000);

const repoRoot = path.join(__dirname, '..');
const langRepoFixture = path.join(__dirname, 'fixtures', 'lang-repo');
const pythonOnlyFixture = path.join(__dirname, 'fixtures', 'python-only');
const nestedPyFixture = path.join(__dirname, 'fixtures', 'nested-py');
const vendoredAttrsFixture = path.join(__dirname, 'fixtures', 'vendored-attrs');
const vendoredNegatedFixture = path.join(__dirname, 'fixtures', 'vendored-negated');

/**
 * Runs the REAL detectLocalLanguages (src/linguist.ts) in a child node
 * process: linguist-js is ESM-only and cannot be require()d inside jest's
 * CommonJS runtime, but plain node handles it fine.
 */
function detect(dir: string, excludePatterns: string[] = []): { [language: string]: number } {
  const helper = path.join(__dirname, 'helpers', 'detect-languages.ts');
  const stdout = execFileSync(
    process.execPath,
    [
      '--require',
      'ts-node/register/transpile-only',
      helper,
      dir,
      JSON.stringify(excludePatterns),
    ],
    { cwd: repoRoot, encoding: 'utf8' }
  );
  return JSON.parse(stdout);
}

describe('linguist local detection (real linguist-js)', () => {
  let result: { [language: string]: number };

  beforeAll(() => {
    result = detect(langRepoFixture);
  });

  test('detects languages with the exact GitHub-API names (languages.yml keys)', () => {
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(['TypeScript', 'HTML', 'Python'])
    );

    // Name parity: the GitHub /languages API names come from Linguist's
    // languages.yml — every name linguist-js returns must be an exact key of
    // the very languages.yml it ships, guaranteeing both detection methods
    // speak the same language names.
    const languagesYml = yaml.load(
      fs.readFileSync(
        path.join(repoRoot, 'node_modules', 'linguist-js', 'ext', 'languages.yml'),
        'utf8'
      )
    ) as { [name: string]: unknown };
    for (const name of Object.keys(result)) {
      expect(languagesYml).toHaveProperty([name]);
    }
  });

  test('counts code under .github/ (Python only exists at .github/scripts/tool.py)', () => {
    const toolPy = path.join(langRepoFixture, '.github', 'scripts', 'tool.py');
    expect(result.Python).toBe(fs.statSync(toolPy).size);
  });

  test('keeps default vendor rules (vendor/ excluded) and API category parity (no YAML)', () => {
    // vendor/lib.rb must not drag Ruby in — only .github/ is un-vendored.
    expect(result).not.toHaveProperty(['Ruby']);
    // The /languages API only reports programming+markup languages; YAML
    // (data) from .github/workflows/ci.yml must not appear either.
    expect(result).not.toHaveProperty(['YAML']);
  });

  test('returns the {LanguageName: bytes} shape of the GitHub /languages API', () => {
    for (const [name, bytes] of Object.entries(result)) {
      expect(typeof name).toBe('string');
      expect(typeof bytes).toBe('number');
      expect(bytes).toBeGreaterThan(0);
    }
  });

  test('linguist_exclude_folders drops the languages of an excluded folder', () => {
    // Go only exists at lib/util.go — present without the filter...
    expect(result).toHaveProperty(['Go']);
    // ...gone when lib/ is excluded, while sibling languages survive.
    const filtered = detect(langRepoFixture, ['lib']);
    expect(filtered).not.toHaveProperty(['Go']);
    expect(filtered).toHaveProperty(['TypeScript']);
    expect(filtered).toHaveProperty(['Python']);
  });

  test('exclusion of .github matches the second pass repo-root-relative', () => {
    // Python only exists at .github/scripts/tool.py, found by the pass ROOTED
    // AT .github/. Excluding `.github` must drop it — proving second-pass
    // paths are relativized against the REPO ROOT before matching, not
    // against the .github pass root.
    const filtered = detect(langRepoFixture, ['.github']);
    expect(filtered).not.toHaveProperty(['Python']);
    expect(filtered).toHaveProperty(['TypeScript']);
    expect(filtered).toHaveProperty(['Go']);
  });
});

describe('filesystem scans (fsscan)', () => {
  test('hasWorkflowYaml is true when .github/workflows has a .yml file', () => {
    expect(hasWorkflowYaml(langRepoFixture)).toBe(true);
  });

  test('hasWorkflowYaml is false without .github/workflows', () => {
    expect(hasWorkflowYaml(pythonOnlyFixture)).toBe(false);
  });

  test('collectExtensions finds the extensions present in the tree', () => {
    const extensions = collectExtensions(pythonOnlyFixture);
    expect(extensions.has('.py')).toBe(true);
    expect(extensions.has('.go')).toBe(false);
  });

  test('collectExtensions skips paths matched by exclude patterns', () => {
    expect(collectExtensions(nestedPyFixture).has('.py')).toBe(true);
    expect(collectExtensions(nestedPyFixture, ['sub']).has('.py')).toBe(false);
    // content-only pattern (does not match the directory itself) also works
    expect(collectExtensions(nestedPyFixture, ['sub/**']).has('.py')).toBe(false);
  });

  test('parseExcludePatterns splits on commas and newlines and trims', () => {
    expect(parseExcludePatterns(' docs/ ,examples/**\nvendor\n\n, ')).toEqual([
      'docs/',
      'examples/**',
      'vendor',
    ]);
    expect(parseExcludePatterns('')).toEqual([]);
  });

  test('gitattributesLinguistExcludes collects vendored/generated patterns from the root .gitattributes', () => {
    expect(gitattributesLinguistExcludes(vendoredAttrsFixture)).toEqual(['thirdparty/**']);
    // negated form (-linguist-vendored) must NOT produce an exclusion
    expect(gitattributesLinguistExcludes(vendoredNegatedFixture)).toEqual([]);
    // no root .gitattributes at all
    expect(gitattributesLinguistExcludes(pythonOnlyFixture)).toEqual([]);
  });
});
