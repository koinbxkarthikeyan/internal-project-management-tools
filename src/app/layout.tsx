import type { Metadata } from "next";
import localFont from "next/font/local";
import "@/styles/globals.css";

// The app's fonts are self-hosted from src/app/fonts (latin subset), so nothing is fetched from Google while building or running the dev server.
const plexSans = localFont({
  variable: "--font-plex-sans",
  src: [
    { path: "./fonts/IBMPlexSans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexSans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexSans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/IBMPlexSans-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  src: "./fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "Backlog Tracker",
  description: "Internal backlog and project tracking",
};

// Applies the saved (or system) theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* A plain inline script in <head> runs before the first paint, so the right theme is on <html> from the start. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
