import React from 'react';
import { ArrowLeft, Columns2, Download, Redo2, RotateCcw, Undo2 } from 'lucide-react';

interface HeaderProps {
  presetName: string;
  canUndo: boolean;
  canRedo: boolean;
  splitMode: boolean;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSplit: () => void;
  onReset: () => void;
  onOpenExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  presetName,
  canUndo,
  canRedo,
  splitMode,
  onBack,
  onUndo,
  onRedo,
  onToggleSplit,
  onReset,
  onOpenExport
}) => {
  return (
    <header className="h-[60px] px-3 sm:px-4 bg-surface/95 backdrop-blur-md border-b border-border shrink-0 z-20 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1 min-w-0">
        <button
          onClick={onBack}
          aria-label="Back to studio"
          className="w-11 h-11 rounded-[12px] flex items-center justify-center text-textPrimary hover:bg-surfaceSecondary active:scale-95 transition duration-fast shrink-0"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={1.85} />
        </button>
        <span className="font-display text-lg font-semibold text-textPrimary truncate hidden xs:inline sm:inline">
          {presetName}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo"
          className={`w-11 h-11 rounded-[12px] flex items-center justify-center transition duration-fast ${
            canUndo
              ? 'text-textPrimary hover:bg-surfaceSecondary active:scale-95'
              : 'text-textSecondary opacity-40 pointer-events-none'
          }`}
        >
          <Undo2 className="w-5 h-5" strokeWidth={1.8} />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo"
          className={`w-11 h-11 rounded-[12px] flex items-center justify-center transition duration-fast ${
            canRedo
              ? 'text-textPrimary hover:bg-surfaceSecondary active:scale-95'
              : 'text-textSecondary opacity-40 pointer-events-none'
          }`}
        >
          <Redo2 className="w-5 h-5" strokeWidth={1.8} />
        </button>

        <button
          onClick={onToggleSplit}
          aria-label="Compare Before and After"
          title="Compare Before / After"
          className={`w-11 h-11 rounded-[12px] flex items-center justify-center transition duration-fast ${
            splitMode
              ? 'bg-primary text-primaryText'
              : 'text-textPrimary hover:bg-surfaceSecondary active:scale-95'
          }`}
        >
          <Columns2 className="w-5 h-5" strokeWidth={1.8} />
        </button>

        <button
          onClick={onReset}
          aria-label="Reset edits"
          title="Reset edits"
          className="w-11 h-11 rounded-[12px] flex items-center justify-center text-textSecondary hover:text-textPrimary hover:bg-surfaceSecondary active:scale-95 transition duration-fast"
        >
          <RotateCcw className="w-4 h-4" strokeWidth={1.8} />
        </button>

        <button
          onClick={onOpenExport}
          className="ml-1 h-10 px-4 rounded-[12px] bg-primary hover:bg-primaryHover text-primaryText font-medium text-xs inline-flex items-center gap-1.5 shadow-card active:scale-95 transition duration-fast shrink-0"
        >
          <Download className="w-4 h-4" strokeWidth={1.85} />
          <span>Save</span>
        </button>
      </div>
    </header>
  );
};
