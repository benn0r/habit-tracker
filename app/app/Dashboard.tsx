"use client";

import { useEffect, useMemo, useState } from "react";

type Habit = {
  task_id: string; content: string; todoist_recurrence: string | null;
  override_type: string | null; override_count: number | null; override_period: string | null;
  project_name: string; color: string;
};
type Completion = { task_id: string; completed_at: string };
type Data = { user: { name: string; email: string; avatar?: string; last_sync?: string }; habits: Habit[]; completions: Completion[] };
type Day = { date: Date; key: string; state: "done" | "miss" | "none" | "future" };

const keyOf = (date: Date) => date.toISOString().slice(0, 10);
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

function scheduleLabel(h: Habit) {
  if (h.override_type === "weekly") return `${h.override_count}× per week`;
  if (h.override_type === "interval") return `Every ${h.override_count} days`;
  if (h.override_type === "daily") return "Every day";
  return h.todoist_recurrence || "No repeat";
}

function requiredOn(h: Habit, date: Date, first: Date) {
  if (h.override_type === "weekly") return false;
  if (h.override_type === "daily") return true;
  const text = (h.todoist_recurrence || "").toLowerCase();
  const interval = h.override_type === "interval" ? h.override_count || 2 :
    Number(text.match(/every\s+(\d+)\s+days?/)?.[1] || (text.includes("every other day") ? 2 : 1));
  if (text.includes("weekdays")) return date.getDay() > 0 && date.getDay() < 6;
  if (text.includes("weekly") || text.includes("every week")) return date.getDay() === first.getDay();
  return Math.floor((date.getTime() - first.getTime()) / 86400000) % interval === 0;
}

function buildDays(h: Habit, completions: Completion[]): Day[] {
  const today = startOfDay(new Date());
  const start = new Date(today); start.setFullYear(start.getFullYear() - 1); start.setDate(start.getDate() + 1);
  start.setDate(start.getDate() - start.getDay());
  const complete = new Set(completions.filter((c) => c.task_id === h.task_id).map((c) => keyOf(new Date(c.completed_at))));
  const days: Day[] = [];
  for (let i = 0; i < 371; i++) {
    const date = new Date(start); date.setDate(start.getDate() + i);
    const key = keyOf(date);
    let state: Day["state"] = date > today ? "future" : complete.has(key) ? "done" : requiredOn(h, date, start) ? "miss" : "none";
    days.push({ date, key, state });
  }
  if (h.override_type === "weekly") {
    for (let i = 0; i < days.length; i += 7) {
      const week = days.slice(i, i + 7).filter((d) => d.date <= today);
      const done = week.filter((d) => d.state === "done").length;
      if (week.length === 7 && done < (h.override_count || 1)) week[6].state = "miss";
    }
  }
  return days;
}

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState(false);
  const load = () => fetch("/api/dashboard").then((r) => r.json()).then((d) => { setData(d); setSelected((s) => s || d.habits?.[0]?.task_id || ""); });
  useEffect(() => { load(); }, []);
  const habit = data?.habits.find((h) => h.task_id === selected);
  const days = useMemo(() => habit && data ? buildDays(habit, data.completions) : [], [habit, data]);
  const elapsed = days.filter((d) => d.state !== "future" && d.state !== "none");
  const completed = elapsed.filter((d) => d.state === "done").length;
  const score = elapsed.length ? Math.round(completed / elapsed.length * 100) : 0;
  const streak = (() => { let n = 0; for (let i = days.length - 1; i >= 0; i--) { if (days[i].state === "future" || days[i].state === "none") continue; if (days[i].state === "done") n++; else break; } return n; })();

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

  if (!data) return <div className="loading"><span className="brandmark">R</span><p>Reading your rituals…</p></div>;
  const initials = data.user.name.split(" ").map((x) => x[0]).join("").slice(0, 2);
  return (
    <main className="shell">
      <aside>
        <a className="brand" href="/"><span className="brandmark">R</span> Ritual</a>
        <div className="side-label">YOUR HABITS</div>
        <div className="habit-nav">
          {data.habits.map((h) => <button key={h.task_id} className={selected === h.task_id ? "active" : ""} onClick={() => setSelected(h.task_id)}><span className="habit-icon">✓</span><span><strong>{h.content}</strong><small>{scheduleLabel(h)}</small></span></button>)}
        </div>
        <button className="sync" onClick={sync} disabled={syncing}><span className={syncing ? "spin" : ""}>↻</span> {syncing ? "Syncing…" : "Sync Todoist"}</button>
        <div className="profile"><div className="avatar">{data.user.avatar ? <img src={data.user.avatar} alt="" /> : initials}</div><span><strong>{data.user.name}</strong><small>{data.user.email}</small></span><form action="/api/auth/logout" method="post"><button title="Log out">↗</button></form></div>
      </aside>
      <section className="dashboard">
        {habit ? <>
          <header><div><div className="eyebrow"><span /> HABIT OVERVIEW</div><h1>{habit.content}</h1><p>{habit.project_name} <b>·</b> {scheduleLabel(habit)}</p></div><button className="button ghost compact" onClick={() => setSettings(true)}>⚙ Adjust rhythm</button></header>
          <div className="stats">
            <article><span>CONSISTENCY</span><strong>{score}<em>%</em></strong><small>across scheduled days</small></article>
            <article><span>COMPLETED</span><strong>{completed}</strong><small>in the last 12 months</small></article>
            <article><span>CURRENT STREAK</span><strong>{streak}<em> days</em></strong><small>{streak ? "keep the rhythm going" : "today is a fresh start"}</small></article>
            <article><span>MISSED</span><strong className="red">{elapsed.length - completed}</strong><small>scheduled check-ins</small></article>
          </div>
          <article className="chart-card">
            <div className="chart-title"><div><span>LAST 12 MONTHS</span><h2>Your year at a glance</h2></div><div className="chart-legend"><i className="done" /> Done <i className="miss" /> Missed <i className="none" /> Not scheduled</div></div>
            <div className="calendar-labels"><span>Mon</span><span>Wed</span><span>Fri</span></div>
            <div className="year-grid">{days.map((d) => <i key={d.key} className={d.state} title={`${d.date.toLocaleDateString()}: ${d.state}`} />)}</div>
            <div className="insight"><span>✦</span><p><strong>{score >= 80 ? "Strong rhythm." : score >= 55 ? "A rhythm is forming." : "Room to reset."}</strong> You completed {completed} scheduled check-ins this year. Misses are information, not failure.</p></div>
          </article>
          <p className="last-sync">Last synced {data.user.last_sync ? new Date(data.user.last_sync).toLocaleString() : "never"} · Read-only Todoist access</p>
        </> : <div className="empty"><span>✓</span><h1>No habits found yet</h1><p>Add the <code>@habit</code> label to a recurring Todoist task, then sync.</p><button className="button primary" onClick={sync}>Sync Todoist</button></div>}
      </section>
      {settings && habit && <div className="modal-bg" onMouseDown={() => setSettings(false)}><div className="modal" onMouseDown={(e) => e.stopPropagation()}><button className="close" onClick={() => setSettings(false)}>×</button><div className="eyebrow"><span /> OVERRIDE SCHEDULE</div><h2>What’s the real rhythm?</h2><p>Ritual will use this to judge completions. Nothing changes in Todoist.</p><div className="choices"><button onClick={() => saveSchedule("todoist")}><strong>Use Todoist schedule</strong><small>{habit.todoist_recurrence || "No recurring due date"}</small></button><button onClick={() => saveSchedule("daily")}><strong>Every day</strong><small>One completion each day</small></button><button onClick={() => saveSchedule("interval", 2)}><strong>Every two days</strong><small>Flexible alternating rhythm</small></button><button onClick={() => saveSchedule("weekly", 4)}><strong>4 times a week</strong><small>Any four days, Monday–Sunday</small></button></div></div></div>}
    </main>
  );
}
