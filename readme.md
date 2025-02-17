# 🔥 orchestrator 🔥
![orchestrator](digram.png)

Orchestrator executes all cypress specs across n parallel docker containers based on a configuration file.

## 😎 Orchestrator Tutorial:
1- [Cypress parallelization with the Orchestrator — part 1](https://0xislamtaha.medium.com/cypress-parallelization-with-the-orchestrator-part-1-255989094deb)

2- [Cypress parallelization with the Orchestrator — part 2 — ShowCase](https://0xislamtaha.medium.com/cypress-parallelization-with-the-orchestrator-part-2-showcase-c78202b17c7a)

## 😍 Usecases:
Check the following repo as a public use case.
- [Orchestrator-Public-Use-Case](https://github.com/0xIslamTaha/orchestrator-public-use-case)

## ♟️ Orchestrator mechanism:

* Pares a config file.
* Create (config.parallelizm * config.browsers.length) containers in parallel.
* Recursively list all the specs files 
* Split all the specs across all those machines based on their execution time.
* Collect all the execution json reports from those containers.
* Down all the running containers.
* Generate one HTML report that has all specs execution results.
* Analyse the execution time for each spec.
* Generate the execution time reports per browser under ExecutionTimeReport dir.
* In the next run, The orchestrator will split the test cases based on this execution time report to reduce the execution time.


## 🏹 The Splitting mechanism:
The orchestrator can measure and report the execution time for each spec per browser. It will report it as `mochawesome-report/specsExecutionTime-chrome.json` file. If you provided this path as `specsExecutionTimePath`  in the next run, The orchestrator will split the specs-based on its execution time to minimize the total execution time 🚀. 

## ⌨️ Operating Systems:
- Linux: working out of the box.
- MacOS: please exeucte `brew install coreutils` command.
- Windows 10: fully supported via [WSL](https://docs.microsoft.com/en-us/windows/wsl/install).


## 👌 Installation:
* Install from npm
```bash
npm -g install @0xislamtaha/orchestrator
```

* Install from Github branch
```bash
npm -g install 0xislamtaha/orchestrator
```

## 🔑 Requirements to use orchestrator:
1- docker-compose file with a cypress service. here is an example of it.

```yml

version: '3.8'
services:
  cypress-container:
    image: 0xislamtaha/cypress-snapshot-image:latest
    network_mode: "bridge"
    volumes:
      - ./cypress/:/cypress_testing/cypress
      - ./mochawesome-report:/cypress_testing/mochawesome-report
      - /dev/shm:/dev/shm
```
2- use mochawesome as a reporter in cypress.json, just add the following snippet to your cypress.json.

```json
{
  "reporter": "mochawesome",
  "reporterOptions": {
    "reportDir": "cypress/report/mochawesome-report",
    "overwrite": false,
    "html": false,
    "json": true
  }
}
```

3- Edit the orchestrator [configuration file](/src/orchestrator.json) with your configuration. Here is the description of each configuration option.

```
- parallelizm:
    description: number of container machines per browser
    type: Integer
    example: 2

- browser:
    description: list of browsers
    type: list
    example: ["chrome", "firefox"]

- timeout:
    description: timeout of each process of cypress 
    type: string
    example: "20m"

- environment:
    description: enviroment variable to be exported 
    type: dict
    example: {"DOCKER_TAG": "master_283"}

- preCommands: 
    description: list of commands to be executed befor the deployment of the cypress containers
    type: list
    example: ["ls -al", "mkdir -p test"],

- dockerComposeOptions:
    description: docker-compose options to be passed to the docker-compose commands
    type: dict
    example: {"-p": "project_name"}

- dockerComposePath:
    description: path to the docker compose file.
    type: string
    example: "/opt/code/github/cypress.docker-compose.yml"

- specsHomePath:
    description: path to the specs dir in the host machine.
    type: string
    example: "/opt/code/github/cypress/integration/"

- specsDockerPath:
    description: path to the specs dir in the cypress container.
    type: string
    example: "/cypress/integration"

- cypressContainerName:
    description: the name of cypress service.
    type: sting
    example: "cypress_service"

- mochawesomeJSONPath:
    description: path to the mochawseom dir in the host machine.
    type: string
    example: "mochawesome-report/*.json"

- reportPath:
    description: path to save the generated HTML report dir.
    type: string
    example: "./"

- specs:
    description: array of specific specs to be executed
    type: array
    example: ["test.js", "test2.js"]

- grepTags:
    description: Grep Tags to pass to cypress for filtering tests to run.
    If using - to exclude a tag on the command line use -- before this argument eg. --grepTags -- '-@smoke'
    This value will also be read from the ENV variable CYPRESS_grepTags 
    type: string
    example: "@smoke"

- analyseReport:
    description: boolean value to generate an execution time report. 
    type: boolean
    example: true
    
- executionTimeReportDir:
    description: path to save the generated execution time JSON to.
    type: string
    example: "executionTimeReport"
    
- executionTimeReportJson:
    description: file name to use for the execution time report.
    type: string
    example: "specsExecutionTime.json"

- useCypressEnvJson:
    description: boolean value to pass CYPRESS_ env variables via cypress.env.json.
    Requires adding a volume mapping in docker-compose file for ./cypress.env.json:/cypress_testing/cypress.env.json  
    type: boolean
    example: true

- gh:
    description: Used to generate parallel github action runners. 
    If set to "divide": Generate output only for spawning github job matrix. Does not execute tests.
    If set to "merge": Merge the json report files and generate a mochawesome report. Does not execute tests.
    type: string
    default: ""
    example: "divide" or "merge"

```

## 🎮 Usage:

* With your configuration file
```bash
npx orchestrator --config "/path/to/orchestrator.json"
```

* You can **overwrite** any configuration param on the fly, simply pass the new configuration as a parameter.
```bash
npx orchestrator --config ./src/orchestrator.json --parallelizm 2 --environment '{"DOCKER_TAG":"master_283"}' --browsers "[chrome, firefox]" --specs "[alerts.js, avatar.js]"
```

## 📖 Reports: 

The orchestrator generates two reports by default:
- The HTML report under the `mochawesome-report` dir.
- The execution time reports per browser und `ExecutionTimeReport` dir.

## Silent Mode:
To suppress all log statements set the ENV variable `SILENT=true`.

## 🎬 To-Do:
* list configuration rather than multiple files for multiple test suites.
* Provide --help option.

## License:
The orchestrator is licensed under the MIT license.
