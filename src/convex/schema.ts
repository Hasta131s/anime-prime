import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
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
  },
  {
    schemaValidation: false,
  },
);

export default schema;
