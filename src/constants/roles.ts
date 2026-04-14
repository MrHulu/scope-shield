import type { Role } from '../types';

export const ROLE_LABELS: Record<Role, string> = {
  pm: '产品经理',
  leader: '领导',
  qa: '测试',
  other: '其他',
};

export const ROLES: Role[] = ['pm', 'leader', 'qa', 'other'];
