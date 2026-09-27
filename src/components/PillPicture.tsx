import type { Medication, PillLook } from "@/lib/types";

/** The senior's own photo of the pill, or a drawing in its real shape and colour. */
export default function PillPicture({ med, size = 56 }: { med: Pick<Medication, "photo" | "look" | "name">; size?: number }) {
  if (med.photo) {
    return <img src={med.photo} alt={med.name} className="shrink-0 rounded-2xl object-cover ring-1 ring-black/10" style={{ width: size, height: size }} />;
  }
  return (
    <span className="flex shrink-0 items-center justify-center rounded-2xl bg-sand" style={{ width: size, height: size }} aria-hidden>
      <PillDrawing look={med.look ?? { shape: "round", color: "#FFFFFF" }} size={size * 0.72} />
    </span>
  );
}

export function PillDrawing({ look, size }: { look: PillLook; size: number }) {
  const stroke = "rgba(0,0,0,0.25)";
  if (look.shape === "capsule") {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40">
        <g transform="rotate(-35 20 20)">
          <path d="M20 11 H13 a9 9 0 0 0 0 18 H20 Z" fill={look.color} stroke={stroke} />
          <path d="M20 11 H27 a9 9 0 0 1 0 18 H20 Z" fill={look.color2 ?? "#FFFFFF"} stroke={stroke} />
          <path d="M11 15 q2-2 5-2" stroke="rgba(255,255,255,0.7)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    );
  }
  if (look.shape === "oval") {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40">
        <g transform="rotate(-25 20 20)">
          <ellipse cx="20" cy="20" rx="16" ry="9.5" fill={look.color} stroke={stroke} />
          <line x1="20" y1="12" x2="20" y2="28" stroke={stroke} />
          <path d="M9 17 q3-4 8-4" stroke="rgba(255,255,255,0.8)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="13" fill={look.color} stroke={stroke} />
      <line x1="11" y1="20" x2="29" y2="20" stroke={stroke} />
      <path d="M12 15 q3-5 8-5" stroke="rgba(255,255,255,0.8)" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export const PILL_COLORS = ["#FFFFFF", "#F4F1EA", "#F2C230", "#E07A2F", "#D9546B", "#7FB3E3", "#6FBF73", "#9B7FD1", "#8B5E3C"];
