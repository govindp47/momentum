import type {
  BalanceAnalysisCommitment,
  BalanceAnalysisHighlight,
  BalanceAnalysisTone,
} from "@/lib/balance-analysis";
import type { StoneId } from "@/lib/stones";

export interface CumulativeBalanceShareInput {
  commitmentId: number;
  percentage: number;
}

export interface CumulativeBalanceCheckpointInput {
  /** ISO calendar date for this cumulative checkpoint. */
  date: string;
  shares: CumulativeBalanceShareInput[];
}

export interface CumulativeBalanceTrendAnalysis {
  canAnalyze: boolean;
  monthsAnalyzed: number;
  score: number | null;
  level: string;
  highlights: BalanceAnalysisHighlight[];
  unavailableReason: string | null;
}

interface MonthlySnapshot {
  date: string;
  label: string;
  monthOrdinal: number;
  score: number;
  shares: Array<BalanceAnalysisCommitment & { percentage: number }>;
}

interface RankedHighlight extends BalanceAnalysisHighlight {
  subjectId: number | null;
}

const CUMULATIVE_SIGNAL_STONES = {
  rhythm: "tidemark",
  comeback: "crucible",
  focusRelease: "crucible",
  harmonyRun: "concord",
  concentrationRun: "tidemark",
  quietFocus: "lodestar",
  dominantFocus: "lodestar",
  momentum: "emberwake",
  steadyAnchor: "concord",
  structuralTurn: "crucible",
} as const satisfies Record<string, StoneId>;

/**
 * Analyze cumulative balance across a long-range period.
 *
 * Multiple checkpoints in one month are collapsed to the latest checkpoint.
 * At least three months with usable cumulative shares are required. The fixed
 * signal system evaluates: long-range rhythm, comeback arcs, released focus,
 * harmony runs, concentration eras, quiet drift, focus gravity, momentum,
 * steady anchors, and structural turns. The five strongest signals are
 * returned in deterministic rank order.
 */
export function analyzeCumulativeBalanceTrend({
  commitments,
  checkpoints,
}: {
  commitments: BalanceAnalysisCommitment[];
  checkpoints: CumulativeBalanceCheckpointInput[];
}): CumulativeBalanceTrendAnalysis {
  if (commitments.length < 2) {
    return unavailableAnalysis(
      0,
      "Select at least two commitments to analyze a cumulative balance trend.",
    );
  }

  const snapshots = buildMonthlySnapshots(commitments, checkpoints);
  if (snapshots.length < 3) {
    return unavailableAnalysis(
      snapshots.length,
      "At least three months of cumulative balance data are required.",
    );
  }

  const latestSnapshot = snapshots.at(-1);
  if (!latestSnapshot) {
    return unavailableAnalysis(
      0,
      "At least three months of cumulative balance data are required.",
    );
  }

  const level = classifyBalance(latestSnapshot.score);
  const candidates: RankedHighlight[] = [
    {
      key: "long-range-rhythm",
      title: "Long-Range Rhythm",
      value: level.label,
      detail: `${Math.round(latestSnapshot.score)}/100 across ${snapshots.length} months`,
      tone: level.tone,
      stone: CUMULATIVE_SIGNAL_STONES.rhythm,
      rank: 110,
      color: null,
      subjectId: null,
    },
  ];

  addCommitmentArcSignals(candidates, commitments, snapshots);
  addRangeRunSignals(candidates, snapshots);
  addPersistentFocusSignals(candidates, commitments, snapshots);
  addMomentumSignal(candidates, snapshots);
  addSteadyAnchorSignal(candidates, commitments, snapshots);
  addStructuralTurnSignal(candidates, snapshots);
  addFallbackSignals(candidates, commitments, snapshots);

  return {
    canAnalyze: true,
    monthsAnalyzed: snapshots.length,
    score: latestSnapshot.score,
    level: level.label,
    highlights: selectHighlights(candidates, 5),
    unavailableReason: null,
  };
}

function buildMonthlySnapshots(
  commitments: BalanceAnalysisCommitment[],
  checkpoints: CumulativeBalanceCheckpointInput[],
): MonthlySnapshot[] {
  const latestCheckpointByMonth = new Map<
    string,
    CumulativeBalanceCheckpointInput
  >();
  checkpoints.forEach((checkpoint) => {
    const monthKey = checkpoint.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
    const current = latestCheckpointByMonth.get(monthKey);
    if (!current || checkpoint.date > current.date) {
      latestCheckpointByMonth.set(monthKey, checkpoint);
    }
  });

  return [...latestCheckpointByMonth.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((checkpoint) => normalizeCheckpoint(commitments, checkpoint))
    .filter((snapshot): snapshot is MonthlySnapshot => snapshot !== null);
}

function normalizeCheckpoint(
  commitments: BalanceAnalysisCommitment[],
  checkpoint: CumulativeBalanceCheckpointInput,
): MonthlySnapshot | null {
  const rawShares = new Map(
    checkpoint.shares.map((share) => [
      share.commitmentId,
      Math.max(0, share.percentage),
    ]),
  );
  const totalShare = commitments.reduce(
    (total, commitment) => total + (rawShares.get(commitment.id) ?? 0),
    0,
  );
  if (totalShare <= 0) return null;

  const shares = commitments.map((commitment) => ({
    ...commitment,
    percentage: ((rawShares.get(commitment.id) ?? 0) / totalShare) * 100,
  }));
  const [year = 0, month = 0] = checkpoint.date.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12) return null;

  return {
    date: checkpoint.date,
    label: formatMonth(checkpoint.date),
    monthOrdinal: year * 12 + month - 1,
    score: calculateBalanceScore(shares.map((share) => share.percentage)),
    shares,
  };
}

function addCommitmentArcSignals(
  candidates: RankedHighlight[],
  commitments: BalanceAnalysisCommitment[],
  snapshots: MonthlySnapshot[],
): void {
  const windowSize = Math.max(1, Math.min(3, Math.floor(snapshots.length / 3)));
  const earlySnapshots = snapshots.slice(0, windowSize);
  const recentSnapshots = snapshots.slice(-windowSize);
  const idealShare = 100 / commitments.length;
  const meaningfulShift = Math.max(3, idealShare * 0.15);

  commitments.forEach((commitment) => {
    const earlyShare = average(
      earlySnapshots.map((snapshot) => shareFor(snapshot, commitment.id)),
    );
    const recentShare = average(
      recentSnapshots.map((snapshot) => shareFor(snapshot, commitment.id)),
    );
    const closenessGain =
      Math.abs(earlyShare - idealShare) - Math.abs(recentShare - idealShare);

    if (
      earlyShare < idealShare * 0.8 &&
      recentShare - earlyShare >= meaningfulShift &&
      closenessGain >= 3
    ) {
      candidates.push({
        key: `comeback-arc-${commitment.id}`,
        title: "Comeback Arc",
        value: commitment.name,
        detail: `${formatPercent(earlyShare)} → ${formatPercent(recentShare)}, closing the gap`,
        tone: "positive",
        stone: CUMULATIVE_SIGNAL_STONES.comeback,
        rank: 80 + Math.min(18, closenessGain),
        color: commitment.color,
        subjectId: commitment.id,
      });
    }

    if (
      earlyShare > idealShare * 1.3 &&
      earlyShare - recentShare >= meaningfulShift &&
      closenessGain >= 3
    ) {
      candidates.push({
        key: `focus-release-${commitment.id}`,
        title: "Focus Release",
        value: commitment.name,
        detail: `${formatPercent(earlyShare)} → ${formatPercent(recentShare)}, easing concentration`,
        tone: "positive",
        stone: CUMULATIVE_SIGNAL_STONES.focusRelease,
        rank: 81 + Math.min(18, closenessGain),
        color: commitment.color,
        subjectId: commitment.id,
      });
    }
  });
}

function addRangeRunSignals(
  candidates: RankedHighlight[],
  snapshots: MonthlySnapshot[],
): void {
  const harmonyRun = longestContinuousRun(
    snapshots,
    (snapshot) => snapshot.score >= 70,
  );
  if (harmonyRun >= 2) {
    candidates.push({
      key: "harmony-era",
      title: "Harmony Era",
      value: `${harmonyRun} months`,
      detail: "Longest sustained balanced chapter",
      tone: "positive",
      stone: CUMULATIVE_SIGNAL_STONES.harmonyRun,
      rank: 72 + harmonyRun * 6,
      color: null,
      subjectId: null,
    });
  }

  const concentrationRun = longestContinuousRun(
    snapshots,
    (snapshot) => snapshot.score < 50,
  );
  if (concentrationRun >= 2) {
    candidates.push({
      key: "concentration-era",
      title: "Concentration Era",
      value: `${concentrationRun} months`,
      detail: "Longest chapter pulled toward too few areas",
      tone: "critical",
      stone: CUMULATIVE_SIGNAL_STONES.concentrationRun,
      rank: 86 + concentrationRun * 7,
      color: null,
      subjectId: null,
    });
  }
}

function addPersistentFocusSignals(
  candidates: RankedHighlight[],
  commitments: BalanceAnalysisCommitment[],
  snapshots: MonthlySnapshot[],
): void {
  const idealShare = 100 / commitments.length;
  const minimumMonths = Math.max(2, Math.ceil(snapshots.length * 0.4));
  const patterns = commitments.map((commitment) => {
    const shares = snapshots.map((snapshot) =>
      shareFor(snapshot, commitment.id),
    );
    return {
      commitment,
      quietMonths: shares.filter((share) => share < idealShare * 0.55).length,
      heavyMonths: shares.filter((share) => share > idealShare * 1.55).length,
      averageDeviation: average(
        shares.map((share) => Math.abs(share - idealShare)),
      ),
    };
  });

  const quietest = [...patterns].sort(
    (left, right) =>
      right.quietMonths - left.quietMonths ||
      right.averageDeviation - left.averageDeviation,
  )[0];
  if (quietest && quietest.quietMonths >= minimumMonths) {
    candidates.push({
      key: `quiet-drift-${quietest.commitment.id}`,
      title: "Quiet Drift",
      value: quietest.commitment.name,
      detail: `Underweighted through ${quietest.quietMonths} of ${snapshots.length} months`,
      tone: "attention",
      stone: CUMULATIVE_SIGNAL_STONES.quietFocus,
      rank: 70 + (quietest.quietMonths / snapshots.length) * 25,
      color: quietest.commitment.color,
      subjectId: quietest.commitment.id,
    });
  }

  const heaviest = [...patterns].sort(
    (left, right) =>
      right.heavyMonths - left.heavyMonths ||
      right.averageDeviation - left.averageDeviation,
  )[0];
  if (heaviest && heaviest.heavyMonths >= minimumMonths) {
    candidates.push({
      key: `focus-gravity-${heaviest.commitment.id}`,
      title: "Focus Gravity",
      value: heaviest.commitment.name,
      detail: `Overweighted through ${heaviest.heavyMonths} of ${snapshots.length} months`,
      tone: "attention",
      stone: CUMULATIVE_SIGNAL_STONES.dominantFocus,
      rank: 72 + (heaviest.heavyMonths / snapshots.length) * 25,
      color: heaviest.commitment.color,
      subjectId: heaviest.commitment.id,
    });
  }
}

function addMomentumSignal(
  candidates: RankedHighlight[],
  snapshots: MonthlySnapshot[],
): void {
  const windowSize = Math.max(1, Math.min(3, Math.floor(snapshots.length / 3)));
  const earlyScore = average(
    snapshots.slice(0, windowSize).map((snapshot) => snapshot.score),
  );
  const recentScore = average(
    snapshots.slice(-windowSize).map((snapshot) => snapshot.score),
  );
  const change = recentScore - earlyScore;
  if (Math.abs(change) < 5) return;

  candidates.push({
    key: "balance-momentum",
    title: "Balance Momentum",
    value: change > 0 ? "Moving inward" : "Drifting outward",
    detail: `${change > 0 ? "+" : "−"}${Math.round(Math.abs(change))} points from early to recent months`,
    tone: change > 0 ? "positive" : "attention",
    stone: CUMULATIVE_SIGNAL_STONES.momentum,
    rank: 68 + Math.min(25, Math.abs(change)),
    color: null,
    subjectId: null,
  });
}

function addSteadyAnchorSignal(
  candidates: RankedHighlight[],
  commitments: BalanceAnalysisCommitment[],
  snapshots: MonthlySnapshot[],
): void {
  const idealShare = 100 / commitments.length;
  const steadiest = commitments
    .map((commitment) => ({
      commitment,
      averageDeviation: average(
        snapshots.map((snapshot) =>
          Math.abs(shareFor(snapshot, commitment.id) - idealShare),
        ),
      ),
    }))
    .sort((left, right) => left.averageDeviation - right.averageDeviation)[0];
  if (!steadiest || steadiest.averageDeviation > idealShare * 0.4) return;

  candidates.push({
    key: `steady-anchor-${steadiest.commitment.id}`,
    title: "Steady Anchor",
    value: steadiest.commitment.name,
    detail: `Stayed within about ${Math.round(steadiest.averageDeviation)} points of balance`,
    tone: "positive",
    stone: CUMULATIVE_SIGNAL_STONES.steadyAnchor,
    rank: 58 + Math.max(0, 22 * (1 - steadiest.averageDeviation / idealShare)),
    color: steadiest.commitment.color,
    subjectId: steadiest.commitment.id,
  });
}

function addStructuralTurnSignal(
  candidates: RankedHighlight[],
  snapshots: MonthlySnapshot[],
): void {
  let strongest: { snapshot: MonthlySnapshot; improvement: number } | undefined;

  for (let index = 1; index < snapshots.length - 1; index += 1) {
    const previous = snapshots[index - 1];
    const current = snapshots[index];
    const next = snapshots[index + 1];
    if (!previous || !current || !next) continue;
    if (current.monthOrdinal !== previous.monthOrdinal + 1) continue;
    if (next.monthOrdinal !== current.monthOrdinal + 1) continue;

    const improvement = current.score - previous.score;
    const retained = next.score >= previous.score + improvement * 0.5;
    if (
      improvement >= 7 &&
      retained &&
      (!strongest || improvement > strongest.improvement)
    ) {
      strongest = { snapshot: current, improvement };
    }
  }

  if (!strongest) return;
  candidates.push({
    key: "structural-turn",
    title: "Structural Turn",
    value: `${strongest.snapshot.label} onward`,
    detail: `A ${Math.round(strongest.improvement)}-point lift held into the next month`,
    tone: "positive",
    stone: CUMULATIVE_SIGNAL_STONES.structuralTurn,
    rank: 74 + Math.min(22, strongest.improvement),
    color: null,
    subjectId: null,
  });
}

function addFallbackSignals(
  candidates: RankedHighlight[],
  commitments: BalanceAnalysisCommitment[],
  snapshots: MonthlySnapshot[],
): void {
  const strongest = [...snapshots].sort(
    (left, right) => right.score - left.score,
  )[0];
  if (strongest) {
    candidates.push({
      key: "balance-peak",
      title: "Balance Peak",
      value: strongest.label,
      detail: `${Math.round(strongest.score)}/100 — strongest alignment`,
      tone: strongest.score >= 70 ? "positive" : "neutral",
      stone: "tidemark",
      rank: 34 + strongest.score / 10,
      color: null,
      subjectId: null,
    });
  }

  const hardest = [...snapshots].sort(
    (left, right) => left.score - right.score,
  )[0];
  if (hardest) {
    candidates.push({
      key: "hardest-chapter",
      title: "Hardest Chapter",
      value: hardest.label,
      detail: `${Math.round(hardest.score)}/100 — strongest concentration`,
      tone: hardest.score < 50 ? "critical" : "attention",
      stone: "tidemark",
      rank: 28 + (100 - hardest.score) / 10,
      color: null,
      subjectId: null,
    });
  }

  const idealShare = 100 / commitments.length;
  const closest = commitments
    .map((commitment) => ({
      commitment,
      deviation: average(
        snapshots.map((snapshot) =>
          Math.abs(shareFor(snapshot, commitment.id) - idealShare),
        ),
      ),
    }))
    .sort((left, right) => left.deviation - right.deviation)[0];
  if (closest) {
    candidates.push({
      key: `closest-thread-${closest.commitment.id}`,
      title: "Closest Thread",
      value: closest.commitment.name,
      detail: "Nearest to an even share across the full range",
      tone: "neutral",
      stone: "concord",
      rank: 32,
      color: closest.commitment.color,
      subjectId: closest.commitment.id,
    });
  }
}

function selectHighlights(
  candidates: RankedHighlight[],
  count: number,
): BalanceAnalysisHighlight[] {
  const selected: RankedHighlight[] = [];
  [...candidates]
    .sort((left, right) => right.rank - left.rank)
    .forEach((candidate) => {
      if (
        selected.length < count &&
        !selected.some(
          (highlight) =>
            highlight.title === candidate.title ||
            (candidate.subjectId !== null &&
              highlight.subjectId === candidate.subjectId),
        )
      ) {
        selected.push(candidate);
      }
    });

  while (selected.length < count) {
    const index = selected.length + 1;
    selected.push({
      key: `pattern-forming-${index}`,
      title: "Pattern Forming",
      value: "More history needed",
      detail: "A longer range will reveal another durable signal",
      tone: "neutral",
      stone: "tidemark",
      rank: 0,
      color: null,
      subjectId: null,
    });
  }
  return selected;
}

function longestContinuousRun(
  snapshots: MonthlySnapshot[],
  matches: (snapshot: MonthlySnapshot) => boolean,
): number {
  let longest = 0;
  let current = 0;
  let previousOrdinal: number | null = null;
  snapshots.forEach((snapshot) => {
    const isContinuous =
      previousOrdinal === null || snapshot.monthOrdinal === previousOrdinal + 1;
    current =
      isContinuous && matches(snapshot)
        ? current + 1
        : matches(snapshot)
          ? 1
          : 0;
    longest = Math.max(longest, current);
    previousOrdinal = snapshot.monthOrdinal;
  });
  return longest;
}

function shareFor(snapshot: MonthlySnapshot, commitmentId: number): number {
  return (
    snapshot.shares.find((share) => share.id === commitmentId)?.percentage ?? 0
  );
}

function calculateBalanceScore(percentages: number[]): number {
  const idealShare = 100 / percentages.length;
  const totalVariation =
    percentages.reduce(
      (total, percentage) => total + Math.abs(percentage - idealShare),
      0,
    ) / 2;
  const maximumVariation = 100 - idealShare;
  return Math.max(
    0,
    Math.min(100, 100 * (1 - totalVariation / maximumVariation)),
  );
}

function classifyBalance(score: number): {
  label: string;
  tone: BalanceAnalysisTone;
} {
  if (score >= 85) return { label: "Well balanced", tone: "positive" };
  if (score >= 70) return { label: "Generally balanced", tone: "neutral" };
  if (score >= 50) return { label: "Uneven", tone: "attention" };
  return { label: "Concentrated", tone: "critical" };
}

function unavailableAnalysis(
  monthsAnalyzed: number,
  unavailableReason: string,
): CumulativeBalanceTrendAnalysis {
  return {
    canAnalyze: false,
    monthsAnalyzed,
    score: null,
    level: "Awaiting a longer range",
    highlights: [],
    unavailableReason,
  };
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

function formatMonth(value: string): string {
  const [year = 0, month = 0] = value.split("-").map(Number);
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthName = monthNames[month - 1];
  return monthName && year ? `${monthName} ${year}` : value;
}
