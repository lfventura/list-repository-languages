import * as path from 'path';
import { afterAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as core from '@actions/core';
import * as github from '@actions/github';

jest.mock('@actions/core');
jest.mock('@actions/github');

const mockedCore = core as jest.Mocked<typeof core>;
const mockedGithub = github as jest.Mocked<typeof github>;

const pythonOnlyFixture = path.join(__dirname, 'fixtures', 'python-only');
const nestedPyFixture = path.join(__dirname, 'fixtures', 'nested-py');
const vendoredAttrsFixture = path.join(__dirname, 'fixtures', 'vendored-attrs');
const vendoredNegatedFixture = path.join(__dirname, 'fixtures', 'vendored-negated');
const originalWorkspace = process.env.GITHUB_WORKSPACE;

const GH_API_EXCLUDE_WARNING =
  'linguist_exclude_folders cannot filter the aggregated GitHub API statistics — it only affects linguist detection and pruning';

function mockOctokit(
  languagesData: { [lang: string]: number },
  workflowFiles: string[] = []
) {
  const request = jest.fn(async () => ({ data: languagesData }));
  const getContent = jest.fn(async () => {
    if (!workflowFiles.length) throw new Error('Not Found');
    return { data: workflowFiles.map(name => ({ type: 'file', name })) };
  });
  return {
    request,
    rest: { repos: { getContent } },
  } as unknown as ReturnType<typeof github.getOctokit>;
}

function getOutput(name: string): string {
  const call = mockedCore.setOutput.mock.calls.find(([n]) => n === name);
  expect(call).toBeDefined();
  return call![1] as string;
}

afterAll(() => {
  if (originalWorkspace === undefined) delete process.env.GITHUB_WORKSPACE;
  else process.env.GITHUB_WORKSPACE = originalWorkspace;
});

describe('prune_undetected_languages (gh-api mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_WORKSPACE = pythonOnlyFixture; // contains only script.py
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'detection_method') return 'gh-api';
      if (name === 'github_token') return 'fake-token';
      if (name === 'owner') return 'acme';
      if (name === 'repo') return 'stale-repo';
      return '';
    });
    mockedCore.getBooleanInput.mockImplementation(
      (name: string) => name === 'prune_undetected_languages'
    );
  });

  test('drops languages with no matching files (with warning) and keeps present ones', async () => {
    mockedGithub.getOctokit.mockReturnValue(mockOctokit({ Python: 100, Go: 200 }));

    const { run } = await import('../src/run');
    await run();

    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    expect(JSON.parse(getOutput('languages_codeql'))).toEqual(['python']);
    expect(mockedCore.warning).toHaveBeenCalledWith(
      'go listed but no matching files found in the checkout — removed from CodeQL analysis'
    );
    // Python has script.py in the checkout — kept, no warning about it.
    expect(mockedCore.warning).not.toHaveBeenCalledWith(
      expect.stringContaining('python listed but no matching files')
    );
    expect(JSON.parse(getOutput('codeql_supported'))).toBe(true);
  });

  test('recomputes codeql_supported to false when everything is pruned', async () => {
    mockedGithub.getOctokit.mockReturnValue(mockOctokit({ Go: 200 }));

    const { run } = await import('../src/run');
    await run();

    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    expect(JSON.parse(getOutput('languages_codeql'))).toEqual([]);
    expect(JSON.parse(getOutput('codeql_supported'))).toBe(false);
  });

  test('prunes the actions pseudo-language when the checkout has no workflow files', async () => {
    // The API reports workflow files, but the local checkout has no .github/workflows.
    mockedGithub.getOctokit.mockReturnValue(mockOctokit({}, ['ci.yml']));

    const { run } = await import('../src/run');
    await run();

    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    // API-side detection still lists it as a repo language...
    expect(JSON.parse(getOutput('languages_repo'))).toEqual(['actions']);
    // ...but the CodeQL matrix drops it: nothing to scan in this checkout.
    expect(JSON.parse(getOutput('languages_codeql'))).toEqual([]);
    expect(mockedCore.warning).toHaveBeenCalledWith(
      'actions listed but no matching files found in the checkout — removed from CodeQL analysis'
    );
  });

  test('prune also filters force_languages entries with no files', async () => {
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'detection_method') return 'gh-api';
      if (name === 'github_token') return 'fake-token';
      if (name === 'owner') return 'acme';
      if (name === 'repo') return 'stale-repo';
      if (name === 'force_languages') return 'swift';
      return '';
    });
    mockedGithub.getOctokit.mockReturnValue(mockOctokit({ Python: 100 }));

    const { run } = await import('../src/run');
    await run();

    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    expect(JSON.parse(getOutput('languages_codeql'))).toEqual(['python']);
    expect(mockedCore.warning).toHaveBeenCalledWith(
      'swift listed but no matching files found in the checkout — removed from CodeQL analysis'
    );
  });

  test('prune respects root .gitattributes linguist-vendored paths (forced language pruned)', async () => {
    // Fixture: the ONLY .py lives under thirdparty/, which the root
    // .gitattributes marks `linguist-vendored` — the prune scan must not see
    // it, so the forced python is pruned with a warning.
    process.env.GITHUB_WORKSPACE = vendoredAttrsFixture;
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'detection_method') return 'gh-api';
      if (name === 'github_token') return 'fake-token';
      if (name === 'owner') return 'acme';
      if (name === 'repo') return 'vendored-repo';
      if (name === 'force_languages') return 'python';
      return '';
    });
    mockedGithub.getOctokit.mockReturnValue(mockOctokit({}));

    const { run } = await import('../src/run');
    await run();

    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    expect(JSON.parse(getOutput('languages_codeql'))).toEqual([]);
    expect(mockedCore.warning).toHaveBeenCalledWith(
      'python listed but no matching files found in the checkout — removed from CodeQL analysis'
    );
  });

  test('negated -linguist-vendored attribute does NOT exclude — language kept', async () => {
    // Same layout, but .gitattributes uses the negated form: thirdparty/ is
    // explicitly UN-vendored, so its .py keeps python in the matrix.
    process.env.GITHUB_WORKSPACE = vendoredNegatedFixture;
    mockedGithub.getOctokit.mockReturnValue(mockOctokit({ Python: 100 }));

    const { run } = await import('../src/run');
    await run();

    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    expect(JSON.parse(getOutput('languages_codeql'))).toEqual(['python']);
    expect(mockedCore.warning).not.toHaveBeenCalledWith(
      expect.stringContaining('python listed but no matching files')
    );
  });

  test('prune respects linguist_exclude_folders (and gh-api emits the stats warning)', async () => {
    // The only .py lives under sub/, excluded via linguist_exclude_folders —
    // the prune scan skips it and python is dropped from the matrix.
    process.env.GITHUB_WORKSPACE = nestedPyFixture;
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'detection_method') return 'gh-api';
      if (name === 'github_token') return 'fake-token';
      if (name === 'owner') return 'acme';
      if (name === 'repo') return 'nested-repo';
      if (name === 'linguist_exclude_folders') return 'sub';
      return '';
    });
    mockedGithub.getOctokit.mockReturnValue(mockOctokit({ Python: 100 }));

    const { run } = await import('../src/run');
    await run();

    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    expect(mockedCore.warning).toHaveBeenCalledWith(GH_API_EXCLUDE_WARNING);
    expect(JSON.parse(getOutput('languages_codeql'))).toEqual([]);
    expect(mockedCore.warning).toHaveBeenCalledWith(
      'python listed but no matching files found in the checkout — removed from CodeQL analysis'
    );
  });
});

describe('linguist_exclude_folders in gh-api mode without prune', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_WORKSPACE = nestedPyFixture; // only sub/app.py
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'detection_method') return 'gh-api';
      if (name === 'github_token') return 'fake-token';
      if (name === 'owner') return 'acme';
      if (name === 'repo') return 'nested-repo';
      if (name === 'linguist_exclude_folders') return 'sub';
      return '';
    });
    mockedCore.getBooleanInput.mockReturnValue(false); // prune OFF
  });

  test('emits the warning and leaves the API-derived outputs unchanged', async () => {
    mockedGithub.getOctokit.mockReturnValue(mockOctokit({ Python: 100 }));

    const { run } = await import('../src/run');
    await run();

    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    expect(mockedCore.warning).toHaveBeenCalledWith(GH_API_EXCLUDE_WARNING);
    // The aggregated API statistics cannot be filtered: python stays.
    expect(JSON.parse(getOutput('languages_repo'))).toEqual(['python']);
    expect(JSON.parse(getOutput('languages_codeql'))).toEqual(['python']);
    expect(JSON.parse(getOutput('codeql_supported'))).toBe(true);
  });
});
