/**
 * IndexedDB wrapper for Auvori local project persistence.
 * Schema v1: projects, images, history, offlineState
 */

import type { ManualAdjustments, ImageTransform, EditorSnapshot } from '../types';

export { type EditorSnapshot } from '../types';

export interface LocalProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceImageId: string;
  sourceWidth: number;
  sourceHeight: number;
  sourceOrientation: number;
  sourceMimeType: string;
  sourceType?: 'local-upload' | 'studio-sample';
  sourceAssetId?: string | null;
  activePresetId: string;
  intensity: number;
  manual: ManualAdjustments;
  transform: ImageTransform;
  adaptiveColorStrength?: number;
  historyLength: number;
  exportCount: number;
  schemaVersion: number;
}

export interface LocalImage {
  id: string;
  projectId: string;
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  contentHash: string;
  createdAt: string;
}

export interface LocalHistoryEntry {
  id?: number;
  projectId: string;
  snapshot: EditorSnapshot;
  timestamp: string;
  schemaVersion: number;
}

export interface OfflineState {
  key: string;
  mandatoryPack: PackStatus;
  aiPack: AIPackStatus;
  storage: StorageStatus;
}

export interface PackStatus {
  status: 'pending' | 'downloading' | 'verifying' | 'ready' | 'failed';
  progress: number;
  totalBytes: number;
  completedBytes: number;
  lastUpdated: string;
  error?: string;
}

export interface AIPackStatus {
  status: 'not-downloaded' | 'downloading' | 'verifying' | 'warming-up' | 'ready' | 'failed';
  progress: number;
  totalBytes: number;
  completedBytes: number;
  lastUpdated: string;
  error?: string;
  modelVersions: Record<string, string>;
}

export interface StorageStatus {
  estimate: { usage: number; quota: number } | null;
  persistent: boolean;
  lastChecked: string;
}

const DB_NAME = 'auvori-projects';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(new Error(`IndexedDB open failed: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        // Projects store
        const projectsStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectsStore.createIndex('by-updatedAt', 'updatedAt', { unique: false });
        projectsStore.createIndex('by-sourceHash', 'sourceHash', { unique: false });

        // Images store
        const imagesStore = db.createObjectStore('images', { keyPath: 'id' });
        imagesStore.createIndex('by-projectId', 'projectId', { unique: false });
        imagesStore.createIndex('by-contentHash', 'contentHash', { unique: false });

        // History store
        const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        historyStore.createIndex('by-projectId-timestamp', ['projectId', 'timestamp'], { unique: false });

        // Offline state store
        db.createObjectStore('offlineState', { keyPath: 'key' });
      }
    };
  });

  return dbPromise;
}

async function getDB(): Promise<IDBDatabase> {
  try {
    return await openDB();
  } catch (err) {
    // If upgrade failed, try to delete and reopen
    if (err instanceof Error && err.message.includes('version')) {
      await deleteDB();
      dbPromise = null;
      return openDB();
    }
    throw err;
  }
}

export async function deleteDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB delete blocked'));
  });
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function createProject(params: {
  name: string;
  sourceBlob: Blob;
  sourceWidth: number;
  sourceHeight: number;
  sourceOrientation: number;
  sourceMimeType: string;
  presetId: string;
  intensity: number;
  manual: ManualAdjustments;
  transform: ImageTransform;
  adaptiveColorStrength?: number;
  sourceType?: 'local-upload' | 'studio-sample';
  sourceAssetId?: string | null;
}): Promise<string> {
  const db = await getDB();
  const projectId = crypto.randomUUID();
  const imageId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Compute content hash for deduplication
  const contentHash = await computeSHA256(params.sourceBlob);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['projects', 'images'], 'readwrite');

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(projectId);

    const projectsStore = tx.objectStore('projects');
    const imagesStore = tx.objectStore('images');

    // Check for existing image with same hash
    const hashIndex = imagesStore.index('by-contentHash');
    const hashRequest = hashIndex.get(contentHash);

    hashRequest.onsuccess = () => {
      let finalImageId = imageId;
      let finalBlob = params.sourceBlob;

      if (hashRequest.result) {
        // Reuse existing image
        finalImageId = hashRequest.result.id;
        finalBlob = hashRequest.result.blob;
      } else {
        // Add new image
        const image: LocalImage = {
          id: finalImageId,
          projectId,
          blob: finalBlob,
          mimeType: params.sourceMimeType,
          width: params.sourceWidth,
          height: params.sourceHeight,
          fileSize: params.sourceBlob.size,
          contentHash,
          createdAt: now
        };
        imagesStore.add(image);
      }

      const project: LocalProject = {
        id: projectId,
        name: params.name,
        createdAt: now,
        updatedAt: now,
        sourceImageId: finalImageId,
        sourceWidth: params.sourceWidth,
        sourceHeight: params.sourceHeight,
        sourceOrientation: params.sourceOrientation,
        sourceMimeType: params.sourceMimeType,
        sourceType: params.sourceType ?? 'local-upload',
        sourceAssetId: params.sourceAssetId ?? null,
        activePresetId: params.presetId,
        intensity: params.intensity,
        manual: params.manual,
        transform: params.transform,
        adaptiveColorStrength: params.adaptiveColorStrength ?? 0,
        historyLength: 1,
        exportCount: 0,
        schemaVersion: 1
      };
      projectsStore.add(project);
    };
  });
}

export async function updateProject(projectId: string, patch: Partial<LocalProject>): Promise<void> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['projects'], 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();

    const store = tx.objectStore('projects');
    const request = store.get(projectId);

    request.onsuccess = () => {
      const project = request.result;
      if (!project) {
        reject(new Error(`Project not found: ${projectId}`));
        return;
      }

      const updated = {
        ...project,
        ...patch,
        updatedAt: new Date().toISOString()
      };
      store.put(updated);
    };
  });
}

export async function getProject(projectId: string): Promise<LocalProject | null> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['projects'], 'readonly');
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('projects');
    const request = store.get(projectId);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function getLatestProject(): Promise<LocalProject | null> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['projects'], 'readonly');
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('projects');
    const index = store.index('by-updatedAt');
    const request = index.openCursor(null, 'prev');
    request.onsuccess = () => {
      const cursor = request.result;
      resolve(cursor?.value || null);
    };
  });
}

export async function getAllProjects(): Promise<LocalProject[]> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['projects'], 'readonly');
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('projects');
    const index = store.index('by-updatedAt');
    const request = index.getAll();
    request.onsuccess = () => resolve(request.result.reverse()); // newest first
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['projects', 'images', 'history'], 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();

    const projectsStore = tx.objectStore('projects');
    const imagesStore = tx.objectStore('images');
    const historyStore = tx.objectStore('history');

    // Get project to find image ID
    const projectRequest = projectsStore.get(projectId);
    projectRequest.onsuccess = () => {
      const project = projectRequest.result;
      if (project) {
        imagesStore.delete(project.sourceImageId);
      }
      projectsStore.delete(projectId);

      // Delete history entries
      const historyIndex = historyStore.index('by-projectId-timestamp');
      const historyRequest = historyIndex.openCursor(IDBKeyRange.only(projectId));
      historyRequest.onsuccess = () => {
        const cursor = historyRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    };
  });
}

// ─── Images ──────────────────────────────────────────────────────────────────

export async function getImage(imageId: string): Promise<LocalImage | null> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['images'], 'readonly');
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('images');
    const request = store.get(imageId);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function getImagesByProject(projectId: string): Promise<LocalImage[]> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['images'], 'readonly');
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('images');
    const index = store.index('by-projectId');
    const request = index.getAll(projectId);
    request.onsuccess = () => resolve(request.result);
  });
}

// ─── History ─────────────────────────────────────────────────────────────────

export async function replaceHistory(projectId: string, snapshots: EditorSnapshot[]): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['history', 'projects'], 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();

    const historyStore = tx.objectStore('history');
    const projectsStore = tx.objectStore('projects');

    // Delete old history
    const index = historyStore.index('by-projectId-timestamp');
    const deleteRequest = index.openCursor(IDBKeyRange.only(projectId));
    deleteRequest.onsuccess = () => {
      const cursor = deleteRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        // Add new history entries
        for (let i = 0; i < snapshots.length; i++) {
          const entry: LocalHistoryEntry = {
            projectId,
            snapshot: snapshots[i],
            timestamp: new Date(Date.now() + i).toISOString(),
            schemaVersion: 1
          };
          historyStore.add(entry);
        }

        // Update project historyLength
        const projectRequest = projectsStore.get(projectId);
        projectRequest.onsuccess = () => {
          const project = projectRequest.result;
          if (project) {
            project.historyLength = snapshots.length;
            project.updatedAt = now;
            projectsStore.put(project);
          }
        };
      }
    };
  });
}

export async function getHistory(projectId: string): Promise<EditorSnapshot[]> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['history'], 'readonly');
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('history');
    const index = store.index('by-projectId-timestamp');
    const request = index.getAll(IDBKeyRange.only(projectId));
    request.onsuccess = () => {
      const entries = request.result.sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp)
      );
      resolve(entries.map((e) => e.snapshot));
    };
  });
}

// ─── Offline State ───────────────────────────────────────────────────────────

export async function getOfflineState(): Promise<OfflineState | null> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['offlineState'], 'readonly');
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('offlineState');
    const request = store.get('main');
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function updateOfflineState(patch: Partial<OfflineState>): Promise<void> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['offlineState'], 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();

    const store = tx.objectStore('offlineState');
    const request = store.get('main');

    request.onsuccess = () => {
      const existing = request.result || {
        key: 'main',
        mandatoryPack: {
          status: 'pending',
          progress: 0,
          totalBytes: 0,
          completedBytes: 0,
          lastUpdated: new Date().toISOString()
        },
        aiPack: {
          status: 'not-downloaded',
          progress: 0,
          totalBytes: 0,
          completedBytes: 0,
          lastUpdated: new Date().toISOString(),
          modelVersions: {}
        },
        storage: {
          estimate: null,
          persistent: false,
          lastChecked: new Date().toISOString()
        }
      };

      const updated = {
        ...existing,
        ...patch,
        mandatoryPack: { ...existing.mandatoryPack, ...patch.mandatoryPack },
        aiPack: { ...existing.aiPack, ...patch.aiPack },
        storage: { ...existing.storage, ...patch.storage }
      };
      store.put(updated);
    };
  });
}

// ─── Storage Utilities ───────────────────────────────────────────────────────

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      return { usage: estimate.usage || 0, quota: estimate.quota || 0 };
    } catch {
      return null;
    }
  }
  return null;
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

async function computeSHA256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Recovery Helpers ────────────────────────────────────────────────────────

export async function loadFullProjectState(projectId: string): Promise<{
  project: LocalProject;
  image: LocalImage;
  history: EditorSnapshot[];
} | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  const image = await getImage(project.sourceImageId);
  if (!image) return null;

  const history = await getHistory(projectId);

  return { project, image, history };
}

export async function createProjectFromEditor(params: {
  name: string;
  sourceBlob: Blob;
  sourceWidth: number;
  sourceHeight: number;
  sourceOrientation: number;
  sourceMimeType: string;
  activePresetId: string;
  intensity: number;
  manual: ManualAdjustments;
  transform: ImageTransform;
  adaptiveColorStrength?: number;
  history: EditorSnapshot[];
  sourceType?: 'local-upload' | 'studio-sample';
  sourceAssetId?: string | null;
}): Promise<string> {
  const projectId = await createProject({
    name: params.name,
    sourceBlob: params.sourceBlob,
    sourceWidth: params.sourceWidth,
    sourceHeight: params.sourceHeight,
    sourceOrientation: params.sourceOrientation,
    sourceMimeType: params.sourceMimeType,
    presetId: params.activePresetId,
    intensity: params.intensity,
    manual: params.manual,
    transform: params.transform,
    adaptiveColorStrength: params.adaptiveColorStrength ?? 0,
    sourceType: params.sourceType,
    sourceAssetId: params.sourceAssetId
  });

  if (params.history.length > 1) {
    await replaceHistory(projectId, params.history);
  }

  return projectId;
}