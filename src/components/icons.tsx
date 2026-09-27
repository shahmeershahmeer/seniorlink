import { Car, HandHeart, Pill, ShoppingCart, Snowflake, type LucideIcon } from "lucide-react";
import type { TaskType } from "@/lib/types";

const TASK_ICONS: Record<TaskType, LucideIcon> = {
  groceries: ShoppingCart,
  pharmacy: Pill,
  ride: Car,
  snow: Snowflake,
  other: HandHeart,
};

/** Line icon for a task type, in a soft tinted circle. */
export function TaskIcon({ type, size = 48 }: { type: TaskType; size?: number }) {
  const Icon = TASK_ICONS[type];
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon size={size * 0.52} strokeWidth={1.75} />
    </span>
  );
}

export function UrgencyDot({ className }: { className: string }) {
  return <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${className}`} aria-hidden />;
}
