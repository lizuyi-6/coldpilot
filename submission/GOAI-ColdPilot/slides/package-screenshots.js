const fileSystem = require('node:fs');
const path = require('node:path');
const { assetPaths } = require('./helpers');

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const destinationDirectory = path.resolve(__dirname, '..', '03-Demo截图');

const screenshotFiles = [
  ['01-agent-awaiting-approval.png', assetPaths.approval],
  ['02-agent-tool-trace.png', assetPaths.toolTrace],
  ['03-plan-simulation.png', assetPaths.simulation],
  ['04-l3-blocked.png', assetPaths.l3Blocked],
  ['05-executing.png', assetPaths.executing],
  ['06-verifying.png', path.join(projectRoot, 'frontend', 'acceptance', 'agent-verifying.png')],
  ['07-recovered.png', assetPaths.recovered],
  ['08-realtime-monitoring.png', path.join(projectRoot, 'frontend', 'acceptance', 'final-realtime-1440.png')],
  ['09-reports-audit.png', assetPaths.reports],
];

fileSystem.mkdirSync(destinationDirectory, { recursive: true });
for (const [destinationName, sourcePath] of screenshotFiles) {
  fileSystem.copyFileSync(sourcePath, path.join(destinationDirectory, destinationName));
}

process.stdout.write(`${destinationDirectory}\n`);
