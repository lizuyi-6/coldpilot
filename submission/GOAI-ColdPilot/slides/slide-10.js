const {
  palette,
  addTitle,
  addPageNumber,
  addFooter,
  addCard,
  addTag,
  writePreview,
} = require('./helpers');

const slideConfig = {
  type: 'content',
  subtype: 'comparison',
  index: 10,
  title: '合规与边界：明确“已实现”与“落地前必须补齐”',
};

const implementedItems = [
  '演示数据、仿真结果和真实数据预留分别标注',
  'L2 人工审批与方案版本绑定',
  'L3 危险动作永久拦截并写入审计',
  '执行前再次进行确定性安全检查',
  'LLM 输出经结构化 Schema 校验',
  '执行或验证失败可回退传统规则 / PID',
];

const requiredItems = [
  '真实身份认证、RBAC 与多级审批',
  '传感器与业务数据授权、最小化和脱敏策略',
  '外部模型供应商、数据保留和私有化部署约定',
  'PLC / 边缘网关的二次边界校验与人工接管',
  '外部不可变审计存储、密钥管理和 API 限流',
  '真实冷库模型校准、工业安全评估与试点验收',
];

function addChecklistColumn(presentation, slide, options) {
  const { x, title, tag, items, fill, line, markerFill } = options;
  addCard(presentation, slide, { x, y: 1.25, w: 4.33, h: 3.62, fill, line });
  addTag(presentation, slide, tag, {
    x: x + 0.24,
    y: 1.49,
    w: 0.8,
    fill: markerFill,
    color: markerFill === palette.black ? palette.white : palette.black,
  });
  slide.addText(title, {
    x: x + 1.17,
    y: 1.49,
    w: 2.8,
    h: 0.28,
    fontFace: 'Microsoft YaHei',
    fontSize: 12,
    bold: true,
    color: palette.black,
    margin: 0,
    fit: 'shrink',
  });
  items.forEach((item, itemIndex) => {
    const itemY = 2.04 + itemIndex * 0.43;
    slide.addShape(presentation.ShapeType.ellipse, {
      x: x + 0.28,
      y: itemY + 0.03,
      w: 0.16,
      h: 0.16,
      line: { color: markerFill, transparency: 100 },
      fill: { color: markerFill },
    });
    slide.addText(item, {
      x: x + 0.58,
      y: itemY,
      w: 3.38,
      h: 0.24,
      fontFace: 'Microsoft YaHei',
      fontSize: 8.6,
      color: palette.darkGray,
      margin: 0,
      fit: 'shrink',
    });
  });
}

function createSlide(presentation, theme) {
  const slide = presentation.addSlide();
  slide.background = { color: theme.bg };
  addTitle(presentation, slide, slideConfig.title, '09  COMPLIANCE & LIMITS');

  addChecklistColumn(presentation, slide, {
    x: 0.48,
    title: '当前系统已经做到',
    tag: 'IMPLEMENTED',
    items: implementedItems,
    fill: palette.paleBlue,
    line: palette.blue,
    markerFill: palette.blue,
  });
  addChecklistColumn(presentation, slide, {
    x: 5.17,
    title: '真实落地前必须补齐',
    tag: 'NEXT',
    items: requiredItems,
    fill: palette.paleGold,
    line: palette.gold,
    markerFill: palette.black,
  });

  slide.addText('不做过度声称', {
    x: 0.72,
    y: 4.99,
    w: 1.02,
    h: 0.2,
    fontFace: 'Microsoft YaHei',
    fontSize: 8,
    bold: true,
    color: palette.black,
    margin: 0,
  });
  slide.addText('当前无真实 PLC、无真实试点、无工业安全认证；哈希链只能检测链条被修改，不等于密码学不可抵赖。', {
    x: 1.79,
    y: 4.97,
    w: 7.12,
    h: 0.24,
    fontFace: 'Microsoft YaHei',
    fontSize: 7.7,
    color: palette.gray,
    margin: 0,
    fit: 'shrink',
  });

  addFooter(slide, '合规策略：先只读、再影子仿真、后 L1 建议，最后才在 L2 人工审批下接入受控执行');
  addPageNumber(presentation, slide, slideConfig.index);
  return slide;
}

if (require.main === module) {
  writePreview(slideConfig.index, createSlide);
}

module.exports = { createSlide, slideConfig };
