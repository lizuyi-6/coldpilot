const {
  palette,
  addPageNumber,
  addCard,
  addTag,
  addFlowArrow,
  writePreview,
} = require('./helpers');

const slideConfig = {
  type: 'summary',
  index: 11,
  title: '从可运行 MVP 走向真实冷库的受控落地',
};

const roadmapStages = [
  { number: '01', period: '0–3 个月', title: '只读试点', description: '接入真实传感器，对比 Agent 诊断与人工判断', metric: '诊断耗时 / 原因命中率 / 误报率' },
  { number: '02', period: '3–6 个月', title: '影子仿真', description: '历史数据校准模型，方案不下发设备', metric: '温度与能耗预测误差' },
  { number: '03', period: '6–9 个月', title: 'L1 建议运行', description: 'Agent 给建议，由值班员人工执行', metric: '采纳率 / 货损 / 能耗' },
  { number: '04', period: '9–12 个月', title: '受控 L2 接入', description: '边缘二次校验、人工审批、人工接管与 PID 回退', metric: '安全事件 / 恢复时间 / 可用性' },
];

function createSlide(presentation, theme) {
  const slide = presentation.addSlide();
  slide.background = { color: theme.primary };

  slide.addText('10  ROADMAP & OPEN SOURCE', {
    x: 0.52,
    y: 0.34,
    w: 2.8,
    h: 0.22,
    fontFace: 'Arial',
    fontSize: 8.5,
    bold: true,
    color: palette.gold,
    charSpacing: 1.1,
    margin: 0,
  });
  slide.addText(slideConfig.title, {
    x: 0.52,
    y: 0.67,
    w: 8.62,
    h: 0.54,
    fontFace: 'Microsoft YaHei',
    fontSize: 25,
    bold: true,
    color: palette.white,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText('永久边界：L3 联锁绕过类动作始终不交给 Agent 执行。', {
    x: 0.54,
    y: 1.29,
    w: 5.2,
    h: 0.28,
    fontFace: 'Microsoft YaHei',
    fontSize: 10,
    bold: true,
    color: palette.paleBlue,
    margin: 0,
  });

  roadmapStages.forEach((roadmapStage, stageIndex) => {
    const stageX = 0.54 + stageIndex * 2.28;
    addCard(presentation, slide, {
      x: stageX,
      y: 1.85,
      w: 1.94,
      h: 2.25,
      fill: palette.white,
      line: stageIndex === 0 ? palette.blue : palette.border,
    });
    slide.addText(roadmapStage.number, {
      x: stageX + 0.17,
      y: 2.05,
      w: 0.45,
      h: 0.36,
      fontFace: 'Arial',
      fontSize: 19,
      bold: true,
      color: stageIndex === 0 ? palette.blue : palette.gold,
      margin: 0,
    });
    slide.addText(roadmapStage.period, {
      x: stageX + 0.77,
      y: 2.1,
      w: 0.98,
      h: 0.22,
      fontFace: 'Arial',
      fontSize: 8.5,
      bold: true,
      color: palette.gray,
      align: 'right',
      margin: 0,
    });
    slide.addText(roadmapStage.title, {
      x: stageX + 0.17,
      y: 2.58,
      w: 1.58,
      h: 0.31,
      fontFace: 'Microsoft YaHei',
      fontSize: 13,
      bold: true,
      color: palette.black,
      margin: 0,
      align: 'center',
    });
    slide.addText(roadmapStage.description, {
      x: stageX + 0.18,
      y: 3.06,
      w: 1.56,
      h: 0.48,
      fontFace: 'Microsoft YaHei',
      fontSize: 8.2,
      color: palette.darkGray,
      margin: 0,
      align: 'center',
      fit: 'shrink',
    });
    slide.addShape(presentation.ShapeType.line, {
      x: stageX + 0.26,
      y: 3.65,
      w: 1.42,
      h: 0,
      line: { color: palette.divider, width: 0.8 },
    });
    slide.addText('验证指标', {
      x: stageX + 0.18,
      y: 3.74,
      w: 1.56,
      h: 0.17,
      fontFace: 'Microsoft YaHei',
      fontSize: 6.5,
      bold: true,
      color: palette.blue,
      margin: 0,
      align: 'center',
    });
    slide.addText(roadmapStage.metric, {
      x: stageX + 0.18,
      y: 3.93,
      w: 1.56,
      h: 0.13,
      fontFace: 'Microsoft YaHei',
      fontSize: 5.8,
      color: palette.gray,
      margin: 0,
      align: 'center',
      fit: 'shrink',
    });
    if (stageIndex < roadmapStages.length - 1) {
      addFlowArrow(presentation, slide, stageX + 1.98, 2.97, 0.25, palette.gold);
    }
  });

  addCard(presentation, slide, { x: 0.54, y: 4.42, w: 5.64, h: 0.67, fill: palette.white, line: palette.white });
  addTag(presentation, slide, '当前', {
    x: 0.76,
    y: 4.62,
    w: 0.52,
    fill: palette.blue,
    color: palette.white,
  });
  slide.addText('可运行全栈 MVP，任务闭环、安全边界与工程复现已验证。', {
    x: 1.46,
    y: 4.6,
    w: 4.4,
    h: 0.27,
    fontFace: 'Microsoft YaHei',
    fontSize: 10,
    bold: true,
    color: palette.black,
    margin: 0,
    fit: 'shrink',
  });

  addCard(presentation, slide, { x: 6.42, y: 4.42, w: 2.96, h: 0.67, fill: palette.gold, line: palette.gold });
  slide.addText('期待连接', {
    x: 6.64,
    y: 4.58,
    w: 0.8,
    h: 0.22,
    fontFace: 'Microsoft YaHei',
    fontSize: 8.5,
    bold: true,
    color: palette.black,
    margin: 0,
  });
  slide.addText('真实冷库场景 · 历史数据 · 设备接口', {
    x: 7.3,
    y: 4.58,
    w: 1.86,
    h: 0.22,
    fontFace: 'Microsoft YaHei',
    fontSize: 7.1,
    bold: true,
    color: palette.black,
    margin: 0,
    fit: 'shrink',
  });

  slide.addText('OPEN FOR REUSE  ·  TOOL CONTRACTS  ·  SAFETY POLICIES  ·  SIMULATOR  ·  SAMPLE DATA  ·  DOCS', {
    x: 0.55,
    y: 5.28,
    w: 8.47,
    h: 0.14,
    fontFace: 'Arial',
    fontSize: 6.4,
    color: palette.softGray,
    charSpacing: 0.45,
    margin: 0,
    fit: 'shrink',
  });
  addPageNumber(presentation, slide, slideConfig.index);
  return slide;
}

if (require.main === module) {
  writePreview(slideConfig.index, createSlide);
}

module.exports = { createSlide, slideConfig };
