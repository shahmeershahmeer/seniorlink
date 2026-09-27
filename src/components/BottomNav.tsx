"use client";

import type { LucideIcon } from "lucide-react";

export interface NavItem<K extends string> {
  key: K;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

/** App-style tab bar pinned to the bottom of the screen (respects the iPhone home indicator). */
export default function BottomNav<K extends string>({
  items,
  active,
  onChange,
}: {
  items: NavItem<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-xl border-t border-sand bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ key, label, icon: Icon, badge }) => {
          const on = key === active;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              aria-current={on ? "page" : undefined}
              className={`relative flex flex-col items-center gap-1 py-3 text-sm font-medium ${on ? "text-brand" : "text-muted"}`}
            >
              <span className={`flex h-8 w-14 items-center justify-center rounded-full ${on ? "bg-brand-soft" : ""}`}>
                <Icon size={24} strokeWidth={on ? 2.25 : 1.75} />
              </span>
              {label}
              {badge ? (
                <span className="absolute right-[22%] top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
