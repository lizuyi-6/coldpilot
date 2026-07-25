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
  index: 7,
  title: '安全不是 Prompt：模型、规则、人和设备边界分层治理',
};

const safetyLevels = [
  { level: 'L0', title: '观察', owner: 'Agent 自动', description: '读取数据、识别异常，不改变设备状态', fill: palette.surface, line: palette.border, levelColor: palette.gray },
  { level: 'L1', title: '建议', owner: 'Agent 自动', description: '输出诊断、方案与核查建议', fill: palette.paleBlue, line: palette.blue, levelColor: palette.blue },
  { level: 'L2', title: '受控执行', owner: '必须人工审批', description: '方案绑定版本，执行前再次安全检查', fill: palette.paleGold, line: palette.gold, levelColor: palette.deepGold },
  { level: 'L3', title: '永久禁止', owner: '规则直接拦截', description: '联锁绕过等动作不进入控制链', fill: palette.black, line: palette.black, levelColor: palette.white },
];

function createSlide(presentation, theme) {
  const slide = presentation.addSlide();
  slide.background = { color: theme.bg };
  addTitle(presentation, slide, slideConfig.title, '06  SAFETY & GOVERNANCE');

  addCard(presentation, slide, { x: 0.48, y: 1.23, w: 4.25, h: 3.9, fill: palette.white });
  addTag(presentation, slide, '四级自治边界', {
    x: 0.72,
    y: 1.45,
    w: 1.1,
    fill: palette.paleBlue,
    color: palette.deepBlue,
  });

  safetyLevels.forEach((safetyLevel, levelIndex) => {
    const levelY = 1.84 + levelIndex * 0.72;
    addCard(presentation, slide, {
      x: 0.72,
      y: levelY,
      w: 3.76,
      h: 0.58,
      fill: safetyLevel.fill,
      line: safetyLevel.line,
    });
    slide.addText(safetyLevel.level, {
      x: 0.88,
      y: levelY + 0.11,
      w: 0.38,
      h: 0.24,
      fontFace: 'Arial',
      fontSize: 13,
      bold: true,
      color: safetyLevel.levelColor,
      margin: 0,
    });
    slide.addText(safetyLevel.title, {
      x: 1.35,
      y: levelY + 0.1,
      w: 0.76,
      h: 0.22,
      fontFace: 'Microsoft YaHei',
      fontSize: 9.5,
      bold: true,
      color: levelIndex === 3 ? palette.white : palette.black,
      margin: 0,
    });
    slide.addText(safetyLevel.owner, {
      x: 2.11,
      y: levelY + 0.1,
      w: 0.87,
      h: 0.2,
      fontFace: 'Microsoft YaHei',
      fontSize: 7.4,
      bold: true,
      color: levelIndex === 3 ? palette.gold : palette.darkGray,
      margin: 0,
      fit: 'shrink',
    });
    slide.addText(safetyLevel.description, {
      x: 2.92,
      y: levelY + 0.09,
      w: 1.35,
      h: 0.34,
      fontFace: 'Microsoft YaHei',
      fontSize: 6.5,
      color: levelIndex === 3 ? palette.border : palette.gray,
      margin: 0,
      fit: 'shrink',
    });
  });

  slide.addText('L2 五项确定性检查', {
    x: 0.75,
    y: 4.78,
    w: 1.35,
    h: 0.2,
    fontFace: 'Microsoft YaHei',
    fontSize: 8.5,
    bold: true,
    color: palette.black,
    margin: 0,
  });
  slide.addText('参数白名单  ·  上下限  ·  变化速率  ·  冲突检测  ·  权限校验', {
    x: 2.13,
    y: 4.77,
    w: 2.32,
    h: 0.2,
    fontFace: 'Microsoft YaHei',
    fontSize: 6.8,
    color: palette.gray,
    margin: 0,
    fit: 'shrink',
  });

  addScreenshot(presentation, slide, assetPaths.l3Blocked, {
    x: 4.98,
    y: 1.23,
    w: 4.5,
    h: 2.82,
    caption: '真实页面：L3 “关闭联锁并强制满负荷”被永久拦截',
  });

  addCard(presentation, slide, { x: 4.98, y: 4.23, w: 4.5, h: 0.9, fill: palette.black, line: palette.black });
  addTag(presentation, slide, '设计原则', {
    x: 5.24,
    y: 4.44,
    w: 0.84,
    fill: palette.gold,
    color: palette.black,
  });
  slide.addText('LLM 最多参与诊断综合；安全、审批、控制命令和执行永远不由模型决定。', {
    x: 6.27,
    y: 4.39,
    w: 2.87,
    h: 0.36,
    fontFace: 'Microsoft YaHei',
    fontSize: 9.4,
    bold: true,
    color: palette.white,
    margin: 0,
    fit: 'shrink',
  });
  slide.addText('当前实现提供工程级约束，不宣称等同于经认证的功能安全系统。', {
    x: 6.27,
    y: 4.84,
    w: 2.87,
    h: 0.16,
    fontFace: 'Microsoft YaHei',
    fontSize: 6.3,
    color: palette.border,
    margin: 0,
    fit: 'shrink',
  });

  addFooter(slide, '实现证据：backend/app/domain/safety.py、approval.py、execution.py；L3 只写审计，不创建方案/审批/命令/任务');
  addPageNumber(presentation, slide, slideConfig.index);
  return slide;
}

if (require.main === module) {
  writePreview(slideConfig.index, createSlide);
}

module.exports = { createSlide, slideConfig };
