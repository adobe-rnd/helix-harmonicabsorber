const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const process = require('process');
const fs = require('fs/promises');

const { resolve, dirname, basename } = require('path');
const { mkdir } = fs;
const { isdef, map, exec } = require('ferrum');

/// List of (async) functions to run on regular script exit
const exitHandlers = [];

/// Resolve path and decompose into directory/base
/// String -> [String, String]
const dirfile = (path) => {
  const p = resolve(path);
  return [dirname(p), basename(p)];
};

/// Write file; creating the dir if need be
const writeFile = async (path, cont) => {
  const [dir, file] = dirfile(path);
  await mkdir(dir, { recursive: true });
  await fs.writeFile(path, cont);
};

let chromeInstance = null;
const getChrome = async () => {
  if (!isdef(chromeInstance)) {
    chromeInstance = await chromeLauncher.launch({chromeFlags: ['--headless']});
    exitHandlers.push(() => chromeInstance.kill());
  }
  return chromeInstance;
};

const runLighthouse = async (url, opts = {}) => {
  let {
    outDir = ({finalUrl, fetchTime}) => `${new URL(finalUrl).host}_${fetchTime}`
  } = opts;

  const chrome = await getChrome();

  const { report, lhr } = await lighthouse(url, {
    logLevel: 'info',
    output: 'html',
    onlyCategories: ['performance'],
    port: chrome.port
  });

  outDir = type(outDir) === Function ? outDir(lhs) : outDir;
  await writeFile(`${outDir}/report.json`, JSON.stringify(lhr));
  await writeFile(`${outDir}/report.html`, report);
};

const main = async () => {
  await runLighthouse('https://cupdev.net');
};

const init = async () => {
  try {
    await main(process.argv.slice(2));
    await Promise.all(map(exitHandlers, exec));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

init();