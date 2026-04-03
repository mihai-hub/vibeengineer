/**
 * VibeCode Generate API
 * Generates code from canvas and can apply it to Dev Mode or GitHub
 */

import { NextResponse } from "next/server";

const JEFF_URL = process.env.JEFF_URL || "http://127.0.0.1:7339";
const JEFF_TOKEN = process.env.JEFF_API_TOKEN || "";

const headers = {
  "Content-Type": "application/json",
  ...(JEFF_TOKEN ? { Authorization: `Bearer ${JEFF_TOKEN}` } : {}),
};

// POST - Generate code from canvas
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { canvas, options, action = "generate" } = body;

    if (!canvas || !canvas.nodes) {
      return NextResponse.json(
        { ok: false, error: "Canvas with nodes required" },
        { status: 400 }
      );
    }

    if (action === "generate") {
      // Generate code from canvas
      const response = await fetch(`${JEFF_URL}/canvas/generate/code`, {
        method: "POST",
        headers,
        body: JSON.stringify({ canvas, options }),
      });

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    if (action === "prd") {
      // Generate PRD document
      const response = await fetch(`${JEFF_URL}/canvas/generate/prd`, {
        method: "POST",
        headers,
        body: JSON.stringify(canvas),
      });

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    if (action === "schema") {
      // Generate database schema
      const response = await fetch(`${JEFF_URL}/canvas/generate/schema`, {
        method: "POST",
        headers,
        body: JSON.stringify(canvas),
      });

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    if (action === "apply") {
      // E50: Use E40 Autonomous Execution for local apply with git commit
      // First generate code
      const genResponse = await fetch(`${JEFF_URL}/canvas/generate/code`, {
        method: "POST",
        headers,
        body: JSON.stringify({ canvas, options }),
      });

      const genData = await genResponse.json();

      if (!genData.ok) {
        return NextResponse.json(genData, { status: 500 });
      }

      // Build file operations for E40
      const fileOperations = genData.files.map((file: { path: string; content: string }) => ({
        operation: "create", // or "modify" - E40 will detect
        path: file.path,
        content: file.content,
      }));

      // Call E40 Autonomous Execution
      const e40Response = await fetch(`${JEFF_URL}/autonomous/execute`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          intent: `VibeCode: Apply ${genData.files.length} generated files`,
          context: {
            file_operations: fileOperations,
            source: "vibecode",
            deploy: options?.deploy || false,
          },
          auto_approve: options?.auto_approve || false,
        }),
      });

      const e40Data = await e40Response.json();

      return NextResponse.json({
        ok: e40Data.success ?? false,
        files: genData.files,
        execution: {
          task_id: e40Data.task_id,
          status: e40Data.status,
          phase: e40Data.phase,
          commit_sha: e40Data.commit_sha,
          awaiting_approval: e40Data.status === "awaiting_approval",
        },
        metadata: genData.metadata,
        error: e40Data.error,
      });
    }

    if (action === "apply_github") {
      // Legacy: Direct GitHub apply (without E40)
      // First generate
      const genResponse = await fetch(`${JEFF_URL}/canvas/generate/code`, {
        method: "POST",
        headers,
        body: JSON.stringify({ canvas, options }),
      });

      const genData = await genResponse.json();

      if (!genData.ok) {
        return NextResponse.json(genData, { status: 500 });
      }

      // Then apply each file to GitHub
      const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
      const GITHUB_OWNER = process.env.GITHUB_OWNER || "mihai-hub";
      const GITHUB_REPO = process.env.GITHUB_REPO || "wellsassy-control-center";

      if (!GITHUB_TOKEN) {
        return NextResponse.json(
          { ok: false, error: "GitHub token not configured", files: genData.files },
          { status: 503 }
        );
      }

      const appliedFiles = [];
      const errors = [];

      for (const file of genData.files) {
        try {
          // Check if file exists
          let fileSha: string | undefined;
          try {
            const checkRes = await fetch(
              `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${file.path}`,
              {
                headers: {
                  Authorization: `Bearer ${GITHUB_TOKEN}`,
                  Accept: "application/vnd.github.v3+json",
                },
              }
            );
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              fileSha = checkData.sha;
            }
          } catch {
            // File doesn't exist, that's OK
          }

          // Create/update file
          const updateRes = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${file.path}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: "application/vnd.github.v3+json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: `VibeCode: Generate ${file.path}`,
                content: Buffer.from(file.content).toString("base64"),
                branch: "main",
                ...(fileSha ? { sha: fileSha } : {}),
              }),
            }
          );

          if (updateRes.ok) {
            appliedFiles.push(file.path);
          } else {
            const errData = await updateRes.json();
            errors.push({ path: file.path, error: errData.message });
          }
        } catch (err: any) {
          errors.push({ path: file.path, error: err.message });
        }
      }

      return NextResponse.json({
        ok: errors.length === 0,
        files: genData.files,
        applied: appliedFiles,
        errors,
        metadata: genData.metadata,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid action. Use: generate, prd, schema, or apply" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("VibeCode generate error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to generate code" },
      { status: 500 }
    );
  }
}










