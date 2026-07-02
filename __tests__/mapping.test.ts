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

  test('force_languages injects a language the /languages API does not report', async () => {
    // Empty /languages payload — nothing is detected.
    mockedGithub.getOctokit.mockReturnValue(mockOctokit({}));
    // Force swift, and configure a manual build mode + command for it so we can
    // assert the forced entry carries the SAME build config as a detected one.
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'fake-token';
      if (name === 'owner') return 'acme';
      if (name === 'repo') return 'ios-app';
      if (name === 'force_languages') return 'swift';
      if (name === 'buildmode_swift') return 'manual';
      if (name === 'buildmode_manual_swift') return 'xcodebuild build';
      return '';
    });

    const { run } = await import('../src/run');
    await run();

    const codeqlOutput = mockedCore.setOutput.mock.calls.find(
      ([name]) => name === 'languages_codeql'
    );
    expect(JSON.parse(codeqlOutput![1] as string)).toContain('swift');

    const supported = mockedCore.setOutput.mock.calls.find(
      ([name]) => name === 'codeql_supported'
    );
    expect(JSON.parse(supported![1] as string)).toBe(true);

    const withBuildmode = mockedCore.setOutput.mock.calls.find(
      ([name]) => name === 'languages_codeql_w_buildmode'
    );
    const swiftEntry = JSON.parse(withBuildmode![1] as string).find(
      (e: { language: string }) => e.language === 'swift'
    );
    expect(swiftEntry).toBeDefined();
    expect(swiftEntry['build-mode']).toBe('manual');
    expect(swiftEntry['manual-build-command']).toEqual(['xcodebuild build']);
  });

  test('an invalid force_languages value throws (via setFailed)', async () => {
    mockedGithub.getOctokit.mockReturnValue(mockOctokit({}));
    mockedCore.getInput.mockImplementation((name: string) => {
      if (name === 'github_token') return 'fake-token';
      if (name === 'owner') return 'acme';
      if (name === 'repo') return 'ios-app';
      if (name === 'force_languages') return 'cobol';
      return '';
    });

    const { run } = await import('../src/run');
    await run();

    expect(mockedCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Invalid language cobol in force_languages input')
    );
  });
});
