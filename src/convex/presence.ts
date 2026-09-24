/**
 * Presence.
 *
 * "Son aktiflik" and the profile activity graph both need to know when a member
 * was last around. The client pings this mutation on load and then every couple
 * of minutes; writes are throttled here so a busy session costs at most one
 * patch per window.
 */

import type { Doc } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { currentUser, ensureOwnerRole } from "./access";

/** A session writes its last-seen timestamp at most once per window. */
const TOUCH_INTERVAL_MS = 45_000;

export const touch = mutation({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const user = await currentUser(ctx);
    if (!user) return false;

    const patch: Partial<Doc<"users">> = {};
    const now = Date.now();
    if (!user.lastSeenAt || now - user.lastSeenAt > TOUCH_INTERVAL_MS) {
      patch.lastSeenAt = now;
    }

    if (Object.keys(patch).length > 0) await ctx.db.patch(user._id, patch);

    // The site owner keeps the admin role even on a brand new row.
    await ensureOwnerRole(ctx, user);
    return true;
  },
});
