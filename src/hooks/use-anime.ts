/**
 * Anime data hooks.
 *
 * Reads are reactive Convex queries over the local cache. Because queries cannot
 * schedule background work, a stale or empty cache comes back with `needsSync`
 * and these hooks are the single place that calls the guarded sync action —
 * which no-ops while a sync runs or while a failure backoff is active.
 */

import { api } from "@/convex/_generated/api";
import type { AnimeCardView, FeedKey, SyncStatus } from "@/convex/animeView";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

export type FeedState = {
  items: AnimeCardView[];
  status: SyncStatus;
  message?: string;
  syncedAt?: number;
  /** True until the first query result arrives. */
  isLoading: boolean;
  isEmpty: boolean;
  /** Clears the cached state and forces a fresh sync. */
  retry: () => Promise<void>;
};

export function useFeed(list: FeedKey): FeedState {
  const result = useQuery(api.anime.feed, { list });
  const syncFeed = useAction(api.anime.syncFeed);
  const resetSync = useMutation(api.anime.retry);
  const inFlight = useRef(false);
  const [nonce, setNonce] = useState(0);

  const needsSync = result?.needsSync ?? false;

  useEffect(() => {
    if ((!needsSync && nonce === 0) || inFlight.current) return;
    inFlight.current = true;
    syncFeed({ list })
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
      });
  }, [needsSync, nonce, syncFeed, list]);

  const retry = useCallback(async () => {
    await resetSync({ list });
    setNonce((value) => value + 1);
  }, [resetSync, list]);

  return {
    items: result?.items ?? [],
    status: result?.status ?? "syncing",
    message: result?.message,
    syncedAt: result?.syncedAt,
    isLoading: result === undefined,
    isEmpty: result !== undefined && result.items.length === 0,
    retry,
  };
}

export type DetailState = {
  anime: import("@/convex/animeView").AnimeDetailView | null;
  status: SyncStatus;
  message?: string;
  isLoading: boolean;
  hasExtras: boolean;
  /** Clears the cached payload and forces a fresh sync. */
  retry: () => Promise<void>;
};

export function useAnimeDetail(anilistId: number): DetailState {
  const result = useQuery(api.anime.detail, { anilistId });
  const syncDetail = useAction(api.anime.syncDetail);
  const resetSync = useMutation(api.anime.retry);
  const inFlight = useRef<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const needsSync = result?.needsSync ?? false;

  useEffect(() => {
    if ((!needsSync && nonce === 0) || inFlight.current === anilistId) return;
    inFlight.current = anilistId;
    syncDetail({ anilistId })
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = null;
      });
  }, [needsSync, nonce, syncDetail, anilistId]);

  const retry = useCallback(async () => {
    await resetSync({ anilistId });
    setNonce((value) => value + 1);
  }, [resetSync, anilistId]);

  const anime = result?.anime ?? null;

  return {
    anime,
    status: result?.status ?? "syncing",
    message: result?.message,
    isLoading: result === undefined,
    hasExtras: Boolean(anime?.detailSyncedAt),
    retry,
  };
}

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export type RemoteSearchState = {
  items: AnimeCardView[];
  /** The term the current results belong to (empty while idle). */
  resolvedTerm: string;
  isSearching: boolean;
};

/**
 * Searches the live AniList catalogue for anything the cached catalogue cannot
 * answer. Results are cached server-side on the way back.
 */
export function useRemoteSearch(term: string, minLength = 3): RemoteSearchState {
  const search = useAction(api.anime.searchRemote);
  const debounced = useDebounced(term.trim(), 450);
  const [state, setState] = useState<{ term: string; items: AnimeCardView[] }>({
    term: "",
    items: [],
  });
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (debounced.length < minLength) {
      setState({ term: "", items: [] });
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    search({ q: debounced })
      .then((items) => {
        if (!cancelled) setState({ term: debounced, items });
      })
      .catch(() => {
        if (!cancelled) setState({ term: debounced, items: [] });
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, minLength, search]);

  return {
    items: state.items,
    resolvedTerm: state.term,
    isSearching,
  };
}
