import type { StoneId } from "@/lib/stones";

export type BalanceAnalysisTone =
  "positive" | "neutral" | "attention" | "critical";

export interface BalanceAnalysisCommitment {
  id: number;
  name: string;
  color: string;
}

export interface BalanceAnalysisEvent {
  commitmentId: number;
  date: string;
  contributes: boolean;
}

export interface BalanceAnalysisHighlight {
  key: string;
  title: string;
  value: string;
  detail: string;
  tone: BalanceAnalysisTone;
  stone: StoneId;
  rank: number;
  color: string | null;
}

export interface ThirtyDayBalanceAnalysis {
  score: number | null;
  level: string;
  highlights: BalanceAnalysisHighlight[];
  unavailableReason: string | null;
}

interface SharePoint extends BalanceAnalysisCommitment {
  percentage: number;
}

interface BalanceWindow {
  score: number;
  shares: SharePoint[];
}

interface RankedHighlight extends BalanceAnalysisHighlight {
  subjectId: number | null;
}

const THIRTY_DAY_SIGNAL_STONES = {
  rhythm: "concord",
  comeback: "emberwake",
  focusRelease: "crucible",
  harmonyRun: "concord",
  concentrationRun: "tidemark",
  quietFocus: "lodestar",
  dominantFocus: "lodestar",
  twoFocusPull: "concord",
  balancedCore: "concord",
  turningWeek: "emberwake",
} as const satisfies Record<string, StoneId>;

/**
 * Rank five short-horizon balance signals from one recent 30-day period.
 *
 * The analyzer evaluates ten fixed areas: overall rhythm, weak-focus recovery,
 * released over-focus, healthy and critical weekly runs, quiet and dominant
 * commitments, two-focus concentration, the balanced core, and the strongest
 * weekly turn. Activity volume is used only to calculate relative share and is
 * never exposed as a performance target.
 */
export function analyzeThirtyDayBalance({
  commitments,
  events,
  startDate,
  endDate,
}: {
  commitments: BalanceAnalysisCommitment[];
  events: BalanceAnalysisEvent[];
  startDate: string;
  endDate: string;
}): ThirtyDayBalanceAnalysis {
  if (commitments.length < 2) {
    return unavailableAnalysis(
      "Select at least two commitments to evaluate your current balance.",
    );
  }

  const selectedIds = new Set(commitments.map((commitment) => commitment.id));
  const relevantEvents = events.filter(
    (event) =>
      event.contributes &&
      selectedIds.has(event.commitmentId) &&
      event.date >= startDate &&
      event.date <= endDate,
  );
  const overallShares = calculateShares(commitments, relevantEvents);
  if (!overallShares) {
    return unavailableAnalysis(
      "There is not enough activity in the last 30 days to read your balance yet.",
    );
  }

  const overallScore = calculateBalanceScore(
    overallShares.map((share) => share.percentage),
  );
  const level = classifyBalance(overallScore);
  const candidates: RankedHighlight[] = [
    {
      key: "thirty-day-rhythm",
      title: "30-Day Rhythm",
      value: level.label,
      detail: `${Math.round(overallScore)}/100 balance score`,
      tone: level.tone,
      stone: THIRTY_DAY_SIGNAL_STONES.rhythm,
      rank: 110,
      color: null,
      subjectId: null,
    },
  ];

  const tenDayWindows = buildWindows({
    commitments,
    events: relevantEvents,
    startDate,
    endDate,
    windowCount: 3,
  });
  addRecoverySignals(candidates, commitments, tenDayWindows);

  const weeklyWindows = buildWindows({
    commitments,
    events: relevantEvents,
    startDate,
    endDate,
    windowCount: 4,
  });
  addWeeklyRunSignals(candidates, weeklyWindows);
  addCurrentShareSignals(candidates, overallShares);
  addBalancedCoreSignal(candidates, overallShares);
  addTurningWeekSignal(candidates, weeklyWindows);
  addFallbackSignals(candidates, overallShares, weeklyWindows);

  return {
    score: overallScore,
    level: level.label,
    highlights: selectHighlights(candidates, 5),
    unavailableReason: null,
  };
}

function addRecoverySignals(
  candidates: RankedHighlight[],
  commitments: BalanceAnalysisCommitment[],
  windows: Array<BalanceWindow | null>,
): void {
  const early = windows[0];
  const recent = windows.at(-1);
  if (!early || !recent) return;

  const idealShare = 100 / commitments.length;
  const meaningfulShift = Math.max(3, idealShare * 0.15);
  commitments.forEach((commitment) => {
    const earlyShare = shareFor(early, commitment.id);
    const recentShare = shareFor(recent, commitment.id);
    const closenessGain =
      Math.abs(earlyShare - idealShare) - Math.abs(recentShare - idealShare);

    if (
      earlyShare < idealShare * 0.8 &&
      recentShare - earlyShare >= meaningfulShift &&
      closenessGain >= 3
    ) {
      candidates.push({
        key: `comeback-pulse-${commitment.id}`,
        title: "Comeback Pulse",
        value: commitment.name,
        detail: `${formatPercent(earlyShare)} → ${formatPercent(recentShare)} in the latest stretch`,
        tone: "positive",
        stone: THIRTY_DAY_SIGNAL_STONES.comeback,
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
        detail: `${formatPercent(earlyShare)} → ${formatPercent(recentShare)}, easing the pull`,
        tone: "positive",
        stone: THIRTY_DAY_SIGNAL_STONES.focusRelease,
        rank: 81 + Math.min(18, closenessGain),
        color: commitment.color,
        subjectId: commitment.id,
      });
    }
  });
}

function addWeeklyRunSignals(
  candidates: RankedHighlight[],
  windows: Array<BalanceWindow | null>,
): void {
  const balancedRun = longestRun(windows, (window) => window.score >= 70);
  if (balancedRun >= 2) {
    candidates.push({
      key: "harmony-streak",
      title: "Harmony Streak",
      value: `${balancedRun} weeks`,
      detail: "Sustained a healthy balance range",
      tone: "positive",
      stone: THIRTY_DAY_SIGNAL_STONES.harmonyRun,
      rank: 72 + balancedRun * 6,
      color: null,
      subjectId: null,
    });
  }

  const criticalRun = longestRun(windows, (window) => window.score < 50);
  if (criticalRun >= 2) {
    candidates.push({
      key: "red-flag-stretch",
      title: "Red-Flag Stretch",
      value: `${criticalRun} weeks`,
      detail: "Focus stayed concentrated for too long",
      tone: "critical",
      stone: THIRTY_DAY_SIGNAL_STONES.concentrationRun,
      rank: 86 + criticalRun * 7,
      color: null,
      subjectId: null,
    });
  }
}

function addCurrentShareSignals(
  candidates: RankedHighlight[],
  shares: SharePoint[],
): void {
  const idealShare = 100 / shares.length;
  const ordered = [...shares].sort(
    (left, right) => right.percentage - left.percentage,
  );
  const quiet = [...shares].sort(
    (left, right) => left.percentage - right.percentage,
  )[0];
  const dominant = ordered[0];

  if (quiet && quiet.percentage < idealShare * 0.55) {
    candidates.push({
      key: `quiet-corner-${quiet.id}`,
      title: "Quiet Corner",
      value: quiet.name,
      detail: `${formatPercent(quiet.percentage)} share — needs more room now`,
      tone: quiet.percentage === 0 ? "critical" : "attention",
      stone: THIRTY_DAY_SIGNAL_STONES.quietFocus,
      rank:
        70 + Math.min(22, ((idealShare - quiet.percentage) / idealShare) * 22),
      color: quiet.color,
      subjectId: quiet.id,
    });
  }

  if (dominant && dominant.percentage > idealShare * 1.55) {
    candidates.push({
      key: `focus-magnet-${dominant.id}`,
      title: "Focus Magnet",
      value: dominant.name,
      detail: `${formatPercent(dominant.percentage)} share — pulling attention inward`,
      tone: "attention",
      stone: THIRTY_DAY_SIGNAL_STONES.dominantFocus,
      rank:
        72 +
        Math.min(22, ((dominant.percentage - idealShare) / idealShare) * 18),
      color: dominant.color,
      subjectId: dominant.id,
    });
  }

  if (shares.length >= 3) {
    const topTwoShare =
      (ordered[0]?.percentage ?? 0) + (ordered[1]?.percentage ?? 0);
    const expectedTopTwoShare = 200 / shares.length;
    const dominanceThreshold = Math.max(70, expectedTopTwoShare * 1.2);
    if (topTwoShare > dominanceThreshold) {
      candidates.push({
        key: "two-way-pull",
        title: "Two-Way Pull",
        value: `${formatPercent(topTwoShare)} combined`,
        detail: "Two commitments are shaping most of this month",
        tone: "attention",
        stone: THIRTY_DAY_SIGNAL_STONES.twoFocusPull,
        rank: 68 + Math.min(24, topTwoShare - dominanceThreshold),
        color: null,
        subjectId: null,
      });
    }
  }
}

function addBalancedCoreSignal(
  candidates: RankedHighlight[],
  shares: SharePoint[],
): void {
  const idealShare = 100 / shares.length;
  const balancedCount = shares.filter(
    (share) =>
      share.percentage >= idealShare * 0.7 &&
      share.percentage <= idealShare * 1.3,
  ).length;
  const ratio = balancedCount / shares.length;
  candidates.push({
    key: "balanced-core",
    title: ratio >= 0.7 ? "Balanced Core" : "Narrow Core",
    value: `${balancedCount} of ${shares.length}`,
    detail:
      ratio >= 0.7
        ? "Most commitments sit near an even share"
        : "Only a few commitments sit near the center",
    tone: ratio >= 0.7 ? "positive" : ratio >= 0.4 ? "neutral" : "attention",
    stone: THIRTY_DAY_SIGNAL_STONES.balancedCore,
    rank: 58 + ratio * 24,
    color: null,
    subjectId: null,
  });
}

function addTurningWeekSignal(
  candidates: RankedHighlight[],
  windows: Array<BalanceWindow | null>,
): void {
  let strongestChange = 0;
  let strongestWeek = 0;
  for (let index = 1; index < windows.length; index += 1) {
    const previous = windows[index - 1];
    const current = windows[index];
    if (!previous || !current) continue;
    const change = current.score - previous.score;
    if (change > strongestChange) {
      strongestChange = change;
      strongestWeek = index + 1;
    }
  }

  if (strongestChange >= 5) {
    candidates.push({
      key: "turning-week",
      title: "Turning Week",
      value: `Week ${strongestWeek}`,
      detail: `Balance lifted ${Math.round(strongestChange)} points`,
      tone: "positive",
      stone: THIRTY_DAY_SIGNAL_STONES.turningWeek,
      rank: 64 + Math.min(24, strongestChange),
      color: null,
      subjectId: null,
    });
  }
}

function addFallbackSignals(
  candidates: RankedHighlight[],
  shares: SharePoint[],
  windows: Array<BalanceWindow | null>,
): void {
  const idealShare = 100 / shares.length;
  const closest = [...shares].sort(
    (left, right) =>
      Math.abs(left.percentage - idealShare) -
      Math.abs(right.percentage - idealShare),
  )[0];
  if (closest) {
    candidates.push({
      key: `center-thread-${closest.id}`,
      title: "Center Thread",
      value: closest.name,
      detail: `${formatPercent(closest.percentage)} share — closest to balance`,
      tone: "neutral",
      stone: "concord",
      rank: 38,
      color: closest.color,
      subjectId: closest.id,
    });
  }

  const strongestWindow = windows
    .filter((window): window is BalanceWindow => window !== null)
    .sort((left, right) => right.score - left.score)[0];
  if (strongestWindow) {
    candidates.push({
      key: "weekly-high-water",
      title: "High-Water Week",
      value: `${Math.round(strongestWindow.score)}/100`,
      detail: "Strongest short balance window",
      tone: strongestWindow.score >= 70 ? "positive" : "neutral",
      stone: "tidemark",
      rank: 34 + strongestWindow.score / 10,
      color: null,
      subjectId: null,
    });
  }
}

function buildWindows({
  commitments,
  events,
  startDate,
  endDate,
  windowCount,
}: {
  commitments: BalanceAnalysisCommitment[];
  events: BalanceAnalysisEvent[];
  startDate: string;
  endDate: string;
  windowCount: number;
}): Array<BalanceWindow | null> {
  const totalDays = calendarDayDifference(startDate, endDate) + 1;
  const windowEvents = Array.from(
    { length: windowCount },
    () => [] as BalanceAnalysisEvent[],
  );
  events.forEach((event) => {
    const offset = calendarDayDifference(startDate, event.date);
    const windowIndex = Math.min(
      windowCount - 1,
      Math.floor((offset * windowCount) / totalDays),
    );
    windowEvents[windowIndex]?.push(event);
  });

  return windowEvents.map((eventsInWindow) => {
    const shares = calculateShares(commitments, eventsInWindow);
    if (!shares) return null;
    return {
      score: calculateBalanceScore(shares.map((share) => share.percentage)),
      shares,
    };
  });
}

function calculateShares(
  commitments: BalanceAnalysisCommitment[],
  events: BalanceAnalysisEvent[],
): SharePoint[] | null {
  const totals = new Map<number, number>(
    commitments.map((commitment) => [commitment.id, 0]),
  );
  events.forEach((event) => {
    if (!event.contributes || !totals.has(event.commitmentId)) return;
    totals.set(event.commitmentId, (totals.get(event.commitmentId) ?? 0) + 1);
  });
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;

  return commitments.map((commitment) => ({
    ...commitment,
    percentage: ((totals.get(commitment.id) ?? 0) / total) * 100,
  }));
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

function shareFor(window: BalanceWindow, commitmentId: number): number {
  return (
    window.shares.find((share) => share.id === commitmentId)?.percentage ?? 0
  );
}

function longestRun(
  windows: Array<BalanceWindow | null>,
  matches: (window: BalanceWindow) => boolean,
): number {
  let longest = 0;
  let current = 0;
  windows.forEach((window) => {
    current = window && matches(window) ? current + 1 : 0;
    longest = Math.max(longest, current);
  });
  return longest;
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
      value: "More signal needed",
      detail: "The next few days will sharpen this view",
      tone: "neutral",
      stone: "tidemark",
      rank: 0,
      color: null,
      subjectId: null,
    });
  }
  return selected;
}

function unavailableAnalysis(reason: string): ThirtyDayBalanceAnalysis {
  return {
    score: null,
    level: "Awaiting a pattern",
    highlights: [],
    unavailableReason: reason,
  };
}

function calendarDayDifference(startDate: string, endDate: string): number {
  const [startYear = 0, startMonth = 1, startDay = 1] = startDate
    .split("-")
    .map(Number);
  const [endYear = 0, endMonth = 1, endDay = 1] = endDate
    .split("-")
    .map(Number);
  return Math.round(
    (Date.UTC(endYear, endMonth - 1, endDay) -
      Date.UTC(startYear, startMonth - 1, startDay)) /
      86_400_000,
  );
}

function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}
