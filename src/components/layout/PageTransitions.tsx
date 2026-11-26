"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Makes leaving a page as smooth as arriving on one: a click on a link to another page of the app first fades the current page out for a moment (140 ms), then goes there, and the new page
 * fades in (see the dashboard template). Links to the same page, to other sites, opened in a new tab, or with a modifier key are left alone. With reduced motion there is no pause.
 */
export default function PageTransitions() {
  const router = useRouter();
  const pathname = usePathname();

  // The new page has arrived: the fade-out is over.
  useEffect(() => {
    document.getElementById("main")?.removeAttribute("data-leaving");
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      const main = document.getElementById("main");
      if (!main) return;
      // Taken over before the link's own handler: the page fades, then the app goes to the same address.
      e.preventDefault();
      e.stopPropagation();
      const go = () => router.push(`${url.pathname}${url.search}${url.hash}`);
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return go();
      main.setAttribute("data-leaving", "");
      setTimeout(go, 140);
      // Should the page not change after all, it comes back.
      setTimeout(() => main.removeAttribute("data-leaving"), 2000);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
