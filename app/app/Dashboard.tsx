"use client";

import { useEffect, useMemo, useState } from "react";

type Habit = {
  task_id: string; content: string; todoist_recurrence: string | null;
  override_type: string | null; override_count: number | null; override_period: string | null;
  project_name: string; color: string;
};
type Completion = { task_id: string; completed_at: string };
type Data = { user: { name: string; email: string; avatar?: string; last_sync?: string }; habits: Habit[]; completions: Completion[] };
type Period = {
  date: Date; key: string; label: string;
  state: "done" | "miss" | "future";
  completed: number; target: number;
};
type Rhythm = { type: "daily" | "interval" | "weekly"; count: number };
type View = "heatmap" | "trend" | "history";

const keyOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

function scheduleLabel(h: Habit) {
  if (h.override_type === "weekly") return `${h.override_count}× per week`;
  if (h.override_type === "interval") return `Every ${h.override_count} days`;
  if (h.override_type === "daily") return "Every day";
  return h.todoist_recurrence || "No repeat";
}

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

function buildPeriods(h: Habit, completions: Completion[]): Period[] {
  const today = startOfDay(new Date());
  const start = new Date(today); start.setFullYear(start.getFullYear() - 1); start.setDate(start.getDate() + 1);
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
    const state: Period["state"] = completed >= target ? "done" : stillOpen ? "future" : "miss";
    const range = periodDays === 1
      ? date.toLocaleDateString(undefined, { dateStyle: "medium" })
      : `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${new Date(end.getTime() - 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    periods.push({
      date, key: `${keyOf(date)}-${periodDays}`, state, completed, target,
      label: `${range}: ${completed}/${target} completed`,
    });
  }
  return periods;
}

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<View>("heatmap");
  const load = () => fetch("/api/dashboard").then((r) => r.json()).then((d) => {
    setData(d);
    setSelected((current) => {
      const requested = new URLSearchParams(window.location.search).get("habit");
      return current || (d.habits?.some((h: Habit) => h.task_id === requested) ? requested : d.habits?.[0]?.task_id) || "";
    });
  });
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!selected) return;
    const url = new URL(window.location.href);
    url.searchParams.set("habit", selected);
    window.history.replaceState({}, "", url);
  }, [selected]);
  const habit = data?.habits.find((h) => h.task_id === selected);
  const periods = useMemo(() => habit && data ? buildPeriods(habit, data.completions) : [], [habit, data]);
  const rhythm = habit ? rhythmFor(habit) : { type: "daily" as const, count: 1 };
  const elapsed = periods.filter((d) => d.state !== "future");
  const completed = elapsed.filter((d) => d.state === "done").length;
  const score = elapsed.length ? Math.round(completed / elapsed.length * 100) : 0;
  const streak = (() => { let n = 0; for (let i = periods.length - 1; i >= 0; i--) { if (periods[i].state === "future") continue; if (periods[i].state === "done") n++; else break; } return n; })();
  const unit = rhythm.type === "weekly" ? "weeks" : rhythm.type === "interval" ? `${rhythm.count}-day periods` : "days";
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

  async function sync() {
    setSyncing(true);
    await fetch("/api/sync", { method: "POST" });
    await load();
    setSyncing(false);
  }
  async function saveSchedule(type: string, count?: number) {
    if (!habit) return;
    await fetch(`/api/habits/${encodeURIComponent(habit.task_id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, count, period: type === "weekly" ? "week" : "days" }),
    });
    await load(); setSettings(false);
  }
  const scheduleIs = (type: string, count?: number) =>
    type === "todoist" ? !habit?.override_type :
    habit?.override_type === type && (count === undefined || habit.override_count === count);

  if (!data) return <div className="loading"><span className="brandmark">H</span><p>Reading your habits…</p></div>;
  const initials = data.user.name.split(" ").map((x) => x[0]).join("").slice(0, 2);
  return (
    <main className="shell">
      <aside className={menuOpen ? "menu-open" : ""}>
        <div className="side-head">
          <a className="brand" href="/"><span className="brandmark">H</span> Habit Tracker</a>
          <button className="menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="Toggle navigation"><span /><span /><span /></button>
        </div>
        <div className="side-content">
          <div className="side-label">YOUR HABITS</div>
          <div className="habit-nav">
            {data.habits.map((h) => <button key={h.task_id} className={selected === h.task_id ? "active" : ""} onClick={() => { setSelected(h.task_id); setMenuOpen(false); }}><span className="habit-icon">✓</span><span><strong>{h.content}</strong><small>{scheduleLabel(h)}</small></span></button>)}
          </div>
          <button className="sync" onClick={sync} disabled={syncing}><span className={syncing ? "spin" : ""}>↻</span> {syncing ? "Syncing…" : "Sync Todoist"}</button>
          <div className="profile"><div className="avatar">{data.user.avatar ? <img src={data.user.avatar} alt="" /> : initials}</div><span><strong>{data.user.name}</strong><small>{data.user.email}</small></span><form action="/api/auth/logout" method="post"><button title="Log out">↗</button></form></div>
        </div>
      </aside>
      <section className="dashboard">
        {habit ? <>
          <header><div><div className="eyebrow"><span /> HABIT OVERVIEW</div><h1>{habit.content}</h1><p>{habit.project_name} <b>·</b> {scheduleLabel(habit)}</p></div><button className="button ghost compact adjust-rhythm" onClick={() => setSettings(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm9 4.2v-1.4l-2.1-.8a7 7 0 0 0-.7-1.7l.9-2-1-1-2 .9a7 7 0 0 0-1.7-.7L13.6 4h-1.4l-.8 2.1a7 7 0 0 0-1.7.7l-2-.9-1 1 .9 2a7 7 0 0 0-.7 1.7l-2.1.8v1.4l2.1.8a7 7 0 0 0 .7 1.7l-.9 2 1 1 2-.9a7 7 0 0 0 1.7.7l.8 2.1h1.4l.8-2.1a7 7 0 0 0 1.7-.7l2 .9 1-1-.9-2a7 7 0 0 0 .7-1.7l2.1-.8Z" /></svg>Adjust rhythm</button></header>
          <div className="stats">
            <article><span>CONSISTENCY</span><strong>{score}<em>%</em></strong><small>across completed periods</small></article>
            <article><span>SUCCESSFUL PERIODS</span><strong>{completed}</strong><small>in the last 12 months</small></article>
            <article><span>CURRENT STREAK</span><strong>{streak}<em> {unit}</em></strong><small>{streak ? "keep the rhythm going" : "this period is a fresh start"}</small></article>
            <article><span>MISSED</span><strong className="red">{elapsed.length - completed}</strong><small>{unit} below target</small></article>
          </div>
          <article className="chart-card">
            <div className="chart-title"><div><span>LAST 12 MONTHS</span><h2>{view === "heatmap" ? "Your year at a glance" : view === "trend" ? "Monthly consistency" : "Recent check-ins"}</h2></div>{view === "heatmap" && <div className="chart-legend"><i className="done" /> Target met <i className="miss" /> Missed <i className="none" /> Current period</div>}</div>
            <div className="view-tabs" role="tablist" aria-label="Habit visualization">
              <button className={view === "heatmap" ? "active" : ""} onClick={() => setView("heatmap")}>Heatmap</button>
              <button className={view === "trend" ? "active" : ""} onClick={() => setView("trend")}>Monthly trend</button>
              <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>History</button>
            </div>
            {view === "heatmap" && <div className="heatmap-layout">
              {rhythm.type === "daily" && <div className="calendar-labels">{["Mon", "", "Wed", "", "Fri", "", ""].map((label, index) => <span key={index}>{label}</span>)}</div>}
              <div className={`heatmap-scroll ${rhythm.type}`}>
                <div className={`year-grid ${rhythm.type}`}>{periods.map((period) => <i key={period.key} className={period.state} title={period.label}>{rhythm.type === "weekly" ? period.completed : null}</i>)}</div>
              </div>
            </div>}
            {view === "trend" && <div className="trend-chart">{monthly.map((month) => <div className="trend-month" key={month.key} title={`${month.hit}/${month.total} targets met`}><strong>{month.score}%</strong><div><i style={{ height: `${Math.max(month.score, 3)}%` }} /></div><span>{month.label}</span></div>)}</div>}
            {view === "history" && <div className="period-history">{periods.slice(-18).reverse().map((period) => <div key={period.key}><i className={period.state} /><span><strong>{period.label.split(":")[0]}</strong><small>{period.state === "future" ? "Still in progress" : `${period.completed} of ${period.target} completed`}</small></span><b>{period.state === "done" ? "Met" : period.state === "miss" ? "Missed" : "Open"}</b></div>)}</div>}
            <div className="insight"><span>✦</span><p><strong>{score >= 80 ? "Strong rhythm." : score >= 55 ? "A rhythm is forming." : "Room to reset."}</strong> You hit your target in {completed} {unit} this year. Misses are information, not failure.</p></div>
          </article>
          <p className="last-sync">Last synced {data.user.last_sync ? new Date(data.user.last_sync).toLocaleString() : "never"} · Read-only Todoist access</p>
        </> : <div className="empty"><span>✓</span><h1>No habits found yet</h1><p>Add the <code>@habit</code> label to a recurring Todoist task, then sync.</p><button className="button primary" onClick={sync}>Sync Todoist</button></div>}
      </section>
      {settings && habit && <div className="modal-bg" onMouseDown={() => setSettings(false)}><div className="modal" onMouseDown={(e) => e.stopPropagation()}><button className="close" onClick={() => setSettings(false)}>×</button><div className="eyebrow"><span /> OVERRIDE SCHEDULE</div><h2>What’s the real rhythm?</h2><p>Habit Tracker will use this to judge completions. Nothing changes in Todoist.</p><div className="choices primary-choices"><button className={scheduleIs("todoist") ? "selected" : ""} onClick={() => saveSchedule("todoist")}><i>↻</i><span><strong>Use Todoist schedule</strong><small>{habit.todoist_recurrence || "No recurring due date"}</small></span><b>✓</b></button><button className={scheduleIs("daily") ? "selected" : ""} onClick={() => saveSchedule("daily")}><i>1d</i><span><strong>Every day</strong><small>One completion each day</small></span><b>✓</b></button><button className={scheduleIs("interval", 2) ? "selected" : ""} onClick={() => saveSchedule("interval", 2)}><i>2d</i><span><strong>Every two days</strong><small>One completion per two-day period</small></span><b>✓</b></button></div><div className="weekly-heading"><strong>Times per week</strong><small>Any days, Monday–Sunday</small></div><div className="weekly-choices">{[1, 2, 3, 4, 5, 6, 7].map((count) => <button className={scheduleIs("weekly", count) ? "selected" : ""} key={count} onClick={() => saveSchedule("weekly", count)}><strong>{count}</strong><small>×</small></button>)}</div></div></div>}
    </main>
  );
}
