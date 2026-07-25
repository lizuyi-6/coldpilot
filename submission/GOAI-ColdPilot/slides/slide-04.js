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
  index: 4,
  title: '可运行 Demo：自主推进，L2 人工接管',
};

function addCallout(presentation, slide, options) {
  const { y, number, title, description, accent } = options;
  addCard(presentation, slide, {
    x: 7.32,
    y,
    w: 2.18,
    h: 0.9,
    fill: palette.white,
    line: accent,
  });
  slide.addText(number, {
    x: 7.47,
    y: y + 0.13,
    w: 0.34,
    h: 0.28,
    fontFace: 'Arial',
    fontSize: 15,
    bold: true,
    color: accent,
    margin: 0,
  });
  slide.addText(title, {
    x: 7.9,
    y: y + 0.13,
    w: 1.38,
    h: 0.26,
    fontFace: 'Microsoft YaHei',
    fontSize: 10.5,
    bold: true,
    color: palette.black,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText(description, {
    x: 7.48,
    y: y + 0.48,
    w: 1.8,
    h: 0.28,
    fontFace: 'Microsoft YaHei',
    fontSize: 7.3,
    color: palette.gray,
    margin: 0,
    fit: 'shrink',
  });
}

function createSlide(presentation, theme) {
  const slide = presentation.addSlide();
  slide.background = { color: theme.bg };
  addTitle(presentation, slide, slideConfig.title, '03  PRODUCT DEMO');
  addTag(presentation, slide, '真实浏览器截图', {
    x: 8.1,
    y: 0.64,
    w: 1.3,
    fill: palette.paleBlue,
    color: palette.deepBlue,
  });

  addScreenshot(presentation, slide, assetPaths.approval, {
    x: 0.48,
    y: 1.25,
    w: 6.55,
    h: 3.76,
    caption: '首页看板：多源环境、候选控制方案、L2 审批与 L3 禁止边界同屏呈现',
  });

  addCallout(presentation, slide, {
    y: 1.31,
    number: '01',
    title: '自动推进',
    description: '无需聊天输入，Agent 自动完成诊断、仿真与安全检查。',
    accent: palette.blue,
  });
  addCallout(presentation, slide, {
    y: 2.39,
    number: '02',
    title: '人工授权',
    description: 'L2 控制参数、当前值、目标值和允许范围在批准前完整可见。',
    accent: palette.gold,
  });
  addCallout(presentation, slide, {
    y: 3.47,
    number: '03',
    title: '责任边界',
    description: 'L3 危险动作不进入方案、审批、命令或执行链。',
    accent: palette.black,
  });

  slide.addText('一屏回答评委最关心的三个问题', {
    x: 7.36,
    y: 4.59,
    w: 2.08,
    h: 0.22,
    fontFace: 'Microsoft YaHei',
    fontSize: 8.7,
    bold: true,
    color: palette.black,
    margin: 0,
    align: 'center',
  });
  slide.addText('Agent 做了什么？人何时介入？危险动作如何被阻止？', {
    x: 7.37,
    y: 4.83,
    w: 2.05,
    h: 0.26,
    fontFace: 'Microsoft YaHei',
    fontSize: 7.4,
    color: palette.gray,
    margin: 0,
    align: 'center',
    fit: 'shrink',
  });

  addFooter(slide, '截图：frontend/acceptance/agent-awaiting-approval.png；页面数据为演示数据，方案指标为仿真结果');
  addPageNumber(presentation, slide, slideConfig.index);
  return slide;
}

if (require.main === module) {
  writePreview(slideConfig.index, createSlide);
}

module.exports = { createSlide, slideConfig };
