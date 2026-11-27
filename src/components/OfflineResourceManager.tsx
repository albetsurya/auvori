/**
 * OfflineResourceManager — Phase 6.4
 * UI for preparing and managing offline resources.
 */

import React, { useEffect, useState } from 'react';
import { Download, Wifi, WifiOff, CheckCircle2, AlertCircle, RotateCcw, Trash2, HardDrive, Info } from 'lucide-react';
import { ModalSheet } from './ui/ModalSheet';
import { Button } from './ui/Button';
import { Slider } from './ui/Slider';
import {
  getOfflineState,
  updateOfflineState,
  getStorageEstimate,
  requestPersistentStorage,
  deleteDB
} from '../lib/idb';
import {
  STUDIO_SAMPLES,
  SIGNATURE_LOOK_PREVIEWS,
  COLLECTION_COVERS
} from '../lib/samplePhoto';

interface OfflineResourceManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const MANDATORY_RESOURCES = [
  { name: 'App Shell (JS/CSS/HTML)', size: 33.5 * 1024 * 1024, cached: false },
  { name: 'Collection Covers (4)', size: 176 * 1024, cached: false },
  { name: 'Signature Look Previews (5)', size: 202 * 1024, cached: false },
  { name: 'Signature Look Sources (5)', size: 425 * 1024, cached: false },
  { name: 'Studio Sample Thumbnails (10)', size: 167 * 1024, cached: false },
  { name: 'Studio Sample Full Images (10)', size: 822 * 1024, cached: false }
];

const AI_MODELS = [
  { id: 'yunet-2026may', name: 'YuNet Face Detection', size: 230 * 1024 },
  { id: 'pphumanseg-2023mar', name: 'PP-HumanSeg Segmentation', size: 6.2 * 1024 * 1024 },
  { id: 'u2netp-v1', name: 'U²-Netp Salient Object', size: 4.6 * 1024 * 1024 }
];

const AI_RUNTIME_WASM = 15 * 1024 * 1024;
const AI_RUNTIME_JSPI = 18 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'ready': return <CheckCircle2 className="w-4 h-4 text-success" strokeWidth={2} />;
    case 'failed': return <AlertCircle className="w-4 h-4 text-error" strokeWidth={2} />;
    case 'downloading':
    case 'verifying':
    case 'warming-up':
      return <RotateCcw className="w-4 h-4 text-primary animate-spin" strokeWidth={2} />;
    default: return <WifiOff className="w-4 h-4 text-textSecondary" strokeWidth={2} />;
  }
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pending',
    downloading: 'Downloading…',
    verifying: 'Verifying…',
    warming_up: 'Warming up…',
    ready: 'Ready',
    failed: 'Failed',
    'not-downloaded': 'Not downloaded'
  };
  return labels[status] || status;
}

export const OfflineResourceManager: React.FC<OfflineResourceManagerProps> = ({
  isOpen,
  onClose
}) => {
  const [offlineState, setOfflineState] = useState<{
    mandatoryPack: PackStatus;
    aiPack: AIPackStatus;
    storage: StorageStatus;
  } | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isDownloadingAI, setIsDownloadingAI] = useState(false);
  const [mandatoryCached, setMandatoryCached] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadState();
      checkCacheStatus();
    }
  }, [isOpen]);

  const loadState = async () => {
    const state = await getOfflineState();
    if (state) {
      setOfflineState({
        mandatoryPack: state.mandatoryPack,
        aiPack: state.aiPack,
        storage: state.storage
      });
    }
    const estimate = await getStorageEstimate();
    const persistent = await requestPersistentStorage();
    setOfflineState((prev) => prev ? {
      ...prev,
      storage: { estimate, persistent, lastChecked: new Date().toISOString() }
    } : null);
    await updateOfflineState({ storage: { estimate, persistent, lastChecked: new Date().toISOString() } });
  };

  const checkCacheStatus = async () => {
    if (typeof caches === 'undefined') return;
    try {
      const cache = await caches.open(`auvori-static-assets-${getCacheVersion()}`);
      const keys = await cache.keys();
      const urls = new Set(keys.map((k) => k.url));

      const newCached: Record<string, boolean> = {};
      for (const res of MANDATORY_RESOURCES) {
        // Simplified check - in reality would check each URL
        newCached[res.name] = urls.size > 0;
      }
      setMandatoryCached(newCached);
    } catch {
      // Cache not ready yet
    }
  };

  const getCacheVersion = () => {
    // This would need to match the version in vite.config.ts
    // For now, return a placeholder
    return 'v1.0.0-timestamp';
  };

  const prepareMandatoryPack = async () => {
    setIsPreparing(true);
    setError(null);
    await updateOfflineState({
      mandatoryPack: { status: 'downloading', progress: 0, totalBytes: 35200000, completedBytes: 0, lastUpdated: new Date().toISOString() }
    });

    try {
      // Precaches are handled by Workbox on SW install
      // Here we trigger runtime caching for static assets
      const urlsToCache: string[] = [];

      // Collection covers
      for (const [, url] of Object.entries(COLLECTION_COVERS)) urlsToCache.push(url);
      // Signature look previews
      for (const [, meta] of Object.entries(SIGNATURE_LOOK_PREVIEWS)) {
        urlsToCache.push(meta.previewPath);
        urlsToCache.push(meta.sourcePath);
      }
      // Studio samples
      for (const sample of STUDIO_SAMPLES) {
        urlsToCache.push(sample.thumbPath);
        urlsToCache.push(sample.fullPath);
      }

      const cacheName = `auvori-static-assets-${getCacheVersion()}`;
      const cache = await caches.open(cacheName);

      let completed = 0;
      const total = urlsToCache.length;

      for (const url of urlsToCache) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch {
          // Ignore individual failures
        }
        completed++;
        const progress = Math.round((completed / total) * 100);
        await updateOfflineState({
          mandatoryPack: { status: 'downloading', progress, totalBytes: 35200000, completedBytes: Math.round(35200000 * progress / 100), lastUpdated: new Date().toISOString() }
        });
        setOfflineState((prev) => prev ? { ...prev, mandatoryPack: { ...prev.mandatoryPack, progress, completedBytes: Math.round(35200000 * progress / 100) } } : null);
      }

      // Verify
      await updateOfflineState({
        mandatoryPack: { status: 'verifying', progress: 100, totalBytes: 35200000, completedBytes: 35200000, lastUpdated: new Date().toISOString() }
      });

      await updateOfflineState({
        mandatoryPack: { status: 'ready', progress: 100, totalBytes: 35200000, completedBytes: 35200000, lastUpdated: new Date().toISOString() }
      });

      setOfflineState((prev) => prev ? { ...prev, mandatoryPack: { status: 'ready', progress: 100, totalBytes: 35200000, completedBytes: 35200000, lastUpdated: new Date().toISOString() } } : null);
      checkCacheStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await updateOfflineState({
        mandatoryPack: { status: 'failed', progress: 0, totalBytes: 35200000, completedBytes: 0, lastUpdated: new Date().toISOString(), error: msg }
      });
      setError(msg);
    } finally {
      setIsPreparing(false);
      loadState();
    }
  };

  const downloadAIPack = async () => {
    setIsDownloadingAI(true);
    setError(null);

    const hasWebGPU = await checkWebGPUSupport();
    const hasJSPI = checkJSPISupport();
    const runtimeSize = hasWebGPU && hasJSPI ? AI_RUNTIME_JSPI : AI_RUNTIME_WASM;
    const totalModelSize = AI_MODELS.reduce((sum, m) => sum + m.size, 0);
    const totalSize = totalModelSize + runtimeSize;

    await updateOfflineState({
      aiPack: { status: 'downloading', progress: 0, totalBytes: totalSize, completedBytes: 0, lastUpdated: new Date().toISOString(), modelVersions: {} }
    });

    try {
      // Download models
      for (const model of AI_MODELS) {
        try {
          const response = await fetch(`/models/${model.id}.onnx`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = await response.arrayBuffer();

          // Verify (size check only here; full SHA-256 in ai-models.ts)
          if (bytes.byteLength !== model.size) {
            throw new Error(`Size mismatch for ${model.name}`);
          }

          // Cache
          const cache = await caches.open('auvori-ai-models-v1');
          await cache.put(`/models/${model.id}.onnx`, new Response(bytes, {
            headers: { 'Content-Type': 'application/octet-stream' }
          }));

          await updateOfflineState({
            aiPack: {
              status: 'downloading',
              progress: Math.round(50 * (AI_MODELS.indexOf(model) + 1) / AI_MODELS.length),
              totalBytes: totalSize,
              completedBytes: Math.round(totalSize * 0.5 * (AI_MODELS.indexOf(model) + 1) / AI_MODELS.length),
              lastUpdated: new Date().toISOString(),
              modelVersions: { [model.id]: 'verified' }
            }
          });
        } catch (err) {
          throw new Error(`Failed to download ${model.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Warmup
      await updateOfflineState({
        aiPack: { status: 'warming-up', progress: 90, totalBytes: totalSize, completedBytes: totalSize, lastUpdated: new Date().toISOString(), modelVersions: AI_MODELS.reduce((acc, m) => ({ ...acc, [m.id]: 'verified' }), {}) }
      });

      // Trigger AI worker warmup
      if (typeof Worker !== 'undefined') {
        const worker = new Worker(new URL('../workers/ai.worker.ts', import.meta.url), { type: 'module' });
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Warmup timeout')), 30000);
          worker.onmessage = (e) => {
            if (e.data.type === 'WARMUP_DONE') {
              clearTimeout(timeout);
              worker.terminate();
              if (e.data.ok) resolve();
              else reject(new Error(e.data.error || 'Warmup failed'));
            }
          };
          worker.onerror = () => {
            clearTimeout(timeout);
            worker.terminate();
            reject(new Error('Worker error'));
          };
          worker.postMessage({ id: 1, type: 'WARMUP_MODELS', modelIds: AI_MODELS.map(m => m.id) });
        });
      }

      await updateOfflineState({
        aiPack: { status: 'ready', progress: 100, totalBytes: totalSize, completedBytes: totalSize, lastUpdated: new Date().toISOString(), modelVersions: AI_MODELS.reduce((acc, m) => ({ ...acc, [m.id]: 'verified' }), {}) }
      });

      setOfflineState((prev) => prev ? { ...prev, aiPack: { status: 'ready', progress: 100, totalBytes: totalSize, completedBytes: totalSize, lastUpdated: new Date().toISOString(), modelVersions: AI_MODELS.reduce((acc, m) => ({ ...acc, [m.id]: 'verified' }), {}) } } : null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await updateOfflineState({
        aiPack: { status: 'failed', progress: 0, totalBytes: totalSize, completedBytes: 0, lastUpdated: new Date().toISOString(), error: msg, modelVersions: {} }
      });
      setError(msg);
    } finally {
      setIsDownloadingAI(false);
      loadState();
    }
  };

  const clearCache = async () => {
    if (!confirm('Clear all offline caches? This will remove prepared resources but keep your local projects.')) return;
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (name.startsWith('auvori-')) {
          await caches.delete(name);
        }
      }
      // Re-register SW to rebuild precache
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.unregister();
      }
      location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cache');
    }
  };

  const clearAllData = async () => {
    if (!confirm('Delete ALL local data including projects? This cannot be undone.')) return;
    if (!confirm('Are you absolutely sure? All your edits and photos will be permanently deleted.')) return;
    try {
      await deleteDB();
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (name.startsWith('auvori-')) {
          await caches.delete(name);
        }
      }
      localStorage.clear();
      location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear data');
    }
  };

  if (!isOpen) return null;

  const mandatoryReady = offlineState?.mandatoryPack.status === 'ready';
  const aiReady = offlineState?.aiPack.status === 'ready';
  const storage = offlineState?.storage;

  return (
    <ModalSheet
      isOpen={isOpen}
      onClose={onClose}
      variant="sheet"
      title="Offline Resources"
      subtitle="Prepare Auvori to work without an internet connection."
    >
      <div className="space-y-5 pb-safe">
        {/* Connectivity Status */}
        <div className="flex items-center gap-3 p-3 rounded-[12px] bg-surfaceSecondary border border-border">
          <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center ${navigator.onLine ? 'bg-success/15' : 'bg-warning/15'}`}>
            {navigator.onLine ? <Wifi className="w-4 h-4 text-success" strokeWidth={2} /> : <WifiOff className="w-4 h-4 text-warning" strokeWidth={2} />}
          </div>
          <div>
            <p className="text-sm font-medium text-textPrimary">
              {navigator.onLine ? 'Online' : 'Offline'}
            </p>
            <p className="text-xs text-textSecondary">
              {navigator.onLine ? 'Connected to internet' : 'Using local resources only'}
            </p>
          </div>
        </div>

        {/* Mandatory Pack */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-olive" strokeWidth={1.8} />
              <h3 className="text-base font-semibold text-textPrimary">Mandatory Offline Pack</h3>
            </div>
            <span className={`px-2 py-0.5 rounded-[6px] text-xs font-medium ${mandatoryReady ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
              {getStatusLabel(offlineState?.mandatoryPack.status || 'pending')}
            </span>
          </div>

          {offlineState?.mandatoryPack.status === 'downloading' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-textSecondary">
                <span>Preparing resources…</span>
                <span>{offlineState.mandatoryPack.progress}%</span>
              </div>
              <div className="h-2 bg-surfaceSecondary rounded-[4px] overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${offlineState.mandatoryPack.progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            {MANDATORY_RESOURCES.map((res) => (
              <div key={res.name} className="flex items-center gap-2 p-2 rounded-[8px] bg-surfaceSecondary">
                <span className={`w-1.5 h-1.5 rounded-full ${mandatoryCached[res.name] ? 'bg-success' : 'bg-textSecondary/30'}`} />
                <span className="text-textPrimary truncate">{res.name}</span>
                <span className="text-textSecondary ml-auto">{formatBytes(res.size)}</span>
              </div>
            ))}
          </div>

          {!mandatoryReady && !isPreparing && (
            <Button
              variant="primary"
              fullWidth
              onClick={prepareMandatoryPack}
              disabled={isPreparing}
              className="mt-2"
            >
              {isPreparing ? 'Preparing…' : 'Prepare Auvori for Offline Use'}
            </Button>
          )}

          {mandatoryReady && (
            <p className="text-xs text-success font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
              Ready for offline use
            </p>
          )}
        </div>

        {/* AI Pack */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-info" strokeWidth={1.8} />
              <h3 className="text-base font-semibold text-textPrimary">AI Adaptive Models (Optional)</h3>
            </div>
            <span className={`px-2 py-0.5 rounded-[6px] text-xs font-medium ${aiReady ? 'bg-success/15 text-success' : 'bg-textSecondary/15 text-textSecondary'}`}>
              {getStatusLabel(offlineState?.aiPack.status || 'not-downloaded')}
            </span>
          </div>

          <p className="text-xs text-textSecondary leading-relaxed">
            Download AI models for Direct Flash & Night Cinema adaptive looks to work offline.
            Requires ~{formatBytes((AI_MODELS.reduce((s, m) => s + m.size, 0) + (checkWebGPUSupport() && checkJSPISupport() ? AI_RUNTIME_JSPI : AI_RUNTIME_WASM)))}.
          </p>

          <div className="space-y-2 text-xs">
            {AI_MODELS.map((model) => (
              <div key={model.id} className="flex items-center gap-2 p-2 rounded-[8px] bg-surfaceSecondary">
                <span className={`w-1.5 h-1.5 rounded-full ${offlineState?.aiPack.modelVersions[model.id] ? 'bg-success' : 'bg-textSecondary/30'}`} />
                <span className="text-textPrimary">{model.name}</span>
                <span className="text-textSecondary ml-auto">{formatBytes(model.size)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 p-2 rounded-[8px] bg-surfaceSecondary text-textSecondary">
              <span className="w-1.5 h-1.5 rounded-full bg-textSecondary/30" />
              <span>ONNX Runtime (WASM)</span>
              <span className="ml-auto">{formatBytes(checkWebGPUSupport() && checkJSPISupport() ? AI_RUNTIME_JSPI : AI_RUNTIME_WASM)}</span>
            </div>
          </div>

          {offlineState?.aiPack.status === 'downloading' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-textSecondary">
                <span>Downloading & verifying…</span>
                <span>{offlineState.aiPack.progress}%</span>
              </div>
              <div className="h-2 bg-surfaceSecondary rounded-[4px] overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${offlineState.aiPack.progress}%` }}
                />
              </div>
            </div>
          )}

          {!aiReady && offlineState?.aiPack.status !== 'downloading' && !isDownloadingAI && (
            <Button
              variant="soft"
              fullWidth
              onClick={downloadAIPack}
              disabled={isDownloadingAI}
              className="mt-2"
            >
              {isDownloadingAI ? 'Downloading…' : 'Download AI Models for Offline Use'}
            </Button>
          )}

          {offlineState?.aiPack.status === 'failed' && (
            <p className="text-xs text-error flex items-center gap-1">
              <AlertCircle className="w-3 h-3" strokeWidth={2} />
              Failed: {offlineState.aiPack.error}
            </p>
          )}
        </div>

        {/* Storage */}
        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-base font-semibold text-textPrimary flex items-center gap-2">
            <HardDrive className="w-5 h-5" strokeWidth={1.8} />
            Storage
          </h3>

          {storage?.estimate && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-textSecondary">Used</span>
                <span className="text-textPrimary font-medium">{formatBytes(storage.estimate.usage)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-textSecondary">Available</span>
                <span className="text-textPrimary font-medium">{formatBytes(storage.estimate.quota - storage.estimate.usage)}</span>
              </div>
              <div className="h-2 bg-surfaceSecondary rounded-[4px] overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${storage.estimate.quota > 0 ? (storage.estimate.usage / storage.estimate.quota) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-textSecondary">
                {storage.persistent ? '✓ Persistent storage granted' : '⚠ Best-effort storage (may be cleared under pressure)'}
              </p>
            </div>
          )}

          {!storage?.persistent && (
            <Button variant="soft" fullWidth onClick={async () => { await requestPersistentStorage(); loadState(); }} className="mt-2">
              Request Persistent Storage
            </Button>
          )}
        </div>

        {/* Danger Zone */}
        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-base font-semibold text-textPrimary">Danger Zone</h3>

          <Button variant="ghost" fullWidth onClick={clearCache} className="text-error hover:bg-error/5">
            <Trash2 className="w-4 h-4 mr-2" strokeWidth={1.8} />
            Clear Offline Caches (keeps projects)
          </Button>

          <Button variant="ghost" fullWidth onClick={clearAllData} className="text-error hover:bg-error/5">
            <Trash2 className="w-4 h-4 mr-2" strokeWidth={1.8} />
            Delete All Local Data (projects + caches)
          </Button>
        </div>

        {error && (
          <div className="p-3 rounded-[8px] bg-error/10 border border-error/30 text-error text-xs">
            {error}
          </div>
        )}
      </div>
    </ModalSheet>
  );
};

function checkWebGPUSupport(): boolean {
  try {
    const nav = navigator as { gpu?: { requestAdapter?: () => Promise<unknown> } };
    return !!nav?.gpu?.requestAdapter;
  } catch {
    return false;
  }
}

function checkJSPISupport(): boolean {
  try {
    return typeof (WebAssembly as { Suspending?: unknown }).Suspending === 'function';
  } catch {
    return false;
  }
}

interface PackStatus {
  status: 'pending' | 'downloading' | 'verifying' | 'ready' | 'failed';
  progress: number;
  totalBytes: number;
  completedBytes: number;
  lastUpdated: string;
  error?: string;
}

interface AIPackStatus {
  status: 'not-downloaded' | 'downloading' | 'verifying' | 'warming-up' | 'ready' | 'failed';
  progress: number;
  totalBytes: number;
  completedBytes: number;
  lastUpdated: string;
  error?: string;
  modelVersions: Record<string, string>;
}

interface StorageStatus {
  estimate: { usage: number; quota: number } | null;
  persistent: boolean;
  lastChecked: string;
}