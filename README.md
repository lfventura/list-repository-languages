# Action

A GitHub [Action](https://docs.github.com/en/actions) that outputs the repository languages and maps them to the CodeQL matrix. Languages are detected either locally from the checkout with [linguist-js](https://www.npmjs.com/package/linguist-js) (default) or via the GitHub [List repository languages](https://docs.github.com/en/rest/repos/repos#list-repository-languages) API.

## ⚠️ Breaking change in v4

- New input `detection_method` defaults to `linguist`: languages are detected from the **local checkout** using linguist-js (same rules/names as GitHub's Linguist, zero GitHub API calls). To keep the exact v3 behavior, set `detection_method: gh-api`.
- `detection_method: linguist` **requires `actions/checkout` to run before this action** (it analyses the working tree).
- Unlike GitHub's Linguist (which treats `.github/` as vendored), linguist mode **counts code under `.github/`** (helper scripts, composite actions), so CodeQL can cover it.
- In linguist mode the `actions` pseudo-language is detected from the filesystem (`.github/workflows/*.yml|yaml`) instead of the Contents API.

### Why the two detection methods can report different language sets

The two `detection_method` values look at different things, so they can legitimately disagree:

- `gh-api` reflects the repository's **default branch**: it returns the Linguist statistics GitHub last computed for that branch. `linguist` analyses the **checked-out ref**. On a pull request that adds or removes a language's files, the two methods diverge until the PR is merged (and GitHub recomputes its stats) — that is expected, not a bug.
- `linguist` mode counts code under `.github/` **by design** (helper scripts, composite actions), while the GitHub API always excludes `.github/` as vendored. A repository whose only shell script lives in `.github/` reports `Shell` in linguist mode but not via `gh-api`.
- `linguist_exclude_folders` can only filter `linguist` detection (and the `prune_undetected_languages` file scan) — it **cannot** affect the aggregated statistics the GitHub `/languages` API returns, so with `gh-api` the language set stays unfiltered (a warning is emitted).

## Repository layout: `dist/` on `main`, written only by the Release workflow

`main` **carries** the compiled `dist/` bundle, but it is generated **exclusively by the [Release workflow](.github/workflows/release.yml)**: each release builds `dist/`, commits it together with the version bump, and pushes that commit to `main` plus the release tag. Pull requests must **not** add or modify `dist/` — the `dist_guard` CI job in [Build & Test](.github/workflows/build_test.yaml) fails any PR that does.

Consequences:

- `dist/` on `main` always corresponds to the **latest release**. Between a source merge and the next release, `dist/` intentionally still reflects the previous release — `@main` behaves like the latest release, not like unreleased source.
- Recommended consumption remains a **pinned release tag or its commit SHA**, e.g. `lfventura/list-repository-languages@v4.0.0`. Pinning `@main` works (it resolves to the latest released `dist/`), but tags give reproducible, auditable upgrades.
- This repository's own CI workflows that self-use the action build it from source first (`npm ci && npm run build`), so they exercise the PR's source rather than the released bundle.

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
      - uses: actions/checkout@v4 # required by detection_method: linguist (the default)
      - uses: lfventura/list-repository-languages@v4.0.0
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
      - uses: lfventura/list-repository-languages@v4.0.0
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
      - uses: lfventura/list-repository-languages@v4.0.0
        id: list-languages
```

## ➡️ Inputs
Various inputs are defined in [`action.yml`](action.yml):

| Name | Description | Default |
| --- | - | - |
| detection_method | How languages are detected. `linguist` analyses the **local checkout** with linguist-js — requires `actions/checkout` to run **before** this action, makes zero GitHub API calls, counts code under `.github/`, and detects the `actions` pseudo-language from `.github/workflows/*.yml\|yaml` on disk. `gh-api` uses the GitHub `/languages` API (exact v3 behavior). Outputs are format-identical between both methods. | linguist |
| linguist_exclude_folders | Comma or newline-separated gitignore-style patterns (e.g. `docs/,examples/**`) excluded from language detection, matched against repo-root-relative paths of the local checkout (requires `actions/checkout` to run **before** this action). Linguist mode only: it filters the per-file linguist results and the `prune_undetected_languages` file scan, but **cannot** filter the aggregated GitHub `/languages` API statistics — with `detection_method: gh-api` a warning is emitted and only the prune scan is filtered. | "" |
| prune_undetected_languages | When `true`, any computed CodeQL language with no matching source file (by extension) in the local checkout is dropped from the CodeQL outputs, with a warning per removal (`codeql_supported` is recomputed). Works with both detection methods, and also filters `force_languages` entries. The file scan skips `linguist_exclude_folders` patterns and any path the **root** `.gitattributes` marks `linguist-vendored`/`linguist-generated` (set or `=true` form; the negated `-linguist-vendored` form is never excluded — nested `.gitattributes` files are not read). Requires `actions/checkout` to run **before** this action. | false |
| github&#x2011;token | Token to use to authorize (used by `detection_method: gh-api`). | ${{&nbsp;github.token&nbsp;}} |
| owner | The repository owner | ${{ github.repository_owner }} |
| repo | The repository name | ${{ github.event.repository.name }} |
| buildvpn_cpp | Indicates if a VPN Connection needs to be established for C++ | false |
| buildvpn_csharp | Indicates if a VPN Connection needs to be established for C# | false |
| buildvpn_go | Indicates if a VPN Connection needs to be established for Go | false |
| buildvpn_javakotlin | Indicates if a VPN Connection needs to be established for Java/Kotlin | false |
| buildvpn_js | Indicates if a VPN Connection needs to be established for JavaScript/TypeScript | false |
| buildvpn_python | Indicates if a VPN Connection needs to be established for Python | false |
| buildvpn_ruby | Indicates if a VPN Connection needs to be established for Ruby | false |
| buildvpn_swift | Indicates if a VPN Connection needs to be established for Swift | false |
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
| buildsetup_cpp | Indicates if the build for CPP projects needs to have any specific setup for CPP. This is useful if you need to trigger for example a setup-language action before running the CodeQL Analysis | ""
| buildsetup_csharp | Indicates if the build for C# projects needs to have any specific setup for C#, comma separated list. This is useful if you need to trigger for example a setup-language action before running the CodeQL Analysis | ""
| buildsetup_go | Indicates if the build for GO projects needs to have any specific setup for GO, comma separated list. This is useful if you need to trigger for example a setup-language action before running the CodeQL Analysis | ""
| buildsetup_javakotlin | Indicates if the build for Java/Kotlin projects needs to have any specific setup for Java, comma separated list. This is useful if you need to trigger for example a setup-language action before running the CodeQL Analysis | ""
| buildsetup_js | Indicates if the build for Javascript/Typescript projects needs to have any specific setup for JavaScript, comma separated list. This is useful if you need to trigger for example a setup-language action before running the CodeQL Analysis | ""
| buildsetup_python | Indicates if the build for Python projects needs to have any specific setup for Python, comma separated list. This is useful if you need to trigger for example a setup-language action before running the CodeQL Analysis | ""
| buildsetup_ruby | Indicates if the build for Ruby projects needs to have any specific setup for Ruby, comma separated list. This is useful if you need to trigger for example a setup-language action before running the CodeQL Analysis | ""
| buildsetup_swift | Indicates if the build for Swift projects needs to have any specific setup for Swift, comma separated list. This is useful if you need to trigger for example a setup-language action before running the CodeQL Analysis | ""

## ⬅️ Outputs
| Name | Description |
| --- | - |
| languages_repo | The languages of the repository as an array |
| languages_codeql | The languages of the repository as an array for CodeQL Matrix without Build Mode set |
| languages_codeql_w_buildmode | The languages of the repository as a JSON array ([{language: string, build-mode: string, manual-build-command: [], vpn-connection: boolean, pre-commands: [], env-vars: {}, setup_language: boolean}]) for CodeQL Matrix with Build Mode set |
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
