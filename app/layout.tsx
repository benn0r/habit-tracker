import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ritual — habits, honestly",
  description: "Turn recurring Todoist tasks into honest habit insights.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
