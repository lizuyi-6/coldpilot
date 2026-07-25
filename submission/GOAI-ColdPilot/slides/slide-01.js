const {
  palette,
  assetPaths,
  imageSizingContain,
  writePreview,
} = require('./helpers');

const slideConfig = {
  type: 'cover',
  index: 1,
  title: '鲜知 ColdPilot',
};

function createSlide(presentation, theme) {
  const slide = presentation.addSlide();
  slide.background = { color: theme.primary };

  slide.addShape(presentation.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.12,
    h: 5.625,
    line: { color: theme.light, transparency: 100 },
    fill: { color: theme.light },
  });
  slide.addShape(presentation.ShapeType.ellipse, {
    x: 7.35,
    y: -1.25,
    w: 4.1,
    h: 4.1,
    line: { color: theme.accent, width: 1.1, transparency: 38 },
    fill: { color: theme.primary, transparency: 100 },
  });
  slide.addShape(presentation.ShapeType.ellipse, {
    x: 7.95,
    y: -0.65,
    w: 2.9,
    h: 2.9,
    line: { color: theme.light, width: 0.8, transparency: 48 },
    fill: { color: theme.primary, transparency: 100 },
  });

  slide.addText('GOAI · BOUNDLESS AGENTS / AI + INDUSTRIAL MANUFACTURING', {
    x: 0.65,
    y: 0.58,
    w: 5.7,
    h: 0.26,
    fontFace: 'Arial',
    fontSize: 9,
    bold: true,
    color: theme.light,
    charSpacing: 1.3,
    margin: 0,
  });
  slide.addText('鲜知', {
    x: 0.65,
    y: 1.34,
    w: 2.1,
    h: 0.55,
    fontFace: 'Microsoft YaHei',
    fontSize: 24,
    bold: true,
    color: palette.white,
    margin: 0,
  });
  slide.addText('ColdPilot', {
    x: 0.65,
    y: 1.82,
    w: 5.5,
    h: 0.92,
    fontFace: 'Arial',
    fontSize: 48,
    bold: true,
    color: palette.white,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText('果蔬冷库安全可控工业 Agent', {
    x: 0.68,
    y: 2.86,
    w: 5.3,
    h: 0.46,
    fontFace: 'Microsoft YaHei',
    fontSize: 19,
    bold: true,
    color: palette.paleBlue,
    margin: 0,
  });
  slide.addText('让 Agent 自主诊断与验证，让安全边界始终由确定性规则和人类掌握。', {
    x: 0.68,
    y: 3.5,
    w: 5.65,
    h: 0.54,
    fontFace: 'Microsoft YaHei',
    fontSize: 11.8,
    color: palette.border,
    margin: 0,
    breakLine: false,
    fit: 'shrink',
  });

  slide.addShape(presentation.ShapeType.roundRect, {
    x: 6.55,
    y: 1.22,
    w: 2.55,
    h: 2.55,
    rectRadius: 0.22,
    line: { color: palette.white, transparency: 86 },
    fill: { color: palette.white },
  });
  slide.addImage(imageSizingContain(assetPaths.logo, 6.88, 1.55, 1.9, 1.9));
  slide.addText('DIAGNOSE  ·  SIMULATE  ·  GOVERN  ·  VERIFY', {
    x: 6.28,
    y: 4.03,
    w: 3.25,
    h: 0.3,
    fontFace: 'Arial',
    fontSize: 7.6,
    bold: true,
    color: palette.paleBlue,
    align: 'center',
    charSpacing: 0.8,
    margin: 0,
  });

  slide.addShape(presentation.ShapeType.line, {
    x: 0.67,
    y: 4.73,
    w: 8.7,
    h: 0,
    line: { color: palette.white, transparency: 82, width: 0.7 },
  });
  slide.addText('GOAI 世界人工智能开源大赛 · 初赛方案 · 2026', {
    x: 0.68,
    y: 4.96,
    w: 5.1,
    h: 0.26,
    fontFace: 'Microsoft YaHei',
    fontSize: 8.5,
    color: palette.softGray,
    margin: 0,
  });
  slide.addText('可运行全栈 MVP', {
    x: 7.52,
    y: 4.89,
    w: 1.82,
    h: 0.36,
    fontFace: 'Microsoft YaHei',
    fontSize: 9,
    bold: true,
    color: palette.black,
    fill: { color: theme.light },
    align: 'center',
    valign: 'mid',
    margin: 0.04,
  });

  return slide;
}

if (require.main === module) {
  writePreview(slideConfig.index, createSlide);
}

module.exports = { createSlide, slideConfig };
