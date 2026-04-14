import type { DBSchema } from 'idb';
import type { Project, Requirement, Change, Snapshot, PersonNameCache } from '../types';

export const DB_NAME = 'scope-shield';
export const DB_VERSION = 1;

export interface ScopeShieldDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: {
      status: string;
      createdAt: string;
    };
  };
  requirements: {
    key: string;
    value: Requirement;
    indexes: {
      projectId: string;
      status: string;
      sortOrder: number;
    };
  };
  changes: {
    key: string;
    value: Change;
    indexes: {
      projectId: string;
      date: string;
      type: string;
    };
  };
  snapshots: {
    key: string;
    value: Snapshot;
    indexes: {
      projectId: string;
      createdAt: string;
    };
  };
  personNameCache: {
    key: string;
    value: PersonNameCache;
    indexes: {
      name: string;
      usageCount: number;
    };
  };
}
