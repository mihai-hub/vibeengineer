'use client';
import { NODE_PALETTE_ITEMS } from '@/lib/canvas/schema';

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string, config: any) => void;
}

export function NodePalette({ onDragStart }: NodePaletteProps) {
  return (
    <div className="w-64 bg-neutral-900 border-r border-neutral-800 p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold text-white mb-4">Node Palette</h3>
      
      <div className="space-y-2">
        {NODE_PALETTE_ITEMS.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(event) => onDragStart(event, item.type, item.defaultConfig)}
            className="p-3 bg-neutral-800 rounded-lg border border-neutral-700 cursor-move hover:border-blue-500 hover:bg-neutral-750 transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{item.icon}</span>
              <span className="text-sm font-medium text-white">{item.label}</span>
            </div>
            <p className="text-xs text-neutral-400 group-hover:text-neutral-300">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-neutral-800">
        <div className="text-xs text-neutral-500 space-y-2">
          <p>💡 <strong>Tip:</strong> Drag nodes onto the canvas</p>
          <p>🔗 Connect nodes by dragging from edges</p>
          <p>✏️ Click nodes to edit properties</p>
        </div>
      </div>
    </div>
  );
}








