const {
  palette,
  addTitle,
  addPageNumber,
  addFooter,
  addCard,
  addTag,
  addMetricCard,
  writePreview,
} = require('./helpers');

const slideConfig = {
  type: 'content',
  subtype: 'data-visualization',
  index: 9,
  title: '工程完成度：可运行、可验证、可复现',
};

const engineeringMetrics = [
  { value: '10', label: '业务模块', note: '驾驶舱到报告审计', accent: palette.blue },
  { value: '13', label: '业务 API', note: '前后端冻结契约', accent: palette.gold },
  { value: '23', label: '数据库表', note: '覆盖完整事件闭环', accent: palette.black },
  { value: '15', label: '工作流阶段', note: '状态与守卫可测试', accent: palette.blue },
  { value: '5', label: 'Agent 工具', note: '真实调用、结构化留痕', accent: palette.gold },
  { value: '109', label: '自动化测试', note: '前端 50 + 后端 59', accent: palette.black },
];

const reproducibilityItems = [
  ['双数据模式', 'Mock 独立演示 / HTTP 全栈联调'],
  ['后端接口文档', '/internal/docs + OpenAPI 契约'],
  ['数据库迁移', 'Alembic 一键建表与演示种子'],
  ['质量门禁', 'typecheck / test / lint / build / ruff'],
  ['浏览器验收', '关键页面与 Agent 状态全程留图'],
  ['部署边界', '单 worker 运行要求已明确记录'],
];

function createSlide(presentation, theme) {
  const slide = presentation.addSlide();
  slide.background = { color: theme.bg };
  addTitle(presentation, slide, slideConfig.title, '08  ENGINEERING EVIDENCE');

  engineeringMetrics.forEach((engineeringMetric, metricIndex) => {
    const metricColumn = metricIndex % 3;
    const metricRow = Math.floor(metricIndex / 3);
    addMetricCard(presentation, slide, {
      x: 0.48 + metricColumn * 1.82,
      y: 1.25 + metricRow * 1.58,
      w: 1.58,
      h: 1.34,
      value: engineeringMetric.value,
      label: engineeringMetric.label,
      note: engineeringMetric.note,
      accent: engineeringMetric.accent,
    });
  });

  addCard(presentation, slide, { x: 6.05, y: 1.25, w: 3.43, h: 2.96, fill: palette.black, line: palette.black });
  addTag(presentation, slide, '复现路径', {
    x: 6.32,
    y: 1.51,
    w: 0.82,
    fill: palette.gold,
    color: palette.black,
  });
  slide.addText('不是只有截图：工程材料可直接运行', {
    x: 6.32,
    y: 1.91,
    w: 2.82,
    h: 0.33,
    fontFace: 'Microsoft YaHei',
    fontSize: 12.5,
    bold: true,
    color: palette.white,
    margin: 0,
    fit: 'shrink',
  });
  reproducibilityItems.forEach((reproducibilityItem, itemIndex) => {
    const itemY = 2.43 + itemIndex * 0.28;
    slide.addShape(presentation.ShapeType.ellipse, {
      x: 6.34,
      y: itemY + 0.03,
      w: 0.12,
      h: 0.12,
      line: { color: palette.gold, transparency: 100 },
      fill: { color: palette.gold },
    });
    slide.addText(reproducibilityItem[0], {
      x: 6.58,
      y: itemY,
      w: 0.88,
      h: 0.16,
      fontFace: 'Microsoft YaHei',
      fontSize: 7.4,
      bold: true,
      color: palette.white,
      margin: 0,
    });
    slide.addText(reproducibilityItem[1], {
      x: 7.48,
      y: itemY,
      w: 1.64,
      h: 0.16,
      fontFace: 'Microsoft YaHei',
      fontSize: 6.6,
      color: palette.border,
      margin: 0,
      fit: 'shrink',
    });
  });

  addCard(presentation, slide, { x: 6.05, y: 4.39, w: 3.43, h: 0.68, fill: palette.paleBlue, line: palette.blue });
  slide.addText('拟开放复用', {
    x: 6.28,
    y: 4.57,
    w: 0.9,
    h: 0.22,
    fontFace: 'Microsoft YaHei',
    fontSize: 9,
    bold: true,
    color: palette.deepBlue,
    margin: 0,
  });
  slide.addText('工具协议 · 安全策略 · 仿真器 · 示例数据 · 部署文档', {
    x: 7.2,
    y: 4.54,
    w: 2.02,
    h: 0.26,
    fontFace: 'Microsoft YaHei',
    fontSize: 7.6,
    color: palette.darkGray,
    margin: 0,
    fit: 'shrink',
  });

  addFooter(slide, '工程数量依据当前源码；测试数量为前端 50 个与后端 59 个，提交前已重新运行关键质量门禁');
  addPageNumber(presentation, slide, slideConfig.index);
  return slide;
}

if (require.main === module) {
  writePreview(slideConfig.index, createSlide);
}

module.exports = { createSlide, slideConfig };
