# Action

A GitHub [Action](https://docs.github.com/en/actions) that outputs the repositories languages using [List repository languages](https://docs.github.com/en/rest/repos/repos#list-repository-languages).

## Usage
Create a workflow (eg: `.github/workflows/seat-count.yml`). See [Creating a Workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

#### Example Basic
Print all the languages as a comma separated list.
```yml
name: Print Languages
on:
  workflow_dispatch:

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: lfventura/list-repository-languages@main
        id: list-languages
      - run: echo ${{ join(fromJSON(steps.list-languages.outputs.languages_repo), ', ') }}
```
#### Example Matrix
Run a a matrix of jobs for each language.
```yml
name: Matrix Language Jobs
on:
  workflow_dispatch:

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: lfventura/list-repository-languages@main
        id: list-languages
    outputs:
      languages_codeql: ${{ steps.list-languages.outputs.languages_codeql }}

  print:
    needs: [run]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: ${{ fromJSON(needs.run.outputs.languages_codeql) }}
    steps:
      - run: echo ${{ matrix.language }}
```
### CodeQL
You can use the output `languages_codeql` to map languages to codeql supported languages. [example](https://github.com/lfventura/.github/blob/main/.github/workflows/codeql.yml).
```yml
      - uses: lfventura/list-repository-languages@main
        id: list-languages
```

## ➡️ Inputs
Various inputs are defined in [`action.yml`](action.yml):

| Name | Description | Default |
| --- | - | - |
| github&#x2011;token | Token to use to authorize. | ${{&nbsp;github.token&nbsp;}} |
| owner | The repository owner | ${{ github.repository_owner }} |
| repo | The repository name | ${{ github.event.repository.name }} |
| buildvpn_cpp | Indicates if a VPN Connection needs to be established for C++ | none |
| buildvpn_csharp | Indicates if a VPN Connection needs to be established for C# | none |
| buildvpn_go | Indicates if a VPN Connection needs to be established for Go | none |
| buildvpn_javakotlin | Indicates if a VPN Connection needs to be established for Java/Kotlin | none |
| buildvpn_js | Indicates if a VPN Connection needs to be established for JavaScript/TypeScript | none |
| buildvpn_python | Indicates if a VPN Connection needs to be established for Python | none |
| buildvpn_ruby | Indicates if a VPN Connection needs to be established for Ruby | none |
| buildvpn_swift | Indicates if a VPN Connection needs to be established for Swift | none |
| buildmode_cpp | Custom build mode for C++ | none |
| buildmode_csharp | Custom build mode for C# | none |
| buildmode_go | Custom build mode for Go | none |
| buildmode_javakotlin | Custom build mode for Java/Kotlin | none |
| buildmode_js | Custom build mode for JavaScript/TypeScript | none |
| buildmode_python | Custom build mode for Python | none |
| buildmode_ruby | Custom build mode for Ruby | none |
| buildmode_swift | Custom build mode for Swift | none |
| buildmode_manual_cpp | Build command to be run when manual build mode set for C++ | none |
| buildmode_manual_csharp | Build command to be run when manual build mode set for C# | none |
| buildmode_manual_go | Build command to be run when manual build mode set for Go | none |
| buildmode_manual_javakotlin | Build command to be run when manual build mode set for Java/Kotlin | none |
| buildmode_manual_js | Build command to be run when manual build mode set for JavaScript/TypeScript | none |
| buildmode_manual_python | Build command to be run when manual build mode set for Python | none |
| buildmode_manual_ruby | Build command to be run when manual build mode set for Ruby | none |
| buildmode_manual_swift | Build command to be run when manual build mode set for Swift | none |
| precommands_cpp | Commands that needs to be run before CodeQL Analysis for CPP | none |
| precommands_csharp | Commands that needs to be run before CodeQL Analysis for CPP | none |
| precommands_go | Commands that needs to be run before CodeQL Analysis for CPP | none |
| precommands_javakotlin | Commands that needs to be run before CodeQL Analysis for CPP | none |
| precommands_js | Commands that needs to be run before CodeQL Analysis for CPP | none |
| precommands_python | Commands that needs to be run before CodeQL Analysis for CPP | none |
| precommands_ruby | Commands that needs to be run before CodeQL Analysis for CPP | none |
| precommands_swift | Commands that needs to be run before CodeQL Analysis for CPP | none |
| envvars_cpp | Env vars in a JSON format with the variables that should be used for build | {} |
| envvars_csharp | Env vars in a JSON format with the variables that should be used for build | {} | 
| envvars_go | Env vars in a JSON format with the variables that should be used for build | {} | 
| envvars_javakotlin | Env vars in a JSON format with the variables that should be used for build | {} | 
| envvars_js | Env vars in a JSON format with the variables that should be used for build | {} | 
| envvars_python | Env vars in a JSON format with the variables that should be used for build | {} | 
| envvars_ruby | Env vars in a JSON format with the variables that should be used for build | {} | 
| envvars_swift | Env vars in a JSON format with the variables that should be used for build | {} |
| skip_languages | The languages to skip when building the languages map, comma separated list. Useful if the test for a specific language is running on another tool | none |

## ⬅️ Outputs
| Name | Description |
| --- | - |
| languages_repo | The languages of the repository as an array |
| languages_codeql | The languages of the repository as an array for CodeQL Matrix without Build Mode set |
| languages_codeql_w_buildmode | The languages of the repository as a JSON array ([{language: string, build-mode: string, manual-build-command: [], vpn-connection: boolean, pre-commands: [], env-vars: {}}]) for CodeQL Matrix with Build Mode set |
| codeql_supported | Bool that indicates if there are supported languages by CodeQL |
| skip_languages | The languages that were skipped when building the languages map

## Examples

Check .github/workflow folder for some examples on how to use.

## Further help
To get more help on the Actions see [documentation](https://docs.github.com/en/actions).

## Some other useful info

- You can test the module locally:
  - npx local-action . src/run.ts .env
- Easy way to update packages:
  - npm install -g npm-check-updates && ncu && ncu -u
