// === Enums ===

export type ProjectStatus = 'active' | 'archived';

export type RequirementStatus = 'active' | 'paused' | 'cancelled';

export type ChangeType =
  | 'add_days'
  | 'new_requirement'
  | 'cancel_requirement'
  | 'reprioritize'
  | 'pause'
  | 'resume';

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
  createdAt: string;
  updatedAt: string;
  _feishuTaskId?: string | null;
}

export interface ChangeMetadata {
  fromPosition?: number;
  toPosition?: number;
  remainingDays?: number;
  cancelledRequirementName?: string;
  cancelledDays?: number;
  newRequirementName?: string;
  deletedRequirementName?: string;
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
