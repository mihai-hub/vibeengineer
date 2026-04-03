/**
 * VibeCode Canvas Schema
 * Defines the structure for visual canvas nodes and edges
 */

export type NodeType = 
  | 'page'
  | 'component'
  | 'api'
  | 'database'
  | 'auth'
  | 'style'
  | 'data-source'
  | 'webhook';

export interface CanvasNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, any>;
    description?: string;
  };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'smoothstep' | 'step' | 'straight';
  label?: string;
  animated?: boolean;
}

export interface CanvasSnapshot {
  id?: string;
  project_id: string;
  name: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  metadata?: {
    created_at?: string;
    updated_at?: string;
    version?: string;
  };
}

export interface CanvasProject {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  last_snapshot?: CanvasSnapshot;
}

/**
 * Code generation spec that Jeff understands
 */
export interface CodeGenerationSpec {
  project_name: string;
  description: string;
  pages: Array<{
    name: string;
    route: string;
    components: string[];
    apis: string[];
  }>;
  components: Array<{
    name: string;
    props: Record<string, any>;
    children?: string[];
  }>;
  apis: Array<{
    name: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    route: string;
    auth_required?: boolean;
    database_query?: string;
  }>;
  database?: {
    tables: Array<{
      name: string;
      columns: Array<{
        name: string;
        type: string;
        nullable?: boolean;
      }>;
    }>;
  };
  auth?: {
    provider: 'supabase' | 'clerk' | 'auth0' | 'custom';
    features: string[];
  };
  styling?: {
    framework: 'tailwind' | 'css' | 'styled-components';
    theme?: Record<string, any>;
  };
}

/**
 * Node palette items for drag-and-drop
 */
export const NODE_PALETTE_ITEMS = [
  {
    type: 'page' as NodeType,
    label: 'Page',
    icon: '📄',
    description: 'Create a new page/route',
    defaultConfig: { route: '/new-page', title: 'New Page' },
  },
  {
    type: 'component' as NodeType,
    label: 'Component',
    icon: '🧩',
    description: 'Reusable UI component',
    defaultConfig: { name: 'NewComponent', props: {} },
  },
  {
    type: 'api' as NodeType,
    label: 'API Route',
    icon: '🔌',
    description: 'Backend API endpoint',
    defaultConfig: { method: 'GET', route: '/api/data' },
  },
  {
    type: 'database' as NodeType,
    label: 'Database',
    icon: '🗄️',
    description: 'Database table/schema',
    defaultConfig: { table: 'users', columns: [] },
  },
  {
    type: 'auth' as NodeType,
    label: 'Auth',
    icon: '🔐',
    description: 'Authentication provider',
    defaultConfig: { provider: 'supabase', features: ['login', 'signup'] },
  },
  {
    type: 'style' as NodeType,
    label: 'Styling',
    icon: '🎨',
    description: 'Theme and styling',
    defaultConfig: { framework: 'tailwind' },
  },
  {
    type: 'data-source' as NodeType,
    label: 'Data Source',
    icon: '📊',
    description: 'External data source',
    defaultConfig: { url: '', method: 'GET' },
  },
  {
    type: 'webhook' as NodeType,
    label: 'Webhook',
    icon: '🪝',
    description: 'Webhook integration',
    defaultConfig: { url: '', events: [] },
  },
] as const;

/**
 * Get node color by type
 */
export function getNodeColor(type: NodeType): string {
  const colors: Record<NodeType, string> = {
    page: '#60a5fa',
    component: '#a78bfa',
    api: '#34d399',
    database: '#f59e0b',
    auth: '#ef4444',
    style: '#ec4899',
    'data-source': '#06b6d4',
    webhook: '#8b5cf6',
  };
  return colors[type] || '#6b7280';
}

/**
 * Validate canvas snapshot
 */
export function validateSnapshot(snapshot: Partial<CanvasSnapshot>): string[] {
  const errors: string[] = [];
  
  if (!snapshot.project_id) {
    errors.push('project_id is required');
  }
  
  if (!snapshot.name || snapshot.name.trim() === '') {
    errors.push('name is required');
  }
  
  if (!Array.isArray(snapshot.nodes)) {
    errors.push('nodes must be an array');
  }
  
  if (!Array.isArray(snapshot.edges)) {
    errors.push('edges must be an array');
  }
  
  return errors;
}








