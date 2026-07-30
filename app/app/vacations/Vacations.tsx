"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Vacation } from "@/lib/vacations";
import SiteFooter from "@/app/SiteFooter";

type Habit = {
  task_id: string;
  content: string;
  label_override: string | null;
  todoist_recurrence: string | null;
  override_type: string | null;
  override_count: number | null;
  track_during_vacations: number;
};
type VacationData = { vacations: Vacation[]; habits: Habit[]; user: { name: string; email: string; avatar?: string } };

const displayLabel = (habit: Habit) => habit.label_override || habit.content;
const scheduleLabel = (habit: Habit) =>
  habit.override_type === "weekly"
    ? `${habit.override_count}× per week`
    : habit.override_type === "interval"
      ? `Every ${habit.override_count} days`
      : habit.override_type === "daily"
        ? "Every day"
        : habit.todoist_recurrence || "No repeat";
const formatDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" });

export default function Vacations() {
  const [data, setData] = useState<VacationData | null>(null);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const load = () =>
    fetch("/api/vacations")
      .then((response) => response.json())
      .then(setData);
  useEffect(() => {
    load();
  }, []);

  async function addVacation(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/vacations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, startDate, endDate }),
    });
    if (!response.ok) {
      setError((await response.json()).error || "Could not save vacation");
      setSaving(false);
      return;
    }
    setTitle("");
    setStartDate("");
    setEndDate("");
    await load();
    setSaving(false);
  }

  async function removeVacation(id: number) {
    await fetch(`/api/vacations/${id}`, { method: "DELETE" });
    await load();
  }

  async function setHabitTracking(habit: Habit, checked: boolean) {
    await fetch(`/api/habits/${encodeURIComponent(habit.task_id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackDuringVacations: checked }),
    });
    setData(
      (current) =>
        current && {
          ...current,
          habits: current.habits.map((item) =>
            item.task_id === habit.task_id ? { ...item, track_during_vacations: checked ? 1 : 0 } : item,
          ),
        },
    );
  }

  async function sync() {
    setSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      await load();
    } finally {
      setSyncing(false);
    }
  }

  const initials =
    data?.user?.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2) || "";
  return (
    <main className="shell vacation-shell">
      <aside className={menuOpen ? "menu-open" : ""}>
        <div className="side-head">
          <a className="brand" href="/app">
            <img className="brand-logo" src="/icons/favicon-rounded-192.png" alt="" width="34" height="34" /> Habit
            Tracker
          </a>
          <button
            className="menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        <div className="side-content">
          <div className="side-label">YOUR HABITS</div>
          <div className="habit-nav">
            <a className="side-habit-link" href="/app">
              <span className="habit-icon overview-icon">▦</span>
              <span>
                <strong>All habits</strong>
                <small>Dashboard overview</small>
              </span>
            </a>
            {data?.habits.map((habit) => (
              <a
                className="side-habit-link"
                key={habit.task_id}
                href={`/app?habit=${encodeURIComponent(habit.task_id)}`}
              >
                <span className="habit-icon habit-dot" aria-hidden="true" />
                <span>
                  <strong>{displayLabel(habit)}</strong>
                  <small>{scheduleLabel(habit)}</small>
                </span>
              </a>
            ))}
          </div>
          <a className="vacations-link active" href="/app/vacations">
            <span>☀</span>
            <span>
              <strong>Vacations</strong>
              <small>Plan tracking breaks</small>
            </span>
          </a>
          <button className="sync" onClick={sync} disabled={syncing}>
            <span className={syncing ? "spin" : ""}>↻</span> {syncing ? "Syncing…" : "Sync Todoist"}
          </button>
          {data?.user && (
            <div className="profile">
              <div className="avatar">{data.user.avatar ? <img src={data.user.avatar} alt="" /> : initials}</div>
              <span>
                <strong>{data.user.name}</strong>
                <small>{data.user.email}</small>
              </span>
              <form action="/api/auth/logout" method="post">
                <button title="Log out">↗</button>
              </form>
            </div>
          )}
        </div>
      </aside>
      <section className="vacation-content">
        <header>
          <div className="eyebrow">
            <span /> TRACKING BREAKS
          </div>
          <h1>Vacations</h1>
          <p>Add time away and choose the habits that should keep counting.</p>
        </header>
        <div className="vacation-layout">
          <form className="vacation-form" onSubmit={addVacation}>
            <span>NEW VACATION</span>
            <h2>Plan time away</h2>
            <label>
              Title
              <input
                aria-label="Vacation title"
                maxLength={80}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Summer at Dragon Cove"
                required
              />
            </label>
            <div>
              <label>
                From
                <input
                  aria-label="Vacation start date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </label>
              <label>
                To
                <input
                  aria-label="Vacation end date"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </label>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={saving}>
              {saving ? "Saving…" : "Add vacation"}
            </button>
          </form>
          <section className="vacation-list">
            <div className="section-heading">
              <span>YOUR VACATIONS</span>
              <small>Dates are inclusive</small>
            </div>
            {!data ? (
              <p className="muted">Loading vacations…</p>
            ) : data.vacations.length ? (
              data.vacations.map((vacation) => (
                <article key={vacation.id}>
                  <div className="vacation-icon">☀</div>
                  <div>
                    <strong>{vacation.title}</strong>
                    <small>
                      {formatDate(vacation.start_date)} – {formatDate(vacation.end_date)}
                    </small>
                  </div>
                  <button onClick={() => removeVacation(vacation.id)} aria-label={`Delete ${vacation.title}`}>
                    ×
                  </button>
                </article>
              ))
            ) : (
              <div className="vacation-empty">
                <strong>No vacations yet</strong>
                <small>Your habits continue normally until you add time away.</small>
              </div>
            )}
          </section>
        </div>
        <section className="vacation-habits">
          <div className="section-heading">
            <div>
              <span>HABITS DURING VACATION</span>
              <h2>What should keep counting?</h2>
            </div>
            <p>Everything is paused by default. Turn on only habits you want tracked while away.</p>
          </div>
          <div className="vacation-habit-list">
            {data?.habits.map((habit) => (
              <label key={habit.task_id}>
                <span className="habit-icon habit-dot" aria-hidden="true" />
                <span>
                  <strong>{displayLabel(habit)}</strong>
                  <small>{habit.track_during_vacations ? "Tracked during vacations" : "Paused during vacations"}</small>
                </span>
                <span className="toggle">
                  <input
                    type="checkbox"
                    aria-label={`Track ${displayLabel(habit)} during vacations`}
                    checked={Boolean(habit.track_during_vacations)}
                    onChange={(event) => setHabitTracking(habit, event.target.checked)}
                  />
                  <span />
                </span>
              </label>
            ))}
          </div>
        </section>
        <SiteFooter />
      </section>
    </main>
  );
}
