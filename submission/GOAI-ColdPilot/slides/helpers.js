const childProcess = require('node:child_process');
const fileSystem = require('node:fs');
const path = require('node:path');

const SLIDE_WIDTH = 10;
const SLIDE_HEIGHT = 5.625;

const palette = {
  black: '0A0A0A',
  darkGray: '404040',
  gray: '737373',
  softGray: 'A3A3A3',
  border: 'D4D4D4',
  divider: 'EBEBEB',
  surface: 'F5F5F5',
  white: 'FFFFFF',
  blue: '0070F3',
  deepBlue: '003F80',
  paleBlue: 'E0EFFF',
  gold: 'D4AF37',
  deepGold: '7C651E',
  paleGold: 'FEF9E7',
};

const theme = {
  primary: palette.black,
  secondary: palette.darkGray,
  accent: palette.blue,
  light: palette.gold,
  bg: palette.white,
};

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const assetPaths = {
  logo: path.join(projectRoot, 'frontend', 'public', 'logo.png'),
  approval: path.join(projectRoot, 'frontend', 'acceptance', 'agent-awaiting-approval.png'),
  toolTrace: path.join(projectRoot, 'frontend', 'docs', 'screenshots', 'verify-agent-trend.png'),
  simulation: path.join(projectRoot, 'frontend', 'acceptance', 'final-simulation-1440.png'),
  l3Blocked: path.join(projectRoot, 'frontend', 'acceptance', 'agent-l3-blocked.png'),
  executing: path.join(projectRoot, 'frontend', 'acceptance', 'agent-executing.png'),
  recovered: path.join(projectRoot, 'frontend', 'acceptance', 'agent-recovered.png'),
  reports: path.join(projectRoot, 'frontend', 'acceptance', 'final-reports-1440.png'),
};

function loadPptxGenJs() {
  try {
    return require('pptxgenjs');
  } catch (localError) {
    const globalNodeModules = childProcess.execSync('npm root -g', {
      encoding: 'utf8',
      shell: true,
    }).trim();
    return require(path.join(globalNodeModules, 'pptxgenjs'));
  }
}

function createPresentation() {
  const PptxGenJS = loadPptxGenJs();
  const presentation = new PptxGenJS();
  presentation.layout = 'LAYOUT_16x9';
  presentation.author = '鲜知 ColdPilot 项目团队';
  presentation.company = '鲜知 ColdPilot';
  presentation.subject = 'GOAI 世界人工智能开源大赛初赛方案';
  presentation.title = '鲜知 ColdPilot：果蔬冷库安全可控工业 Agent';
  presentation.lang = 'zh-CN';
  presentation.theme = {
    headFontFace: 'Microsoft YaHei',
    bodyFontFace: 'Microsoft YaHei',
    lang: 'zh-CN',
  };
  presentation.defineSlideMaster({
    title: 'COLDPILOT_MASTER',
    background: { color: palette.white },
    objects: [],
    slideNumber: { x: 9.3, y: 5.1, w: 0.4, h: 0.3, color: palette.white },
  });
  return presentation;
}

function addTitle(presentation, slide, title, kicker) {
  if (kicker) {
    slide.addText(kicker, {
      x: 0.48,
      y: 0.28,
      w: 2.8,
      h: 0.22,
      fontFace: 'Arial',
      fontSize: 9,
      bold: true,
      color: palette.blue,
      charSpacing: 1.2,
      margin: 0,
    });
  }
  slide.addText(title, {
    x: 0.48,
    y: 0.55,
    w: 8.75,
    h: 0.48,
    fontFace: 'Microsoft YaHei',
    fontSize: 25,
    bold: true,
    color: palette.black,
    margin: 0,
    fit: 'shrink',
  });
}

function addPageNumber(presentation, slide, pageNumber) {
  slide.addShape(presentation.ShapeType.ellipse, {
    x: 9.3,
    y: 5.1,
    w: 0.36,
    h: 0.36,
    line: { color: palette.blue, transparency: 100 },
    fill: { color: palette.blue },
  });
  slide.addText(String(pageNumber).padStart(2, '0'), {
    x: 9.3,
    y: 5.1,
    w: 0.36,
    h: 0.36,
    fontFace: 'Arial',
    fontSize: 9,
    bold: true,
    color: palette.white,
    align: 'center',
    valign: 'mid',
    margin: 0,
  });
}

function addFooter(slide, text = '来源：当前仓库源码与真实浏览器截图；业务数值均为演示或仿真结果') {
  slide.addText(text, {
    x: 0.48,
    y: 5.25,
    w: 8.45,
    h: 0.16,
    fontFace: 'Microsoft YaHei',
    fontSize: 6.5,
    color: palette.gray,
    margin: 0,
    fit: 'shrink',
  });
}

function addCard(presentation, slide, options) {
  const {
    x,
    y,
    w,
    h,
    fill = palette.white,
    line = palette.divider,
    radius = true,
  } = options;
  slide.addShape(radius ? presentation.ShapeType.roundRect : presentation.ShapeType.rect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    line: { color: line, width: 0.7 },
    fill: { color: fill },
  });
}

function addTag(presentation, slide, text, options) {
  const {
    x,
    y,
    w,
    fill = palette.paleBlue,
    color = palette.deepBlue,
    line = fill,
  } = options;
  slide.addShape(presentation.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.27,
    rectRadius: 0.12,
    line: { color: line, width: 0.5 },
    fill: { color: fill },
  });
  slide.addText(text, {
    x,
    y: y + 0.01,
    w,
    h: 0.23,
    fontFace: 'Microsoft YaHei',
    fontSize: 7.5,
    bold: true,
    color,
    align: 'center',
    valign: 'mid',
    margin: 0,
    fit: 'shrink',
  });
}

function addMetricCard(presentation, slide, options) {
  const { x, y, w, h, value, label, note, accent = palette.blue } = options;
  addCard(presentation, slide, { x, y, w, h, fill: palette.white });
  slide.addShape(presentation.ShapeType.rect, {
    x,
    y,
    w: 0.05,
    h,
    line: { color: accent, transparency: 100 },
    fill: { color: accent },
  });
  slide.addText(value, {
    x: x + 0.18,
    y: y + 0.13,
    w: w - 0.3,
    h: 0.48,
    fontFace: 'Arial',
    fontSize: 24,
    bold: true,
    color: palette.black,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText(label, {
    x: x + 0.18,
    y: y + 0.68,
    w: w - 0.3,
    h: 0.22,
    fontFace: 'Microsoft YaHei',
    fontSize: 9.5,
    bold: true,
    color: palette.darkGray,
    margin: 0,
  });
  if (note) {
    slide.addText(note, {
      x: x + 0.18,
      y: y + 0.94,
      w: w - 0.3,
      h: h - 1.05,
      fontFace: 'Microsoft YaHei',
      fontSize: 7,
      color: palette.gray,
      margin: 0,
      breakLine: false,
      fit: 'shrink',
    });
  }
}

function readPngDimensions(imagePath) {
  const imageBuffer = fileSystem.readFileSync(imagePath);
  const pngSignature = imageBuffer.toString('hex', 0, 8);
  if (pngSignature !== '89504e470d0a1a0a') {
    throw new Error(`Only PNG assets are supported by this helper: ${imagePath}`);
  }
  return {
    width: imageBuffer.readUInt32BE(16),
    height: imageBuffer.readUInt32BE(20),
  };
}

function imageSizingContain(imagePath, x, y, w, h) {
  const dimensions = readPngDimensions(imagePath);
  const imageRatio = dimensions.width / dimensions.height;
  const boxRatio = w / h;
  if (imageRatio > boxRatio) {
    const containedHeight = w / imageRatio;
    return { path: imagePath, x, y: y + (h - containedHeight) / 2, w, h: containedHeight };
  }
  const containedWidth = h * imageRatio;
  return { path: imagePath, x: x + (w - containedWidth) / 2, y, w: containedWidth, h };
}

function addScreenshot(presentation, slide, imagePath, options) {
  const { x, y, w, h, caption } = options;
  addCard(presentation, slide, { x, y, w, h, fill: palette.surface, line: palette.border });
  const imageOptions = imageSizingContain(imagePath, x + 0.06, y + 0.06, w - 0.12, h - 0.12);
  slide.addImage(imageOptions);
  if (caption) {
    slide.addText(caption, {
      x: x + 0.13,
      y: y + h - 0.3,
      w: w - 0.26,
      h: 0.2,
      fontFace: 'Microsoft YaHei',
      fontSize: 6.5,
      color: palette.white,
      fill: { color: palette.black, transparency: 18 },
      margin: 0.04,
      fit: 'shrink',
    });
  }
}

function addFlowArrow(presentation, slide, x, y, w, color = palette.blue) {
  slide.addShape(presentation.ShapeType.line, {
    x,
    y,
    w,
    h: 0,
    line: { color, width: 1.4, beginArrowType: 'none', endArrowType: 'triangle' },
  });
}

function addBulletList(slide, items, options) {
  const { x, y, w, h, fontSize = 11, color = palette.darkGray, bulletColor = palette.blue } = options;
  const runs = [];
  items.forEach((item, index) => {
    runs.push({
      text: item,
      options: {
        bullet: { indent: fontSize * 1.3 },
        hanging: fontSize * 0.35,
        breakLine: index < items.length - 1,
        color,
      },
    });
  });
  slide.addText(runs, {
    x,
    y,
    w,
    h,
    fontFace: 'Microsoft YaHei',
    fontSize,
    color,
    breakLine: false,
    paraSpaceAfterPt: 8,
    margin: 0,
    valign: 'top',
    fit: 'shrink',
    bulletColor,
  });
}

function writePreview(slideNumber, createSlide) {
  const presentation = createPresentation();
  createSlide(presentation, theme);
  const previewPath = path.join(__dirname, `slide-${String(slideNumber).padStart(2, '0')}-preview.pptx`);
  presentation.writeFile({ fileName: previewPath });
}

module.exports = {
  SLIDE_WIDTH,
  SLIDE_HEIGHT,
  palette,
  theme,
  assetPaths,
  createPresentation,
  addTitle,
  addPageNumber,
  addFooter,
  addCard,
  addTag,
  addMetricCard,
  addScreenshot,
  addFlowArrow,
  addBulletList,
  imageSizingContain,
  writePreview,
};
