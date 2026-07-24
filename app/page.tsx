import Link from "next/link";

export const dynamic = "force-dynamic";

const sample = Array.from({ length: 63 }, (_, i) => i % 11 === 0 ? "miss" : i % 5 === 0 ? "soft" : i > 56 ? "none" : "done");

export default function Home() {
  return (
    <main className="landing">
      <nav className="nav">
        <Link className="brand" href="/"><span className="brandmark">H</span> Habit Tracker</Link>
        <a className="button ghost" href="/api/auth/login">Log in</a>
      </nav>
      <section className="hero">
        <div className="eyebrow"><span /> BUILT FOR TODOIST</div>
        <h1>Your habits.<br /><em>Honestly.</em></h1>
        <p>Habit Tracker turns your recurring Todoist tasks into a clear picture of what you actually do — not what you planned to do.</p>
        <a className="button primary" href="/api/auth/login">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.7c-.4-.2-.8-.2-1.2 0L12 8 4.7 3.7a1.2 1.2 0 0 0-1.2 2.1L11.4 10c.4.2.8.2 1.2 0l7.9-4.2c.8-.5.8-1.7 0-2.1ZM4.7 9.3a1.2 1.2 0 1 0-1.2 2.1l7.9 4.2c.4.2.8.2 1.2 0l7.9-4.2a1.2 1.2 0 1 0-1.2-2.1L12 13.2 4.7 9.3Zm0 5.6A1.2 1.2 0 1 0 3.5 17l7.9 4.2c.4.2.8.2 1.2 0l7.9-4.2a1.2 1.2 0 1 0-1.2-2.1L12 18.8l-7.3-3.9Z"/></svg>
          Continue with Todoist
        </a>
        <small>Read-only access · Your tasks stay in Todoist</small>
      </section>
      <section className="preview">
        <div className="preview-head"><div><span className="pill">LAST 12 MONTHS</span><h2>Show up, over time.</h2></div><div className="score"><strong>87%</strong><span>consistency</span></div></div>
        <div className="heatmap">{sample.map((v, i) => <i key={i} className={v} />)}</div>
        <div className="legend"><span><i className="done" /> Done</span><span><i className="miss" /> Missed</span><span><i className="none" /> Not scheduled</span></div>
      </section>
      <div className="feature-row">
        <div><b>01</b><h3>Tag it <code>@habit</code></h3><p>Keep planning in Todoist. We automatically find every task with your habit label.</p></div>
        <div><b>02</b><h3>Set your real rhythm</h3><p>Daily, every two days, or four times a week. Override schedules Todoist can’t express.</p></div>
        <div><b>03</b><h3>See the whole story</h3><p>A year of completions and misses, without streak anxiety or selective memory.</p></div>
      </div>
    </main>
  );
}
