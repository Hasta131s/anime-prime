/**
 * Comments under a title.
 *
 * • Top-level comments are paginated with Convex's cursor pagination, so a
 *   thread with thousands of messages never ships more than one page and never
 *   makes the page janky.
 * • Replies are one level deep and loaded only when a thread is expanded.
 * • Spoilers are stored as a flag and blurred client-side until revealed.
 * • Deletes are soft: the author (or an admin) clears the body, the row stays so
 *   the replies underneath keep their context.
 */

import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { currentUser, isAdmin, requireMember, requireUser } from "./access";
import {
  COMMENT_COOLDOWN_MS,
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  COMMENT_POPULAR_SCAN_LIMIT,
  COMMENT_REPLY_LIMIT,
  DEFAULT_COMMENTS_PAGE_SIZE,
  handleFromEmail,
  normalizeCommentSort,
  resolveDisplayName,
  type CommentAuthorView,
  type CommentPage,
  type CommentThread,
  type CommentView,
} from "./communityView";
import { ensureProfile } from "./profileStore";

type CommentRow = Doc<"comments">;

type Viewer = { userId: Id<"users"> | null; admin: boolean };

export function normalizeBody(raw: string) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function validateBody(raw: string) {
  const body = normalizeBody(raw);
  if (body.length < COMMENT_MIN_LENGTH) {
    throw new Error("Yorum en az 2 karakter olmalı.");
  }
  if (body.length > COMMENT_MAX_LENGTH) {
    throw new Error(`Yorum en fazla ${COMMENT_MAX_LENGTH} karakter olabilir.`);
  }
  return body;
}

/** Author payload, cached per request so a page of 20 costs two lookups. */
async function authorFor(
  ctx: QueryCtx,
  userId: Id<"users">,
  cache: Map<string, CommentAuthorView>,
): Promise<CommentAuthorView> {
  const cached = cache.get(userId);
  if (cached) return cached;

  const [user, profile] = await Promise.all([
    ctx.db.get(userId),
    ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first(),
  ]);

  const source = user ?? {
    name: undefined,
    email: undefined,
    isAnonymous: false,
  };
  const name = resolveDisplayName(source, profile);
  const author: CommentAuthorView = {
    userId,
    name,
    isAnonymous: user?.isAnonymous ?? false,
    banned: Boolean(user?.bannedAt),
  };
  // A gallery upload wins, then the chosen character, then the account avatar.
  const uploadedAvatar = profile?.avatarStorageId
    ? await ctx.storage.getUrl(profile.avatarStorageId)
    : null;
  if (uploadedAvatar) author.image = uploadedAvatar;
  else if (profile?.characterImage) author.image = profile.characterImage;
  else if (user?.image) author.image = user.image;
  if (user?.role) author.role = user.role;
  const handle = profile?.username ?? handleFromEmail(user?.email);
  if (handle) author.handle = handle;

  cache.set(userId, author);
  return author;
}

/** Turns stored rows into the shape the UI renders. */
export async function decorateComments(
  ctx: QueryCtx,
  rows: CommentRow[],
  viewer: Viewer,
): Promise<CommentView[]> {
  const authors = new Map<string, CommentAuthorView>();

  return await Promise.all(
    rows.map(async (row) => {
      const author = await authorFor(ctx, row.userId, authors);
      let likedByMe = false;
      if (viewer.userId) {
        const like = await ctx.db
          .query("commentLikes")
          .withIndex("by_comment_user", (q) =>
            q.eq("commentId", row._id).eq("userId", viewer.userId as Id<"users">),
          )
          .first();
        likedByMe = like !== null;
      }

      const view: CommentView = {
        id: row._id,
        anilistId: row.anilistId,
        body: row.deletedAt ? "" : row.body,
        spoiler: row.spoiler && !row.deletedAt,
        isReply: row.isReply,
        replyCount: row.replyCount,
        likeCount: row.likeCount,
        likedByMe,
        mine: viewer.userId === row.userId,
        canDelete: !row.deletedAt && (viewer.admin || viewer.userId === row.userId),
        deleted: Boolean(row.deletedAt),
        deletedByAdmin: Boolean(row.deletedAt && row.deletedByAdmin),
        createdAt: row.createdAt,
        author,
      };
      if (row.rootId) view.rootId = row.rootId;
      if (row.editedAt) view.editedAt = row.editedAt;
      return view;
    }),
  );
}

async function viewerOf(ctx: QueryCtx): Promise<Viewer> {
  const user = await currentUser(ctx);
  return { userId: user?._id ?? null, admin: isAdmin(user) };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Paginated top-level feed.
 *
 * `new` / `old` use cursor pagination straight off the index. `popular` scans a
 * bounded window and returns a single page, so the UI simply hides "load more".
 */
export const list = query({
  args: {
    anilistId: v.number(),
    sort: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args): Promise<CommentPage> => {
    if (!Number.isInteger(args.anilistId) || args.anilistId <= 0) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const sort = normalizeCommentSort(args.sort);
    const viewer = await viewerOf(ctx);
    const numItems = Math.min(
      Math.max(args.paginationOpts.numItems, 1),
      COMMENT_REPLY_LIMIT,
    );

    if (sort === "popular") {
      const rows = await topLevel(ctx, args.anilistId, COMMENT_POPULAR_SCAN_LIMIT);
      const ranked = [...rows]
        .sort(
          (a, b) =>
            Number(b.deletedAt ? -1 : b.likeCount) -
              Number(a.deletedAt ? -1 : a.likeCount) ||
            b.createdAt - a.createdAt,
        )
        .slice(0, numItems);
      return {
        page: await decorateComments(ctx, ranked, viewer),
        isDone: true,
        continueCursor: "",
      };
    }

    const result = await ctx.db
      .query("comments")
      .withIndex("by_target", (q) =>
        q.eq("anilistId", args.anilistId).eq("isReply", false),
      )
      .order(sort === "old" ? "asc" : "desc")
      .paginate({ ...args.paginationOpts, numItems });

    return {
      page: await decorateComments(ctx, result.page, viewer),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

async function topLevel(ctx: QueryCtx, anilistId: number, limit: number) {
  return await ctx.db
    .query("comments")
    .withIndex("by_target", (q) =>
      q.eq("anilistId", anilistId).eq("isReply", false),
    )
    .order("desc")
    .take(limit);
}

/** Header count: "Yorumlar (128)". Capped scan keeps it cheap. */
export const count = query({
  args: { anilistId: v.number() },
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.anilistId) || args.anilistId <= 0) {
      return { total: 0, topLevel: 0, replies: 0, mine: 0 };
    }

    const rows = await ctx.db
      .query("comments")
      .withIndex("by_target", (q) => q.eq("anilistId", args.anilistId))
      .take(COMMENT_POPULAR_SCAN_LIMIT);

    const live = rows.filter((row) => !row.deletedAt);
    const viewer = await viewerOf(ctx);

    return {
      total: live.length,
      topLevel: live.filter((row) => !row.isReply).length,
      replies: live.filter((row) => row.isReply).length,
      mine: viewer.userId
        ? live.filter((row) => row.userId === viewer.userId).length
        : 0,
    };
  },
});

/** Replies of one thread, loaded when the reader expands it. */
export const replies = query({
  args: { rootId: v.id("comments"), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<CommentThread> => {
    const root = await ctx.db.get(args.rootId);
    if (!root) return { items: [], total: 0 };

    const limit = Math.min(
      Math.max(args.limit ?? 30, 1),
      COMMENT_REPLY_LIMIT,
    );
    const rows = await ctx.db
      .query("comments")
      .withIndex("by_root", (q) => q.eq("rootId", args.rootId))
      .order("asc")
      .take(limit);

    const viewer = await viewerOf(ctx);
    return {
      items: await decorateComments(ctx, rows, viewer),
      total: root.replyCount,
    };
  },
});

/** Comments written by one account, newest first (used on profiles). */
export const byUser = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<CommentView[]> => {
    const limit = Math.min(Math.max(args.limit ?? 5, 1), 50);
    const rows = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    const viewer = await viewerOf(ctx);
    return await decorateComments(ctx, rows, viewer);
  },
});

/** Whether the signed-in visitor may post, and why not. */
export const myState = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) {
      return { signedIn: false, canComment: false, reason: "signin" as const };
    }
    if (user.bannedAt) {
      return {
        signedIn: true,
        canComment: false,
        reason: "banned" as const,
        message: user.banReason,
      };
    }
    if (user.isAnonymous) {
      return { signedIn: true, canComment: false, reason: "anonymous" as const };
    }
    return { signedIn: true, canComment: true, reason: "ready" as const };
  },
});

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const add = mutation({
  args: {
    anilistId: v.number(),
    body: v.string(),
    spoiler: v.optional(v.boolean()),
    parentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args): Promise<Id<"comments">> => {
    const user = await requireMember(ctx);

    if (!Number.isInteger(args.anilistId) || args.anilistId <= 0) {
      throw new Error("Geçersiz yapım kimliği.");
    }

    const body = validateBody(args.body);
    const anime = await ctx.db
      .query("anime")
      .withIndex("by_anilistId", (q) => q.eq("anilistId", args.anilistId))
      .first();
    if (!anime) {
      throw new Error("Bu yapım kataloğta bulunamadı.");
    }

    const now = Date.now();
    const last = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();
    if (last && now - last.createdAt < COMMENT_COOLDOWN_MS) {
      const wait = Math.ceil((COMMENT_COOLDOWN_MS - (now - last.createdAt)) / 1000);
      throw new Error(`Çok hızlı yazıyorsun, ${wait} saniye sonra tekrar dene.`);
    }

    // Replies stay one level deep: answering a reply joins the same thread.
    let rootId: Id<"comments"> | undefined;
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || parent.anilistId !== args.anilistId) {
        throw new Error("Yanıtlanacak yorum bulunamadı.");
      }
      rootId = parent.isReply ? parent.rootId ?? parent._id : parent._id;
      if (parent.deletedAt) {
        throw new Error("Silinmiş bir yoruma yanıt yazılamaz.");
      }
    }

    const id = await ctx.db.insert("comments", {
      anilistId: args.anilistId,
      userId: user._id,
      body,
      spoiler: Boolean(args.spoiler),
      isReply: rootId !== undefined,
      rootId,
      replyCount: 0,
      likeCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    if (rootId) {
      const root = await ctx.db.get(rootId);
      if (root) {
        await ctx.db.patch(root._id, { replyCount: root.replyCount + 1 });
      }
    }

    const profile = await ensureProfile(ctx, user._id);
    await ctx.db.patch(profile._id, {
      commentCount: profile.commentCount + 1,
      updatedAt: now,
    });

    return id;
  },
});

/** Author or admin. Clears the body and keeps the thread readable. */
export const remove = mutation({
  args: { id: v.id("comments") },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) throw new Error("Bu işlem için giriş yapmalısın.");

    const row = await ctx.db.get(args.id);
    if (!row) return;
    if (row.deletedAt) return;

    const admin = isAdmin(user);
    if (!admin && row.userId !== user._id) {
      throw new Error("Yalnızca kendi yorumunu silebilirsin.");
    }

    const now = Date.now();
    await ctx.db.patch(row._id, {
      body: "",
      spoiler: false,
      deletedAt: now,
      updatedAt: now,
      deletedByAdmin: admin && row.userId !== user._id ? true : undefined,
      likeCount: 0,
    });

    // Likes on a deleted comment no longer mean anything.
    const likes = await ctx.db
      .query("commentLikes")
      .withIndex("by_comment", (q) => q.eq("commentId", row._id))
      .take(500);
    for (const like of likes) await ctx.db.delete(like._id);

    if (row.rootId) {
      const root = await ctx.db.get(row.rootId);
      if (root) {
        await ctx.db.patch(root._id, {
          replyCount: Math.max(root.replyCount - 1, 0),
        });
      }
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", row.userId))
      .first();
    if (profile) {
      await ctx.db.patch(profile._id, {
        commentCount: Math.max(profile.commentCount - 1, 0),
      });
    }
  },
});

/** Idempotent like / unlike. */
export const toggleLike = mutation({
  args: { id: v.id("comments") },
  handler: async (ctx, args): Promise<{ liked: boolean; likeCount: number }> => {
    const user = await requireUser(ctx);

    const row = await ctx.db.get(args.id);
    if (!row || row.deletedAt) {
      throw new Error("Beğenilecek yorum bulunamadı.");
    }

    const existing = await ctx.db
      .query("commentLikes")
      .withIndex("by_comment_user", (q) =>
        q.eq("commentId", args.id).eq("userId", user._id),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      const likeCount = Math.max(row.likeCount - 1, 0);
      await ctx.db.patch(row._id, { likeCount });
      return { liked: false, likeCount };
    }

    await ctx.db.insert("commentLikes", {
      commentId: args.id,
      userId: user._id,
      createdAt: Date.now(),
    });
    const likeCount = row.likeCount + 1;
    await ctx.db.patch(row._id, { likeCount });
    return { liked: true, likeCount };
  },
});

/** The signed-in user's own latest comment, for the composer's cooldown hint. */
export const myLatest = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    const last = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();
    if (!last) return null;
    return { createdAt: last.createdAt, anilistId: last.anilistId };
  },
});

export const PAGE_SIZE = DEFAULT_COMMENTS_PAGE_SIZE;
