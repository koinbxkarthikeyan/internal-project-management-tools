import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server be opened from other machines on the office LAN
  // (e.g. http://172.16.17.48:3000). Without this, Next blocks dev assets and
  // the HMR socket for non-localhost hosts, so the page never hydrates and
  // clicks (side panels, menus) do nothing.
  allowedDevOrigins: ["172.16.17.48", "172.16.17.*"],
};

export default nextConfig;
