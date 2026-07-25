const fileSystem = require('node:fs');
const path = require('node:path');
const { createPresentation, theme } = require('./helpers');

const presentation = createPresentation();

for (let slideIndex = 1; slideIndex <= 11; slideIndex += 1) {
  const slideNumber = String(slideIndex).padStart(2, '0');
  const slideModule = require(`./slide-${slideNumber}.js`);
  slideModule.createSlide(presentation, theme);
}

const outputDirectory = path.resolve(__dirname, '..');
fileSystem.mkdirSync(outputDirectory, { recursive: true });
const outputFile = path.join(outputDirectory, '02-ColdPilot-GOAI-Preliminary.pptx');

async function writePresentation() {
  await presentation.writeFile({ fileName: outputFile });
  process.stdout.write(`${outputFile}\n`);
}

writePresentation().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
