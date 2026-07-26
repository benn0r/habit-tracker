const BUILD_NUMBER = (process.env.NEXT_PUBLIC_APP_VERSION || "dev").slice(0, 7);

export default function SiteFooter() {
  return <footer className="site-footer">Habit Tracker · build {BUILD_NUMBER}</footer>;
}
