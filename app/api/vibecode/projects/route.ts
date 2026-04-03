/**
 * VibeCode Projects API
 * Manages VibeCode projects (CRUD operations)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-client';

// GET - List all projects
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('vibe_projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Projects fetch error:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      projects: data || [],
    });
  } catch (error: any) {
    console.error('Projects fetch error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST - Create new project
export async function POST(req: NextRequest) {
  try {
    const { name, description, template } = await req.json();

    if (!name) {
      return NextResponse.json(
        { ok: false, error: 'Project name is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('vibe_projects')
      .insert({
        name,
        description: description || '',
        meta: { template: template || 'blank' },
      })
      .select()
      .single();

    if (error) {
      console.error('Project create error:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      project: data,
      message: 'Project created successfully',
    });
  } catch (error: any) {
    console.error('Project create error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create project' },
      { status: 500 }
    );
  }
}

// PUT - Update project
export async function PUT(req: NextRequest) {
  try {
    const { projectId, name, description } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { ok: false, error: 'Missing projectId' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const updates: any = {};

    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;

    const { data, error } = await supabase
      .from('vibe_projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error('Project update error:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      project: data,
      message: 'Project updated successfully',
    });
  } catch (error: any) {
    console.error('Project update error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to update project' },
      { status: 500 }
    );
  }
}

// DELETE - Delete project
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { ok: false, error: 'Missing projectId' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Delete associated canvases first (handled by CASCADE)
    // await supabase.from('vibe_canvas').delete().eq('project_id', projectId);

    // Delete project (will cascade delete canvas)
    const { error } = await supabase
      .from('vibe_projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      console.error('Project delete error:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Project deleted successfully',
    });
  } catch (error: any) {
    console.error('Project delete error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to delete project' },
      { status: 500 }
    );
  }
}
