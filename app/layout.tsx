import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Habit Tracker — habits, honestly",
  description: "Turn recurring Todoist tasks into honest habit insights.",
};

const BUILD_NUMBER = (process.env.NEXT_PUBLIC_APP_VERSION || "dev").slice(0, 7);

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<footer className="site-footer">Habit Tracker · build {BUILD_NUMBER}</footer></body>
    </html>
  );
}
