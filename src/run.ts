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

    // Languages that are supported by CodeQL, mapping between the Github API output and the accepted CodeQL Input
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

    // Mapping between the CodeQL languages and the default build mode for CodeQL
    let codeqlBuildmodeMapping: { [key: string]: string } = {
      "c-cpp": "none",
      "csharp": "none",
      "go": "none",
      "java-kotlin": "none",
      "javascript-typescript": "none",
      "python": "none",
      "ruby": "none",
      "swift": "none",
    }

    // If there is an input for the module passing a custom build mode, store on this transitive const
    const customBuildmode : { [key: string]: string } = {
      "c-cpp": core.getInput('buildmode_cpp'),
      "csharp": core.getInput('buildmode_csharp'),
      "go": core.getInput('buildmode_go'),
      "java-kotlin": core.getInput('buildmode_javakotlin'),
      "javascript-typescript": core.getInput('buildmode_js'),
      "python": core.getInput('buildmode_python'),
      "ruby": core.getInput('buildmode_ruby'),
      "swift": core.getInput('buildmode_swift'),
    }

    // If there is a custom build mode, update the default build mode mapping
    for (const language in customBuildmode) {
      if (customBuildmode[language]) {
        codeqlBuildmodeMapping[language] = customBuildmode[language]
      }
    }

    // If the user set a manual build mode, we are going to need which command should be ran for each language
    // Definining the default manual build mode command
    const defaultBuildModeManualCommand : string = "echo 'When you are running manual build mode, you need to provide the build steps over input buildmode_manual_<lang> to the list-repository-languages module' && exit 1"

    // If there is an input for the module passing a custom manual build mode command, store on this transitive const
    const manualBuildmodeCommand : { [key: string]: string } = {
      "c-cpp": core.getInput('buildmode_manual_cpp') || defaultBuildModeManualCommand,
      "csharp": core.getInput('buildmode_manual_csharp') || defaultBuildModeManualCommand,
      "go": core.getInput('buildmode_manual_go') || defaultBuildModeManualCommand,
      "java-kotlin": core.getInput('buildmode_manual_javakotlin') || defaultBuildModeManualCommand,
      "javascript-typescript": core.getInput('buildmode_manual_js') || defaultBuildModeManualCommand,
      "python": core.getInput('buildmode_manual_python') || defaultBuildModeManualCommand,
      "ruby": core.getInput('buildmode_manual_ruby') || defaultBuildModeManualCommand,
      "swift": core.getInput('buildmode_manual_swift') || defaultBuildModeManualCommand,
    }

    const octokit: ReturnType<typeof github.getOctokit> = github.getOctokit(token);
    const langResponse = await octokit.request(`GET /repos/${owner}/${repo}/languages`);
    core.debug(JSON.stringify({langResponse}))
    let languages: string[] = Object.keys(langResponse.data);
    let languages_codeql_format = Array.from(new Set(languages.map(l => codeqlLanguageMapping[l.toLowerCase()]).filter(l => l)));
    let languages_codeql_output = languages_codeql_format.map(language => ({
      language: language,
      "build-mode": codeqlBuildmodeMapping[language],
      "manual-build-command": manualBuildmodeCommand[language]
    }));

    core.setOutput('languages_repo', JSON.stringify(languages.map(l => l.toLowerCase())));
    core.setOutput('languages_codeql', JSON.stringify(languages_codeql_format));
    core.setOutput('languages_codeql_w_buildmode', JSON.stringify(languages_codeql_output));
    core.setOutput('codeql_supported', JSON.stringify(languages_codeql_format.length > 0));

  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
