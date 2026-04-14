import type { ChangeType } from '../types';

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  add_days: '加天数',
  new_requirement: '新增需求',
  cancel_requirement: '砍需求',
  reprioritize: '调优先级',
  pause: '暂停',
  resume: '恢复',
};

export const CHANGE_TYPES: ChangeType[] = [
  'add_days',
  'new_requirement',
  'cancel_requirement',
  'reprioritize',
  'pause',
  'resume',
];

// Types available when editing a non-new_requirement change
export const EDITABLE_CHANGE_TYPES: ChangeType[] = [
  'add_days',
  'cancel_requirement',
  'reprioritize',
  'pause',
  'resume',
];
