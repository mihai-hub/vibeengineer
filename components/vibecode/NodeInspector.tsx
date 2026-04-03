'use client';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { CanvasNode } from '@/lib/canvas/schema';
import { getNodeColor } from '@/lib/canvas/schema';

interface NodeInspectorProps {
  node: CanvasNode | null;
  onUpdate: (node: CanvasNode) => void;
  onClose: () => void;
}

export function NodeInspector({ node, onUpdate, onClose }: NodeInspectorProps) {
  const [label, setLabel] = useState('');
  const [config, setConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    if (node) {
      setLabel(node.data.label);
      setConfig(node.data.config);
    }
  }, [node]);

  if (!node) {
    return (
      <div className="w-80 bg-neutral-900 border-l border-neutral-800 p-6 flex items-center justify-center">
        <p className="text-neutral-500 text-sm text-center">
          Select a node to edit its properties
        </p>
      </div>
    );
  }

  const handleSave = () => {
    onUpdate({
      ...node,
      data: {
        ...node.data,
        label,
        config,
      },
    });
  };

  const handleConfigChange = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const nodeColor = getNodeColor(node.type);

  return (
    <div className="w-80 bg-neutral-900 border-l border-neutral-800 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Node Properties</h3>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Node Type Badge */}
      <div className="mb-4">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: nodeColor }}
        >
          <span className="capitalize">{node.type}</span>
        </div>
      </div>

      {/* Label */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-neutral-400 mb-2">
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          placeholder="Node name"
        />
      </div>

      {/* Configuration */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-neutral-400 mb-2">
          Configuration
        </label>
        
        <div className="space-y-3">
          {Object.entries(config).map(([key, value]) => (
            <div key={key}>
              <label className="block text-xs text-neutral-500 mb-1 capitalize">
                {key.replace(/_/g, ' ')}
              </label>
              {typeof value === 'boolean' ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => handleConfigChange(key, e.target.checked)}
                    className="rounded border-neutral-700 bg-neutral-800 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-neutral-400">Enabled</span>
                </label>
              ) : Array.isArray(value) ? (
                <textarea
                  value={JSON.stringify(value, null, 2)}
                  onChange={(e) => {
                    try {
                      handleConfigChange(key, JSON.parse(e.target.value));
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  rows={3}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              ) : typeof value === 'object' ? (
                <textarea
                  value={JSON.stringify(value, null, 2)}
                  onChange={(e) => {
                    try {
                      handleConfigChange(key, JSON.parse(e.target.value));
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  rows={4}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              ) : (
                <input
                  type="text"
                  value={String(value)}
                  onChange={(e) => handleConfigChange(key, e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              )}
            </div>
          ))}
        </div>

        {/* Add Config Field */}
        <button
          onClick={() => {
            const newKey = prompt('Enter config key:');
            if (newKey) {
              handleConfigChange(newKey, '');
            }
          }}
          className="mt-3 w-full py-2 text-xs text-blue-400 border border-neutral-700 rounded hover:bg-neutral-800 transition-colors"
        >
          + Add Config Field
        </button>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={handleSave}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Save Changes
        </button>
        
        <button
          onClick={onClose}
          className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Node Info */}
      <div className="mt-6 pt-6 border-t border-neutral-800">
        <div className="text-xs text-neutral-500 space-y-1">
          <p><strong>ID:</strong> {node.id}</p>
          <p><strong>Position:</strong> ({Math.round(node.position.x)}, {Math.round(node.position.y)})</p>
        </div>
      </div>
    </div>
  );
}








