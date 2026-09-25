import type { DocFolder } from "@/lib/types";

/** Pure folder-tree helpers for Documents — tested in scripts/docs.test.mjs. */

/** Root-first chain of folders leading to `id` (inclusive). */
export function folderChain(folders: DocFolder[], id: string | null | undefined): DocFolder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const out: DocFolder[] = [];
  const seen = new Set<string>();
  for (let cur = id ? byId.get(id) : undefined; cur && !seen.has(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
    seen.add(cur.id);
    out.unshift(cur);
  }
  return out;
}

export const folderPath = (folders: DocFolder[], id: string | null | undefined) => folderChain(folders, id).map((f) => f.name).join(" / ");

/** The folder and every folder below it. */
export function descendants(folders: DocFolder[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) if (f.parentId && out.has(f.parentId) && !out.has(f.id)) { out.add(f.id); grew = true; }
  }
  return out;
}

/** Depth-first list for a <select>, sub-folders indented under their parent. */
export function folderOptions(folders: DocFolder[]): { id: string; label: string; depth: number }[] {
  const kids = new Map<string | null, DocFolder[]>();
  for (const f of folders) kids.set(f.parentId, [...(kids.get(f.parentId) ?? []), f]);
  const out: { id: string; label: string; depth: number }[] = [];
  const walk = (parent: string | null, depth: number, seen: Set<string>) => {
    for (const f of (kids.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      out.push({ id: f.id, label: `${"   ".repeat(depth)}${depth ? "↳ " : ""}${f.name}`, depth });
      walk(f.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());
  return out;
}
