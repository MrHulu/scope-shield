import { openDB, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, type ScopeShieldDB } from './schema';

let dbInstance: IDBPDatabase<ScopeShieldDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<ScopeShieldDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<ScopeShieldDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('status', 'status');
        projectStore.createIndex('createdAt', 'createdAt');

        const reqStore = db.createObjectStore('requirements', { keyPath: 'id' });
        reqStore.createIndex('projectId', 'projectId');
        reqStore.createIndex('status', 'status');
        reqStore.createIndex('sortOrder', 'sortOrder');

        const changeStore = db.createObjectStore('changes', { keyPath: 'id' });
        changeStore.createIndex('projectId', 'projectId');
        changeStore.createIndex('date', 'date');
        changeStore.createIndex('type', 'type');

        const snapStore = db.createObjectStore('snapshots', { keyPath: 'id' });
        snapStore.createIndex('projectId', 'projectId');
        snapStore.createIndex('createdAt', 'createdAt');

        const nameStore = db.createObjectStore('personNameCache', { keyPath: 'id' });
        nameStore.createIndex('name', 'name', { unique: true });
        nameStore.createIndex('usageCount', 'usageCount');
      }
      // Future migrations:
      // if (oldVersion < 2) { ... }
    },
  });

  return dbInstance;
}
