import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { PhotoCanvas } from './components/PhotoCanvas';
import { PresetDrawer } from './components/PresetDrawer';
import { ExportModal, ExportSuccessMeta, formatBytes } from './components/ExportModal';
import { ProModal } from './components/ProModal';
import { BottomNav } from './components/BottomNav';
import { TopStudioBar } from './components/TopStudioBar';
import { GalleryPickerSheet } from './components/GalleryPickerSheet';
import { PresetDetailModal } from './components/PresetDetailModal';
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
import { buildEffectiveRecipe } from './lib/imageEngine';
import { PhotoPipeline } from './engine/pipeline/photo-pipeline';
import { createSamplePhotoDataUrl, SamplePhotoId } from './lib/samplePhoto';
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

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Navigation & Editor Backdrop
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [presetCategory, setPresetCategory] = useState<PresetCategory>('all');
  const [editorBackdrop, setEditorBackdrop] = useState<EditorBackdrop>(() => loadEditorBackdrop());
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Studio collections & history persistence
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadFavoritePresetIds());
  const [recentEdits, setRecentEdits] = useState<RecentEdit[]>(() => loadRecentEdits());
  const [defaultWatermark, setDefaultWatermark] = useState<boolean>(() => loadDefaultWatermark());

  // Modals & sheets
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
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

  useEffect(() => {
    syncThemeColorMeta(Boolean(sourceImage), editorBackdrop);
  }, [sourceImage, editorBackdrop]);

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

  // Support deep link from Lynk.id thank-you page: /activate or /?code=XXX or /?email=XXX
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
    },
    [historyIndex]
  );

  const loadImageIntoEditor = useCallback(
    (
      url: string,
      label: string,
      initial?: Partial<EditorSnapshot>,
      isObjectUrl = false
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
        setActivePreset(initPreset);
        setIntensity(initSnap.intensity);
        setManual(initSnap.manual);
        setTransform(initSnap.transform);
        setThumbnails({});
        setSplitMode(false);
        setHistory([initSnap]);
        setHistoryIndex(0);
        setHasUnsavedChanges(false);

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
            .catch(() => {
              // Non-fatal thumbnail error
            });
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
    [revokeThumbnailUrls, revokeTrackedObjectUrl, showToast, sourceRevision]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '') || 'Gallery Photo';
    loadImageIntoEditor(url, cleanName, undefined, true);
    e.target.value = '';
  };

  const handleStartWithSample = (sampleId: SamplePhotoId, presetId?: string) => {
    const labelMap: Record<SamplePhotoId, string> = {
      cafe: 'Café Window',
      park: 'Garden Shade',
      window: 'Golden Hour'
    };
    const dataUrl = createSamplePhotoDataUrl(sampleId);
    loadImageIntoEditor(dataUrl, labelMap[sampleId], presetId ? { presetId } : undefined);
  };

  const handleOpenRecentEdit = (recent: RecentEdit) => {
    const sampleFallback: SamplePhotoId =
      PRESETS.find((p) => p.id === recent.presetId)?.category === 'portrait' ? 'park' : 'cafe';
    loadImageIntoEditor(createSamplePhotoDataUrl(sampleFallback), recent.title, {
      presetId: recent.presetId,
      intensity: recent.intensity,
      manual: recent.manual,
      transform: recent.transform
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
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIdx = historyIndex + 1;
    setHistoryIndex(nextIdx);
    applySnapshot(history[nextIdx]);
  };

  const handleSelectPreset = (preset: Preset) => {
    const nextInt = preset.id !== 'original' && intensity === 0 ? 85 : intensity;
    setActivePreset(preset);
    setIntensity(nextInt);
    pushHistory({ presetId: preset.id, intensity: nextInt, manual, transform });
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
    loadSeqRef.current++;
    editorPipelineRef.current?.cancelThumbnailBatch();
    revokeTrackedObjectUrl();
    revokeThumbnailUrls();
    setThumbnails({});
    setSourceImage(null);
  }, [revokeThumbnailUrls, revokeTrackedObjectUrl]);

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

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-bg text-textPrimary overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {!isOnline && <OfflineBanner />}
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {sourceImage ? (
        /* Contextual Photo Editor Workspace (Graphite Dark default or Chalk Light preference) */
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
              onChangeIntensity={setIntensity}
              onCommitIntensity={() =>
                pushHistory({ presetId: activePreset.id, intensity, manual, transform })
              }
              onChangeManual={setManual}
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
              }}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
        </div>
      ) : (
        /* Main Studio Browse Shell (always Neutral Analog Light: Chalk / White / Stone / Olive) */
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
          />

          {activeTab === 'home' && (
            <HomeScreen
              license={license}
              recentEdits={recentEdits}
              favoriteIds={favoriteIds}
              onStartEditing={() => setIsGalleryOpen(true)}
              onStartWithSample={(sid, pid) => handleStartWithSample(sid, pid)}
              onOpenRecentEdit={handleOpenRecentEdit}
              onOpenCollection={(cat) => {
                setPresetCategory(cat);
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
            />
          )}

          {activeTab === 'presets' && (
            <PresetsScreen
              license={license}
              category={presetCategory}
              favoriteIds={favoriteIds}
              onChangeCategory={setPresetCategory}
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
        onSelectSample={(sampleId) => handleStartWithSample(sampleId)}
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
