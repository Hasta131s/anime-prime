/** Small shared readers for the cached AniList catalogue. */

import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { toCardView, type AnimeCardView } from "./animeView";

export async function animeRowByAnilistId(ctx: QueryCtx, anilistId: number) {
  return await ctx.db
    .query("anime")
    .withIndex("by_anilistId", (q) => q.eq("anilistId", anilistId))
    .first();
}

export async function cardByAnilistId(
  ctx: QueryCtx,
  anilistId: number,
): Promise<AnimeCardView | null> {
  const row = await animeRowByAnilistId(ctx, anilistId);
  return row ? toCardView(row) : null;
}

/** Ordered card lookup — keeps the caller's order and drops unknown ids. */
export async function cardsByAnilistIds(
  ctx: QueryCtx,
  ids: number[],
): Promise<AnimeCardView[]> {
  const unique = Array.from(new Set(ids));
  const rows = await Promise.all(
    unique.map((id) => animeRowByAnilistId(ctx, id)),
  );

  const found = new Map<number, Doc<"anime">>();
  for (const row of rows) {
    if (row) found.set(row.anilistId, row);
  }

  const cards: AnimeCardView[] = [];
  for (const id of ids) {
    const row = found.get(id);
    if (row) cards.push(toCardView(row));
    found.delete(id);
  }
  return cards;
}
