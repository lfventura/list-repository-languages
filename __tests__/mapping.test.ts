import { describe, expect, jest, test, beforeEach } from '@jest/globals';
import * as core from '@actions/core';
import * as github from '@actions/github';

jest.mock('@actions/core');
jest.mock('@actions/github');

const mockedCore = core as jest.Mocked<typeof core>;
const mockedGithub = github as jest.Mocked<typeof github>;

/**
 * Builds a mocked octokit that returns the given /languages payload and
 * reports no .github/workflows directory.
 */
function mockOctokit(languagesData: { [lang: string]: number }) {
  const request = jest.fn(async () => ({ data: languagesData }));
  const getContent = jest.fn(async () => {
    throw new Error('Not Found');
  });
  return {
    request,
    rest: { repos: { getContent } },
  } as unknown as ReturnType<typeof github.getOctokit>;
}

describe('codeqlLanguageMapping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // All getInput / getBooleanInput calls return empty/false by default.
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'fake-token';
      if (name === 'owner') return 'acme';
      if (name === 'repo') return 'static-site';
      return '';
    });
    mockedCore.getBooleanInput.mockReturnValue(false);
  });

  test('maps HTML to javascript-typescript', async () => {
    mockedGithub.getOctokit.mockReturnValue(mockOctokit({ HTML: 1000 }));

    const { run } = await import('../src/run');
    await run();

    const codeqlOutput = mockedCore.setOutput.mock.calls.find(
      ([name]) => name === 'languages_codeql'
    );
    expect(codeqlOutput).toBeDefined();
    expect(JSON.parse(codeqlOutput![1] as string)).toContain('javascript-typescript');

    const supported = mockedCore.setOutput.mock.calls.find(
      ([name]) => name === 'codeql_supported'
    );
    expect(JSON.parse(supported![1] as string)).toBe(true);
  });

  test('a pure-HTML repo is CodeQL-supported via the html mapping', async () => {
    mockedGithub.getOctokit.mockReturnValue(mockOctokit({ HTML: 500, CSS: 50 }));

    const { run } = await import('../src/run');
    await run();

    const codeqlOutput = mockedCore.setOutput.mock.calls.find(
      ([name]) => name === 'languages_codeql'
    );
    // CSS has no CodeQL language and is dropped; HTML yields javascript-typescript.
    expect(JSON.parse(codeqlOutput![1] as string)).toEqual(['javascript-typescript']);
  });
});
