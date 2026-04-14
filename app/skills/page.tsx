'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Trash2, ArrowLeft, Plus } from 'lucide-react';
import { getSkills, deleteSkill } from '../../lib/skills';
import type { Skill } from '../../lib/skills';

export default function SkillsPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    setSkills(getSkills());
  }, []);

  const handleDelete = (id: string) => {
    deleteSkill(id);
    setSkills(getSkills());
  };

  const handleUse = (prompt: string) => {
    router.push(`/chat?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-zinc-800 transition text-zinc-400 hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-violet-400" />
            <h1 className="text-xl font-semibold">Saved Skills</h1>
          </div>
        </div>

        {skills.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <Zap size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg mb-2">No skills saved yet</p>
            <p className="text-sm">
              After an AI response in chat, click &ldquo;Save as Skill&rdquo; to reuse it.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {skills.map(skill => (
              <div
                key={skill.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={14} className="text-violet-400 shrink-0" />
                    <span className="font-medium text-sm truncate">{skill.name}</span>
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2">{skill.prompt}</p>
                  <p className="text-xs text-zinc-600 mt-2">
                    {new Date(skill.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleUse(skill.prompt)}
                    className="px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 rounded-lg transition font-medium"
                  >
                    Use
                  </button>
                  <button
                    onClick={() => handleDelete(skill.id)}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 transition text-zinc-500 hover:text-red-400"
                    aria-label="Delete skill"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Link to chat */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/chat')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition"
          >
            <Plus size={14} />
            New chat
          </button>
        </div>
      </div>
    </main>
  );
}
