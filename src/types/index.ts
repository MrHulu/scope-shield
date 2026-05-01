// === Enums ===

export type ProjectStatus = 'active' | 'archived';

export type RequirementStatus = 'active' | 'paused' | 'cancelled';

export type ChangeType =
  | 'add_days'
  | 'new_requirement'
  | 'cancel_requirement'
  | 'supplement'
  | 'reprioritize'
  | 'pause'
  | 'resume';

export type SupplementSubType = 'feature_addition' | 'condition_change' | 'detail_refinement';

export type Role = 'pm' | 'leader' | 'qa' | 'other';

// === Entities ===

export interface Project {
  id: string;
  name: string;
  startDate: string; // ISO date YYYY-MM-DD
  status: ProjectStatus;
  isDemo: boolean;
  createdAt: string; // ISO datetime
  updatedAt: string;
  _userId?: string | null;
  _teamId?: string | null;
  _feishuProjectId?: string | null;
}

export interface Requirement {
  id: string;
  projectId: string;
  name: string;
  originalDays: number;
  isAddedByChange: boolean;
  currentDays: number;
  status: RequirementStatus;
  sortOrder: number;
  dependsOn: string | null;
  pausedRemainingDays: number | null;
  source?: RequirementSource | null;
  createdAt: string;
  updatedAt: string;
  _feishuTaskId?: string | null;
}

export type RequirementSourceProvider = 'feishu_project';

export interface RequirementSource {
  provider: RequirementSourceProvider;
  url: string;
  projectKey?: string | null;
  workItemTypeKey?: string | null;
  workItemId?: string | null;
  rawTitle?: string | null;
  ownerNames?: string[];
  startDate?: string | null;
  endDate?: string | null;
  fetchedAt?: string | null;
}

export interface ChangeMetadata {
  // reprioritize: 新语义 — 直接指定目标需求 + 新前置依赖
  // (legacy) fromPosition/toPosition 保留用于回放旧 change 数据
  reprioritizeTargetId?: string;
  reprioritizeNewDependsOn?: string | null; // null = 无前置
  fromPosition?: number;
  toPosition?: number;
  remainingDays?: number;
  cancelledRequirementName?: string;
  cancelledDays?: number;
  newRequirementName?: string;
  deletedRequirementName?: string;
  subType?: SupplementSubType;
  cascadeTargets?: string[];
}

export interface Change {
  id: string;
  projectId: string;
  type: ChangeType;
  targetRequirementId: string | null;
  role: Role;
  personName: string | null;
  description: string;
  daysDelta: number;
  date: string; // ISO date YYYY-MM-DD
  metadata: ChangeMetadata | null;
  screenshots: string[]; // base64 data URLs, max 3
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotData {
  requirements: Array<{
    id: string;
    name: string;
    originalDays: number;
    currentDays: number;
    status: RequirementStatus;
    isAddedByChange: boolean;
    dependsOn: string | null;
    sortOrder: number;
    pausedRemainingDays: number | null;
  }>;
  schedule: {
    totalDays: number;
    originalTotalDays: number;
    requirementSchedules: RequirementSchedule[];
  };
}

export interface Snapshot {
  id: string;
  projectId: string;
  changeId: string;
  data: SnapshotData;
  totalDays: number;
  createdAt: string;
}

export interface PersonNameCache {
  id: string;
  name: string;
  role: Role;
  usageCount: number;
  lastUsedAt: string;
}

// === Computed types ===

export interface RequirementSchedule {
  requirementId: string;
  startDay: number;
  endDay: number;
}

export interface ScheduleResult {
  totalDays: number;
  originalTotalDays: number;
  requirementSchedules: RequirementSchedule[];
  criticalPath: string[]; // requirement IDs
}

export interface ProjectStats {
  originalTotalDays: number;
  currentTotalDays: number;
  inflationRate: number | null; // null when originalTotalDays=0
  totalChanges: number;
  supplementCount: number;
  endDate: string;
}

// === Input types ===

export interface CreateProjectInput {
  name: string;
  startDate: string;
}

export interface CreateRequirementInput {
  projectId: string;
  name: string;
  originalDays: number;
  dependsOn?: string | null;
  source?: RequirementSource | null;
}

export interface CreateChangeInput {
  projectId: string;
  type: ChangeType;
  targetRequirementId?: string | null;
  role: Role;
  personName?: string | null;
  description: string;
  daysDelta?: number;
  date: string;
  metadata?: ChangeMetadata | null;
  screenshots?: string[]; // base64 data URLs
  // For new_requirement
  newRequirementName?: string;
  newRequirementDays?: number;
}

// === Export format ===

export interface ExportData {
  version: '1.0';
  exportedAt: string;
  projects: Array<
    Project & {
      requirements: Requirement[];
      changes: Change[];
      snapshots: Snapshot[];
    }
  >;
  personNameCache: PersonNameCache[];
}
