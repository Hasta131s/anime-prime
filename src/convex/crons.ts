import { cronJobs } from "convex/server";
import { api } from "./_generated/api";
import { FEED_ORDER } from "./animeView";

/**
 * Keeps the four editorial rails warm so the landing page has real AniList data
 * ready without waiting for a visitor. Individual pages still trigger their own
 * guarded syncs for anything not covered here.
 */
const crons = cronJobs();

for (const list of FEED_ORDER) {
  crons.interval(`warm-${list}-rail`, { hours: 6 }, api.anime.syncFeed, { list });
}

export default crons;
