import * as path from 'path';
import { afterAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as core from '@actions/core';
import * as github from '@actions/github';

jest.mock('@actions/core');
jest.mock('@actions/github');

const mockedCore = core as jest.Mocked<typeof core>;
const mockedGithub = github as jest.Mocked<typeof github>;

const pythonOnlyFixture = path.join(__dirname, 'fixtures', 'python-only');
const originalWorkspace = process.env.GITHUB_WORKSPACE;

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
});
