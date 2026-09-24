import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  MODERATOR: "moderator",
  EDITOR: "editor",
  USER: "user",
  MEMBER: "member",
  NEWCOMER: "newcomer",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.MODERATOR),
  v.literal(ROLES.EDITOR),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
  v.literal(ROLES.NEWCOMER),
);
export type Role = Infer<typeof roleValidator>;

/**
 * A reference to another title (relation or recommendation) as shown in rails.
 * Only ids + display fields are kept so the cards can be rendered without an
 * extra round-trip.
 */
const titleRefValidator = v.object({
  anilistId: v.number(),
  title: v.string(),
  cover: v.optional(v.string()),
  format: v.optional(v.string()),
  score: v.optional(v.number()),
  relationType: v.optional(v.string()),
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      // Moderation state. A banned account keeps read access but cannot post
      // comments, customise its profile or record progress.
      bannedAt: v.optional(v.number()),
      banReason: v.optional(v.string()),
      bannedBy: v.optional(v.id("users")),
      lastSeenAt: v.optional(v.number()),
    }).index("email", ["email"]), // index for the email. do not remove or modify

    /**
     * Local mirror of the AniList catalogue.
     *
     * Every field is sourced from the AniList GraphQL API — titles, artwork,
     * genres, studios, scores and streaming links are all real data. Nothing in
     * here is generated or invented, so the UI never has to fall back to fake
     * posters: when artwork is missing we render a typographic placeholder
     * built from the real title instead.
     */
    anime: defineTable({
      anilistId: v.number(),
      idMal: v.optional(v.number()),
      title: v.string(),
      titleEnglish: v.optional(v.string()),
      titleNative: v.optional(v.string()),
      synopsis: v.optional(v.string()),
      cover: v.optional(v.string()),
      coverColor: v.optional(v.string()),
      banner: v.optional(v.string()),
      genres: v.array(v.string()),
      score: v.optional(v.number()),
      popularity: v.optional(v.number()),
      favourites: v.optional(v.number()),
      format: v.optional(v.string()),
      status: v.optional(v.string()),
      episodes: v.optional(v.number()),
      duration: v.optional(v.number()),
      season: v.optional(v.string()),
      seasonYear: v.optional(v.number()),
      year: v.optional(v.number()),
      studios: v.array(v.string()),
      trailerId: v.optional(v.string()),
      trailerSite: v.optional(v.string()),
      nextEpisode: v.optional(v.number()),
      nextEpisodeAt: v.optional(v.number()),
      siteUrl: v.optional(v.string()),
      // Flattened haystack so Convex full-text search covers every title variant
      // and the studios behind a title.
      searchText: v.string(),

      // Detail-only payload, filled on demand by `syncDetail`.
      characters: v.optional(
        v.array(
          v.object({
            name: v.string(),
            image: v.optional(v.string()),
            role: v.optional(v.string()),
            voiceActor: v.optional(v.string()),
            voiceImage: v.optional(v.string()),
          }),
        ),
      ),
      relations: v.optional(v.array(titleRefValidator)),
      recommendations: v.optional(v.array(titleRefValidator)),
      streamEpisodes: v.optional(
        v.array(
          v.object({
            title: v.string(),
            thumbnail: v.optional(v.string()),
            url: v.string(),
            site: v.optional(v.string()),
          }),
        ),
      ),
      streams: v.optional(
        v.array(
          v.object({
            site: v.string(),
            url: v.string(),
            icon: v.optional(v.string()),
          }),
        ),
      ),
      detailSyncedAt: v.optional(v.number()),
      updatedAt: v.number(),
    })
      .index("by_anilistId", ["anilistId"])
      .searchIndex("search_text", { searchField: "searchText" }),

    /** Ordered anime ids behind each editorial rail (trending, airing, …). */
    feeds: defineTable({
      list: v.string(),
      animeIds: v.array(v.id("anime")),
      syncedAt: v.number(),
    }).index("by_list", ["list"]),

    /**
     * Playable sources (HLS `.m3u8` or progressive `.mp4`).
     *
     * These are supplied by the site owner — the app never scrapes or extracts
     * streams, and writing here is restricted to admin accounts in
     * `convex/sources.ts`. An anime with no rows simply shows the "Nerede
     * izlenir" panel with licensed platform links instead of a player.
     */
    playbackSources: defineTable({
      anilistId: v.number(),
      /** 1-based episode number; 0 means a film / single-part title. */
      episode: v.number(),
      label: v.string(),
      url: v.string(),
      /** hls | mp4 | auto (probed by the player from the URL). */
      kind: v.string(),
      language: v.optional(v.string()),
      note: v.optional(v.string()),
      addedBy: v.optional(v.id("users")),
      createdAt: v.number(),
    })
      .index("by_anilistId", ["anilistId"])
      .index("by_anilistId_episode", ["anilistId", "episode"]),

    /**
     * Per-key sync bookkeeping. Drives the loading/error states in the UI and
     * the retry backoff, so a failing upstream never turns into a busy loop.
     */
    syncs: defineTable({
      key: v.string(),
      status: v.string(), // running | ok | error
      message: v.optional(v.string()),
      attempts: v.number(),
      attemptedAt: v.number(),
    }).index("by_key", ["key"]),

    /**
     * One row per airing episode, mirrored from AniList's `airingSchedules`.
     * The calendar page reads these and joins them with the cached titles, so
     * every slot on the timetable is a real broadcast time from AniList.
     */
    airingSchedule: defineTable({
      anilistId: v.number(),
      episode: v.number(),
      /** Epoch ms of the broadcast. */
      airingAt: v.number(),
    })
      .index("by_airingAt", ["airingAt"])
      .index("by_anilistId_episode", ["anilistId", "episode"]),

    /**
     * Discussion under a title.
     *
     * Replies are one level deep: a reply stores the id of the comment it
     * answers in `rootId` and `isReply` keeps them out of the paginated
     * top-level feed. Deletes are soft so a thread never loses its context, and
     * `replyCount` is maintained on write so the UI can label a thread without
     * counting rows on every render.
     */
    comments: defineTable({
      anilistId: v.number(),
      userId: v.id("users"),
      body: v.string(),
      spoiler: v.boolean(),
      isReply: v.boolean(),
      rootId: v.optional(v.id("comments")),
      replyCount: v.number(),
      likeCount: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
      editedAt: v.optional(v.number()),
      deletedAt: v.optional(v.number()),
      deletedByAdmin: v.optional(v.boolean()),
    })
      .index("by_target", ["anilistId", "isReply", "createdAt"])
      .index("by_root", ["rootId", "createdAt"])
      .index("by_user", ["userId", "createdAt"])
      .index("by_createdAt", ["createdAt"]),

    /** One row per (comment, user) pair, so a like is idempotent. */
    commentLikes: defineTable({
      commentId: v.id("comments"),
      userId: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_comment", ["commentId"])
      .index("by_comment_user", ["commentId", "userId"])
      .index("by_user", ["userId", "createdAt"]),

    /**
     * Public profile customisation plus the counters the profile shows.
     * The counters are incremented on write so a profile render never has to
     * scan the history or comment tables.
     */
    profiles: defineTable({
      userId: v.id("users"),
      /**
       * The member's own @username. Lowercased, unique across the site and
       * changeable at most once every two weeks (see `usernameChangedAt`).
       */
      username: v.optional(v.string()),
      /** Timestamp of the last username claim; drives the rename cooldown. */
      usernameChangedAt: v.optional(v.number()),
      displayName: v.optional(v.string()),
      tagline: v.optional(v.string()),
      bio: v.optional(v.string()),
      location: v.optional(v.string()),
      website: v.optional(v.string()),
      /** Free-text favourite genre shown on the profile. */
      favoriteGenre: v.optional(v.string()),
      /** AniList id whose banner is used as the profile header image. */
      bannerAnilistId: v.optional(v.number()),
      /**
       * Images the member uploaded from their own gallery, kept in Convex file
       * storage. When present they win over the character portrait and the
       * anime banner, so an upload always shows up immediately.
       */
      avatarStorageId: v.optional(v.id("_storage")),
      bannerStorageId: v.optional(v.id("_storage")),
      /** Ordered favourites — the first one supplies the default banner. */
      favoriteAnimeIds: v.array(v.number()),

      /**
       * The character the member chose to represent them, captured from AniList
       * when they pick it. Name and portrait are stored so the profile renders
       * without another upstream call, and they are always server-fetched — a
       * member can never write an arbitrary image URL here.
       */
      characterAnilistId: v.optional(v.number()),
      characterName: v.optional(v.string()),
      characterImage: v.optional(v.string()),
      characterMediaTitle: v.optional(v.string()),
      /** AniList id of the anime the character belongs to (for the link). */
      characterMediaAnilistId: v.optional(v.number()),

      /**
       * Profile sections the member chose to keep private. Ids come from
       * `PROFILE_SECTIONS`; anything listed is simply not rendered for others.
       */
      hiddenSections: v.optional(v.array(v.string())),

      isPublic: v.boolean(),
      commentCount: v.number(),
      /** Distinct titles with at least one recorded episode. */
      watchedTitleCount: v.number(),
      watchedEpisodeCount: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_userId", ["userId"])
      .index("by_updatedAt", ["updatedAt"])
      // Uniqueness is enforced in `setUsername`, which checks this index inside
      // the same transaction before writing.
      .index("by_username", ["username"]),

    /**
     * Site-wide settings — a single row keyed `"site"`.
     * Right now it only holds the admin-selected colour palette, which every
     * visitor reads and applies on load.
     */
    settings: defineTable({
      key: v.string(),
      /** Palette id from `SITE_PALETTES`. */
      palette: v.string(),
      updatedAt: v.number(),
      updatedBy: v.optional(v.id("users")),
    }).index("by_key", ["key"]),

    /** "En son izlenenler" — one row per episode a signed-in user watched. */
    watchHistory: defineTable({
      userId: v.id("users"),
      anilistId: v.number(),
      /** 0 means a film / single-part title. */
      episode: v.number(),
      position: v.number(),
      duration: v.number(),
      completed: v.boolean(),
      watchedAt: v.number(),
    })
      .index("by_user", ["userId", "watchedAt"])
      .index("by_user_anilistId", ["userId", "anilistId"])
      .index("by_user_anilistId_episode", ["userId", "anilistId", "episode"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
