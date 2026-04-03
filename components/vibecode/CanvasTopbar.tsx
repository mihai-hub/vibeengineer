'use client';
import { Code, Loader2, Play, Save, Square } from 'lucide-react';

interface CanvasTopbarProps {
  projectName: string;
  isSaving: boolean;
  isGenerating: boolean;
  isPreviewRunning: boolean;
  onSave: () => void;
  onGenerateCode: () => void;
  onRunPreview: () => void;
  onStopPreview: () => void;
  onBack: () => void;
}

export function CanvasTopbar({
  projectName,
  isSaving,
  isGenerating,
  isPreviewRunning,
  onSave,
  onGenerateCode,
  onRunPreview,
  onStopPreview,
  onBack,
}: CanvasTopbarProps) {
  return (
    <div className="h-16 bg-black border-b border-neutral-800 px-4 flex items-center justify-between">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-neutral-400 hover:text-white transition-colors text-sm"
        >
          ← Back
        </button>
        
        <div className="h-6 w-px bg-neutral-700" />
        
        <div>
          <h1 className="text-white font-semibold text-lg">{projectName}</h1>
          <p className="text-neutral-500 text-xs">Visual Canvas</p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Save Button */}
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save
            </>
          )}
        </button>

        {/* Generate Code Button */}
        <button
          onClick={onGenerateCode}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Code className="w-4 h-4" />
              Generate Code
            </>
          )}
        </button>

        {/* Preview Button */}
        {!isPreviewRunning ? (
          <button
            onClick={onRunPreview}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            Run Preview
          </button>
        ) : (
          <button
            onClick={onStopPreview}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
          >
            <Square className="w-4 h-4" />
            Stop Preview
          </button>
        )}
      </div>
    </div>
  );
}








