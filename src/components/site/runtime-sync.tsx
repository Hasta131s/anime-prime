/**
 * Site-wide runtime sync.
 *
 * Two jobs that have to happen for every visitor on every route:
 *  • apply the admin-selected palette by setting `[data-theme]` on <html>, so a
 *    theme change in the panel lands for everyone at once
 *  • ping presence, which is what "son aktiflik" and the activity graph read
 */

import { api } from "@/convex/_generated/api";
import { DEFAULT_PALETTE } from "@/convex/communityView";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { useLocation } from "react-router";

/** The server throttles writes, so a couple of minutes is plenty. */
const PRESENCE_INTERVAL_MS = 120_000;

export function RuntimeSync() {
  const palette = useQuery(api.settings.theme);
  const touch = useMutation(api.presence.touch);
  const { pathname } = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    const next = palette ?? DEFAULT_PALETTE;
    if (next === DEFAULT_PALETTE) root.removeAttribute("data-theme");
    else root.dataset.theme = next;
  }, [palette]);

  // Active on load, then on a timer, then on every route change.
  useEffect(() => {
    void touch().catch(() => undefined);
    const timer = window.setInterval(() => {
      void touch().catch(() => undefined);
    }, PRESENCE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [touch]);

  useEffect(() => {
    void touch().catch(() => undefined);
  }, [pathname, touch]);

  return null;
}
