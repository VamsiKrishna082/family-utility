"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { SECTIONS } from "@/lib/sections";

export function Rail() {
  const path = usePathname();

  return (
    <nav
      className="hidden md:flex flex-col items-center gap-1 fixed left-0 top-0 bottom-0 py-6"
      style={{ width: 68, borderRight: "1px solid var(--line)", background: "var(--card)", zIndex: 20 }}
    >
      <Link
        href="/"
        title="Home"
        className="flex items-center justify-center mb-4"
        style={{ width: 38, height: 38, borderRadius: 12, background: path === "/" ? "var(--ink)" : "transparent" }}
      >
        <LayoutGrid size={19} color={path === "/" ? "#fff" : "var(--dim)"} strokeWidth={1.9} />
      </Link>

      {SECTIONS.map((s) => {
        const active = path.startsWith(s.href);
        const Icon = s.icon;
        return (
          <Link
            key={s.key}
            href={s.ready ? s.href : "/"}
            title={s.ready ? s.name : `${s.name} — not built yet`}
            className="flex items-center justify-center"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: active ? s.tint : "transparent",
              opacity: s.ready ? 1 : 0.38,
            }}
          >
            <Icon size={18} color={active ? s.ink : "var(--faint)"} strokeWidth={1.9} />
          </Link>
        );
      })}
    </nav>
  );
}
