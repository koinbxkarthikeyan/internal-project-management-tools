import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The browser tests run their own copy of the app with its own build folder, so they never touch the `.next` that `next dev` is using.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Lets the dev server be opened from other machines on the office LAN
  // (e.g. http://172.16.17.48:3000). Without this, Next blocks dev assets and
  // the HMR socket for non-localhost hosts, so the page never hydrates and
  // clicks (side panels, menus) do nothing.
  allowedDevOrigins: ["172.16.17.48", "172.16.17.*"],
  // The Ready for QA and Testing pages are now one page, QA Workspace; old links still work.
  async redirects() {
    return [
      { source: "/ready-for-qa", destination: "/qa-workspace", permanent: false },
      { source: "/ready-for-qa/:path*", destination: "/qa-workspace/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
