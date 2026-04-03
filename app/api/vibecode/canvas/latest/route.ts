/**
 * VibeCode Canvas Latest API
 * Retrieves the most recent canvas for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    const supabase = getSupabaseClient();

    let query = supabase
      .from('vibe_canvas')
      .select('*')
      .order('version', { ascending: false })
      .limit(1);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query.single();

    if (error) {
      // No canvas found is not an error - return empty canvas
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          ok: true,
          canvas: {
            nodes: [],
            edges: [],
          },
          message: 'No canvas found, returning empty canvas',
        });
      }

      console.error('Canvas fetch error:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      canvas: {
        nodes: data.nodes || [],
        edges: data.edges || [],
        metadata: data.metadata || {},
      },
      canvasId: data.id,
      name: data.name,
      version: data.version,
      updatedAt: data.updated_at,
    });
  } catch (error: any) {
    console.error('Canvas fetch error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch canvas' },
      { status: 500 }
    );
  }
}
