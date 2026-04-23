import type { ChangeType } from '../types';

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  add_days: '调整天数',
  new_requirement: '新增需求',
  cancel_requirement: '砍需求',
  supplement: '需求补充',
  reprioritize: '调优先级',
  pause: '暂停',
  resume: '恢复',
};

export const CHANGE_TYPES: ChangeType[] = [
  'add_days',
  'new_requirement',
  'cancel_requirement',
  'supplement',
  'reprioritize',
  'pause',
  'resume',
];

export const SUPPLEMENT_SUBTYPE_LABELS: Record<string, string> = {
  feature_addition: '功能补充',
  condition_change: '条件变更',
  detail_refinement: '细节细化',
};
