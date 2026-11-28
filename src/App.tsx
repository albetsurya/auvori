import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { AdaptiveStatusUi, PhotoCanvas } from './components/PhotoCanvas';
import { PresetDrawer } from './components/PresetDrawer';
import { ExportModal, ExportSuccessMeta, formatBytes } from './components/ExportModal';
import { ProModal } from './components/ProModal';
import { BottomNav } from './components/BottomNav';
import { TopStudioBar } from './components/TopStudioBar';
import { GalleryPickerSheet } from './components/GalleryPickerSheet';
import { StudioSampleLibrary } from './components/StudioSampleLibrary';
import { PresetDetailModal } from './components/PresetDetailModal';
import { OfflineResourceManager } from './components/OfflineResourceManager';
import { HomeScreen } from './screens/HomeScreen';
import { PresetsScreen } from './screens/PresetsScreen';
import { DiscoverScreen } from './screens/DiscoverScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ModalSheet } from './components/ui/ModalSheet';
import { Button } from './components/ui/Button';
import { OfflineBanner, ToastBanner, ToastMessage } from './components/ui/Toast';
import { PRESETS } from './data/presets';
import {
  AppTab,
  CuratedCollectionId,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_TRANSFORM,
  EditorBackdrop,
  ImageTransform,
  LicenseState,
  ManualAdjustments,
  Preset,
  PresetCategory,
  RecentEdit
} from './types';
import { buildEffectiveRecipe, prepareTransformedSource } from './lib/imageEngine';
import { resolveAdaptiveRelighting } from './engine/analysis/adaptive-relighting';
import { AnalysisResult } from './engine/analysis/analysis-types';
import { PhotoPipeline } from './engine/pipeline/photo-pipeline';
import {
  getPresetSampleId,
  getSamplePhotoLabel,
  getSamplePhotoUrl,
  SamplePhotoId
} from './lib/samplePhoto';
import { loadSavedLicense } from './lib/license';
import {
  clearRecentEdits,
  loadDefaultWatermark,
  loadEditorBackdrop,
  loadFavoritePresetIds,
  loadRecentEdits,
  saveDefaultWatermark,
  saveEditorBackdrop,
  saveFavoritePresetIds,
  saveRecentEdits,
  syncThemeColorMeta
} from './lib/storage';
import {
  createProject,
  createProjectFromEditor,
  getLatestProject,
  loadFullProjectState,
  replaceHistory,
  updateProject,
  getOfflineState,
  updateOfflineState,
  getStorageEstimate,
  requestPersistentStorage
} from './lib/idb';

interface EditorSnapshot {
  presetId: string;
  intensity: number;
  manual: ManualAdjustments;
  transform: ImageTransform;
}

const snapshotsEqual = (a: EditorSnapshot, b: EditorSnapshot): boolean =>
  a.presetId === b.presetId &&
  a.intensity === b.intensity &&
  JSON.stringify(a.manual) === JSON.stringify(b.manual) &&
  JSON.stringify(a.transform) === JSON.stringify(b.transform);

// Decode check: a fetched sample must be a usable image before it becomes a project source.
function assertDecodableImage(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Sample asset failed to decode'));
    };
    img.src = objectUrl;
  });
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Navigation & Editor Backdrop
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [presetCategory, setPresetCategory] = useState<PresetCategory>('all');
  const [selectedCollection, setSelectedCollection] = useState<CuratedCollectionId | null>(null);
  const [editorBackdrop, setEditorBackdrop] = useState<EditorBackdrop>(() => loadEditorBackdrop());
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Offline resource state
  const [offlineState, setOfflineState] = useState<{
    mandatoryPack: { status: string; progress: number };
    aiPack: { status: string; progress: number };
    storage: { estimate: { usage: number; quota: number } | null; persistent: boolean };
  } | null>(null);
  const [isOfflineManagerOpen, setIsOfflineManagerOpen] = useState(false);

  // Studio collections & history persistence
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadFavoritePresetIds());
  const [recentEdits, setRecentEdits] = useState<RecentEdit[]>(() => loadRecentEdits());
  const [defaultWatermark, setDefaultWatermark] = useState<boolean>(() => loadDefaultWatermark());

  // Modals & sheets
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isStudioSamplesOpen, setIsStudioSamplesOpen] = useState(false);
  const [detailPreset, setDetailPreset] = useState<Preset | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isProOpen, setIsProOpen] = useState(false);
  const [proInitialTab, setProInitialTab] = useState<'buy' | 'activate'>('buy');
  const [prefillCode, setPrefillCode] = useState('');
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Licensing
  const [license, setLicense] = useState<LicenseState>(() => loadSavedLicense());

  // Editor workspace state
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceRevision, setSourceRevision] = useState<number>(1);
  const [transformRevision, setTransformRevision] = useState<number>(1);
  const [sourceLabel, setSourceLabel] = useState<string>('Studio Photo');
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [sourceMimeType, setSourceMimeType] = useState<string>('image/jpeg');
  const [sourceOrientation, setSourceOrientation] = useState<number>(1);
  const activeObjectUrlRef = useRef<string | null>(null);
  const thumbObjectUrlsRef = useRef<string[]>([]);
  const [editorPipeline, setEditorPipeline] = useState<PhotoPipeline | null>(null);
  const editorPipelineRef = useRef<PhotoPipeline | null>(null);
  const loadSeqRef = useRef<number>(0);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [activePreset, setActivePreset] = useState<Preset>(
    () => PRESETS.find((p) => p.id === 'seoul-cafe') ?? PRESETS[1]
  );
  const [intensity, setIntensity] = useState<number>(85);
  const [manual, setManual] = useState<ManualAdjustments>(DEFAULT_ADJUSTMENTS);
  const [transform, setTransform] = useState<ImageTransform>(DEFAULT_TRANSFORM);
  const [splitMode, setSplitMode] = useState<boolean>(false);

  // Undo / Redo history
  const [history, setHistory] = useState<EditorSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Autosave state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const autosaveTimeoutRef = useRef<number | null>(null);
  const currentProjectIdRef = useRef<string | null>(null);
  // Latest autosave callback; timers must not capture the mount-time closure (sourceImage null)
  const performAutosaveRef = useRef<() => void>(() => {});
  const sourceTypeRef = useRef<'local-upload' | 'studio-sample'>('local-upload');
  const sourceAssetIdRef = useRef<string | null>(null);
  const retrySourceRef = useRef<(() => void) | null>(null);
  const [saveErrorKind, setSaveErrorKind] = useState<'none' | 'storage' | 'source'>('none');
  const pendingAutosaveRef = useRef<Partial<{
    presetId: string;
    intensity: number;
    manual: ManualAdjustments;
    transform: ImageTransform;
    history: EditorSnapshot[];
    historyIndex: number;
    exportCount: number;
  }>>({});

  // Adaptive Look non-blocking AI analysis state (lazy-triggered only for adaptive presets)
  const analysisSeqRef = useRef<number>(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [adaptiveStatus, setAdaptiveStatus] = useState<AdaptiveStatusUi>({
    status: 'idle',
    label: ''
  });

  // ─── Offline Resource State Sync ─────────────────────────────────────────
  useEffect(() => {
    const loadOfflineState = async () => {
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
      } : { mandatoryPack: { status: 'pending', progress: 0 }, aiPack: { status: 'not-downloaded', progress: 0 }, storage: { estimate, persistent, lastChecked: new Date().toISOString() } });
    };
    loadOfflineState();
  }, []);

  // ─── Session Recovery on Mount ───────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const recoverSession = async () => {
      try {
        const latest = await getLatestProject();
        if (!latest || !mounted) return;

        const fullState = await loadFullProjectState(latest.id);
        if (!fullState || !mounted) return;

        const { project, image, history: savedHistory } = fullState;
        currentProjectIdRef.current = project.id;

        // Restore source metadata for autosave
        if (project.sourceType) sourceTypeRef.current = project.sourceType;
        if (project.sourceAssetId) sourceAssetIdRef.current = project.sourceAssetId;
        retrySourceRef.current = null;
        setSaveErrorKind('none');

        // Load image from blob
        const img = new Image();
        img.onload = () => {
          if (!mounted) return;
          revokeTrackedObjectUrl();
          revokeThumbnailUrls();
          activeObjectUrlRef.current = URL.createObjectURL(image.blob);

          const initPreset = PRESETS.find((p) => p.id === project.activePresetId) ?? PRESETS[1];
          const initSnap: EditorSnapshot = {
            presetId: project.activePresetId,
            intensity: project.intensity,
            manual: project.manual,
            transform: project.transform
          };

          setSourceImage(img);
          setSourceRevision(1);
          setTransformRevision(1);
          setSourceLabel(project.name);
          setSourceBlob(image.blob);
          setSourceMimeType(image.mimeType);
          setSourceOrientation(image.width > image.height ? 1 : 1); // Simplified
          setActivePreset(initPreset);
          setIntensity(project.intensity);
          setManual(project.manual);
          setTransform(project.transform);
          setThumbnails({});
          setSplitMode(false);
          setHistory(savedHistory.length > 0 ? savedHistory : [initSnap]);
          setHistoryIndex(savedHistory.length - 1);
          setHasUnsavedChanges(false);

          const nextThumbs: Record<string, string> = {};
          const pipeline = editorPipelineRef.current;
          if (pipeline) {
            pipeline
              .generateThumbnails(img, 'editor-source', 1, PRESETS, (presetId, thumbUrl) => {
                if (thumbUrl.startsWith('blob:')) {
                  thumbObjectUrlsRef.current.push(thumbUrl);
                }
                nextThumbs[presetId] = thumbUrl;
                const count = Object.keys(nextThumbs).length;
                if (count % 4 === 0 || count === PRESETS.length) {
                  setThumbnails({ ...nextThumbs });
                }
              })
              .then((finalMap) => {
                setThumbnails({ ...finalMap });
              })
              .catch(() => {});
          }
        };
        img.onerror = () => {
          if (mounted) showToast('error', 'Failed to restore project image.');
        };
        img.src = URL.createObjectURL(image.blob);
      } catch (err) {
        console.warn('Session recovery failed:', err);
      }
    };

    recoverSession();
    return () => { mounted = false; };
  }, []);

  // ─── Connectivity & Online/Offline ───────────────────────────────────────
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ─── Theme Sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    syncThemeColorMeta(Boolean(sourceImage), editorBackdrop);
  }, [sourceImage, editorBackdrop]);

  // ─── Deep Link Handling ──────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeOrEmail = params.get('code') || params.get('email') || '';
    const isActivatePath = window.location.pathname.includes('activate');
    if (isActivatePath || codeOrEmail) {
      setProInitialTab('activate');
      setPrefillCode(codeOrEmail);
      setIsProOpen(true);
    }
  }, []);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const revokeThumbnailUrls = useCallback(() => {
    for (const u of thumbObjectUrlsRef.current) {
      if (u.startsWith('blob:')) URL.revokeObjectURL(u);
    }
    thumbObjectUrlsRef.current = [];
  }, []);

  const revokeTrackedObjectUrl = useCallback(() => {
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
  }, []);

  // ─── Pipeline Init ───────────────────────────────────────────────────────
  useEffect(() => {
    const pipeline = new PhotoPipeline({
      preferWebGL2: true,
      preferWorkerFallback: true
    });
    editorPipelineRef.current = pipeline;
    setEditorPipeline(pipeline);

    return () => {
      revokeTrackedObjectUrl();
      revokeThumbnailUrls();
      editorPipelineRef.current = null;
      pipeline.dispose();
    };
  }, [revokeThumbnailUrls, revokeTrackedObjectUrl]);

  const showToast = useCallback((tone: ToastMessage['tone'], text: string) => {
    const id = Date.now();
    setToast({ id, tone, text });
    setTimeout(() => {
      setToast((cur) => (cur?.id === id ? null : cur));
    }, 3600);
  }, []);

  // ─── Autosave ─────────────────────────────────────────────────────────────
  const scheduleAutosave = useCallback((patch: Partial<{
    presetId: string;
    intensity: number;
    manual: ManualAdjustments;
    transform: ImageTransform;
    history: EditorSnapshot[];
    historyIndex: number;
    exportCount: number;
  }>) => {
    pendingAutosaveRef.current = { ...pendingAutosaveRef.current, ...patch };

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      performAutosaveRef.current();
    }, 800);

    // Force save after max delay
    setTimeout(() => {
      if (pendingAutosaveRef.current && Object.keys(pendingAutosaveRef.current).length > 0) {
        performAutosaveRef.current();
      }
    }, 5000);
  }, []);

  const performAutosave = useCallback(async () => {
    const pending = pendingAutosaveRef.current;
    if (!pending || Object.keys(pending).length === 0) return;
    if (!currentProjectIdRef.current && !sourceImage) return;

    setSaveStatus('saving');

    try {
      if (currentProjectIdRef.current) {
        // Update existing project
        await updateProject(currentProjectIdRef.current, {
          name: sourceLabel,
          activePresetId: pending.presetId ?? activePreset.id,
          intensity: pending.intensity ?? intensity,
          manual: pending.manual ?? manual,
          transform: pending.transform ?? transform,
          historyLength: (pending.history ?? history).length,
          exportCount: pending.exportCount ?? 0,
          sourceType: sourceTypeRef.current,
          sourceAssetId: sourceAssetIdRef.current,
          updatedAt: new Date().toISOString()
        });

        if (pending.history) {
          await replaceHistory(currentProjectIdRef.current, pending.history);
        }
      } else if (sourceImage && sourceBlob) {
        // Create new project
        const projectId = await createProjectFromEditor({
          name: sourceLabel,
          sourceBlob,
          sourceWidth: sourceImage.naturalWidth,
          sourceHeight: sourceImage.naturalHeight,
          sourceOrientation,
          sourceMimeType,
          activePresetId: pending.presetId ?? activePreset.id,
          intensity: pending.intensity ?? intensity,
          manual: pending.manual ?? manual,
          transform: pending.transform ?? transform,
          history: pending.history ?? history,
          sourceType: sourceTypeRef.current,
          sourceAssetId: sourceAssetIdRef.current
        });
        currentProjectIdRef.current = projectId;
      } else {
        // No source Blob: cannot create a recoverable project. Never report "saved".
        setSaveStatus('failed');
        setSaveErrorKind('source');
        setHasUnsavedChanges(true);
        return;
      }

      pendingAutosaveRef.current = {};
      setSaveErrorKind('none');
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Autosave failed:', err);
      setSaveStatus('failed');
      setSaveErrorKind('storage');
      setHasUnsavedChanges(true);
      if (err instanceof Error && err.name === 'QuotaExceededError') {
        showToast('error', 'Storage full — delete old projects to continue.');
      }
    }
  }, [sourceImage, sourceBlob, sourceLabel, sourceMimeType, sourceOrientation, activePreset, intensity, manual, transform, history, showToast]);

  useEffect(() => {
    performAutosaveRef.current = performAutosave;
  }, [performAutosave]);

  const forceAutosave = useCallback(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    performAutosave();
  }, [performAutosave]);

  // ─── History Management ──────────────────────────────────────────────────
  const pushHistory = useCallback(
    (snap: EditorSnapshot) => {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        const last = sliced[sliced.length - 1];
        if (last && snapshotsEqual(last, snap)) return prev;
        const next = [...sliced, snap];
        setHistoryIndex(next.length - 1);
        return next;
      });
      setHasUnsavedChanges(true);
      scheduleAutosave({ historyIndex: historyIndex + 1 });
    },
    [historyIndex, scheduleAutosave]
  );

  // ─── Image Loading ────────────────────────────────────────────────────────
  const loadImageIntoEditor = useCallback(
    (
      url: string,
      label: string,
      initial?: Partial<EditorSnapshot>,
      isObjectUrl = false,
      blob?: Blob,
      mimeType = 'image/jpeg',
      sourceType?: 'local-upload' | 'studio-sample',
      sourceAssetId?: string | null
    ) => {
      const seq = ++loadSeqRef.current;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (seq !== loadSeqRef.current) {
          if (isObjectUrl) URL.revokeObjectURL(url);
          return;
        }
        revokeTrackedObjectUrl();
        revokeThumbnailUrls();
        if (isObjectUrl) activeObjectUrlRef.current = url;

        const initPreset =
          PRESETS.find((p) => p.id === (initial?.presetId || 'seoul-cafe')) ?? PRESETS[1];
        const initSnap: EditorSnapshot = {
          presetId: initPreset.id,
          intensity: initial?.intensity ?? (initPreset.id === 'original' ? 100 : 85),
          manual: initial?.manual ?? DEFAULT_ADJUSTMENTS,
          transform: initial?.transform ?? DEFAULT_TRANSFORM
        };

        const nextSourceRev = sourceRevision + 1;
        setSourceImage(img);
        setSourceRevision(nextSourceRev);
        setTransformRevision(1);
        setSourceLabel(label);
        if (blob) {
          setSourceBlob(blob);
          setSourceMimeType(mimeType);
        }
        // Track source metadata for autosave
        if (sourceType) sourceTypeRef.current = sourceType;
        if (sourceAssetId !== undefined) sourceAssetIdRef.current = sourceAssetId;
        // Clear any pending retry on successful load
        retrySourceRef.current = null;
        setSaveErrorKind('none');

        setActivePreset(initPreset);
        setIntensity(initSnap.intensity);
        setManual(initSnap.manual);
        setTransform(initSnap.transform);
        setThumbnails({});
        setSplitMode(false);
        setHistory([initSnap]);
        setHistoryIndex(0);
        setHasUnsavedChanges(false);
        currentProjectIdRef.current = null; // New project, will be created on autosave

        // Schedule autosave for studio samples immediately so they get persisted
        if (sourceType === 'studio-sample') {
          scheduleAutosave({ historyIndex: 0 });
        }

        const nextThumbs: Record<string, string> = {};
        const pipeline = editorPipelineRef.current;
        if (pipeline) {
          pipeline
            .generateThumbnails(img, 'editor-source', nextSourceRev, PRESETS, (presetId, thumbUrl) => {
              if (seq !== loadSeqRef.current) {
                if (thumbUrl.startsWith('blob:')) URL.revokeObjectURL(thumbUrl);
                return;
              }
              if (thumbUrl.startsWith('blob:')) {
                thumbObjectUrlsRef.current.push(thumbUrl);
              }
              nextThumbs[presetId] = thumbUrl;
              const count = Object.keys(nextThumbs).length;
              if (count % 4 === 0 || count === PRESETS.length) {
                setThumbnails({ ...nextThumbs });
              }
            })
            .then((finalMap) => {
              if (seq === loadSeqRef.current) {
                setThumbnails({ ...finalMap });
              }
            })
            .catch(() => {});
        }
      };
      img.onerror = () => {
        if (isObjectUrl) URL.revokeObjectURL(url);
        if (seq === loadSeqRef.current) {
          showToast('error', 'Something went wrong loading that photo. Try again.');
        }
      };
      img.src = url;
    },
    [revokeThumbnailUrls, revokeTrackedObjectUrl, showToast, sourceRevision, scheduleAutosave]
  );

  // Fetch sample asset and load with original Blob for offline persistence
  const loadSampleWithBlob = useCallback(async (sampleId: SamplePhotoId, presetId?: string) => {
    const label = getSamplePhotoLabel(sampleId);
    const url = getSamplePhotoUrl(sampleId);
    if (!url) {
      showToast('error', 'Sample not found.');
      return;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      const blob = await response.blob();
      await assertDecodableImage(blob);
      const mimeType = blob.type || 'image/jpeg';
      loadImageIntoEditor(url, label, presetId ? { presetId } : undefined, false, blob, mimeType, 'studio-sample', sampleId);
    } catch (err) {
      console.error('Sample load failed:', err);
      // Fallback: load without blob so UI still works, but mark as not-saved
      loadImageIntoEditor(url, label, presetId ? { presetId } : undefined, false, undefined, 'image/jpeg', 'studio-sample', sampleId);
      setSaveErrorKind('source');
      setSaveStatus('failed');
      setHasUnsavedChanges(true);
      retrySourceRef.current = () => loadSampleWithBlob(sampleId, presetId);
    }
  }, [loadImageIntoEditor, showToast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '') || 'Gallery Photo';
    loadImageIntoEditor(url, cleanName, undefined, true, file, file.type, 'local-upload', null);
    e.target.value = '';
  };

  const handleStartWithSample = (sampleId: SamplePhotoId, presetId?: string) => {
    loadSampleWithBlob(sampleId, presetId);
  };

  const handleOpenRecentEdit = (recent: RecentEdit) => {
    const matchedPreset = PRESETS.find((p) => p.id === recent.presetId);
    const sampleFallback = getPresetSampleId(recent.presetId, matchedPreset?.category);
    const label = recent.title;
    const url = getSamplePhotoUrl(sampleFallback);
    // Fetch the original sample Blob for offline persistence
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
        return r.blob();
      })
      .then(async (blob) => {
        await assertDecodableImage(blob);
        const mimeType = blob.type || 'image/jpeg';
        loadImageIntoEditor(
          url,
          label,
          {
            presetId: recent.presetId,
            intensity: recent.intensity,
            manual: recent.manual,
            transform: recent.transform
          },
          false,
          blob,
          mimeType,
          'studio-sample',
          sampleFallback
        );
      })
      .catch((err) => {
        console.error('Recent edit sample load failed:', err);
        // Fallback without blob
        loadImageIntoEditor(
          url,
          label,
          {
            presetId: recent.presetId,
            intensity: recent.intensity,
            manual: recent.manual,
            transform: recent.transform
          },
          false,
          undefined,
          'image/jpeg',
          'studio-sample',
          sampleFallback
        );
        setSaveErrorKind('source');
        setSaveStatus('failed');
        setHasUnsavedChanges(true);
        retrySourceRef.current = () => handleOpenRecentEdit(recent);
      });
  };

  const applySnapshot = (snap: EditorSnapshot) => {
    const preset = PRESETS.find((p) => p.id === snap.presetId) ?? PRESETS[0];
    setActivePreset(preset);
    setIntensity(snap.intensity);
    setManual(snap.manual);
    setTransform((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(snap.transform)) {
        setTransformRevision((r) => r + 1);
      }
      return snap.transform;
    });
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const nextIdx = historyIndex - 1;
    setHistoryIndex(nextIdx);
    applySnapshot(history[nextIdx]);
    scheduleAutosave({ historyIndex: nextIdx });
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIdx = historyIndex + 1;
    setHistoryIndex(nextIdx);
    applySnapshot(history[nextIdx]);
    scheduleAutosave({ historyIndex: nextIdx });
  };

  const handleSelectPreset = (preset: Preset) => {
    const nextInt = preset.id !== 'original' && intensity === 0 ? 85 : intensity;
    setActivePreset(preset);
    setIntensity(nextInt);
    pushHistory({ presetId: preset.id, intensity: nextInt, manual, transform });
    scheduleAutosave({ presetId: preset.id, intensity: nextInt });
  };

  const handleReset = () => {
    const resetSnap: EditorSnapshot = {
      presetId: PRESETS[0].id,
      intensity: 100,
      manual: DEFAULT_ADJUSTMENTS,
      transform: DEFAULT_TRANSFORM
    };
    applySnapshot(resetSnap);
    pushHistory(resetSnap);
    scheduleAutosave({ presetId: PRESETS[0].id, intensity: 100, manual: DEFAULT_ADJUSTMENTS, transform: DEFAULT_TRANSFORM });
  };

  const handleToggleFavorite = (presetId: string) => {
    if (presetId === 'original') return;
    setFavoriteIds((prev) => {
      const exists = prev.includes(presetId);
      const next = exists ? prev.filter((id) => id !== presetId) : [...prev, presetId];
      saveFavoritePresetIds(next);
      return next;
    });
  };

  const handleExportSuccess = (thumbDataUrl: string, meta?: ExportSuccessMeta) => {
    const entry: RecentEdit = {
      id: `${Date.now()}`,
      title: sourceLabel,
      presetId: activePreset.id,
      presetName: activePreset.name,
      intensity,
      manual,
      transform,
      thumbDataUrl,
      savedAt: new Date().toISOString()
    };
    const nextRecents = [entry, ...recentEdits].slice(0, 8);
    setRecentEdits(nextRecents);
    saveRecentEdits(nextRecents);
    setHasUnsavedChanges(false);
    scheduleAutosave({ exportCount: 1 });
    forceAutosave(); // Force immediate save on export
    if (meta) {
      showToast(
        'success',
        `Saved ${meta.format.toUpperCase()} (${meta.width}×${meta.height} · ${formatBytes(meta.sizeBytes)})`
      );
    } else {
      showToast('success', 'Photo saved.');
    }
  };

  const closeEditor = useCallback(() => {
    forceAutosave(); // Save before closing
    loadSeqRef.current++;
    editorPipelineRef.current?.cancelThumbnailBatch();
    revokeTrackedObjectUrl();
    revokeThumbnailUrls();
    setThumbnails({});
    setSourceImage(null);
    setSourceBlob(null);
    currentProjectIdRef.current = null;
    // Reset source metadata for next session
    sourceTypeRef.current = 'local-upload';
    sourceAssetIdRef.current = null;
    retrySourceRef.current = null;
    setSaveErrorKind('none');
  }, [forceAutosave, revokeThumbnailUrls, revokeTrackedObjectUrl]);

  const handleRequestEditorBack = () => {
    if (hasUnsavedChanges && historyIndex > 0) {
      setConfirmDiscardOpen(true);
    } else {
      closeEditor();
    }
  };

  const effectiveRecipe = useMemo(
    () => buildEffectiveRecipe(activePreset.recipe, intensity, manual),
    [activePreset, intensity, manual]
  );

  const transformRevisionKey = useMemo(
    () => `aspect=${transform.aspect}|rot=${transform.rotate}|flip=${transform.flipH ? 1 : 0}`,
    [transform.aspect, transform.rotate, transform.flipH]
  );

  const isAdaptivePresetActive = activePreset.lookType === 'adaptive';

  // ─── Adaptive Analysis ───────────────────────────────────────────────────
  useEffect(() => {
    const pipeline = editorPipelineRef.current;
    if (!sourceImage || !pipeline || !isAdaptivePresetActive) {
      analysisSeqRef.current++;
      pipeline?.cancelAdaptiveAnalysis();
      setAnalysisResult(null);
      setAdaptiveStatus({ status: 'idle', label: '' });
      return;
    }

    const seq = ++analysisSeqRef.current;
    const hasTransform =
      transform.rotate !== 0 || transform.flipH || transform.aspect !== 'original';
    const targetSrc = hasTransform ? prepareTransformedSource(sourceImage, transform) : sourceImage;

    const cached = pipeline.getCachedAdaptiveAnalysis({
      source: targetSrc,
      sourceId: 'editor-source',
      sourceRevision,
      transformRevision: transformRevisionKey
    });

    if (cached) {
      const resolved = resolveAdaptiveRelighting(activePreset.recipe.relighting, cached);
      setAnalysisResult(cached);
      setAdaptiveStatus({
        status: resolved.statusKind.startsWith('fallback') ? 'fallback' : 'ready',
        mode: resolved.mode,
        label: resolved.statusLabel
      });
      return;
    }

    setAnalysisResult(null);
    setAdaptiveStatus({
      status: 'analyzing',
      label: 'Analyzing subject & light...'
    });

    pipeline
      .analyzeAdaptive({
        source: targetSrc,
        sourceId: 'editor-source',
        sourceRevision,
        transformRevision: transformRevisionKey
      })
      .then((outcome) => {
        if (seq !== analysisSeqRef.current || outcome.cancelled) return;
        if (!outcome.result) {
          setAnalysisResult(null);
          setAdaptiveStatus({
            status: 'fallback',
            mode: 'fallback-signature',
            label: 'Signature Fallback · Offline Mode'
          });
          return;
        }
        const resolved = resolveAdaptiveRelighting(activePreset.recipe.relighting, outcome.result);
        setAnalysisResult(outcome.result);
        setAdaptiveStatus({
          status: resolved.statusKind.startsWith('fallback') ? 'fallback' : 'ready',
          mode: resolved.mode,
          label: resolved.statusLabel
        });
      })
      .catch(() => {
        if (seq !== analysisSeqRef.current) return;
        setAnalysisResult(null);
        setAdaptiveStatus({
          status: 'fallback',
          mode: 'fallback-signature',
          label: 'Signature Fallback · Offline Mode'
        });
      });
  }, [
    sourceImage,
    sourceRevision,
    transform,
    transformRevisionKey,
    isAdaptivePresetActive,
    activePreset.id
  ]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] w-full flex flex-col bg-bg text-textPrimary overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Offline Banner */}
      {!isOnline && <OfflineBanner />}

      {/* Save Status Indicator — shows even without sourceImage when source fetch failed */}
      {(sourceImage || saveErrorKind === 'source') && saveStatus !== 'idle' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[50] w-[calc(100%-32px)] max-w-[440px] pointer-events-auto">
          <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-[10px] bg-surface border shadow-card text-xs font-medium ${
            saveStatus === 'saving' ? 'border-info/40 text-info' :
            saveStatus === 'saved' ? 'border-success/40 text-success' :
            'border-error/40 text-error'
          }`}>
            {saveStatus === 'saving' && <> <span className="animate-pulse">●</span> Saving on this device… </>}
            {saveStatus === 'saved' && <span>Saved on this device</span>}
            {saveStatus === 'failed' && saveErrorKind === 'source' && (
              <>
                <span>Not saved — original asset unavailable</span>
                {retrySourceRef.current && (
                  <button
                    type="button"
                    onClick={retrySourceRef.current}
                    className="ml-2 px-3 py-1 text-xs font-medium text-primary bg-primary/10 border border-primary/30 rounded-[6px] hover:bg-primary/20"
                  >
                    Retry
                  </button>
                )}
              </>
            )}
            {saveStatus === 'failed' && saveErrorKind === 'storage' && <span>Save failed — check storage</span>}
            {saveStatus === 'failed' && saveErrorKind === 'none' && <span>Save failed</span>}
          </div>
        </div>
      )}

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {sourceImage ? (
        /* Contextual Photo Editor Workspace */
        <div
          data-editor-backdrop={editorBackdrop}
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
          style={{
            backgroundColor: 'var(--editor-background)',
            color: 'var(--editor-text)'
          }}
        >
          <Header
            presetName={activePreset.name}
            sourceLabel={sourceLabel}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            splitMode={splitMode}
            onBack={handleRequestEditorBack}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onToggleSplit={() => setSplitMode((v) => !v)}
            onReset={handleReset}
            onOpenExport={() => setIsExportOpen(true)}
          />

          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
            {editorPipeline && (
              <PhotoCanvas
                pipeline={editorPipeline}
                sourceImage={sourceImage}
                sourceRevision={sourceRevision}
                transformRevision={transformRevision}
                effectiveRecipe={effectiveRecipe}
                transform={transform}
                activePreset={activePreset}
                analysisResult={analysisResult}
                adaptiveStatus={adaptiveStatus}
                isProUnlocked={license.isPro}
                splitMode={splitMode}
                onOpenPro={() => {
                  setProInitialTab('buy');
                  setIsProOpen(true);
                }}
              />
            )}

            <PresetDrawer
              activePreset={activePreset}
              intensity={intensity}
              manual={manual}
              transform={transform}
              thumbnails={thumbnails}
              favoriteIds={favoriteIds}
              isProUnlocked={license.isPro}
              onSelectPreset={handleSelectPreset}
              onChangeIntensity={(val) => {
                setIntensity(val);
                scheduleAutosave({ intensity: val });
              }}
              onCommitIntensity={() =>
                pushHistory({ presetId: activePreset.id, intensity, manual, transform })
              }
              onChangeManual={(val) => {
                setManual(val);
                scheduleAutosave({ manual: val });
              }}
              onCommitManual={() =>
                pushHistory({ presetId: activePreset.id, intensity, manual, transform })
              }
              onChangeTransform={(nextTransform) => {
                setTransform(nextTransform);
                setTransformRevision((r) => r + 1);
                pushHistory({
                  presetId: activePreset.id,
                  intensity,
                  manual,
                  transform: nextTransform
                });
                scheduleAutosave({ transform: nextTransform });
              }}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
        </div>
      ) : (
        /* Main Studio Browse Shell */
        <>
          <TopStudioBar
            activeTab={activeTab}
            license={license}
            onSelectTab={setActiveTab}
            onOpenPhoto={() => setIsGalleryOpen(true)}
            onOpenPro={() => {
              setProInitialTab('buy');
              setIsProOpen(true);
            }}
            onOpenOfflineManager={() => setIsOfflineManagerOpen(true)}
          />

          {activeTab === 'home' && (
            <HomeScreen
              license={license}
              recentEdits={recentEdits}
              favoriteIds={favoriteIds}
              onStartEditing={() => setIsGalleryOpen(true)}
              onStartWithSample={(sid, pid) => handleStartWithSample(sid, pid)}
              onOpenRecentEdit={handleOpenRecentEdit}
              onOpenCollection={(cat, colId) => {
                setPresetCategory(cat);
                setSelectedCollection(colId ?? null);
                setActiveTab('presets');
              }}
              onSelectPresetDetail={(preset) => setDetailPreset(preset)}
              onToggleFavorite={handleToggleFavorite}
              onOpenDiscover={() => setActiveTab('discover')}
              onOpenProfile={() => setActiveTab('profile')}
              onOpenPro={() => {
                setProInitialTab('buy');
                setIsProOpen(true);
              }}
              onOpenStudioSamples={() => setIsStudioSamplesOpen(true)}
            />
          )}

          {activeTab === 'presets' && (
            <PresetsScreen
              license={license}
              category={presetCategory}
              collectionId={selectedCollection}
              favoriteIds={favoriteIds}
              onChangeCategory={setPresetCategory}
              onChangeCollection={setSelectedCollection}
              onToggleFavorite={handleToggleFavorite}
              onSelectPresetDetail={(preset) => setDetailPreset(preset)}
            />
          )}

          {activeTab === 'discover' && (
            <DiscoverScreen
              onTryLook={(preset, sampleId) => handleStartWithSample(sampleId, preset.id)}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileScreen
              license={license}
              editorBackdrop={editorBackdrop}
              defaultWatermark={defaultWatermark}
              favoritesCount={favoriteIds.length}
              recentsCount={recentEdits.length}
              onChangeEditorBackdrop={(nextBackdrop) => {
                setEditorBackdrop(nextBackdrop);
                saveEditorBackdrop(nextBackdrop);
              }}
              onToggleDefaultWatermark={(next) => {
                setDefaultWatermark(next);
                saveDefaultWatermark(next);
              }}
              onOpenPro={(tab) => {
                setProInitialTab(tab);
                setIsProOpen(true);
              }}
              onOpenFavorites={() => {
                setPresetCategory('favorites');
                setActiveTab('presets');
              }}
              onClearRecents={() => {
                clearRecentEdits();
                setRecentEdits([]);
                showToast('info', 'Recent edits cleared.');
              }}
              offlineState={offlineState}
            />
          )}

          <BottomNav
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onQuickCreate={() => setIsGalleryOpen(true)}
          />
        </>
      )}

      {/* Gallery Picker Bottom Sheet */}
      <GalleryPickerSheet
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        onPickDevicePhoto={() => fileInputRef.current?.click()}
        onOpenStudioSamples={() => {
          setIsGalleryOpen(false);
          setIsStudioSamplesOpen(true);
        }}
      />

      {/* Studio Sample Library */}
      <StudioSampleLibrary
        isOpen={isStudioSamplesOpen}
        onClose={() => setIsStudioSamplesOpen(false)}
        onSelectSample={(sampleId, presetId) => {
          setIsStudioSamplesOpen(false);
          handleStartWithSample(sampleId, presetId);
        }}
      />

      {/* Preset Detail Sheet */}
      <PresetDetailModal
        preset={detailPreset}
        isProUnlocked={license.isPro}
        isFavorite={detailPreset ? favoriteIds.includes(detailPreset.id) : false}
        onClose={() => setDetailPreset(null)}
        onToggleFavorite={handleToggleFavorite}
        onUsePreset={(preset, sampleId) => handleStartWithSample(sampleId, preset.id)}
      />

      {/* Export Bottom Sheet */}
      <ExportModal
        isOpen={isExportOpen}
        sourceImage={sourceImage}
        sourceRevision={sourceRevision}
        transformRevision={transformRevision}
        maxHardwareTextureSize={editorPipeline?.getMaxGpuTextureSize() ?? 4096}
        effectiveRecipe={effectiveRecipe}
        transform={transform}
        activePreset={activePreset}
        analysisResult={analysisResult}
        isProUnlocked={license.isPro}
        defaultWatermark={defaultWatermark}
        onClose={() => setIsExportOpen(false)}
        onOpenPro={() => {
          setProInitialTab('buy');
          setIsProOpen(true);
        }}
        onExportSuccess={handleExportSuccess}
      />

      {/* Pro / Lynk.id Activation Modal */}
      <ProModal
        isOpen={isProOpen}
        initialTab={proInitialTab}
        prefillIdentifier={prefillCode}
        license={license}
        onClose={() => setIsProOpen(false)}
        onLicenseChange={setLicense}
      />

      {/* Offline Resource Manager */}
      <OfflineResourceManager
        isOpen={isOfflineManagerOpen}
        onClose={() => setIsOfflineManagerOpen(false)}
      />

      {/* Unsaved Edit Discard Confirmation */}
      <ModalSheet
        isOpen={confirmDiscardOpen}
        onClose={() => setConfirmDiscardOpen(false)}
        variant="modal"
        title="Leave without saving?"
        subtitle="Your current tone and crop adjustments will be discarded."
      >
        <div className="flex items-center gap-3 pt-1">
          <Button variant="secondary" fullWidth onClick={() => setConfirmDiscardOpen(false)}>
            Keep Editing
          </Button>
          <Button
            variant="destructive"
            fullWidth
            onClick={() => {
              setConfirmDiscardOpen(false);
              closeEditor();
            }}
          >
            Discard
          </Button>
        </div>
      </ModalSheet>
    </div>
  );
}