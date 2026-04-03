/**
 * VibeCode Canvas Save API
 * Saves canvas state (nodes + edges) to database/file
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-client';

export async function POST(req: NextRequest) {
  try {
    const { canvas, projectId, name } = await req.json();

    if (!canvas || !canvas.nodes) {
      return NextResponse.json(
        { ok: false, error: 'Invalid canvas data' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Save to vibe_canvas table
    const { data, error } = await supabase
      .from('vibe_canvas')
      .insert({
        project_id: projectId,
        name: name || 'Untitled Canvas',
        nodes: canvas.nodes || [],
        edges: canvas.edges || [],
        metadata: canvas.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Canvas save error:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      canvas: data,
      message: 'Canvas saved successfully',
    });
  } catch (error: any) {
    console.error('Canvas save error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to save canvas' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { canvasId, canvas } = await req.json();

    if (!canvasId || !canvas) {
      return NextResponse.json(
        { ok: false, error: 'Missing canvasId or canvas data' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Update existing canvas
    const { data, error } = await supabase
      .from('vibe_canvas')
      .update({
        nodes: canvas.nodes || [],
        edges: canvas.edges || [],
        metadata: canvas.metadata || {},
      })
      .eq('id', canvasId)
      .select()
      .single();

    if (error) {
      console.error('Canvas update error:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      canvas: data,
      message: 'Canvas updated successfully',
    });
  } catch (error: any) {
    console.error('Canvas update error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to update canvas' },
      { status: 500 }
    );
  }
}
