export const STEPS = [
  { id: 1, label: '主视觉上传' },
  { id: 2, label: '背景 AI 生成' },
  { id: 3, label: '蒙版融合' },
  { id: 4, label: '数据导入' },
  { id: 5, label: '画板初始化' },
  { id: 6, label: '批量排版' },
  { id: 7, label: '间距微调' },
  { id: 8, label: '导出' },
] as const;

export const RAIL = [
  { step: 1, label: '主视觉' },
  { step: 2, label: '背景生成' },
  { step: 3, label: '蒙版' },
  { step: 4, label: '数据' },
  { step: 6, label: '卡片' },
  { step: 7, label: '间距' },
  { step: 8, label: '导出' },
] as const;
