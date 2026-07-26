"use client";

import { useEffect, useMemo, useState } from "react";
import { periodTones, trackedStreak } from "@/lib/habit-status";
import { periodOverlapsVacation, type Vacation } from "@/lib/vacations";
import SiteFooter from "@/app/SiteFooter";

type Habit = {
  task_id: string; content: string; todoist_recurrence: string | null;
  label_override: string | null;
  override_type: string | null; override_count: number | null; override_period: string | null;
  track_during_vacations: number;
  tracking_start_date: string | null;
  project_name: string; color: string;
};
type Completion = { task_id: string; completed_at: string };
type Data = { user: { name: string; email: string; avatar?: string; last_sync?: string }; habits: Habit[]; completions: Completion[]; vacations: Vacation[] };
type Period = {
  date: Date; key: string; label: string;
  state: "done" | "miss" | "future" | "vacation" | "before_start";
  completed: number; target: number;
};
type Rhythm = { type: "daily" | "interval" | "weekly"; count: number };
type View = "heatmap" | "trend" | "history";
type Range = "30d" | "90d" | "6m" | "ytd" | "12m";
type SyncResponse = { code?: string; error?: string };
const ALL_HABITS = "all";
const LAST_APP_VISIT_KEY = "habit-tracker:last-app-visit";
const AUTO_SYNC_AFTER_MS = 4 * 60 * 60 * 1000;
const WEEKLY_OPTIONS = ["Once per week", "Twice per week", "Three times per week", "Four times per week", "Five times per week", "Six times per week"];
const RANGE_OPTIONS: { value: Range; label: string; short: string }[] = [
  { value: "30d", label: "Last 30 days", short: "30 days" },
  { value: "90d", label: "Last 90 days", short: "90 days" },
  { value: "6m", label: "Last 6 months", short: "6 months" },
  { value: "ytd", label: "Year to date", short: "year to date" },
  { value: "12m", label: "Last 12 months", short: "12 months" },
];

const keyOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

function scheduleLabel(h: Habit) {
  if (h.override_type === "weekly") return `${h.override_count}× per week`;
  if (h.override_type === "interval") return `Every ${h.override_count} days`;
  if (h.override_type === "daily") return "Every day";
  return h.todoist_recurrence || "No repeat";
}

const displayLabel = (habit: Habit) => habit.label_override || habit.content;

function rhythmFor(h: Habit): Rhythm {
  if (h.override_type === "weekly") return { type: "weekly", count: h.override_count || 1 };
  if (h.override_type === "interval") return { type: "interval", count: h.override_count || 2 };
  if (h.override_type === "daily") return { type: "daily", count: 1 };
  const text = (h.todoist_recurrence || "").toLowerCase();
  const interval = Number(text.match(/every\s+(\d+)\s+days?/)?.[1] || (text.includes("every other day") ? 2 : 0));
  if (interval > 1) return { type: "interval", count: interval };
  if (text.includes("weekly") || text.includes("every week") || /every\s+(mon|tue|wed|thu|fri|sat|sun)/.test(text)) {
    return { type: "weekly", count: 1 };
  }
  return { type: "daily", count: 1 };
}

function buildPeriods(h: Habit, completions: Completion[], vacations: Vacation[], months = 12): Period[] {
  const today = startOfDay(new Date());
  const start = new Date(today); start.setMonth(start.getMonth() - months); start.setDate(start.getDate() + 1);
  const rhythm = rhythmFor(h);
  if (rhythm.type === "weekly" || rhythm.type === "daily") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  }
  const completionDates = completions
    .filter((c) => c.task_id === h.task_id)
    .map((c) => startOfDay(new Date(c.completed_at)));
  const periodDays = rhythm.type === "weekly" ? 7 : rhythm.type === "interval" ? rhythm.count : 1;
  const target = rhythm.type === "weekly" ? rhythm.count : 1;
  const periods: Period[] = [];
  for (let periodStart = new Date(start); periodStart <= today; periodStart.setDate(periodStart.getDate() + periodDays)) {
    const date = new Date(periodStart);
    const end = new Date(date); end.setDate(end.getDate() + periodDays);
    const completed = completionDates.filter((d) => d >= date && d < end).length;
    const stillOpen = end > today && completed < target;
    const beforeTrackingStart = Boolean(h.tracking_start_date) && end <= new Date(`${h.tracking_start_date}T00:00:00`);
    const onUntrackedVacation = !beforeTrackingStart && !h.track_during_vacations && periodOverlapsVacation(date, end, vacations);
    const state: Period["state"] = beforeTrackingStart ? "before_start" : onUntrackedVacation ? "vacation" : completed >= target ? "done" : stillOpen ? "future" : "miss";
    const range = periodDays === 1
      ? date.toLocaleDateString(undefined, { dateStyle: "medium" })
      : `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${new Date(end.getTime() - 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    periods.push({
      date, key: `${keyOf(date)}-${periodDays}`, state, completed, target,
      label: `${range}: ${beforeTrackingStart ? "before tracking started" : onUntrackedVacation ? "vacation · not tracked" : `${completed}/${target} completed`}`,
    });
  }
  return periods;
}
const periodClass = (period: Period, tone: string) => period.state === "vacation" || period.state === "before_start" ? "untracked" : tone;

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [labelOverride, setLabelOverride] = useState("");
  const [trackingStartDate, setTrackingStartDate] = useState("");
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const [periodTooltip, setPeriodTooltip] = useState<{ title: string; detail: string; x: number; y: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<View>("heatmap");
  const [range, setRange] = useState<Range>("90d");
  const habit = data?.habits.find((h) => h.task_id === selected);
  const isOverview = selected === ALL_HABITS;
  const load = () => fetch("/api/dashboard").then((r) => r.json()).then((d) => {
    setData(d);
    setSelected((current) => {
      const requested = new URLSearchParams(window.location.search).get("habit");
      return current || (requested && (requested === ALL_HABITS || d.habits?.some((h: Habit) => h.task_id === requested)) ? requested : ALL_HABITS);
    });
  });
  const requestSync = async () => {
    const response = await fetch("/api/sync", { method: "POST" });
    const result = await response.json().catch(() => ({})) as SyncResponse;
    if (response.status === 401 && result.code === "TODOIST_REAUTH_REQUIRED") {
      window.location.assign("/api/auth/login");
      return false;
    }
    if (!response.ok) throw new Error(result.error || "Sync failed");
    return true;
  };
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const requestedRange = searchParams.get("range");
    if (RANGE_OPTIONS.some((option) => option.value === requestedRange)) setRange(requestedRange as Range);
    const now = Date.now();
    const previousVisit = Number(window.localStorage.getItem(LAST_APP_VISIT_KEY));
    window.localStorage.setItem(LAST_APP_VISIT_KEY, String(now));
    const autoSync = Number.isFinite(previousVisit) && previousVisit > 0 && now - previousVisit > AUTO_SYNC_AFTER_MS;
    load();
    if (searchParams.get("sync") !== "1" && !autoSync) return;
    setSyncing(true);
    requestSync()
      .then((synced) => { if (synced) return load(); })
      .finally(() => {
        setSyncing(false);
        const url = new URL(window.location.href);
        url.searchParams.delete("sync");
        window.history.replaceState({}, "", url);
      });
  }, []);
  useEffect(() => {
    if (!selected) return;
    const url = new URL(window.location.href);
    url.searchParams.set("habit", selected);
    window.history.replaceState({}, "", url);
  }, [selected]);
  useEffect(() => {
    if (!data) return;
    const restoreSelection = () => {
      const requested = new URLSearchParams(window.location.search).get("habit");
      setSelected(requested && (requested === ALL_HABITS || data.habits.some((h) => h.task_id === requested)) ? requested : ALL_HABITS);
      setMenuOpen(false);
      setSettings(false);
    };
    window.addEventListener("popstate", restoreSelection);
    return () => window.removeEventListener("popstate", restoreSelection);
  }, [data]);
  useEffect(() => {
    if (!isOverview) return;
    const url = new URL(window.location.href);
    url.searchParams.set("range", range);
    window.history.replaceState({}, "", url);
  }, [range, isOverview]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  const periods = useMemo(() => habit && data ? buildPeriods(habit, data.completions, data.vacations || []) : [], [habit, data]);
  const tones = useMemo(() => periodTones(periods.map((period) => period.state)), [periods]);
  const rhythm = habit ? rhythmFor(habit) : { type: "daily" as const, count: 1 };
  const elapsed = periods.filter((d) => d.state === "done" || d.state === "miss");
  const completed = elapsed.filter((d) => d.state === "done").length;
  const score = elapsed.length ? Math.round(completed / elapsed.length * 100) : 0;
  const streak = trackedStreak(periods.map((period) => period.state));
  const unit = rhythm.type === "weekly" ? "weeks" : rhythm.type === "interval" ? `${rhythm.count}-day periods` : "days";
  const detailAnalytics = useMemo(() => {
    if (!habit || !data) return { trend: [0], direction: "steady", delta: 0, stability: 100, previousScore: null as number | null, comparison: null as number | null };
    const cutoff = startOfDay(new Date()); cutoff.setFullYear(cutoff.getFullYear() - 1); cutoff.setDate(cutoff.getDate() + 1);
    const previousCutoff = new Date(cutoff); previousCutoff.setFullYear(previousCutoff.getFullYear() - 1);
    const all = buildPeriods(habit, data.completions, data.vacations || [], 24);
    const current = all.filter((period) => period.date >= cutoff && (period.state === "done" || period.state === "miss"));
    const previous = all.filter((period) => period.date >= previousCutoff && period.date < cutoff && (period.state === "done" || period.state === "miss"));
    const bucketCount = Math.min(10, Math.max(1, current.length));
    const trend = Array.from({ length: bucketCount }, (_, index) => {
      const start = Math.floor(index * current.length / bucketCount);
      const end = Math.floor((index + 1) * current.length / bucketCount);
      const bucket = current.slice(start, end);
      return bucket.length ? Math.round(bucket.filter((period) => period.state === "done").length / bucket.length * 100) : 0;
    });
    const edgeSize = Math.min(2, Math.max(1, Math.floor(trend.length / 2)));
    const early = trend.slice(0, edgeSize).reduce((sum, value) => sum + value, 0) / edgeSize;
    const recent = trend.slice(-edgeSize).reduce((sum, value) => sum + value, 0) / edgeSize;
    const delta = Math.round(recent - early);
    const direction = delta > 5 ? "improving" : delta < -5 ? "declining" : "steady";
    const mean = trend.reduce((sum, value) => sum + value, 0) / trend.length;
    const deviation = Math.sqrt(trend.reduce((sum, value) => sum + (value - mean) ** 2, 0) / trend.length);
    const stability = Math.max(0, Math.round(100 - deviation));
    const previousHits = previous.filter((period) => period.state === "done").length;
    const previousScore = previous.length ? Math.round(previousHits / previous.length * 100) : null;
    return { trend, direction, delta, stability, previousScore, comparison: previousScore === null ? null : score - previousScore };
  }, [habit, data, score]);
  const monthly = useMemo(() => {
    const result: { key: string; label: string; hit: number; total: number; score: number }[] = [];
    for (const period of elapsed) {
      const key = `${period.date.getFullYear()}-${period.date.getMonth()}`;
      let month = result.find((item) => item.key === key);
      if (!month) {
        month = { key, label: period.date.toLocaleDateString(undefined, { month: "short" }), hit: 0, total: 0, score: 0 };
        result.push(month);
      }
      month.total++;
      if (period.state === "done") month.hit++;
      month.score = Math.round(month.hit / month.total * 100);
    }
    return result.slice(-12);
  }, [elapsed]);
  const summaries = useMemo(() => data?.habits.map((item) => {
    const today = startOfDay(new Date());
    const dashboardCutoff = new Date(today);
    if (range === "30d") dashboardCutoff.setDate(dashboardCutoff.getDate() - 29);
    if (range === "90d") dashboardCutoff.setDate(dashboardCutoff.getDate() - 89);
    if (range === "6m") dashboardCutoff.setMonth(dashboardCutoff.getMonth() - 6);
    if (range === "ytd") dashboardCutoff.setMonth(0, 1);
    if (range === "12m") dashboardCutoff.setFullYear(dashboardCutoff.getFullYear() - 1);
    const previousCutoff = new Date(dashboardCutoff);
    if (range === "30d") previousCutoff.setDate(previousCutoff.getDate() - 30);
    if (range === "90d") previousCutoff.setDate(previousCutoff.getDate() - 90);
    if (range === "6m") previousCutoff.setMonth(previousCutoff.getMonth() - 6);
    if (range === "ytd") previousCutoff.setDate(previousCutoff.getDate() - (Math.floor((today.getTime() - dashboardCutoff.getTime()) / 86400000) + 1));
    if (range === "12m") previousCutoff.setFullYear(previousCutoff.getFullYear() - 1);
    const allPeriods = buildPeriods(item, data.completions, data.vacations || [], 24);
    const itemPeriods = allPeriods.filter((period) => period.date >= dashboardCutoff);
    const itemElapsed = itemPeriods.filter((period) => period.state === "done" || period.state === "miss");
    const previousElapsed = allPeriods.filter((period) => period.date >= previousCutoff && period.date < dashboardCutoff && (period.state === "done" || period.state === "miss"));
    const hits = itemElapsed.filter((period) => period.state === "done").length;
    const previousHits = previousElapsed.filter((period) => period.state === "done").length;
    const previousScore = previousElapsed.length ? Math.round(previousHits / previousElapsed.length * 100) : null;
    const trackingStart = item.tracking_start_date ? new Date(`${item.tracking_start_date}T00:00:00`) : null;
    const previousBeforeStart = previousScore === null && trackingStart !== null && trackingStart >= dashboardCutoff;
    const itemScore = itemElapsed.length ? Math.round(hits / itemElapsed.length * 100) : 0;
    const itemStreak = trackedStreak(itemPeriods.map((period) => period.state));
    const bucketCount = Math.min(8, Math.max(1, itemElapsed.length));
    const trend = Array.from({ length: bucketCount }, (_, index) => {
      const start = Math.floor(index * itemElapsed.length / bucketCount);
      const end = Math.floor((index + 1) * itemElapsed.length / bucketCount);
      const bucket = itemElapsed.slice(start, end);
      return bucket.length ? Math.round(bucket.filter((period) => period.state === "done").length / bucket.length * 100) : 0;
    });
    const edgeSize = Math.min(2, Math.max(1, Math.floor(trend.length / 2)));
    const early = trend.slice(0, edgeSize).reduce((sum, value) => sum + value, 0) / edgeSize;
    const recent = trend.slice(-edgeSize).reduce((sum, value) => sum + value, 0) / edgeSize;
    const trendDelta = Math.round(recent - early);
    const direction = trendDelta > 5 ? "improving" : trendDelta < -5 ? "declining" : "steady";
    const mean = trend.reduce((sum, value) => sum + value, 0) / trend.length;
    const deviation = Math.sqrt(trend.reduce((sum, value) => sum + (value - mean) ** 2, 0) / trend.length);
    const stability = Math.max(0, Math.round(100 - deviation));
    return {
      habit: item, periods: itemPeriods, tones: periodTones(itemPeriods.map((period) => period.state)),
      hits, total: itemElapsed.length, streak: itemStreak,
      score: itemScore, previousScore, previousBeforeStart, comparison: previousScore === null ? null : itemScore - previousScore,
      unit: rhythmFor(item).type === "weekly" ? "weeks" : rhythmFor(item).type === "interval" ? `${rhythmFor(item).count}-day periods` : "days",
      trend, trendDelta, direction, stability,
    };
  }) || [], [data, range]);
  const overviewHits = summaries.reduce((sum, item) => sum + item.hits, 0);
  const overviewTotal = summaries.reduce((sum, item) => sum + item.total, 0);
  const overviewScore = overviewTotal ? Math.round(overviewHits / overviewTotal * 100) : 0;
  const needsAttention = summaries.filter((item) => item.total > 0 && item.score < 60).length;
  const portfolioTrend = Array.from({ length: 8 }, (_, index) => {
    if (!summaries.length) return 0;
    return Math.round(summaries.reduce((sum, summary) => {
      const sourceIndex = summary.trend.length === 1 ? 0 : Math.round(index * (summary.trend.length - 1) / 7);
      return sum + summary.trend[sourceIndex];
    }, 0) / summaries.length);
  });
  const portfolioDelta = portfolioTrend[portfolioTrend.length - 1] - portfolioTrend[0];
  const portfolioDirection = portfolioDelta > 5 ? "improving" : portfolioDelta < -5 ? "declining" : "steady";
  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label || "Last 90 days";
  const rangeShort = RANGE_OPTIONS.find((option) => option.value === range)?.short || "90 days";

  async function sync() {
    setSyncing(true);
    try {
      if (await requestSync()) await load();
    } finally {
      setSyncing(false);
    }
  }
  async function saveSchedule(type: string, count?: number) {
    if (!habit) return;
    await fetch(`/api/habits/${encodeURIComponent(habit.task_id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, count, period: type === "weekly" ? "week" : "days" }),
    });
    await load(); setSettings(false); showToast("Rhythm saved");
  }
  const showToast = (message: string) => setToast({ message, id: Date.now() });
  const showPeriodTooltip = (label: string, target: HTMLElement) => {
    const [title, ...detail] = label.split(": ");
    const bounds = target.getBoundingClientRect();
    setPeriodTooltip({
      title,
      detail: detail.join(": "),
      x: Math.max(110, Math.min(window.innerWidth - 110, bounds.left + bounds.width / 2)),
      y: bounds.top,
    });
  };
  const openSettings = () => {
    if (!habit) return;
    setLabelOverride(habit.label_override || "");
    setTrackingStartDate(habit.tracking_start_date || "");
    setSettings(true);
  };
  async function saveLabel() {
    if (!habit) return;
    const response = await fetch(`/api/habits/${encodeURIComponent(habit.task_id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: labelOverride }),
    });
    if (!response.ok) throw new Error((await response.json()).error || "Could not save label");
    await load();
    setLabelOverride(labelOverride.trim());
    showToast("Label saved");
  }
  async function saveVacationTracking(trackDuringVacations: boolean) {
    if (!habit) return;
    const response = await fetch(`/api/habits/${encodeURIComponent(habit.task_id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackDuringVacations }),
    });
    if (!response.ok) throw new Error((await response.json()).error || "Could not save vacation tracking");
    await load();
    showToast("Vacation tracking saved");
  }
  async function saveTrackingStartDate() {
    if (!habit) return;
    const response = await fetch(`/api/habits/${encodeURIComponent(habit.task_id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingStartDate }),
    });
    if (!response.ok) throw new Error((await response.json()).error || "Could not save tracking start date");
    await load(); showToast("Start date saved");
  }
  const scheduleIs = (type: string, count?: number) =>
    type === "todoist" ? !habit?.override_type :
    habit?.override_type === type && (count === undefined || habit.override_count === count);
  const selectHabit = (taskId: string) => {
    setMenuOpen(false);
    if (taskId === selected) return;
    const url = new URL(window.location.href);
    url.searchParams.set("habit", taskId);
    window.history.pushState({}, "", url);
    setSelected(taskId);
  };

  if (!data) return <div className="loading"><img className="brand-logo" src="/icons/favicon-rounded-192.png" alt="" width="34" height="34" /><p>Reading your habits…</p></div>;
  const initials = data.user.name.split(" ").map((x) => x[0]).join("").slice(0, 2);
  return (
    <main className="shell">
      <aside className={menuOpen ? "menu-open" : ""}>
        <div className="side-head">
          <a className="brand" href="/"><img className="brand-logo" src="/icons/favicon-rounded-192.png" alt="" width="34" height="34" /> Habit Tracker</a>
          <button className="menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="Toggle navigation"><span /><span /><span /></button>
        </div>
        <div className="side-content">
          <div className="side-label">YOUR HABITS</div>
          <div className="habit-nav">
            <button className={`overview-link ${isOverview ? "active" : ""}`} onClick={() => selectHabit(ALL_HABITS)}><span className="habit-icon overview-icon">▦</span><span><strong>All habits</strong><small>Dashboard overview</small></span></button>
            {data.habits.map((h) => <button key={h.task_id} className={selected === h.task_id ? "active" : ""} onClick={() => selectHabit(h.task_id)}><span className="habit-icon habit-dot" aria-hidden="true" /><span><strong>{displayLabel(h)}</strong><small>{scheduleLabel(h)}</small></span></button>)}
          </div>
          <a className="vacations-link" href="/app/vacations"><span>☀</span><span><strong>Vacations</strong><small>Plan tracking breaks</small></span></a>
          <button className="sync" onClick={sync} disabled={syncing}><span className={syncing ? "spin" : ""}>↻</span> {syncing ? "Syncing…" : "Sync Todoist"}</button>
          <div className="profile"><div className="avatar">{data.user.avatar ? <img src={data.user.avatar} alt="" /> : initials}</div><span><strong>{data.user.name}</strong><small>{data.user.email}</small></span><form action="/api/auth/logout" method="post"><button title="Log out">↗</button></form></div>
        </div>
      </aside>
      <section className="dashboard">
        {isOverview ? <>
          <header><div><div className="eyebrow"><span /> {rangeLabel.toUpperCase()}</div><h1>Your dashboard</h1><p>A recent view of every rhythm you’re tracking.</p></div><button className="button ghost compact adjust-rhythm" onClick={sync} disabled={syncing}><span className={syncing ? "spin" : ""}>↻</span>{syncing ? "Syncing…" : "Sync Todoist"}</button></header>
          <div className="range-picker" role="group" aria-label="Dashboard time range">{RANGE_OPTIONS.map((option) => <button key={option.value} className={range === option.value ? "active" : ""} onClick={() => setRange(option.value)}>{option.label}</button>)}</div>
          <div className="stats overview-stats">
            <article><span>OVERALL CONSISTENCY</span><strong>{overviewScore}<em>%</em></strong><small>across all completed periods</small></article>
            <article><span>ACTIVE HABITS</span><strong>{summaries.length}</strong><small>currently tagged in Todoist</small></article>
            <article><span>TARGETS MET</span><strong>{overviewHits}</strong><small>in the last {rangeShort}</small></article>
            <article><span>NEEDS ATTENTION</span><strong className={needsAttention ? "red" : ""}>{needsAttention}</strong><small>habits below 60%</small></article>
          </div>
          <article className={`portfolio-card ${portfolioDirection}`}>
            <div><span>PORTFOLIO TREND</span><h2>All habits, equally weighted</h2><p>Each habit contributes the same weight, regardless of how often it is scheduled.</p></div>
            <div className="portfolio-status"><strong>{portfolioDirection === "improving" ? "↗ Improving" : portfolioDirection === "declining" ? "↘ Declining" : "→ Steady"}</strong><small>{portfolioDelta > 0 ? "+" : ""}{portfolioDelta} points</small></div>
            <svg viewBox="0 0 100 38" preserveAspectRatio="none" role="img" aria-label={`Portfolio trend ${portfolioDirection}`}>
              <path d="M0 19H100" />
              <polyline points={portfolioTrend.map((value, index) => `${index * 100 / 7},${35 - value * .32}`).join(" ")} />
            </svg>
          </article>
          <div className="habit-summary-grid">
            {summaries.map((summary) => <button key={summary.habit.task_id} onClick={() => selectHabit(summary.habit.task_id)}>
              <div className="summary-head"><span className="habit-icon habit-dot" aria-hidden="true" /><span><strong>{displayLabel(summary.habit)}</strong><small>{summary.habit.project_name} · {scheduleLabel(summary.habit)}</small></span><b>{summary.score}%</b></div>
              <div className="summary-bar"><i style={{ width: `${summary.score}%` }} /></div>
              <div className="summary-metrics">
                <div><span>Previous period</span><strong className={summary.comparison === null ? "" : summary.comparison > 0 ? "positive" : summary.comparison < 0 ? "negative" : ""}>{summary.previousBeforeStart ? "Not tracked" : summary.comparison === null ? "No data" : `${summary.comparison > 0 ? "+" : ""}${summary.comparison} pts`}</strong><small>{summary.previousBeforeStart ? "Before tracking started" : summary.previousScore === null ? "Syncing older history" : `${summary.previousScore}% previously`}</small></div>
                <div><span>Stability</span><strong>{summary.stability}/100</strong><small>{summary.stability >= 80 ? "Consistent" : summary.stability >= 60 ? "Mixed" : "Volatile"}</small></div>
              </div>
              <div className={`summary-trend ${summary.direction}`}>
                <div><span>Trend</span><strong>{summary.direction === "improving" ? "↗ Improving" : summary.direction === "declining" ? "↘ Declining" : "→ Steady"}</strong></div>
                <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label={`${summary.direction} trend, ${summary.trendDelta > 0 ? "+" : ""}${summary.trendDelta} percentage points`}>
                  <path className="trend-guide" d="M0 15H100" />
                  <polyline points={summary.trend.map((value, index) => `${summary.trend.length === 1 ? 50 : index * 100 / (summary.trend.length - 1)},${28 - value * .26}`).join(" ")} />
                </svg>
              </div>
              <div className="summary-recent">{summary.periods.map((period, index) => <i key={period.key} className={periodClass(period, summary.tones[index])} aria-label={period.label} onMouseEnter={(event) => showPeriodTooltip(period.label, event.currentTarget)} onMouseLeave={() => setPeriodTooltip(null)} />)}</div>
              <div className="summary-foot"><span>{summary.hits} targets met</span><span>{summary.streak} {summary.unit} streak</span><strong>View habit →</strong></div>
            </button>)}
          </div>
          <p className="last-sync">Last synced {data.user.last_sync ? new Date(data.user.last_sync).toLocaleString() : "never"} · Read-only Todoist access</p>
        </> : habit ? <>
          <header><div><div className="eyebrow"><span /> HABIT OVERVIEW</div><h1>{displayLabel(habit)}</h1><p>{habit.project_name} <b>·</b> {scheduleLabel(habit)}</p></div><button className="button ghost compact adjust-rhythm" onClick={openSettings}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm9 4.2v-1.4l-2.1-.8a7 7 0 0 0-.7-1.7l.9-2-1-1-2 .9a7 7 0 0 0-1.7-.7L13.6 4h-1.4l-.8 2.1a7 7 0 0 0-1.7.7l-2-.9-1 1 .9 2a7 7 0 0 0-.7 1.7l-2.1.8v1.4l2.1.8a7 7 0 0 0 .7 1.7l-.9 2 1 1 2-.9a7 7 0 0 0 1.7.7l.8 2.1h1.4l.8-2.1a7 7 0 0 0 1.7-.7l2 .9 1-1-.9-2a7 7 0 0 0 .7-1.7l2.1-.8Z" /></svg>Habit settings</button></header>
          <div className="stats">
            <article><span>CONSISTENCY</span><strong>{score}<em>%</em></strong><small>across completed periods</small></article>
            <article><span>SUCCESSFUL PERIODS</span><strong>{completed}</strong><small>in the last 12 months</small></article>
            <article><span>CURRENT STREAK</span><strong>{streak}<em> {unit}</em></strong><small>{streak ? "keep the rhythm going" : "this period is a fresh start"}</small></article>
            <article><span>MISSED</span><strong className="red">{elapsed.length - completed}</strong><small>{unit} below target</small></article>
          </div>
          <article className={`detail-analytics ${detailAnalytics.direction}`}>
            <div className="detail-analytic-copy"><span>12-MONTH TREND</span><strong>{detailAnalytics.direction === "improving" ? "↗ Improving" : detailAnalytics.direction === "declining" ? "↘ Declining" : "→ Steady"}</strong><small>{detailAnalytics.delta > 0 ? "+" : ""}{detailAnalytics.delta} points from early to recent periods</small></div>
            <svg viewBox="0 0 100 34" preserveAspectRatio="none" role="img" aria-label={`${detailAnalytics.direction} yearly trend`}>
              <path d="M0 17H100" />
              <polyline points={detailAnalytics.trend.map((value, index) => `${detailAnalytics.trend.length === 1 ? 50 : index * 100 / (detailAnalytics.trend.length - 1)},${31 - value * .28}`).join(" ")} />
            </svg>
            <div className="detail-analytic-stat"><span>STABILITY</span><strong>{detailAnalytics.stability}<em>/100</em></strong><small>{detailAnalytics.stability >= 80 ? "Consistent" : detailAnalytics.stability >= 60 ? "Mixed" : "Volatile"}</small></div>
            <div className="detail-analytic-stat"><span>VS PREVIOUS YEAR</span><strong className={detailAnalytics.comparison === null ? "" : detailAnalytics.comparison > 0 ? "positive" : detailAnalytics.comparison < 0 ? "negative" : ""}>{detailAnalytics.comparison === null ? "—" : `${detailAnalytics.comparison > 0 ? "+" : ""}${detailAnalytics.comparison}`}<em>{detailAnalytics.comparison === null ? "" : " pts"}</em></strong><small>{detailAnalytics.previousScore === null ? "No previous data yet" : `${detailAnalytics.previousScore}% in the prior 12 months`}</small></div>
          </article>
          <article className="chart-card">
            <div className="chart-title"><div><span>LAST 12 MONTHS</span><h2>{view === "heatmap" ? "Your year at a glance" : view === "trend" ? "Monthly consistency" : "Recent check-ins"}</h2></div>{view === "heatmap" && <div className="chart-legend"><i className="done" /> Target met <i className="warning" /> First miss <i className="miss" /> Repeated miss <i className="untracked" /> Untracked <i className="none" /> Current period</div>}</div>
            <div className="view-tabs" role="tablist" aria-label="Habit visualization">
              <button className={view === "heatmap" ? "active" : ""} onClick={() => setView("heatmap")}>Heatmap</button>
              <button className={view === "trend" ? "active" : ""} onClick={() => setView("trend")}>Monthly trend</button>
              <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>History</button>
            </div>
            {view === "heatmap" && <div className="heatmap-layout">
              {rhythm.type === "daily" && <div className="calendar-labels">{["Mon", "", "Wed", "", "Fri", "", ""].map((label, index) => <span key={index}>{label}</span>)}</div>}
              <div className={`heatmap-scroll ${rhythm.type}`}>
                <div className={`year-grid ${rhythm.type}`}>{periods.map((period, index) => <i key={period.key} className={periodClass(period, tones[index])} aria-label={period.label} onMouseEnter={(event) => showPeriodTooltip(period.label, event.currentTarget)} onMouseLeave={() => setPeriodTooltip(null)}>{rhythm.type === "weekly" ? period.completed : null}</i>)}</div>
              </div>
            </div>}
            {view === "trend" && <div className="trend-chart">{monthly.map((month) => <div className="trend-month" key={month.key} title={`${month.hit}/${month.total} targets met`}><strong>{month.score}%</strong><div><i style={{ height: `${Math.max(month.score, 3)}%` }} /></div><span>{month.label}</span></div>)}</div>}
            {view === "history" && <div className="period-history">{periods.slice(-18).map((period, index) => ({ period, tone: tones[periods.length - Math.min(18, periods.length) + index] })).reverse().map(({ period, tone }) => <div key={period.key}><i className={periodClass(period, tone)} /><span><strong>{period.label.split(":")[0]}</strong><small>{period.state === "before_start" ? "Before tracking started" : period.state === "vacation" ? "Not tracked during vacation" : period.state === "future" ? "Still in progress" : `${period.completed} of ${period.target} completed`}</small></span><b>{period.state === "done" ? "Met" : period.state === "miss" ? tone === "warning" ? "Warning" : "Missed" : period.state === "vacation" ? "Vacation" : period.state === "before_start" ? "Before start" : "Open"}</b></div>)}</div>}
            <div className="insight"><span>✦</span><p><strong>{score >= 80 ? "Strong rhythm." : score >= 55 ? "A rhythm is forming." : "Room to reset."}</strong> You hit your target in {completed} {unit} this year. Misses are information, not failure.</p></div>
          </article>
          <p className="last-sync">Last synced {data.user.last_sync ? new Date(data.user.last_sync).toLocaleString() : "never"} · Read-only Todoist access</p>
        </> : <div className="empty"><span>✓</span><h1>No habits found yet</h1><p>Add the <code>@habit</code> label to a recurring Todoist task, then sync.</p><button className="button primary" onClick={sync}>Sync Todoist</button></div>}
        <SiteFooter />
      </section>
      {periodTooltip && <div className="period-tooltip" role="tooltip" style={{ left: periodTooltip.x, top: periodTooltip.y }}><strong>{periodTooltip.title}</strong><small>{periodTooltip.detail}</small></div>}
      {toast && <div className="save-toast" role="status" aria-live="polite"><span>✓</span><div><strong>Saved</strong><small>{toast.message}</small></div></div>}
      {settings && habit && <div className="modal-bg" onMouseDown={() => setSettings(false)}><div className="modal settings-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" aria-label="Close settings" onClick={() => setSettings(false)}>×</button>
        <div className="eyebrow"><span /> HABIT SETTINGS</div>
        <h2>Make it yours</h2>
        <p>Customize how this habit appears and how completions are measured. Nothing changes in Todoist.</p>
        <section className="settings-section label-setting">
          <div className="settings-heading"><strong>Label</strong><small>Todoist name: {habit.content}</small></div>
          <div className="label-control">
            <input aria-label="Habit label" maxLength={80} value={labelOverride} placeholder={habit.content} onChange={(event) => setLabelOverride(event.target.value)} />
            <button className="button primary compact" onClick={saveLabel}>Save label</button>
          </div>
          <small>{labelOverride ? "Used throughout Habit Tracker" : "Leave empty to use the Todoist name"}</small>
        </section>
        <section className="settings-section vacation-setting">
          <div><strong>Track during vacations</strong><small>Off by default. Vacation periods are grey and excluded from analytics.</small></div>
          <label className="toggle"><input type="checkbox" aria-label="Track during vacations" checked={Boolean(habit.track_during_vacations)} onChange={(event) => saveVacationTracking(event.target.checked)} /><span /></label>
        </section>
        <section className="settings-section start-date-setting">
          <div className="settings-heading"><strong>Tracking start date</strong><small>Earlier periods are grey and excluded</small></div>
          <div className="label-control"><input aria-label="Tracking start date" type="date" value={trackingStartDate} onChange={(event) => setTrackingStartDate(event.target.value)} /><button className="button primary compact" onClick={saveTrackingStartDate}>Save date</button></div>
          <small>{trackingStartDate ? "Only periods from this date count" : "No start date — all history counts"}</small>
        </section>
        <section className="settings-section rhythm-setting">
          <div className="settings-heading"><strong>Rhythm</strong><small>How often this habit should count</small></div>
          <div className="choices primary-choices"><button className={scheduleIs("todoist") ? "selected" : ""} onClick={() => saveSchedule("todoist")}><i>↻</i><span><strong>Use Todoist schedule</strong><small>{habit.todoist_recurrence || "No recurring due date"}</small></span><b>✓</b></button><button className={scheduleIs("daily") ? "selected" : ""} onClick={() => saveSchedule("daily")}><i>1d</i><span><strong>Every day</strong><small>One completion each day</small></span><b>✓</b></button><button className={scheduleIs("interval", 2) ? "selected" : ""} onClick={() => saveSchedule("interval", 2)}><i>2d</i><span><strong>Every two days</strong><small>One completion per two-day period</small></span><b>✓</b></button>{WEEKLY_OPTIONS.map((label, index) => { const count = index + 1; return <button className={scheduleIs("weekly", count) ? "selected" : ""} key={count} onClick={() => saveSchedule("weekly", count)}><i>{count}×</i><span><strong>{label}</strong><small>Any days, Monday–Sunday</small></span><b>✓</b></button>; })}</div>
        </section>
      </div></div>}
    </main>
  );
}
