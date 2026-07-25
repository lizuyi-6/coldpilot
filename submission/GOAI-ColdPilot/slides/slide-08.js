const {
  palette,
  addTitle,
  addPageNumber,
  addFooter,
  addCard,
  addTag,
  addFlowArrow,
  writePreview,
} = require('./helpers');

const slideConfig = {
  type: 'content',
  subtype: 'process',
  index: 8,
  title: '技术架构：把 Agent 能力嵌入可测试的业务用例层',
};

function addArchitectureBox(presentation, slide, options) {
  const { x, y, w, h, title, description, fill, line, titleColor = palette.black, bodyColor = palette.gray } = options;
  addCard(presentation, slide, { x, y, w, h, fill, line });
  slide.addText(title, {
    x: x + 0.14,
    y: y + 0.12,
    w: w - 0.28,
    h: 0.25,
    fontFace: 'Microsoft YaHei',
    fontSize: 9.8,
    bold: true,
    color: titleColor,
    margin: 0,
    align: 'center',
    fit: 'shrink',
  });
  slide.addText(description, {
    x: x + 0.14,
    y: y + 0.43,
    w: w - 0.28,
    h: h - 0.53,
    fontFace: 'Microsoft YaHei',
    fontSize: 6.7,
    color: bodyColor,
    margin: 0,
    align: 'center',
    valign: 'mid',
    fit: 'shrink',
  });
}

function createSlide(presentation, theme) {
  const slide = presentation.addSlide();
  slide.background = { color: theme.bg };
  addTitle(presentation, slide, slideConfig.title, '07  ARCHITECTURE');

  addTag(presentation, slide, 'Web 产品层', {
    x: 0.55,
    y: 1.25,
    w: 0.9,
    fill: palette.paleBlue,
    color: palette.deepBlue,
  });
  addArchitectureBox(presentation, slide, {
    x: 0.55,
    y: 1.64,
    w: 1.75,
    h: 0.85,
    title: 'React 18 + TypeScript',
    description: '10 个业务模块\n驾驶舱 / 监控 / Agent / 仿真 / 审计',
    fill: palette.white,
    line: palette.blue,
  });
  addArchitectureBox(presentation, slide, {
    x: 2.57,
    y: 1.64,
    w: 1.75,
    h: 0.85,
    title: 'ColdPilotClient',
    description: '唯一数据边界\nMock 与 HTTP 可切换',
    fill: palette.surface,
    line: palette.border,
  });
  addFlowArrow(presentation, slide, 2.31, 2.06, 0.22, palette.blue);

  addTag(presentation, slide, 'API 与用例层', {
    x: 4.72,
    y: 1.25,
    w: 1.0,
    fill: palette.paleBlue,
    color: palette.deepBlue,
  });
  addArchitectureBox(presentation, slide, {
    x: 4.72,
    y: 1.64,
    w: 1.85,
    h: 0.85,
    title: 'FastAPI + Pydantic',
    description: '13 个业务 API\n冻结契约 + 结构化 Schema',
    fill: palette.white,
    line: palette.blue,
  });
  addArchitectureBox(presentation, slide, {
    x: 6.84,
    y: 1.64,
    w: 2.58,
    h: 0.85,
    title: 'Application Use Cases',
    description: 'diagnosis · simulation · approval · execution',
    fill: palette.surface,
    line: palette.border,
  });
  addFlowArrow(presentation, slide, 4.35, 2.06, 0.32, palette.blue);
  addFlowArrow(presentation, slide, 6.59, 2.06, 0.2, palette.blue);

  slide.addShape(presentation.ShapeType.line, {
    x: 0.55,
    y: 2.84,
    w: 8.87,
    h: 0,
    line: { color: palette.divider, width: 1.1 },
  });
  addTag(presentation, slide, '核心能力层', {
    x: 0.55,
    y: 2.99,
    w: 0.9,
    fill: palette.paleGold,
    color: palette.deepGold,
  });

  const capabilityBoxes = [
    ['Agent', '确定性默认\n可选 LLM 综合'],
    ['Tool Registry', '五类工具协议\n结构化 IO 留痕'],
    ['Safety Engine', 'L2 五项检查\nL3 永久拦截'],
    ['Thermal Simulator', '一阶热力学近似\n预测曲线与风险'],
    ['Async Worker', '诊断 / 执行任务\n逐步可观察'],
  ];
  capabilityBoxes.forEach((capabilityBox, capabilityIndex) => {
    addArchitectureBox(presentation, slide, {
      x: 0.55 + capabilityIndex * 1.78,
      y: 3.39,
      w: 1.55,
      h: 0.9,
      title: capabilityBox[0],
      description: capabilityBox[1],
      fill: capabilityIndex === 2 ? palette.paleGold : palette.white,
      line: capabilityIndex === 2 ? palette.gold : palette.border,
    });
  });

  addCard(presentation, slide, { x: 0.55, y: 4.58, w: 8.87, h: 0.48, fill: palette.black, line: palette.black });
  slide.addText('SQLAlchemy Async + SQLite WAL', {
    x: 0.8,
    y: 4.7,
    w: 2.25,
    h: 0.2,
    fontFace: 'Arial',
    fontSize: 9,
    bold: true,
    color: palette.white,
    margin: 0,
  });
  slide.addText('23 张表覆盖遥测、Agent 任务、证据、方案版本、仿真、审批、命令、执行、报告与安全审计', {
    x: 3.08,
    y: 4.69,
    w: 5.98,
    h: 0.2,
    fontFace: 'Microsoft YaHei',
    fontSize: 7.4,
    color: palette.border,
    margin: 0,
    fit: 'shrink',
  });

  addFooter(slide, '当前为单进程 MVP：无 Redis、消息队列、微服务、向量数据库或真实设备网关；生产化路线见第 11 页');
  addPageNumber(presentation, slide, slideConfig.index);
  return slide;
}

if (require.main === module) {
  writePreview(slideConfig.index, createSlide);
}

module.exports = { createSlide, slideConfig };
