import * as path from 'path';
import { afterAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as core from '@actions/core';
import * as github from '@actions/github';

jest.mock('@actions/core');
jest.mock('@actions/github');
// linguist-js is ESM-only (unloadable inside jest's CJS runtime) — the real
// detection is covered by linguist.integration.test.ts via a child process.
// Here it is mocked so the FULL downstream pipeline (mapping/force/skip/html,
// outputs) runs for real in linguist mode.
jest.mock('../src/linguist', () => ({ detectLocalLanguages: jest.fn() }));

import { detectLocalLanguages } from '../src/linguist';

const mockedCore = core as jest.Mocked<typeof core>;
const mockedGithub = github as jest.Mocked<typeof github>;
const mockedDetect = detectLocalLanguages as jest.MockedFunction<typeof detectLocalLanguages>;

const langRepoFixture = path.join(__dirname, 'fixtures', 'lang-repo');
const pythonOnlyFixture = path.join(__dirname, 'fixtures', 'python-only');
const originalWorkspace = process.env.GITHUB_WORKSPACE;

function mockInputs(inputs: { [name: string]: string }) {
  mockedCore.getInput.mockImplementation((name: string) => inputs[name] ?? '');
}

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

function collectOutputs(): { [name: string]: string } {
  const outputs: { [name: string]: string } = {};
  for (const [name, value] of mockedCore.setOutput.mock.calls) {
    outputs[name as string] = value as string;
  }
  return outputs;
}

afterAll(() => {
  if (originalWorkspace === undefined) delete process.env.GITHUB_WORKSPACE;
  else process.env.GITHUB_WORKSPACE = originalWorkspace;
});

describe('detection_method: linguist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCore.getBooleanInput.mockReturnValue(false);
  });

  test('produces outputs identical to gh-api for the same language data, with zero API calls', async () => {
    const languageBytes = { Python: 1200, HTML: 300 };
    const { run } = await import('../src/run');

    // linguist mode — fixture without workflows so `actions` stays out on both paths
    process.env.GITHUB_WORKSPACE = pythonOnlyFixture;
    mockInputs({ detection_method: 'linguist' });
    mockedDetect.mockResolvedValue(languageBytes);
    await run();
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    const linguistOutputs = collectOutputs();
    expect(mockedGithub.getOctokit).not.toHaveBeenCalled();
    expect(mockedDetect).toHaveBeenCalledWith(pythonOnlyFixture, []);

    jest.clearAllMocks();
    mockedCore.getBooleanInput.mockReturnValue(false);

    // gh-api mode — same language data served by the mocked /languages API
    mockInputs({ detection_method: 'gh-api', github_token: 't', owner: 'acme', repo: 'r' });
    mockedGithub.getOctokit.mockReturnValue(mockOctokit(languageBytes));
    await run();
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    const ghApiOutputs = collectOutputs();

    expect(linguistOutputs).toEqual(ghApiOutputs);
    expect(JSON.parse(linguistOutputs['languages_repo'])).toEqual(['python', 'html']);
    expect(JSON.parse(linguistOutputs['languages_codeql'])).toEqual([
      'python',
      'javascript-typescript',
    ]);
    expect(JSON.parse(linguistOutputs['codeql_supported'])).toBe(true);
  });

  test('detects the actions pseudo-language from .github/workflows on the filesystem', async () => {
    process.env.GITHUB_WORKSPACE = langRepoFixture; // has .github/workflows/ci.yml
    mockInputs({ detection_method: 'linguist' });
    mockedDetect.mockResolvedValue({});

    const { run } = await import('../src/run');
    await run();

    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    const outputs = collectOutputs();
    expect(JSON.parse(outputs['languages_repo'])).toEqual(['actions']);
    expect(JSON.parse(outputs['languages_codeql'])).toEqual(['actions']);
    expect(mockedGithub.getOctokit).not.toHaveBeenCalled();
  });

  test('prune drops a linguist-detected language with no matching files', async () => {
    process.env.GITHUB_WORKSPACE = pythonOnlyFixture;
    mockInputs({ detection_method: 'linguist' });
    mockedCore.getBooleanInput.mockImplementation(
      (name: string) => name === 'prune_undetected_languages'
    );
    mockedDetect.mockResolvedValue({ Python: 10, Go: 20 });

    const { run } = await import('../src/run');
    await run();

    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    const outputs = collectOutputs();
    expect(JSON.parse(outputs['languages_codeql'])).toEqual(['python']);
    expect(mockedCore.warning).toHaveBeenCalledWith(
      'go listed but no matching files found in the checkout — removed from CodeQL analysis'
    );
  });

  test('linguist_exclude_folders is parsed and forwarded to detection, without the gh-api warning', async () => {
    // The real per-file filtering is covered by linguist.integration.test.ts
    // (detectLocalLanguages is mocked here); this test pins the run.ts wiring:
    // comma/newline parsing + pass-through to detectLocalLanguages.
    process.env.GITHUB_WORKSPACE = pythonOnlyFixture;
    mockInputs({
      detection_method: 'linguist',
      linguist_exclude_folders: ' docs/ ,examples/**\nvendor',
    });
    mockedDetect.mockResolvedValue({ Python: 10 });

    const { run } = await import('../src/run');
    await run();

    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    expect(mockedDetect).toHaveBeenCalledWith(pythonOnlyFixture, [
      'docs/',
      'examples/**',
      'vendor',
    ]);
    // The gh-api-only warning must not fire in linguist mode.
    expect(mockedCore.warning).not.toHaveBeenCalled();
  });

  test('an invalid detection_method fails the action', async () => {
    mockInputs({ detection_method: 'clairvoyance' });

    const { run } = await import('../src/run');
    await run();

    expect(mockedCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Invalid detection_method clairvoyance')
    );
  });
});
