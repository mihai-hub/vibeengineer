/**
 * Skills — client-side localStorage skill management
 * Skills are named prompts that users can save and reuse.
 */

export interface Skill {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
}

const SKILLS_KEY = 'vibeengineer_skills';

export function getSkills(): Skill[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SKILLS_KEY);
    return raw ? (JSON.parse(raw) as Skill[]) : [];
  } catch {
    return [];
  }
}

export function saveSkill(name: string, prompt: string): Skill {
  const skill: Skill = {
    id: crypto.randomUUID(),
    name,
    prompt,
    createdAt: new Date().toISOString(),
  };
  const existing = getSkills();
  localStorage.setItem(SKILLS_KEY, JSON.stringify([...existing, skill]));
  return skill;
}

export function deleteSkill(id: string): void {
  const existing = getSkills();
  localStorage.setItem(
    SKILLS_KEY,
    JSON.stringify(existing.filter(s => s.id !== id))
  );
}
