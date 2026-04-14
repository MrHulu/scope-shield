import { openDB, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, type ScopeShieldDB } from './schema';

let dbInstance: IDBPDatabase<ScopeShieldDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<ScopeShieldDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<ScopeShieldDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Projects
      const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
      projectStore.createIndex('status', 'status');
      projectStore.createIndex('createdAt', 'createdAt');

      // Requirements
      const reqStore = db.createObjectStore('requirements', { keyPath: 'id' });
      reqStore.createIndex('projectId', 'projectId');
      reqStore.createIndex('status', 'status');
      reqStore.createIndex('sortOrder', 'sortOrder');

      // Changes
      const changeStore = db.createObjectStore('changes', { keyPath: 'id' });
      changeStore.createIndex('projectId', 'projectId');
      changeStore.createIndex('date', 'date');
      changeStore.createIndex('type', 'type');

      // Snapshots
      const snapStore = db.createObjectStore('snapshots', { keyPath: 'id' });
      snapStore.createIndex('projectId', 'projectId');
      snapStore.createIndex('createdAt', 'createdAt');

      // PersonNameCache
      const nameStore = db.createObjectStore('personNameCache', { keyPath: 'id' });
      nameStore.createIndex('name', 'name', { unique: true });
      nameStore.createIndex('usageCount', 'usageCount');
    },
  });

  return dbInstance;
}
