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
  subtype: 'timeline',
  index: 3,
  title: '不是聊天窗口：这是从异常到验证的任务闭环',
};

const workflowStages = [
  { number: '01', label: '异常进入', note: '持续高温事件', group: 'AUTO' },
  { number: '02', label: '工具诊断', note: '多源取数与留痕', group: 'AUTO' },
  { number: '03', label: '原因证据', note: '排序 + 正反证据', group: 'AUTO' },
  { number: '04', label: '候选方案', note: 'A / B 控制策略', group: 'AUTO' },
  { number: '05', label: '仿真校验', note: '效果与风险预测', group: 'AUTO' },
  { number: '06', label: '人工审批', note: 'L2 停下等授权', group: 'HUMAN' },
  { number: '07', label: '受控执行', note: '结构化命令', group: 'AUTO' },
  { number: '08', label: '效果验证', note: '通过才恢复', group: 'AUTO' },
];

function createSlide(presentation, theme) {
  const slide = presentation.addSlide();
  slide.background = { color: theme.bg };
  addTitle(presentation, slide, slideConfig.title, '02  TASK LOOP');

  slide.addText('Agent 自主推进', {
    x: 0.62,
    y: 1.25,
    w: 2.2,
    h: 0.26,
    fontFace: 'Microsoft YaHei',
    fontSize: 10,
    bold: true,
    color: palette.deepBlue,
    margin: 0,
  });
  slide.addShape(presentation.ShapeType.line, {
    x: 1.75,
    y: 1.39,
    w: 4.1,
    h: 0,
    line: { color: palette.blue, width: 1.2 },
  });
  slide.addText('人在关键节点负责', {
    x: 5.98,
    y: 1.25,
    w: 1.6,
    h: 0.26,
    fontFace: 'Microsoft YaHei',
    fontSize: 10,
    bold: true,
    color: palette.deepGold,
    margin: 0,
  });
  slide.addShape(presentation.ShapeType.line, {
    x: 7.48,
    y: 1.39,
    w: 1.85,
    h: 0,
    line: { color: palette.gold, width: 1.2 },
  });

  workflowStages.forEach((workflowStage, stageIndex) => {
    const columnIndex = stageIndex % 4;
    const rowIndex = Math.floor(stageIndex / 4);
    const stageX = 0.55 + columnIndex * 2.28;
    const stageY = 1.72 + rowIndex * 1.38;
    const isHumanStage = workflowStage.group === 'HUMAN';
    addCard(presentation, slide, {
      x: stageX,
      y: stageY,
      w: 1.85,
      h: 0.92,
      fill: isHumanStage ? palette.paleGold : palette.white,
      line: isHumanStage ? palette.gold : palette.border,
    });
    slide.addText(workflowStage.number, {
      x: stageX + 0.13,
      y: stageY + 0.11,
      w: 0.44,
      h: 0.26,
      fontFace: 'Arial',
      fontSize: 13,
      bold: true,
      color: isHumanStage ? palette.deepGold : palette.blue,
      margin: 0,
    });
    slide.addText(workflowStage.label, {
      x: stageX + 0.57,
      y: stageY + 0.11,
      w: 1.13,
      h: 0.26,
      fontFace: 'Microsoft YaHei',
      fontSize: 11.2,
      bold: true,
      color: palette.black,
      margin: 0,
      fit: 'shrink',
    });
    slide.addText(workflowStage.note, {
      x: stageX + 0.14,
      y: stageY + 0.52,
      w: 1.58,
      h: 0.2,
      fontFace: 'Microsoft YaHei',
      fontSize: 7.8,
      color: palette.gray,
      margin: 0,
      align: 'center',
      fit: 'shrink',
    });
    if (columnIndex < 3) {
      addFlowArrow(presentation, slide, stageX + 1.9, stageY + 0.46, 0.28, isHumanStage ? palette.gold : palette.blue);
    }
  });

  addTag(presentation, slide, '关键守卫 1', {
    x: 5.1,
    y: 4.58,
    w: 0.92,
    fill: palette.paleGold,
    color: palette.deepGold,
  });
  slide.addText('L2 方案必须绑定版本并由人工审批；版本变化后旧审批失效。', {
    x: 6.15,
    y: 4.57,
    w: 3.1,
    h: 0.28,
    fontFace: 'Microsoft YaHei',
    fontSize: 8.5,
    color: palette.darkGray,
    margin: 0,
    fit: 'shrink',
  });
  addTag(presentation, slide, '关键守卫 2', {
    x: 0.61,
    y: 4.58,
    w: 0.92,
    fill: palette.paleBlue,
    color: palette.deepBlue,
  });
  slide.addText('执行完成 ≠ 事件恢复；必须进入 verifying 并满足恢复条件。', {
    x: 1.66,
    y: 4.57,
    w: 3.08,
    h: 0.28,
    fontFace: 'Microsoft YaHei',
    fontSize: 8.5,
    color: palette.darkGray,
    margin: 0,
    fit: 'shrink',
  });

  addFooter(slide, '仓库事实：前端 15 阶段状态机与后端状态迁移共同约束流程；当前异常检测输入和执行均为演示/仿真');
  addPageNumber(presentation, slide, slideConfig.index);
  return slide;
}

if (require.main === module) {
  writePreview(slideConfig.index, createSlide);
}

module.exports = { createSlide, slideConfig };
