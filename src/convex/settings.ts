/**
 * Site-wide settings.
 *
 * One row keyed `"site"` holds the colour palette the admin picked. The theme
 * query is public — every visitor reads it and applies `[data-theme]`, so a
 * change made in the admin panel lands for everyone at once.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./access";
import { DEFAULT_PALETTE, paletteById } from "./communityView";

const SETTINGS_KEY = "site";

export const theme = query({
  args: {},
  handler: async (ctx): Promise<string> => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .first();
    return row?.palette ?? DEFAULT_PALETTE;
  },
});

/** Changes the palette for the whole site. Admin only. */
export const setPalette = mutation({
  args: { palette: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const admin = await requireAdmin(ctx);
    // `paletteById` falls back to the default, so only known ids are stored.
    const palette = paletteById(args.palette).id;
    const now = Date.now();

    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .first();

    if (row) {
      await ctx.db.patch(row._id, {
        palette,
        updatedAt: now,
        updatedBy: admin._id,
      });
    } else {
      await ctx.db.insert("settings", {
        key: SETTINGS_KEY,
        palette,
        updatedAt: now,
        updatedBy: admin._id,
      });
    }

    return palette;
  },
});
