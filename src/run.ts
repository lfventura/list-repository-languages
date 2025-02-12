import * as core from '@actions/core'
import * as github from '@actions/github';

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const token: string = core.getInput('github_token')
    const owner: string = core.getInput('owner')
    const repo: string = core.getInput('repo')

    const codeqlLanguageMapping: { [key: string]: string } = {
      // https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/customizing-your-advanced-setup-for-code-scanning#changing-the-languages-that-are-analyzed
      // https://aka.ms/codeql-docs/language-support
      "c": "c-cpp",
      "c++": "c-cpp",
      "cpp": "c-cpp",
      "csharp": "csharp",
      "go": "go",
      "java": "java-kotlin",
      "kotlin": "java-kotlin",
      "javascript": "javascript-typescript",
      "typescript": "javascript-typescript",
      "python": "python",
      "ruby": "ruby",
      "swift": "swift",
    }
    const octokit: ReturnType<typeof github.getOctokit> = github.getOctokit(token);
    const langResponse = await octokit.request(`GET /repos/${owner}/${repo}/languages`);
    core.debug(JSON.stringify({langResponse}))
    let languages: string[] = Object.keys(langResponse.data);
    let languages_codeql_format = Array.from(new Set(languages.map(l => codeqlLanguageMapping[l.toLowerCase()]).filter(l => l)));
    core.setOutput('languages_repo', JSON.stringify(languages.map(l => l.toLowerCase())));

    let languages_codeql_output = languages_codeql_format.map(language => ({
      language: language,
      "build-mode": "none"
    }));

    core.setOutput('languages_codeql', JSON.stringify(languages_codeql_output));
    core.setOutput('codeql_supported', JSON.stringify(languages_codeql_format.length > 0));

  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
