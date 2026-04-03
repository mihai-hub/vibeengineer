/**
 * Transform canvas snapshots to code generation specs
 * This is what Jeff understands and can generate code from
 */

import type { CanvasEdge, CanvasNode, CanvasSnapshot, CodeGenerationSpec, NodeType } from './schema';

/**
 * Convert canvas snapshot to code generation spec
 */
export function toCodeSpec(snapshot: CanvasSnapshot): CodeGenerationSpec {
  const spec: CodeGenerationSpec = {
    project_name: snapshot.name,
    description: snapshot.metadata?.version || 'Generated from VibeCode canvas',
    pages: [],
    components: [],
    apis: [],
  };

  // Extract nodes by type
  const nodesByType = groupNodesByType(snapshot.nodes);
  
  // Build pages
  for (const pageNode of nodesByType.page || []) {
    const connectedComponents = findConnectedNodes(pageNode.id, snapshot.edges, snapshot.nodes, 'component');
    const connectedApis = findConnectedNodes(pageNode.id, snapshot.edges, snapshot.nodes, 'api');
    
    spec.pages.push({
      name: pageNode.data.label,
      route: pageNode.data.config.route || `/${slugify(pageNode.data.label)}`,
      components: connectedComponents.map(n => n.data.label),
      apis: connectedApis.map(n => n.data.label),
    });
  }

  // Build components
  for (const componentNode of nodesByType.component || []) {
    const connectedChildren = findConnectedNodes(componentNode.id, snapshot.edges, snapshot.nodes, 'component');
    
    spec.components.push({
      name: componentNode.data.label,
      props: componentNode.data.config.props || {},
      children: connectedChildren.length > 0 ? connectedChildren.map(n => n.data.label) : undefined,
    });
  }

  // Build APIs
  for (const apiNode of nodesByType.api || []) {
    const connectedDb = findConnectedNodes(apiNode.id, snapshot.edges, snapshot.nodes, 'database');
    const connectedAuth = findConnectedNodes(apiNode.id, snapshot.edges, snapshot.nodes, 'auth');
    
    spec.apis.push({
      name: apiNode.data.label,
      method: apiNode.data.config.method || 'GET',
      route: apiNode.data.config.route || `/api/${slugify(apiNode.data.label)}`,
      auth_required: connectedAuth.length > 0,
      database_query: connectedDb.length > 0 && connectedDb[0] ? connectedDb[0].data.config.query : undefined,
    });
  }

  // Build database schema
  if (nodesByType.database && nodesByType.database.length > 0) {
    spec.database = {
      tables: nodesByType.database.map(dbNode => ({
        name: dbNode.data.config.table || slugify(dbNode.data.label),
        columns: dbNode.data.config.columns || [
          { name: 'id', type: 'uuid', nullable: false },
          { name: 'created_at', type: 'timestamp', nullable: false },
        ],
      })),
    };
  }

  // Build auth config
  if (nodesByType.auth && nodesByType.auth.length > 0) {
    const authNode = nodesByType.auth[0];
    if (authNode) {
      spec.auth = {
        provider: authNode.data.config.provider || 'supabase',
        features: authNode.data.config.features || ['login', 'signup', 'logout'],
      };
    }
  }

  // Build styling config
  if (nodesByType.style && nodesByType.style.length > 0) {
    const styleNode = nodesByType.style[0];
    if (styleNode) {
      spec.styling = {
        framework: styleNode.data.config.framework || 'tailwind',
        theme: styleNode.data.config.theme || undefined,
      };
    }
  }

  return spec;
}

/**
 * Group nodes by type
 */
function groupNodesByType(nodes: CanvasNode[]): Partial<Record<NodeType, CanvasNode[]>> {
  return nodes.reduce((acc, node) => {
    if (!acc[node.type]) {
      acc[node.type] = [];
    }
    acc[node.type]!.push(node);
    return acc;
  }, {} as Partial<Record<NodeType, CanvasNode[]>>);
}

/**
 * Find nodes connected to a source node of a specific type
 */
function findConnectedNodes(
  sourceId: string,
  edges: CanvasEdge[],
  allNodes: CanvasNode[],
  targetType?: NodeType
): CanvasNode[] {
  const connectedNodeIds = edges
    .filter(edge => edge.source === sourceId)
    .map(edge => edge.target);
  
  const connectedNodes = allNodes.filter(node => 
    connectedNodeIds.includes(node.id) && 
    (!targetType || node.type === targetType)
  );
  
  return connectedNodes;
}

/**
 * Convert string to URL-safe slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Estimate complexity of the canvas
 */
export function estimateComplexity(snapshot: CanvasSnapshot): {
  score: number;
  level: 'simple' | 'moderate' | 'complex' | 'very-complex';
  factors: string[];
} {
  const factors: string[] = [];
  let score = 0;

  // Count nodes
  const nodeCount = snapshot.nodes.length;
  score += nodeCount * 2;
  
  if (nodeCount > 10) factors.push(`${nodeCount} nodes (high)`);
  else if (nodeCount > 5) factors.push(`${nodeCount} nodes (moderate)`);

  // Count edges (connections)
  const edgeCount = snapshot.edges.length;
  score += edgeCount;
  
  if (edgeCount > 15) factors.push(`${edgeCount} connections (high)`);

  // Check for complex node types
  const hasDatabase = snapshot.nodes.some(n => n.type === 'database');
  const hasAuth = snapshot.nodes.some(n => n.type === 'auth');
  const hasWebhook = snapshot.nodes.some(n => n.type === 'webhook');
  
  if (hasDatabase) {
    score += 5;
    factors.push('Database integration');
  }
  
  if (hasAuth) {
    score += 5;
    factors.push('Authentication');
  }
  
  if (hasWebhook) {
    score += 3;
    factors.push('Webhooks');
  }

  // Determine level
  let level: 'simple' | 'moderate' | 'complex' | 'very-complex';
  if (score < 10) level = 'simple';
  else if (score < 25) level = 'moderate';
  else if (score < 50) level = 'complex';
  else level = 'very-complex';

  return { score, level, factors };
}

/**
 * Validate that canvas can be transformed to valid spec
 */
export function validateForCodeGen(snapshot: CanvasSnapshot): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Must have at least one page
  const hasPages = snapshot.nodes.some(n => n.type === 'page');
  if (!hasPages) {
    errors.push('Canvas must have at least one Page node');
  }

  // Check for orphaned nodes (no connections)
  const connectedNodeIds = new Set<string>();
  snapshot.edges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  const orphanedNodes = snapshot.nodes.filter(node => 
    !connectedNodeIds.has(node.id) && 
    node.type !== 'page' && 
    node.type !== 'auth' &&
    node.type !== 'style'
  );

  if (orphanedNodes.length > 0) {
    errors.push(`${orphanedNodes.length} unconnected nodes found (they won't be included in code)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

