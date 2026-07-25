const {
  palette,
  assetPaths,
  addTitle,
  addPageNumber,
  addFooter,
  addCard,
  addTag,
  addScreenshot,
  writePreview,
} = require('./helpers');

const slideConfig = {
  type: 'content',
  subtype: 'mixed-media',
  index: 5,
  title: 'Agent 能力：五类工具取数，结论可解释、可追溯',
};

const toolItems = [
  ['telemetry.query', '温度 / 湿度 / O₂ / CO₂ / 压差'],
  ['doorlog.query', '库门开启时段与持续时间'],
  ['devicelog.query', '压缩机 / 风机 / 阀门状态'],
  ['knowledge.search', '冷库高温处置知识'],
  ['cases.search', '相似异常历史案例'],
];

function createSlide(presentation, theme) {
  const slide = presentation.addSlide();
  slide.background = { color: theme.bg };
  addTitle(presentation, slide, slideConfig.title, '04  AGENT & TOOLS');

  addScreenshot(presentation, slide, assetPaths.toolTrace, {
    x: 0.48,
    y: 1.25,
    w: 6.48,
    h: 3.86,
    caption: 'Agent 工作台：工具调用进度、事件趋势和业务上下文',
  });

  addCard(presentation, slide, { x: 7.18, y: 1.25, w: 2.32, h: 2.42, fill: palette.surface });
  slide.addText('真实后端工具调用', {
    x: 7.43,
    y: 1.47,
    w: 1.82,
    h: 0.28,
    fontFace: 'Microsoft YaHei',
    fontSize: 11.5,
    bold: true,
    color: palette.black,
    margin: 0,
    align: 'center',
  });
  toolItems.forEach((toolItem, toolIndex) => {
    const toolY = 1.9 + toolIndex * 0.33;
    slide.addShape(presentation.ShapeType.ellipse, {
      x: 7.4,
      y: toolY + 0.03,
      w: 0.16,
      h: 0.16,
      line: { color: palette.blue, transparency: 100 },
      fill: { color: palette.blue },
    });
    slide.addText(toolItem[0], {
      x: 7.66,
      y: toolY,
      w: 1.47,
      h: 0.18,
      fontFace: 'Consolas',
      fontSize: 6.8,
      bold: true,
      color: palette.deepBlue,
      margin: 0,
      fit: 'shrink',
    });
    slide.addText(toolItem[1], {
      x: 7.66,
      y: toolY + 0.15,
      w: 1.48,
      h: 0.15,
      fontFace: 'Microsoft YaHei',
      fontSize: 5.7,
      color: palette.gray,
      margin: 0,
      fit: 'shrink',
    });
  });

  addCard(presentation, slide, { x: 7.18, y: 3.85, w: 2.32, h: 1.26, fill: palette.black, line: palette.black });
  addTag(presentation, slide, '结构化产出', {
    x: 7.42,
    y: 4.04,
    w: 0.92,
    fill: palette.gold,
    color: palette.black,
  });
  slide.addText('原因排序 + 置信度\n支持证据 + 反向证据\n不确定项 + 现场核查', {
    x: 7.42,
    y: 4.37,
    w: 1.8,
    h: 0.5,
    fontFace: 'Microsoft YaHei',
    fontSize: 8.5,
    bold: true,
    color: palette.white,
    margin: 0,
    breakLine: false,
    fit: 'shrink',
  });
  slide.addText('每次调用均记录完整输入输出、摘要、耗时与状态。', {
    x: 7.42,
    y: 4.82,
    w: 1.8,
    h: 0.22,
    fontFace: 'Microsoft YaHei',
    fontSize: 5.5,
    color: palette.border,
    margin: 0,
    fit: 'shrink',
  });

  addFooter(slide, '默认模式为离线确定性 Agent；可选 OpenAI 兼容 LLM 仅综合诊断原因，不决定安全、审批或执行');
  addPageNumber(presentation, slide, slideConfig.index);
  return slide;
}

if (require.main === module) {
  writePreview(slideConfig.index, createSlide);
}

module.exports = { createSlide, slideConfig };
