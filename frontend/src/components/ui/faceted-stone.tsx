import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { STONES, type StoneId } from "@/lib/stones";
import { cn } from "@/lib/utils";

export type StoneSize = "small" | "medium" | "large";

export interface FacetedStoneProps extends Omit<
  ComponentProps<"div">,
  "children"
> {
  stone: StoneId;
  icon: LucideIcon;
  size?: StoneSize;
  active?: boolean;
}

/**
 * A reusable faceted stone with an irregular gemstone silhouette, layered
 * depth, translucent facets, a luminous gradient, and a central emblem.
 */
export function FacetedStone({
  stone,
  icon: Icon,
  size = "small",
  active = true,
  className,
  "aria-label": ariaLabel,
  role,
  ...props
}: FacetedStoneProps) {
  const accent = STONES[stone].theme;

  const dimensions = {
    small: "h-14 w-12",
    large: "h-24 w-20",
    medium: "h-20 w-16",
  };

  const iconSizes = {
    small: "h-5 w-5",
    large: "h-8 w-8",
    medium: "h-6 w-6",
  };

  const innerSizes = {
    small: "h-6 w-6",
    large: "h-10 w-10",
    medium: "h-8 w-8",
  };

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center",
        dimensions[size],
        active
          ? `drop-shadow-xl ${accent.glow} transition-[filter] duration-300`
          : "opacity-45 grayscale",
        className,
      )}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? (role ?? "img") : role}
      data-stone={stone}
      data-state={active ? "active" : "inactive"}
      {...props}
    >
      {/* =========================================================
          OUTER CRYSTAL
          ========================================================= */}
      <div
        className={`absolute inset-0 overflow-hidden ${
          active
            ? `bg-gradient-to-br ${accent.gradient}`
            : "bg-muted-foreground/30"
        }`}
        style={{
          clipPath:
            "polygon(50% 0%, 68% 5%, 86% 17%, 96% 38%, 91% 68%, 78% 88%, 61% 98%, 50% 100%, 39% 98%, 22% 88%, 9% 68%, 4% 38%, 14% 17%, 32% 5%)",
        }}
      >
        {active && (
          <>
            {/* =====================================================
                DEPTH LAYER 01 — OUTER GLASS SHELL
                ===================================================== */}
            <div
              className="absolute inset-[2%] bg-white/[0.035]"
              style={{
                clipPath:
                  "polygon(50% 0%, 69% 6%, 87% 18%, 95% 39%, 90% 68%, 77% 88%, 61% 98%, 50% 100%, 39% 98%, 23% 88%, 10% 68%, 5% 39%, 13% 18%, 31% 6%)",
              }}
            />

            {/* =====================================================
                DEPTH LAYER 02 — DARK INTERNAL WALL
                ===================================================== */}
            <div
              className="absolute inset-[5%] bg-black/[0.14]"
              style={{
                clipPath:
                  "polygon(50% 0%, 70% 7%, 88% 20%, 94% 40%, 88% 67%, 75% 86%, 60% 97%, 50% 100%, 40% 97%, 25% 86%, 12% 67%, 6% 40%, 12% 20%, 30% 7%)",
              }}
            />

            {/* =====================================================
                DEPTH LAYER 03 — INNER GLASS
                ===================================================== */}
            <div
              className={`absolute inset-[8%] ${accent.inner}`}
              style={{
                clipPath:
                  "polygon(50% 0%, 70% 10%, 87% 25%, 91% 42%, 84% 65%, 70% 84%, 57% 96%, 50% 100%, 43% 96%, 30% 84%, 16% 65%, 9% 42%, 13% 25%, 30% 10%)",
              }}
            />

            {/* =====================================================
                DEPTH LAYER 04 — INNER TRANSLUCENT SHELL
                ===================================================== */}
            <div
              className="absolute inset-[13%] bg-white/[0.055]"
              style={{
                clipPath:
                  "polygon(50% 0%, 71% 12%, 86% 28%, 88% 44%, 80% 64%, 67% 82%, 56% 94%, 50% 100%, 44% 94%, 33% 82%, 20% 64%, 12% 44%, 14% 28%, 29% 12%)",
              }}
            />

            {/* =====================================================
                DEEP CORE
                ===================================================== */}
            <div
              className="absolute inset-[20%] bg-black/[0.08]"
              style={{
                clipPath:
                  "polygon(50% 0%, 76% 18%, 90% 50%, 74% 82%, 50% 100%, 26% 82%, 10% 50%, 24% 18%)",
              }}
            />

            {/* =====================================================
                SOFT INTERNAL LIGHT VOLUME
                ===================================================== */}
            <div
              className="absolute inset-[18%] bg-white/[0.035] blur-[1px]"
              style={{
                clipPath:
                  "polygon(50% 4%, 76% 22%, 84% 50%, 69% 79%, 50% 94%, 31% 79%, 16% 50%, 24% 22%)",
              }}
            />

            {/* =====================================================
                PRIMARY CRYSTAL FACETS
                ===================================================== */}

            {/* Crown */}
            <div
              className="absolute inset-0 bg-white/[0.18]"
              style={{
                clipPath:
                  "polygon(50% 0%, 70% 7%, 61% 38%, 50% 32%, 39% 38%, 30% 7%)",
              }}
            />

            {/* Upper-left */}
            <div
              className="absolute inset-0 bg-white/[0.075]"
              style={{
                clipPath: "polygon(30% 7%, 39% 38%, 17% 59%, 4% 38%, 14% 17%)",
              }}
            />

            {/* Upper-right */}
            <div
              className="absolute inset-0 bg-black/[0.075]"
              style={{
                clipPath: "polygon(70% 7%, 86% 17%, 96% 38%, 83% 59%, 61% 38%)",
              }}
            />

            {/* Lower-left */}
            <div
              className="absolute inset-0 bg-black/[0.11]"
              style={{
                clipPath:
                  "polygon(17% 59%, 39% 38%, 50% 74%, 39% 98%, 22% 88%, 9% 68%)",
              }}
            />

            {/* Lower-right */}
            <div
              className="absolute inset-0 bg-white/[0.075]"
              style={{
                clipPath:
                  "polygon(83% 59%, 61% 38%, 50% 74%, 61% 98%, 78% 88%, 91% 68%)",
              }}
            />

            {/* Bottom core */}
            <div
              className="absolute inset-0 bg-black/[0.14]"
              style={{
                clipPath: "polygon(50% 74%, 61% 98%, 50% 100%, 39% 98%)",
              }}
            />

            {/* =====================================================
                SECONDARY INTERNAL FACETS
                ===================================================== */}

            {/* Upper crystal window */}
            <div
              className="absolute inset-0 bg-white/[0.045]"
              style={{
                clipPath:
                  "polygon(50% 11%, 65% 21%, 57% 39%, 50% 32%, 43% 39%, 35% 21%)",
              }}
            />

            {/* Left inner plane */}
            <div
              className="absolute inset-0 bg-white/[0.035]"
              style={{
                clipPath: "polygon(17% 59%, 39% 38%, 43% 60%, 31% 72%)",
              }}
            />

            {/* Right inner plane */}
            <div
              className="absolute inset-0 bg-black/[0.045]"
              style={{
                clipPath: "polygon(83% 59%, 61% 38%, 57% 60%, 69% 72%)",
              }}
            />

            {/* Deep lower-left plane */}
            <div
              className="absolute inset-0 bg-white/[0.035]"
              style={{
                clipPath: "polygon(31% 72%, 43% 60%, 50% 74%, 39% 86%)",
              }}
            />

            {/* Deep lower-right plane */}
            <div
              className="absolute inset-0 bg-black/[0.045]"
              style={{
                clipPath: "polygon(69% 72%, 57% 60%, 50% 74%, 61% 86%)",
              }}
            />

            {/* =====================================================
                Z-AXIS / DEPTH PLANES
                ===================================================== */}

            {/* Left depth wall */}
            <div
              className="absolute inset-0 bg-white/[0.055]"
              style={{
                clipPath:
                  "polygon(4% 38%, 17% 59%, 39% 38%, 50% 32%, 39% 18%, 14% 17%)",
              }}
            />

            {/* Right depth wall */}
            <div
              className="absolute inset-0 bg-black/[0.075]"
              style={{
                clipPath:
                  "polygon(96% 38%, 83% 59%, 61% 38%, 50% 32%, 61% 18%, 86% 17%)",
              }}
            />

            {/* Central front plane */}
            <div
              className="absolute inset-0 bg-white/[0.045]"
              style={{
                clipPath: "polygon(39% 38%, 50% 32%, 61% 38%, 50% 74%)",
              }}
            />

            {/* Rear plane */}
            <div
              className="absolute inset-0 bg-black/[0.055]"
              style={{
                clipPath: "polygon(39% 38%, 50% 32%, 61% 38%, 50% 18%)",
              }}
            />

            {/* Lower depth left */}
            <div
              className="absolute inset-0 bg-white/[0.035]"
              style={{
                clipPath:
                  "polygon(17% 59%, 39% 38%, 50% 74%, 39% 86%, 22% 88%)",
              }}
            />

            {/* Lower depth right */}
            <div
              className="absolute inset-0 bg-black/[0.04]"
              style={{
                clipPath:
                  "polygon(83% 59%, 61% 38%, 50% 74%, 61% 86%, 78% 88%)",
              }}
            />

            {/* =====================================================
                MICRO FACET NETWORK
                ===================================================== */}

            {/* Upper-left micro facet */}
            <div
              className="absolute inset-0 bg-white/[0.035]"
              style={{
                clipPath: "polygon(22% 19%, 31% 10%, 39% 38%, 29% 32%)",
              }}
            />

            {/* Upper-right micro facet */}
            <div
              className="absolute inset-0 bg-black/[0.035]"
              style={{
                clipPath: "polygon(78% 19%, 69% 10%, 61% 38%, 71% 32%)",
              }}
            />

            {/* Mid-left micro plane */}
            <div
              className="absolute inset-0 bg-white/[0.03]"
              style={{
                clipPath: "polygon(10% 43%, 17% 59%, 29% 50%, 23% 38%)",
              }}
            />

            {/* Mid-right micro plane */}
            <div
              className="absolute inset-0 bg-black/[0.03]"
              style={{
                clipPath: "polygon(90% 43%, 83% 59%, 71% 50%, 77% 38%)",
              }}
            />

            {/* Lower-left micro plane */}
            <div
              className="absolute inset-0 bg-white/[0.025]"
              style={{
                clipPath: "polygon(22% 76%, 31% 72%, 39% 86%, 30% 84%)",
              }}
            />

            {/* Lower-right micro plane */}
            <div
              className="absolute inset-0 bg-black/[0.03]"
              style={{
                clipPath: "polygon(78% 76%, 69% 72%, 61% 86%, 70% 84%)",
              }}
            />

            {/* =====================================================
                FINE CRYSTAL SEAMS
                ===================================================== */}

            {/* Main diagonal refraction */}
            <span
              className="absolute left-[23%] top-[24%] h-px w-[54%] bg-white/[0.28]"
              style={{ transform: "rotate(24deg)" }}
            />

            <span
              className="absolute left-[27%] top-[59%] h-px w-[46%] bg-white/[0.16]"
              style={{ transform: "rotate(-18deg)" }}
            />

            {/* Central vertical crystal seams */}
            <span
              className="absolute left-[39%] top-[31%] h-[45%] w-px bg-white/[0.16]"
              style={{ transform: "rotate(-10deg)" }}
            />

            <span
              className="absolute left-[59%] top-[31%] h-[45%] w-px bg-black/[0.13]"
              style={{ transform: "rotate(10deg)" }}
            />

            {/* Z-axis seams */}
            <span
              className="absolute left-[14%] top-[38%] h-[29%] w-px bg-white/[0.13]"
              style={{ transform: "rotate(-24deg)" }}
            />

            <span
              className="absolute right-[14%] top-[38%] h-[29%] w-px bg-black/[0.13]"
              style={{ transform: "rotate(24deg)" }}
            />

            <span
              className="absolute left-[32%] top-[12%] h-[24%] w-px bg-white/[0.13]"
              style={{ transform: "rotate(24deg)" }}
            />

            <span
              className="absolute right-[32%] top-[12%] h-[24%] w-px bg-black/[0.11]"
              style={{ transform: "rotate(-24deg)" }}
            />

            {/* Secondary hairline facets */}
            <span
              className="absolute left-[20%] top-[50%] h-px w-[15%] bg-white/[0.15]"
              style={{ transform: "rotate(38deg)" }}
            />

            <span
              className="absolute right-[20%] top-[50%] h-px w-[15%] bg-black/[0.12]"
              style={{ transform: "rotate(-38deg)" }}
            />

            <span
              className="absolute bottom-[21%] left-[30%] h-px w-[19%] bg-white/[0.11]"
              style={{ transform: "rotate(-28deg)" }}
            />

            <span
              className="absolute bottom-[21%] right-[30%] h-px w-[19%] bg-black/[0.11]"
              style={{ transform: "rotate(28deg)" }}
            />

            {/* Additional microscopic seams */}
            <span
              className="absolute left-[34%] top-[18%] h-px w-[10%] bg-white/[0.1]"
              style={{ transform: "rotate(52deg)" }}
            />

            <span
              className="absolute right-[34%] top-[18%] h-px w-[10%] bg-black/[0.09]"
              style={{ transform: "rotate(-52deg)" }}
            />

            <span
              className="absolute left-[18%] top-[63%] h-px w-[12%] bg-white/[0.08]"
              style={{ transform: "rotate(-16deg)" }}
            />

            <span
              className="absolute right-[18%] top-[63%] h-px w-[12%] bg-black/[0.08]"
              style={{ transform: "rotate(16deg)" }}
            />

            {/* =====================================================
                INNER REFRACTION WINDOWS
                ===================================================== */}

            <div
              className="absolute inset-[27%] rounded-[38%] border border-white/[0.08]"
              style={{
                transform: "rotate(45deg) skew(-5deg, -5deg)",
              }}
            />

            <div
              className="absolute inset-[34%] rounded-[30%] border border-white/[0.045]"
              style={{
                transform: "rotate(-18deg) skew(3deg, 3deg)",
              }}
            />

            {/* =====================================================
                LIGHT TRAPPED INSIDE THE CRYSTAL
                ===================================================== */}

            <span className="absolute left-[23%] top-[16%] h-[13%] w-[18%] rounded-full bg-white/[0.3] blur-[1.5px]" />

            <span className="absolute left-[31%] top-[24%] h-[7%] w-[9%] rounded-full bg-white/[0.12] blur-[1px]" />

            <span className="absolute right-[23%] top-[27%] h-[5%] w-[6%] rounded-full bg-white/[0.7] blur-[0.5px]" />

            <span className="absolute left-[21%] top-[53%] h-[4%] w-[4%] rounded-full bg-white/[0.4]" />

            <span className="absolute right-[25%] top-[62%] h-[3%] w-[3%] rounded-full bg-white/[0.3]" />

            {/* Deep internal glints */}
            <span className="absolute left-[42%] top-[43%] h-[3%] w-[3%] rounded-full bg-white/[0.3]" />

            <span className="absolute right-[40%] bottom-[27%] h-[3%] w-[3%] rounded-full bg-white/[0.22]" />

            {/* Very faint internal light beam */}
            <span
              className="absolute left-[36%] top-[15%] h-[58%] w-[9%] bg-white/[0.025] blur-[2px]"
              style={{
                transform: "rotate(18deg)",
              }}
            />

            {/* =====================================================
                INTERNAL CRYSTAL GLOW
                ===================================================== */}

            {/* Soft colored light trapped inside the crystal */}
            <div
              className={`absolute inset-[16%] rounded-full opacity-50 blur-[7px] ${accent.inner}`}
              style={{
                clipPath:
                  "polygon(50% 4%, 76% 22%, 86% 50%, 70% 79%, 50% 96%, 30% 79%, 14% 50%, 24% 22%)",
              }}
            />

            {/* Concentrated inner glow */}
            <div
              className={`absolute left-[28%] top-[27%] h-[46%] w-[44%] rounded-full opacity-30 blur-[5px] ${accent.inner}`}
              style={{
                transform: "rotate(-12deg)",
              }}
            />

            {/* =====================================================
                CRYSTAL EDGE BLOOM
                ===================================================== */}

            <div
              className={`absolute inset-[4%] opacity-30 blur-[2px] ${
                active ? accent.inner : ""
              }`}
              style={{
                clipPath:
                  "polygon(50% 0%, 68% 5%, 86% 17%, 96% 38%, 91% 68%, 78% 88%, 61% 98%, 50% 100%, 39% 98%, 22% 88%, 9% 68%, 4% 38%, 14% 17%, 32% 5%)",
              }}
            />

            {/* =====================================================
                SPECULAR SHINE
                ===================================================== */}

            {/* Main diagonal glass reflection */}
            <span
              className="absolute left-[18%] top-[13%] h-[2px] w-[62%] rounded-full bg-white/30 blur-[0.5px]"
              style={{
                transform: "rotate(35deg)",
              }}
            />

            {/* Secondary reflection */}
            <span
              className="absolute left-[31%] top-[23%] h-px w-[34%] rounded-full bg-white/25"
              style={{
                transform: "rotate(35deg)",
              }}
            />

            {/* Bright crystal point */}
            <span className="absolute left-[24%] top-[18%] h-1.5 w-1.5 rounded-full bg-white/65 blur-[0.5px]" />

            <span className="absolute right-[25%] top-[31%] h-1 w-1 rounded-full bg-white/60" />

            {/* Tiny internal spark */}
            <span className="absolute left-[43%] top-[39%] h-1 w-1 rounded-full bg-white/50 blur-[0.5px]" />

            {/* =====================================================
                DIFFUSED LIGHT LEAKS
                ===================================================== */}

            <span
              className={`absolute -left-[8%] top-[34%] h-[30%] w-[28%] rounded-full opacity-25 blur-[8px] ${accent.inner}`}
            />

            <span
              className={`absolute -right-[8%] top-[42%] h-[24%] w-[24%] rounded-full opacity-20 blur-[9px] ${accent.inner}`}
            />

            {/* =====================================================
                FINAL GLASS GLINT
                ===================================================== */}

            <span
              className="absolute left-[19%] top-[11%] h-[7%] w-[7%] rounded-full bg-white/55 blur-[1px]"
              style={{
                transform: "rotate(-20deg)",
              }}
            />
          </>
        )}
      </div>

      {/* =========================================================
          RAISED CENTRAL EMBLEM
          ========================================================= */}
      <div
        className={`relative z-10 flex items-center justify-center rounded-full border ${innerSizes[size]} ${
          active
            ? "border-white/30 bg-black/10 shadow-inner dark:bg-white/5"
            : "border-border/50 bg-background/30"
        }`}
      >
        <Icon
          className={`${iconSizes[size]} ${
            active ? accent.icon : "text-muted-foreground"
          }`}
        />
      </div>
    </div>
  );
}
