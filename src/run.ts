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
      "go": "autobuild",
      "java-kotlin": "none",
      "javascript-typescript": "none",
      "python": "none",
      "ruby": "none",
      "swift": "none",
    }

    // Control variable to indicate to actions if a VPN Connection needs to be established for the analysis
    const vpnConnection : { [key: string]: boolean } = {
      "c-cpp": core.getBooleanInput('buildvpn_cpp'),
      "c-sharp": core.getBooleanInput('buildvpn_csharp'),
      "go": core.getBooleanInput('buildvpn_go'),
      "java-kotlin": core.getBooleanInput('buildvpn_javakotlin'),
      "javascript-typescript": core.getBooleanInput('buildvpn_js'),
      "python": core.getBooleanInput('buildvpn_python'),
      "ruby": core.getBooleanInput('buildvpn_ruby'),
      "swift": core.getBooleanInput('buildvpn_swift'),
    }

    // If there is an input for the module passing a custom build mode, store on this transitive const
    const customBuildmode : { [key: string]: string } = {
      "c-cpp": core.getInput('buildmode_cpp').toLowerCase(),
      "csharp": core.getInput('buildmode_csharp').toLowerCase(),
      "go": core.getInput('buildmode_go').toLowerCase(),
      "java-kotlin": core.getInput('buildmode_javakotlin').toLowerCase(),
      "javascript-typescript": core.getInput('buildmode_js').toLowerCase(),
      "python": core.getInput('buildmode_python').toLowerCase(),
      "ruby": core.getInput('buildmode_ruby').toLowerCase(),
      "swift": core.getInput('buildmode_swift').toLowerCase(),
    }

    // Languages that should be skipped from the analysis (useful for when a test is running in another tool)
    const skipLanguages : string[] = core.getInput('skip_languages') ? core.getInput('skip_languages').split(',').map(lang => lang.trim().toLowerCase()) : []

    // If there is a custom build mode, update the default build mode mapping
    for (const language in customBuildmode) {
      if (customBuildmode[language] && !skipLanguages.includes(language)) {
        codeqlBuildmodeMapping[language] = customBuildmode[language]
      }
    }

    // If the user set a manual build mode, we are going to need which command should be ran for each language
    // Definining the default manual build mode command
    const defaultBuildModeManualCommand : string = "echo 'When you are running manual build mode, you need to provide the build steps over input buildmode_manual_<lang> to the list-repository-languages module' && exit 1"

    // If there is an input for the module passing a custom manual build mode command, store on this transitive const
    const manualBuildmodeCommand : { [key: string]: string[] } = {
      "c-cpp": core.getInput('buildmode_manual_cpp') ? core.getInput('buildmode_manual_cpp').split('\n').map(cmd => cmd.trim()) : [defaultBuildModeManualCommand],
      "csharp": core.getInput('buildmode_manual_csharp') ? core.getInput('buildmode_manual_csharp').split('\n').map(cmd => cmd.trim()) : [defaultBuildModeManualCommand],
      "go": core.getInput('buildmode_manual_go') ? core.getInput('buildmode_manual_go').split('\n').map(cmd => cmd.trim()) : [defaultBuildModeManualCommand],
      "java-kotlin": core.getInput('buildmode_manual_javakotlin') ? core.getInput('buildmode_manual_javakotlin').split('\n').map(cmd => cmd.trim()) : [defaultBuildModeManualCommand],
      "javascript-typescript": core.getInput('buildmode_manual_js') ? core.getInput('buildmode_manual_js').split('\n').map(cmd => cmd.trim()) : [defaultBuildModeManualCommand],
      "python": core.getInput('buildmode_manual_python') ? core.getInput('buildmode_manual_python').split('\n').map(cmd => cmd.trim()) : [defaultBuildModeManualCommand],
      "ruby": core.getInput('buildmode_manual_ruby') ? core.getInput('buildmode_manual_ruby').split('\n').map(cmd => cmd.trim()) : [defaultBuildModeManualCommand],
      "swift": core.getInput('buildmode_manual_swift') ? core.getInput('buildmode_manual_swift').split('\n').map(cmd => cmd.trim()) : [defaultBuildModeManualCommand],
    }

    // If there is a custom manual build mode command, update the default manual build mode command mapping
    let customManualBuildmodeCommand : { [key: string]: string[] } = {}
    for (const language in customBuildmode) {
      if (customBuildmode[language] == "manual") {
        customManualBuildmodeCommand[language] = manualBuildmodeCommand[language]
      }
    }

    // PreCommands that should be ran before CodeQL analysis
    const preCommands: { [language: string]: string[] } = {
      "c-cpp": core.getInput('precommands_cpp') ? core.getInput('precommands_cpp').split('\n').map(cmd => cmd.trim()) : [],
      "c-sharp": core.getInput('precommands_csharp') ? core.getInput('precommands_csharp').split('\n').map(cmd => cmd.trim()) : [],
      "go": core.getInput('precommands_go') ? core.getInput('precommands_go').split('\n').map(cmd => cmd.trim()) : [],
      "java-kotlin": core.getInput('precommands_javakotlin') ? core.getInput('precommands_javakotlin').split('\n').map(cmd => cmd.trim()) : [],
      "javascript-typescript": core.getInput('precommands_js') ? core.getInput('precommands_js').split('\n').map(cmd => cmd.trim()) : [],
      "python": core.getInput('precommands_python') ? core.getInput('precommands_python').split('\n').map(cmd => cmd.trim()) : [],
      "ruby": core.getInput('precommands_ruby') ? core.getInput('precommands_ruby').split('\n').map(cmd => cmd.trim()) : [],
      "swift": core.getInput('precommands_swift') ? core.getInput('precommands_swift').split('\n').map(cmd => cmd.trim()) : [],
    }

    const buildEnvVars: { [language: string]: { [env_name: string]: string }[] } = {
      "c-cpp": core.getInput('envvars_cpp') ? JSON.parse(core.getInput('envvars_cpp')) : {},
      "csharp": core.getInput('envvars_csharp') ? JSON.parse(core.getInput('envvars_csharp')) : {},
      "go": core.getInput('envvars_go') ? JSON.parse(core.getInput('envvars_go')) : {},
      "java-kotlin": core.getInput('envvars_javakotlin') ? JSON.parse(core.getInput('envvars_javakotlin')) : {},
      "javascript-typescript": core.getInput('envvars_js') ? JSON.parse(core.getInput('envvars_js')) : {},
      "python": core.getInput('envvars_python') ? JSON.parse(core.getInput('envvars_python')) : {},
      "ruby": core.getInput('envvars_ruby') ? JSON.parse(core.getInput('envvars_ruby')) : {},
      "swift": core.getInput('envvars_swift') ? JSON.parse(core.getInput('envvars_swift')) : {},
    };

    const octokit: ReturnType<typeof github.getOctokit> = github.getOctokit(token);
    const langResponse = await octokit.request(`GET /repos/${owner}/${repo}/languages`);
    core.debug(JSON.stringify({langResponse}))
    let languages: string[] = Object.keys(langResponse.data);
    let languages_codeql_format = Array.from(new Set(languages.map(l => codeqlLanguageMapping[l.toLowerCase()]).filter(l => l)));
    let languages_codeql_output = languages_codeql_format.map(language => ({
      language: language,
      "build-mode": codeqlBuildmodeMapping[language],
      "manual-build-command": customManualBuildmodeCommand[language] || "",
      "vpn-connection": vpnConnection[language] || false,
      "pre-commands": preCommands[language] || [],
      "env-vars": buildEnvVars[language] || {}
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
