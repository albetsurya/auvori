import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { PhotoCanvas } from './components/PhotoCanvas';
import { PresetDrawer } from './components/PresetDrawer';
import { ExportModal } from './components/ExportModal';
import { ProModal } from './components/ProModal';
import { BottomNav } from './components/BottomNav';
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
  ImageTransform,
  LicenseState,
  ManualAdjustments,
  Preset,
  PresetCategory,
  RecentEdit,
  ThemeMode
} from './types';
import { buildEffectiveRecipe, generatePresetThumbnail } from './lib/imageEngine';
import { createSamplePhotoDataUrl, SamplePhotoId } from './lib/samplePhoto';
import { loadSavedLicense } from './lib/license';
import {
  applyThemeToDom,
  clearRecentEdits,
  loadDefaultWatermark,
  loadFavoritePresetIds,
  loadRecentEdits,
  loadTheme,
  saveDefaultWatermark,
  saveFavoritePresetIds,
  saveRecentEdits,
  saveTheme
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

  // Navigation & Theme
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [presetCategory, setPresetCategory] = useState<PresetCategory>('all');
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
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
  const [sourceLabel, setSourceLabel] = useState<string>('Studio Photo');
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
    applyThemeToDom(theme);
  }, [theme]);

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

  const showToast = useCallback((tone: ToastMessage['tone'], text: string) => {
    const id = Date.now();
    setToast({ id, tone, text });
    setTimeout(() => {
      setToast((cur) => (cur?.id === id ? null : cur));
    }, 3200);
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
      initial?: Partial<EditorSnapshot>
    ) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const initPreset =
          PRESETS.find((p) => p.id === (initial?.presetId || 'seoul-cafe')) ?? PRESETS[1];
        const initSnap: EditorSnapshot = {
          presetId: initPreset.id,
          intensity: initial?.intensity ?? (initPreset.id === 'original' ? 100 : 85),
          manual: initial?.manual ?? DEFAULT_ADJUSTMENTS,
          transform: initial?.transform ?? DEFAULT_TRANSFORM
        };

        setSourceImage(img);
        setSourceLabel(label);
        setActivePreset(initPreset);
        setIntensity(initSnap.intensity);
        setManual(initSnap.manual);
        setTransform(initSnap.transform);
        setSplitMode(false);
        setHistory([initSnap]);
        setHistoryIndex(0);
        setHasUnsavedChanges(false);

        const nextThumbs: Record<string, string> = {};
        PRESETS.forEach((p, idx) => {
          setTimeout(() => {
            nextThumbs[p.id] = generatePresetThumbnail(img, p.recipe);
            if (idx === PRESETS.length - 1 || idx % 4 === 0) {
              setThumbnails({ ...nextThumbs });
            }
          }, idx * 12);
        });
      };
      img.onerror = () => {
        showToast('error', 'Something went wrong loading that photo. Try again.');
      };
      img.src = url;
    },
    [showToast]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '') || 'Gallery Photo';
    loadImageIntoEditor(url, cleanName);
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
    setTransform(snap.transform);
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

  const handleExportSuccess = (thumbDataUrl: string) => {
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
    showToast('success', 'Beautifully done.');
  };

  const handleRequestEditorBack = () => {
    if (hasUnsavedChanges && historyIndex > 0) {
      setConfirmDiscardOpen(true);
    } else {
      setSourceImage(null);
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
        /* Contextual Photo Editor Workspace (no global bottom navigation) */
        <>
          <Header
            presetName={activePreset.name}
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

          <PhotoCanvas
            sourceImage={sourceImage}
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
              pushHistory({
                presetId: activePreset.id,
                intensity,
                manual,
                transform: nextTransform
              });
            }}
            onToggleFavorite={handleToggleFavorite}
          />
        </>
      ) : (
        /* Main Studio Browse Shell: Home / Presets / Discover / Profile */
        <>
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
              theme={theme}
              defaultWatermark={defaultWatermark}
              favoritesCount={favoriteIds.length}
              recentsCount={recentEdits.length}
              onToggleTheme={(nextTheme) => {
                setTheme(nextTheme);
                saveTheme(nextTheme);
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
              setSourceImage(null);
            }}
          >
            Discard
          </Button>
        </div>
      </ModalSheet>
    </div>
  );
}
