'use client';
import { ArrowRight, Edit3, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Edge, Node } from 'reactflow';

interface ListModeProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (nodeId: string) => void;
  onNodeEdit?: (nodeId: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onNodeRun?: (nodeId: string) => void;
  onEdgeCreate?: (sourceId: string, targetId: string) => void;
  className?: string;
}

export function ListMode({
  nodes,
  edges,
  onNodeClick,
  onNodeEdit,
  onNodeDelete,
  onNodeRun,
  onEdgeCreate,
  className = ''
}: ListModeProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const getNodeConnections = (nodeId: string) => {
    const outgoing = edges.filter(edge => edge.source === nodeId);
    const incoming = edges.filter(edge => edge.target === nodeId);
    return { outgoing, incoming };
  };

  const getNodeTypeColor = (type: string) => {
    switch (type) {
      case 'input': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'process': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'output': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'decision': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default: return 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30';
    }
  };

  const getNodeTypeIcon = (type: string) => {
    switch (type) {
      case 'input': return '📥';
      case 'process': return '⚙️';
      case 'output': return '📤';
      case 'decision': return '❓';
      default: return '🔧';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-sm text-neutral-400 mb-4">
        List Mode • {nodes.length} nodes, {edges.length} connections
      </div>

      {nodes.map((node) => {
        const { outgoing, incoming } = getNodeConnections(node.id);
        const isSelected = selectedNode === node.id;

        return (
          <div
            key={node.id}
            className={`bg-neutral-800 rounded-lg border transition-all ${
              isSelected 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-neutral-700 hover:border-neutral-600'
            }`}
          >
            {/* Node Header */}
            <div className="p-4 border-b border-neutral-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getNodeTypeIcon(node.data.type || 'default')}</span>
                  <div>
                    <h3 className="font-medium text-white">{node.data.label || node.id}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 rounded text-xs border ${getNodeTypeColor(node.data.type || 'default')}`}>
                        {node.data.type || 'default'}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {outgoing.length} → • ← {incoming.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNodeRun?.(node.id)}
                    className="p-2 text-green-400 hover:bg-green-400/10 rounded transition-colors"
                    title="Run node"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onNodeEdit?.(node.id)}
                    className="p-2 text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                    title="Edit node"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onNodeDelete?.(node.id)}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded transition-colors"
                    title="Delete node"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Node Content */}
            {node.data.description && (
              <div className="p-4 text-sm text-neutral-300">
                {node.data.description}
              </div>
            )}

            {/* Connections */}
            {(outgoing.length > 0 || incoming.length > 0) && (
              <div className="px-4 pb-4 space-y-2">
                {outgoing.length > 0 && (
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">Connects to:</div>
                    <div className="flex flex-wrap gap-1">
                      {outgoing.map((edge) => {
                        const targetNode = nodes.find(n => n.id === edge.target);
                        return (
                          <button
                            key={edge.id}
                            onClick={() => onNodeClick?.(edge.target)}
                            className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded hover:bg-blue-500/30 transition-colors"
                          >
                            {targetNode?.data.label || edge.target}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {incoming.length > 0 && (
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">Connected from:</div>
                    <div className="flex flex-wrap gap-1">
                      {incoming.map((edge) => {
                        const sourceNode = nodes.find(n => n.id === edge.source);
                        return (
                          <button
                            key={edge.id}
                            onClick={() => onNodeClick?.(edge.source)}
                            className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded hover:bg-green-500/30 transition-colors"
                          >
                            {sourceNode?.data.label || edge.source}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="px-4 pb-4">
              <button
                onClick={() => setSelectedNode(isSelected ? null : node.id)}
                className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <ArrowRight className={`w-3 h-3 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                {isSelected ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>
        );
      })}

      {nodes.length === 0 && (
        <div className="text-center py-8 text-neutral-500">
          No nodes to display
        </div>
      )}
    </div>
  );
}
