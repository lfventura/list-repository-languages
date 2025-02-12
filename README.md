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


## ⬅️ Outputs
| Name | Description |
| --- | - |
| languages | The languages of the repository as a JSON array |
| languages_codeql | The languages of the repository as a JSON array for CodeQL Matrix |
| codeql_supported | Bool that indicates if there are supported languages by CodeQL |


## Further help
To get more help on the Actions see [documentation](https://docs.github.com/en/actions).

## Some other useful info

- You can test the module locally:
  - npx local-action . src/run.ts .env
- Easy way to update packages:
  - npm install -g npm-check-updates && ncu && ncu -u
