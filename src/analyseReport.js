//@ts-check

import {
  checkFileIsExisting,
  orderBasedOnBrowserDuration,
  millisToMinutesAndSeconds,
  writeJsonFile,
} from "./helper.js";
import path from "path";


const browsers = ["chrome", "firefox"];
const defaultBrowser = "chrome"; // I will use it in case of there is no browser in the title.
const specs = [];

function getBrowserFromTitle(title) {
  return browsers.find((browser) => title.toLowerCase() === browser);
}

function intiateSpecData(specName) {
  if (!specs.find((spec) => spec.specName === specName)) {
    specs.push({
      specName: specName,
      data: browsers.map((browser) => {
        return { browser: browser, duration: 0 };
      }),
    });
  }
}

function updateSpecData(suites, specName) {
  suites.forEach((suite) => {
    let browser = getBrowserFromTitle(suite["title"]) || defaultBrowser;
    let duration = parseInt(suite["duration"]);

    let spec = specs.find((spec) => spec.specName === specName);
    if (spec)
      spec.data.find((item) => item.browser === browser).duration += duration;
    if (suite.hasOwnProperty("suites")) {
      updateSpecData(suite.suites, specName);
    }
  });
}

export function analyseReport(mochaReportPath) {
  console.log("analyse the json report .... ");

  if (checkFileIsExisting(mochaReportPath)) {
    const reportDir = path.dirname(mochaReportPath);
    const report = require(mochaReportPath);

    report["results"].forEach( result => {
      let specFile = result["file"].split("/").pop();
      let suites = result["suites"];

      intiateSpecData(specFile);
      updateSpecData(suites, specFile);
    });

    for (let browser of browsers) {
      console.log(
        `------------------------- ${browser} -------------------------`
      );
      let data = orderBasedOnBrowserDuration(specs, browser).map((spec) => {
        return {
          specName: spec.specName,
          duration: millisToMinutesAndSeconds(
            spec.data.find((item) => item.browser === browser).duration
          ),
        };
      });
      writeJsonFile(data, reportDir, `specsExecutionTime-${browser}.json`);
      console.table(data);
    }
  }
}
