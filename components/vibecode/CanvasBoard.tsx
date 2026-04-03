'use client';
import { useCallback } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    addEdge,
    useEdgesState,
    useNodesState,
    type Connection,
    type Edge,
    type EdgeChange,
    type Node,
    type NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { CanvasEdge as SchemaEdge, CanvasNode as SchemaNode } from '@/lib/canvas/schema';
import { getNodeColor } from '@/lib/canvas/schema';

interface CanvasBoardProps {
  initialNodes?: SchemaNode[];
  initialEdges?: SchemaEdge[];
  onNodesChange: (nodes: SchemaNode[]) => void;
  onEdgesChange: (edges: SchemaEdge[]) => void;
  onNodeSelect: (node: SchemaNode | null) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
}

// Custom node component
function CustomNode({ data, selected }: any) {
  const nodeColor = getNodeColor(data.nodeType);
  
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-neutral-900 min-w-[150px] ${
        selected ? 'border-blue-500' : 'border-neutral-700'
      }`}
      style={{ borderColor: selected ? '#3b82f6' : nodeColor }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: nodeColor }}
        />
        <div className="text-xs font-semibold text-white">{data.label}</div>
      </div>
      <div className="text-[10px] text-neutral-400 capitalize">{data.nodeType}</div>
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

export function CanvasBoard({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
  onNodeSelect,
  onDrop,
  onDragOver,
}: CanvasBoardProps) {
  // Convert schema nodes to ReactFlow nodes
  const rfNodes: Node[] = initialNodes.map(node => ({
    id: node.id,
    type: 'custom',
    position: node.position,
    data: {
      label: node.data.label,
      nodeType: node.type,
      config: node.data.config,
    },
  }));

  // Convert schema edges to ReactFlow edges
  const rfEdges: Edge[] = initialEdges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type || 'default',
    label: edge.label,
    animated: edge.animated,
  }));

  const [nodes, setNodes, onNodesChangeHandler] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChangeHandler] = useEdgesState(rfEdges);

  // Handle node changes and propagate to parent
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChangeHandler(changes);
    
    // After changes, convert back to schema format
    setTimeout(() => {
      setNodes((currentNodes) => {
        const schemaNodes: SchemaNode[] = currentNodes.map(node => ({
          id: node.id,
          type: node.data.nodeType,
          position: node.position,
          data: {
            label: node.data.label,
            config: node.data.config || {},
            description: node.data.description,
          },
        }));
        onNodesChange(schemaNodes);
        return currentNodes;
      });
    }, 0);
  }, [onNodesChangeHandler, onNodesChange, setNodes]);

  // Handle edge changes and propagate to parent
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChangeHandler(changes);
    
    // After changes, convert back to schema format
    setTimeout(() => {
      setEdges((currentEdges) => {
        const schemaEdges: SchemaEdge[] = currentEdges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type as any,
          label: edge.label as string | undefined,
          animated: edge.animated,
        }));
        onEdgesChange(schemaEdges);
        return currentEdges;
      });
    }, 0);
  }, [onEdgesChangeHandler, onEdgesChange, setEdges]);

  // Handle connection creation
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    },
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const schemaNode: SchemaNode = {
      id: node.id,
      type: node.data.nodeType,
      position: node.position,
      data: {
        label: node.data.label,
        config: node.data.config || {},
        description: node.data.description,
      },
    };
    onNodeSelect(schemaNode);
  }, [onNodeSelect]);

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  return (
    <div
      className="flex-1 bg-neutral-950"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#404040" gap={16} />
        <Controls className="bg-neutral-800 border border-neutral-700 rounded-lg" />
        <MiniMap
          className="bg-neutral-900 border border-neutral-700 rounded-lg"
          nodeColor={(node) => getNodeColor(node.data.nodeType)}
          maskColor="rgba(0, 0, 0, 0.6)"
        />
      </ReactFlow>
    </div>
  );
}

