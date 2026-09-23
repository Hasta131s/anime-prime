import { useEffect } from "react";

const SUFFIX = "Anime Prime";

/** Keeps the browser tab in sync with the page you are actually on. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    if (!title) return;
    document.title = `${title} — ${SUFFIX}`;
  }, [title]);
}
