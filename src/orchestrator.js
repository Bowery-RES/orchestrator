//@ts-check
import sh from "shelljs";
import marge from "mochawesome-report-generator";
import {merge} from "mochawesome-merge";
import fs from "fs";
import arg from "arg";
import path from "path";
import {analyseReport} from "./analyseReport";
import {checkFileIsExisting, orderBasedOnBrowserDuration, parseJsonFile,} from "./helper.js";
import * as lg from "./logger";
import {checkRequirements} from "./checker";

const executionTimeReportDir = "executionTimeReport";
const executionTimeReportDirPath = path.resolve(
  process.cwd(),
  executionTimeReportDir
);
const executionTimeReportJson = "specsExecutionTime.json";
const executionTimeReportJsonPath = path.join(
  executionTimeReportDirPath,
  executionTimeReportJson
);

function execa(command, flag = true) {
  return new Promise((resolve, reject) =>
    sh.exec(command, function (code, stdout, stderr) {
      if (code !== 0) {
        if (
          flag &&
          stdout
            .concat(stderr)
            .toLowerCase()
            .includes("cypress failed to make a connection to firefox")
        ) {
          const oldContName = command.split("--name ")[1].split(" ")[0];
          const newContName = `${oldContName}_${Math.floor(
            Math.random() * 100000
          )}`;
          const cmd = command.replace(oldContName, newContName);
          setTimeout(() => execa(cmd, false), 1000);
        } else {
          return reject(code);
        }
      } else {
        return resolve(code);
      }
    })
  );
}

function parseArgumentsIntoConfig(rawArgs) {
  const args = arg(
    {
      "--config": String,
      "-c": "--config",
    },
    {
      argv: rawArgs.slice(2),
      permissive: true,
    }
  );
  const result = {};
  for (let i = 0; i < args["_"].length; i += 2) {
    const key = args["_"][i].replace("--", "");
    let variable = args["_"][i + 1];
    if (variable.includes("{")) {
      variable = JSON.parse(variable);
    } else if (variable.includes("[")) {
      variable = variable
        .replace("[", "")
        .replace("]", "")
        .replace(", ", ",")
        .replace(/["']/g, "")
        .split(",");
    }
    result[key] = variable;
  }
  return { ...result, ...args };
}

function overWriteConfig(args) {
  lg.step("Overwrite the config file with the arguments if there is any", true);
  const configFile = args["--config"] || path.resolve(__dirname, "orchestrator.json");
  const defaultConfig = JSON.parse(fs.readFileSync(configFile, {encoding:'utf8', flag:'r'}));
  return {
    "parallelizm": 1,
    "timeout": "",
    "browsers": [],
    "environment": {},
    "preCommands": [],
    "dockerComposeOptions": {},
    "dockerComposePath": "",
    "specsHomePath": "",
    "specsDockerPath": "",
    "cypressContainerName": "",
    "mochawesomeJSONPath": "",
    "reportPath": "",
    "specs": [],
    "analyseReport": false,
    "specsExecutionTimePath": "",
    ...defaultConfig,
    ...args
  };
}

function setEnvVars(config) {
  lg.step("Export the environment variables");
  Object.keys(config.environment).forEach((key) => {
    const value = config.environment[key];
    sh.env[key] = value;
    lg.subStep(`${key}=${value}`);
  });
}

function execPreCommands(config) {
  lg.step("Execute the pre commands", true);
  config.preCommands.forEach((command) => {
    lg.subStep(`~$ ${command}`);
    sh.exec(command);
  });
}

function extractDockerComposeOptions(config) {
  let dockerComposeOptions = "";
  Object.keys(config.dockerComposeOptions).forEach((option) => {
   dockerComposeOptions = `${dockerComposeOptions} ${option} ${config.dockerComposeOptions[option]}`;
  });
  return dockerComposeOptions;
}

function getListOfSpecs(config, browser) {
  let existingSpecs = [];

  if (config.specs.length > 0) {
    existingSpecs = [...config.specs];
  } else {
    existingSpecs = sh
      .ls("-R", config.specsHomePath)
      .filter((val) => val.match(/.*ts|js/));
  }

  if (checkFileIsExisting(executionTimeReportJsonPath)) {
    const specsExecutionTime = parseJsonFile(executionTimeReportJsonPath);
    const browserSpecs = orderBasedOnBrowserDuration(
      specsExecutionTime,
      browser
    ).map((item) => item.specName);

    const specs = [
      ...browserSpecs.filter((spec) => existingSpecs.includes(spec)),
      ...existingSpecs.filter((item) => !specs.includes(item)),
    ];

    return specs;
  } else {
    return existingSpecs;
  }
}

function removeEmpty(arrays) {
  const results = [];
  arrays.forEach((array) => {
    if (array.length > 0) results.push(array.filter((item) => item !== ""));
  });
  return results;
}

function splitSpecsOverMachines(specs, config) {
  const noOfMachines = config.parallelizm * config.browsers.length;
  const specsForMachines = [];

  for (let i = 0; i < noOfMachines; i++) {
    specsForMachines.push([]); // [ [], [], [] ..]
  }

  let _cycles = 0;
  while (specs.length > 0) {
    for (let i = 0; i < noOfMachines; i++) {
      if (specs.length === 0) break;
      _cycles % 2
        ? specsForMachines[i].push(specs.pop())
        : specsForMachines[i].push(specs.shift());
    }
    _cycles++;
  }

  return removeEmpty(specsForMachines);
}

function generateSpecsCommandsForMachines(config, browser) {
  const specsCommandsOverMachines = [];

  const specs = getListOfSpecs(config, browser);
  const listOfSpecsOverMachines = splitSpecsOverMachines(specs, config);

  listOfSpecsOverMachines.forEach((listOfSpecsPerMachine) => {
    let result = "";
    listOfSpecsPerMachine.forEach((spec) => {
      const specPath = path.join(config.specsDockerPath, spec);
      result = `${result},${specPath.replace(/\\/g, "/")}`;
    });
    specsCommandsOverMachines.push(result.slice(1));
  });

  return specsCommandsOverMachines;
}

function generateSpecsCommandsOverMachinesOrderedByBrowsers(config) {
  const specsCommandsOverMachinesOrderedByBrowsers = {}; // {'chrome': [ [] , [] , []], 'firefox': [[], [], []]}

  config.browsers.forEach((browser) => {
    specsCommandsOverMachinesOrderedByBrowsers[browser] =
      generateSpecsCommandsForMachines(config, browser);
  });

  return specsCommandsOverMachinesOrderedByBrowsers;
}

function _constructCypressCommands(config) {
  const bashCommands = [];
  const specsCommandsOverMachinesOrderedByBrowsers =
    generateSpecsCommandsOverMachinesOrderedByBrowsers(config);
  const _noOfMachines =
    specsCommandsOverMachinesOrderedByBrowsers[config.browsers[0]].length;

  for (let i = 0; i < _noOfMachines; i++) {
    let bashCommand = "exit_code=0";

    const _browsers = i % 2 ? config.browsers : config.browsers.reverse();
    _browsers.forEach((browser) => {
      bashCommand = `${bashCommand}; npx cypress run -b ${browser} --headless --spec ${specsCommandsOverMachinesOrderedByBrowsers[browser][i]} || exit_code=$? ; pkill -9 cypress`;
    });

    bashCommand = `${bashCommand} ; exit $exit_code`;
    bashCommands.push(bashCommand);
  }
  return bashCommands;
}

function upContainers(config) {
  const promises = [];
  const bashCommands = _constructCypressCommands(config);
  const dockerComposeOptions = extractDockerComposeOptions(config);
  const container_name = `${config.cypressContainerName}_${Math.floor(
      Math.random() * 100000
  )}`;

  lg.step("Build the cypress containers", true);
  const buildCmd = `docker-compose ${dockerComposeOptions} -f ${config.dockerComposePath} build ${config.cypressContainerName}`;
  lg.subStep(`~$ ${buildCmd}`);
  const {code, stdout, stderr} = sh.exec(buildCmd, { silent:true });
  lg.subStep(stdout)
  if (code !== 0) {
    lg.subStep(`Error building docker container with docker-compose.\n${stderr}`);
    sh.exit(code);
    return promises
  }

  lg.step("Start the cypress containers", true);

  bashCommands.forEach((cmd, index) => {
    const command = `timeout --preserve-status ${config.timeout} docker-compose ${dockerComposeOptions} -f ${config.dockerComposePath} run --name ${container_name}__${index} ${config.cypressContainerName} bash -c '${cmd}'`;
    lg.subStep(`~$ ${command}`);
    promises.push(execa(command));
  });

  return promises;
}

function downContainers(config) {
  const dockerComposeOptions = extractDockerComposeOptions(config);
  lg.step("Stop the cypress containers", true);
  const dockerComposeDown = `docker-compose ${dockerComposeOptions} -f ${config.dockerComposePath} down`;
  sh.exec(dockerComposeDown);
}

async function generateReport(config) {
  lg.step("Generate the reports", true);
  const report = await merge({ files: [config.mochawesomeJSONPath] })
  lg.subStep(`HTML report: ${config.reportPath}/mochawesome.html`);
  await marge.create(report, {
    reportDir: config.reportPath,
    charts: true,
    saveJson: true,
  });
  if (config.analyseReport) {
    if (!fs.existsSync(executionTimeReportDirPath)) {
      sh.mkdir(executionTimeReportDirPath);
    }
    lg.subStep(
        `Execution time report: ${executionTimeReportDir}/${executionTimeReportJson}`
    );
    _analyseReport(config);
  }
  return true
}

function _analyseReport(config) {
  let mergedMochawesomeJSONPath;
  if (config.reportPath.includes(process.cwd())) {
    mergedMochawesomeJSONPath = path.resolve(
      process.cwd(),
      config.reportPath,
      "mochawesome.json"
    );
  } else {
    mergedMochawesomeJSONPath = path.resolve(
      config.reportPath,
      "mochawesome.json"
    );
  }

  analyseReport(mergedMochawesomeJSONPath, executionTimeReportJsonPath);
}

async function afterPromises(config, timer) {
  downContainers(config);
  await generateReport(config)
  console.timeEnd(timer);
}

export async function orchestrator(rawArgs) {
  lg.banner();
  checkRequirements();

  const orchestratorTime = "\n[*] Total execution time";
  const config = overWriteConfig(parseArgumentsIntoConfig(rawArgs));

  console.time(orchestratorTime);
  setEnvVars(config);
  execPreCommands(config);

  Promise.allSettled(upContainers(config)).then(async (promises) => {
    await afterPromises(config, orchestratorTime);
    const failedPromises = promises.filter(
      (promise) => promise.status === "rejected"
    );
    if (failedPromises.length) {
      setTimeout(() => {
        lg.step("Exit code: 1");
        sh.exit(1);
      }, 5000);
    }
  });
}
