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
  subtype: 'comparison',
  index: 6,
  title: '控制前先仿真：把效果、能耗与风险放在同一张桌上',
};

function addPlanComparisonCard(presentation, slide, options) {
  const { x, y, label, name, recovery, energy, overshoot, frost, recommended } = options;
  addCard(presentation, slide, {
    x,
    y,
    w: 2.28,
    h: 1.55,
    fill: recommended ? palette.paleBlue : palette.surface,
    line: recommended ? palette.blue : palette.border,
  });
  addTag(presentation, slide, label, {
    x: x + 0.15,
    y: y + 0.15,
    w: 0.58,
    fill: recommended ? palette.blue : palette.darkGray,
    color: palette.white,
  });
  slide.addText(name, {
    x: x + 0.82,
    y: y + 0.17,
    w: 1.28,
    h: 0.24,
    fontFace: 'Microsoft YaHei',
    fontSize: 9.3,
    bold: true,
    color: palette.black,
    margin: 0,
    fit: 'shrink',
  });
  const metrics = [
    ['预计恢复', recovery],
    ['预计能耗', energy],
    ['过冲风险', overshoot],
    ['冻害风险', frost],
  ];
  metrics.forEach((metric, metricIndex) => {
    const metricColumn = metricIndex % 2;
    const metricRow = Math.floor(metricIndex / 2);
    const metricX = x + 0.16 + metricColumn * 1.04;
    const metricY = y + 0.63 + metricRow * 0.43;
    slide.addText(metric[0], {
      x: metricX,
      y: metricY,
      w: 0.92,
      h: 0.14,
      fontFace: 'Microsoft YaHei',
      fontSize: 6.2,
      color: palette.gray,
      margin: 0,
    });
    slide.addText(metric[1], {
      x: metricX,
      y: metricY + 0.16,
      w: 0.92,
      h: 0.2,
      fontFace: 'Arial',
      fontSize: 10.2,
      bold: true,
      color: palette.black,
      margin: 0,
      fit: 'shrink',
    });
  });
}

function createSlide(presentation, theme) {
  const slide = presentation.addSlide();
  slide.background = { color: theme.bg };
  addTitle(presentation, slide, slideConfig.title, '05  SIMULATION');

  addScreenshot(presentation, slide, assetPaths.simulation, {
    x: 0.48,
    y: 1.23,
    w: 6.45,
    h: 3.9,
    caption: '策略与仿真页：A/B 方案、温度预测、控制参数、安全校验和 L2 审批',
  });

  addPlanComparisonCard(presentation, slide, {
    x: 7.2,
    y: 1.23,
    label: '方案 A',
    name: '平滑逼近目标',
    recovery: '5.2 h',
    energy: '1,170 kWh',
    overshoot: '低',
    frost: '低',
    recommended: true,
  });
  addPlanComparisonCard(presentation, slide, {
    x: 7.2,
    y: 2.96,
    label: '方案 B',
    name: '快速强制降温',
    recovery: '2.3 h',
    energy: '887 kWh',
    overshoot: '中',
    frost: '中',
    recommended: false,
  });

  addCard(presentation, slide, { x: 7.2, y: 4.7, w: 2.28, h: 0.43, fill: palette.paleGold, line: palette.gold });
  slide.addText('结论：不是只选“更快”，而是让恢复速度、能耗和货品风险可比较。', {
    x: 7.35,
    y: 4.8,
    w: 1.98,
    h: 0.2,
    fontFace: 'Microsoft YaHei',
    fontSize: 7.2,
    bold: true,
    color: palette.deepGold,
    margin: 0,
    align: 'center',
    fit: 'shrink',
  });

  addFooter(slide, '仿真值来自当前一阶热力学近似模型，仅用于技术可行性演示；不得视为真实冷库节能或恢复成效');
  addPageNumber(presentation, slide, slideConfig.index);
  return slide;
}

if (require.main === module) {
  writePreview(slideConfig.index, createSlide);
}

module.exports = { createSlide, slideConfig };
