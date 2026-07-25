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
  subtype: 'comparison',
  index: 2,
  title: '真正的难点不是告警，而是安全地闭环',
};

const fragmentedSignals = [
  { label: '传感器', note: '温湿度 / 气体 / 压差' },
  { label: '库门记录', note: '作业与外界扰动' },
  { label: '设备日志', note: '压缩机 / 风机 / 阀门' },
  { label: '库存批次', note: '品类 / 数量 / 安全窗口' },
  { label: 'SOP 与案例', note: '规则散落、经验依赖' },
];

function createSlide(presentation, theme) {
  const slide = presentation.addSlide();
  slide.background = { color: theme.bg };
  addTitle(presentation, slide, slideConfig.title, '01  SCENE & PROBLEM');

  addCard(presentation, slide, { x: 0.48, y: 1.27, w: 4.2, h: 3.56, fill: palette.surface });
  addTag(presentation, slide, '传统处置：信息碎片 + 经验判断', {
    x: 0.72,
    y: 1.5,
    w: 2.48,
    fill: palette.paleGold,
    color: palette.deepGold,
  });

  fragmentedSignals.forEach((signal, signalIndex) => {
    const columnIndex = signalIndex % 2;
    const rowIndex = Math.floor(signalIndex / 2);
    const cardWidth = signalIndex === fragmentedSignals.length - 1 ? 3.42 : 1.64;
    const cardX = signalIndex === fragmentedSignals.length - 1 ? 0.86 : 0.74 + columnIndex * 1.85;
    const cardY = 1.95 + rowIndex * 0.74;
    addCard(presentation, slide, {
      x: cardX,
      y: cardY,
      w: cardWidth,
      h: 0.58,
      fill: palette.white,
      line: palette.border,
    });
    slide.addText(signal.label, {
      x: cardX + 0.12,
      y: cardY + 0.09,
      w: cardWidth - 0.24,
      h: 0.19,
      fontFace: 'Microsoft YaHei',
      fontSize: 9,
      bold: true,
      color: palette.black,
      margin: 0,
      align: signalIndex === fragmentedSignals.length - 1 ? 'center' : 'left',
    });
    slide.addText(signal.note, {
      x: cardX + 0.12,
      y: cardY + 0.32,
      w: cardWidth - 0.24,
      h: 0.15,
      fontFace: 'Microsoft YaHei',
      fontSize: 6.5,
      color: palette.gray,
      margin: 0,
      align: signalIndex === fragmentedSignals.length - 1 ? 'center' : 'left',
      fit: 'shrink',
    });
  });

  slide.addText('人工需要同时回答', {
    x: 0.78,
    y: 4.28,
    w: 1.2,
    h: 0.2,
    fontFace: 'Microsoft YaHei',
    fontSize: 8.5,
    bold: true,
    color: palette.darkGray,
    margin: 0,
  });
  slide.addText('原因是什么？哪个方案更稳？谁来授权？执行后真的恢复了吗？', {
    x: 1.9,
    y: 4.2,
    w: 2.44,
    h: 0.38,
    fontFace: 'Microsoft YaHei',
    fontSize: 8.2,
    color: palette.gray,
    margin: 0,
    fit: 'shrink',
  });

  addFlowArrow(presentation, slide, 4.82, 2.94, 0.55, theme.accent);

  addCard(presentation, slide, { x: 5.48, y: 1.27, w: 4.0, h: 3.56, fill: palette.black, line: palette.black });
  addTag(presentation, slide, 'ColdPilot：证据驱动的受控自治', {
    x: 5.75,
    y: 1.5,
    w: 2.22,
    fill: palette.blue,
    color: palette.white,
  });
  slide.addText('面向谁', {
    x: 5.78,
    y: 1.97,
    w: 0.7,
    h: 0.2,
    fontFace: 'Microsoft YaHei',
    fontSize: 8,
    bold: true,
    color: palette.gold,
    margin: 0,
  });
  slide.addText('冷库管理员、冷链运营负责人、设备运维与安全审计人员', {
    x: 6.52,
    y: 1.93,
    w: 2.6,
    h: 0.32,
    fontFace: 'Microsoft YaHei',
    fontSize: 9.2,
    color: palette.white,
    margin: 0,
    fit: 'shrink',
  });

  const valueRows = [
    ['看懂异常', '五类工具自动取数，输出原因排序与正反证据'],
    ['比较方案', '在控制前仿真恢复时间、能耗、过冲与冻害风险'],
    ['守住边界', 'L2 必须人工审批；L3 联锁绕过永久禁止'],
    ['验证结果', '执行不等于恢复，验证通过后才生成闭环报告'],
  ];

  valueRows.forEach((valueRow, rowIndex) => {
    const rowY = 2.47 + rowIndex * 0.55;
    slide.addShape(presentation.ShapeType.ellipse, {
      x: 5.78,
      y: rowY + 0.03,
      w: 0.22,
      h: 0.22,
      line: { color: palette.blue, transparency: 100 },
      fill: { color: rowIndex === 2 ? palette.gold : palette.blue },
    });
    slide.addText(valueRow[0], {
      x: 6.13,
      y: rowY,
      w: 0.83,
      h: 0.23,
      fontFace: 'Microsoft YaHei',
      fontSize: 9.5,
      bold: true,
      color: palette.white,
      margin: 0,
    });
    slide.addText(valueRow[1], {
      x: 6.99,
      y: rowY,
      w: 2.1,
      h: 0.3,
      fontFace: 'Microsoft YaHei',
      fontSize: 7.5,
      color: palette.border,
      margin: 0,
      fit: 'shrink',
    });
  });

  slide.addText('产品判断', {
    x: 5.78,
    y: 4.62,
    w: 0.8,
    h: 0.2,
    fontFace: 'Microsoft YaHei',
    fontSize: 8,
    bold: true,
    color: palette.gold,
    margin: 0,
  });
  slide.addText('工业 Agent 的价值不在“替人拍板”，而在“判断更深、边界更硬、结果更实”。', {
    x: 6.62,
    y: 4.51,
    w: 2.5,
    h: 0.35,
    fontFace: 'Microsoft YaHei',
    fontSize: 8.2,
    bold: true,
    color: palette.white,
    margin: 0,
    fit: 'shrink',
  });

  addFooter(slide, '场景：果蔬冷库持续高温等异常处置；痛点表述依据当前产品流程，真实客户量化数据仍待试点');
  addPageNumber(presentation, slide, slideConfig.index);
  return slide;
}

if (require.main === module) {
  writePreview(slideConfig.index, createSlide);
}

module.exports = { createSlide, slideConfig };
