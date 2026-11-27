# Phase 6.4 Local Storage — IndexedDB Schema & Persistence

## Database Overview

**Name**: `auvori-projects`
**Version**: 1
**Stores**: `projects`, `images`, `history`, `offlineState`

## Object Store Definitions

### `projects` Store
```typescript
interface LocalProject {
  id: string;                    // UUID v4
  name: string;                  // User-editable project name
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  sourceImageId: string;         // FK → images.id
  sourceWidth: number;
  sourceHeight: number;
  sourceOrientation: number;     // EXIF orientation (1-8)
  sourceMimeType: string;        // 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic'
  activePresetId: string;
  intensity: number;             // 0-100
  manual: ManualAdjustments;
  transform: ImageTransform;
  historyLength: number;         // Number of history entries
  exportCount: number;           // Total exports from this project
  schemaVersion: number;         // 1
}
```
**Indexes**:
- `by-updatedAt` (updatedAt, descending) — for recent projects list
- `by-sourceHash` (sourceHash) — for deduplication

### `images` Store
```typescript
interface LocalImage {
  id: string;                    // UUID v4
  projectId: string;             // FK → projects.id
  blob: Blob;                    // Original photo file
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;              // Bytes
  contentHash: string;           // SHA-256 hex (for dedup)
  createdAt: string;             // ISO 8601
}
```
**Indexes**:
- `by-projectId` (projectId) — cascade delete with project

### `history` Store
```typescript
interface LocalHistoryEntry {
  id: number;                    // Auto-increment
  projectId: string;             // FK → projects.id
  snapshot: EditorSnapshot;      // { presetId, intensity, manual, transform }
  timestamp: string;             // ISO 8601
  schemaVersion: number;         // 1
}
```
**Indexes**:
- `by-projectId-timestamp` (projectId, timestamp) — ordered history

### `offlineState` Store
```typescript
interface OfflineState {
  key: string;                   // 'mandatoryPack' | 'aiPack' | 'storage'
  mandatoryPack: PackStatus;
  aiPack: AIPackStatus;
  storage: StorageStatus;
}

interface PackStatus {
  status: 'pending' | 'downloading' | 'verifying' | 'ready' | 'failed';
  progress: number;              // 0-100
  totalBytes: number;
  completedBytes: number;
  lastUpdated: string;           // ISO 8601
  error?: string;
}

interface AIPackStatus {
  status: 'not-downloaded' | 'downloading' | 'verifying' | 'warming-up' | 'ready' | 'failed';
  progress: number;
  totalBytes: number;
  completedBytes: number;
  lastUpdated: string;
  error?: string;
  modelVersions: Record<string, string>; // modelId → version
}

interface StorageStatus {
  estimate: { usage: number; quota: number } | null;
  persistent: boolean;
  lastChecked: string;
}
```

## Persistence Operations

### Project Creation
```typescript
async function createProject(params: {
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
}): Promise<string> // returns projectId
```
1. Generate `projectId` (UUID), `imageId` (UUID)
2. Compute `contentHash` (SHA-256 of blob)
3. Check `images` index `by-sourceHash` — if exists, reuse imageId
4. Transaction: `images.put(image)`, `projects.put(project)`
5. Return `projectId`

### Project Update (Autosave)
```typescript
async function updateProject(projectId: string, patch: Partial<LocalProject>): Promise<void>
```
1. Read existing project
2. Merge patch
3. `updatedAt = now()`, `historyLength = history.length`
4. Transaction: `projects.put(updatedProject)`
5. On quota exceeded: throw `QuotaExceededError` (handled by UI)

### History Persistence
```typescript
async function replaceHistory(projectId: string, snapshots: EditorSnapshot[]): Promise<void>
```
1. Transaction: `history.clear()` for projectId (by index), then `history.add()` each snapshot
2. Update `projects.historyLength = snapshots.length`

### Project Recovery (App Start)
```typescript
async function loadLatestProject(): Promise<{ project: LocalProject; image: LocalImage; history: EditorSnapshot[] } | null>
```
1. `projects.index('by-updatedAt').getAll()` → first entry
2. If none: return `null`
3. Load `image` by `project.sourceImageId`
4. Load `history` by `projectId` ordered by timestamp
5. Reconstruct `EditorSnapshot[]` from history entries
6. Return full state

### Project Deletion
```typescript
async function deleteProject(projectId: string): Promise<void>
```
1. Load project → get `sourceImageId`
2. Transaction: `projects.delete(projectId)`, `images.delete(sourceImageId)`, `history.clear(projectId)`
3. Revoke any blob URLs associated

### Storage Quota Management
```typescript
async function getStorageEstimate(): Promise<{ usage: number; quota: number }>
```
- `navigator.storage.estimate()` if available
- Fallback: sum `images` blob sizes + estimated overhead

```typescript
async function requestPersistentStorage(): Promise<boolean>
```
- `navigator.storage.persist()` if available
- Returns granted status

## Schema Migration (Future)

**Version 1**: Initial schema as defined above.

**Migration Strategy**:
- Increment `version` in `openDB()`
- `upgrade` callback handles `oldVersion < newVersion`
- Add stores/indexes, transform data
- Bump `schemaVersion` in records after migration

## Autosave Implementation

### Debounce Configuration
```typescript
const AUTOSAVE_DEBOUNCE_MS = 800;
const AUTOSAVE_MAX_DELAY_MS = 5000;
```

### Trigger Points
| Event | Fields Updated | Debounce |
|-------|----------------|----------|
| Preset change | `activePresetId`, `intensity` (reset) | Immediate |
| Intensity slider | `intensity` | 800ms |
| Manual adjustment | `manual` | 800ms |
| Transform (crop/rotate/flip) | `transform` | Immediate |
| Export success | `exportCount` | Immediate |
| Before unload | All dirty fields | Best-effort (sync) |

### Coalescing
- Single `setTimeout` per project
- Accumulate dirty fields in memory
- On fire: single transaction writes all changes

### Save Status UI
| State | Condition | Toast/Indicator |
|-------|-----------|-----------------|
| `saving` | Transaction in progress | "Saving on this device…" |
| `saved` | Transaction committed | "Saved on this device" (2s) |
| `failed` | Transaction error | "Save failed — storage full?" |
| `unsaved` | Dirty fields, no pending save | "Unsaved changes" (subtle) |

## Data Integrity

### Blob Handling
- Store original `Blob` from `fileInput` or `fetch` (studio samples)
- Never compress or transform before storage
- `createObjectURL(blob)` for editor display
- Revoke on project close/delete

### Hash Verification
- SHA-256 computed on project creation
- Used for deduplication (same photo imported twice)
- Not re-verified on every load (trusted local storage)

### Transaction Atomicity
- All writes in single `IDBTransaction` (readwrite)
- `projects`, `images`, `history` in same transaction
- Failure → full rollback, no partial state

### Corruption Recovery
- On `IDBDatabase` error: log, attempt `openDB()` again
- If schema mismatch: trigger migration
- If unrecoverable: show "Local data corrupted — starting fresh" (preserve other projects)

## Integration with Existing `localStorage`

### Migration Path
1. On first load with IndexedDB: read `localStorage.auvori_recents_v1`
2. For each recent edit: create `LocalProject` with `sourceImageId` pointing to existing image or placeholder
3. Clear `localStorage` recent edits after successful migration
4. Keep `localStorage` for: theme, backdrop, favorites, license (small, non-blob)

### Coexistence
- `localStorage`: preferences, license, favorites (≤ 10 KB)
- `IndexedDB`: projects, images, history, offline state (MBs)

## Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| `QuotaExceededError` | Storage full | Show "Delete old projects to continue" with list |
| `InvalidStateError` | DB closed | Reopen DB, retry |
| `AbortError` | Transaction aborted | Retry once |
| `DataError` | Serialization fail | Log, skip problematic field |
| `NotFoundError` | Record missing | Treat as fresh start |
| `SecurityError` | Private browsing / denied | Fallback to in-memory only, warn user |

## Testing Requirements

1. Create project → reload → verify full state restored
2. Edit → wait autosave → reload → verify state + history
3. Fill storage → verify quota error handled gracefully
4. Delete project → verify images + history cascade deleted
5. Private browsing → verify fallback behavior
6. Corrupt DB → verify recovery or clean reset
7. Concurrent tabs → verify no data loss (broadcast channel for sync)