/**
 * AniList GraphQL access layer.
 *
 * AniList (https://anilist.co) is a free, public and key-less API — every title,
 * poster, banner, character portrait, trailer and streaming link the app shows
 * comes from here. This module is deliberately pure (no Convex imports) so it can
 * be reasoned about on its own: it only knows how to talk to AniList and how to
 * normalise the response into the shapes stored in the database.
 */

const ENDPOINT = "https://graphql.anilist.co";
const REQUEST_TIMEOUT_MS = 12_000;

// ---------------------------------------------------------------------------
// Raw response shapes (only the parts we consume)
// ---------------------------------------------------------------------------

type Maybe<T> = T | null | undefined;

type RawFuzzyDate = Maybe<{ year?: Maybe<number>; month?: Maybe<number>; day?: Maybe<number> }>;

type RawMedia = {
  id: number;
  idMal?: Maybe<number>;
  title?: Maybe<{ romaji?: Maybe<string>; english?: Maybe<string>; native?: Maybe<string> }>;
  description?: Maybe<string>;
  coverImage?: Maybe<{ extraLarge?: Maybe<string>; large?: Maybe<string>; color?: Maybe<string> }>;
  bannerImage?: Maybe<string>;
  genres?: Maybe<string[]>;
  averageScore?: Maybe<number>;
  meanScore?: Maybe<number>;
  popularity?: Maybe<number>;
  favourites?: Maybe<number>;
  format?: Maybe<string>;
  status?: Maybe<string>;
  episodes?: Maybe<number>;
  duration?: Maybe<number>;
  season?: Maybe<string>;
  seasonYear?: Maybe<number>;
  startDate?: RawFuzzyDate;
  studios?: Maybe<{ nodes?: Maybe<Array<Maybe<{ name?: Maybe<string> }>>> }>;
  trailer?: Maybe<{ id?: Maybe<string>; site?: Maybe<string> }>;
  nextAiringEpisode?: Maybe<{ episode?: Maybe<number>; airingAt?: Maybe<number> }>;
  siteUrl?: Maybe<string>;
  characters?: Maybe<{
    edges?: Maybe<
      Array<
        Maybe<{
          role?: Maybe<string>;
          node?: Maybe<{
            id?: Maybe<number>;
            name?: Maybe<{ full?: Maybe<string> }>;
            image?: Maybe<{ large?: Maybe<string> }>;
          }>;
          voiceActors?: Maybe<
            Array<
              Maybe<{
                id?: Maybe<number>;
                name?: Maybe<{ full?: Maybe<string> }>;
                image?: Maybe<{ large?: Maybe<string> }>;
                languageV2?: Maybe<string>;
              }>
            >
          >;
        }>
      >
    >;
  }>;
  relations?: Maybe<{
    edges?: Maybe<
      Array<
        Maybe<{
          relationType?: Maybe<string>;
          node?: Maybe<{
            id?: Maybe<number>;
            title?: Maybe<{ romaji?: Maybe<string>; english?: Maybe<string> }>;
            coverImage?: Maybe<{ large?: Maybe<string> }>;
            format?: Maybe<string>;
            averageScore?: Maybe<number>;
          }>;
        }>
      >
    >;
  }>;
  recommendations?: Maybe<{
    nodes?: Maybe<
      Array<
        Maybe<{
          mediaRecommendation?: Maybe<{
            id?: Maybe<number>;
            title?: Maybe<{ romaji?: Maybe<string>; english?: Maybe<string> }>;
            coverImage?: Maybe<{ large?: Maybe<string> }>;
            format?: Maybe<string>;
            averageScore?: Maybe<number>;
          }>;
        }>
      >
    >;
  }>;
  streamingEpisodes?: Maybe<
    Array<Maybe<{ title?: Maybe<string>; thumbnail?: Maybe<string>; url?: Maybe<string>; site?: Maybe<string> }>>
  >;
  externalLinks?: Maybe<
    Array<Maybe<{ id?: Maybe<number>; url?: Maybe<string>; site?: Maybe<string>; type?: Maybe<string>; icon?: Maybe<string> }>>
  >;
};

// ---------------------------------------------------------------------------
// Query documents
// ---------------------------------------------------------------------------

const CARD_FIELDS = `
  fragment CardFields on Media {
    id
    idMal
    title { romaji english native }
    description(asHtml: false)
    coverImage { extraLarge large color }
    bannerImage
    genres
    averageScore
    popularity
    favourites
    format
    status
    episodes
    duration
    season
    seasonYear
    startDate { year }
    studios(isMain: true) { nodes { name } }
    trailer { id site }
    nextAiringEpisode { episode airingAt }
    siteUrl
  }
`;

const FEED_QUERY = `
  ${CARD_FIELDS}
  query Feed($page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus, $search: String) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage }
      media(type: ANIME, isAdult: false, sort: $sort, status: $status, search: $search) {
        ...CardFields
      }
    }
  }
`;

const DETAIL_QUERY = `
  ${CARD_FIELDS}
  query Detail($id: Int) {
    Media(id: $id, type: ANIME) {
      ...CardFields
      characters(sort: [ROLE, RELEVANCE], perPage: 16) {
        edges {
          role
          node {
            id
            name { full }
            image { large }
          }
          voiceActors {
            id
            name { full }
            image { large }
            languageV2
          }
        }
      }
      relations {
        edges {
          relationType
          node {
            id
            title { romaji english }
            coverImage { large }
            format
            averageScore
          }
        }
      }
      recommendations(sort: RATING_DESC, perPage: 14) {
        nodes {
          mediaRecommendation {
            id
            title { romaji english }
            coverImage { large }
            format
            averageScore
          }
        }
      }
      streamingEpisodes { title thumbnail url site }
      externalLinks { id url site type icon }
    }
  }
`;

/**
 * Broadcast times for one window, as AniList's `airingSchedules` reports them.
 * 
 * This is what the calendar page shows: real broadcast timestamps for real
 * airing episodes, not a derived guess.
 */
const AIRING_QUERY = `
  ${CARD_FIELDS}
  query Airing($page: Int, $perPage: Int, $from: Int, $to: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
        airingAt
        episode
        media { ...CardFields }
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** `AbortSignal.timeout` is not guaranteed in every isolate runtime. */
function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") {
    return undefined;
  }
  return AbortSignal.timeout(ms);
}

async function request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  let lastError = "AniList yanıt vermedi";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await sleep(900 * attempt);

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables }),
        signal: timeoutSignal(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : "AniList'e bağlanılamadı";
      continue;
    }

    // AniList throttles aggressively; back off and retry on 429 / 5xx.
    if (response.status === 429 || response.status >= 500) {
      lastError = `AniList geçici olarak yanıt vermiyor (HTTP ${response.status})`;
      continue;
    }

    const payload = (await response.json().catch(() => null)) as
      | { data?: T; errors?: Array<{ message?: string }> }
      | null;

    if (!payload) {
      lastError = "AniList yanıtı okunamadı";
      continue;
    }

    if (payload.errors?.length && !payload.data) {
      const message = payload.errors
        .map((entry) => entry.message)
        .filter((entry): entry is string => Boolean(entry))
        .join(" · ");
      throw new Error(message || "AniList isteği reddedildi");
    }

    if (!payload.data) {
      lastError = "AniList boş yanıt döndü";
      continue;
    }

    return payload.data;
  }

  throw new Error(lastError);
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

export type NormalizedTitleRef = {
  anilistId: number;
  title: string;
  cover?: string;
  format?: string;
  score?: number;
  relationType?: string;
};

export type NormalizedCharacter = {
  name: string;
  image?: string;
  role?: string;
  voiceActor?: string;
  voiceImage?: string;
};

export type NormalizedEpisode = {
  title: string;
  thumbnail?: string;
  url: string;
  site?: string;
};

export type NormalizedStream = {
  site: string;
  url: string;
  icon?: string;
};

export type NormalizedCard = {
  anilistId: number;
  idMal?: number;
  title: string;
  titleEnglish?: string;
  titleNative?: string;
  synopsis?: string;
  cover?: string;
  coverColor?: string;
  banner?: string;
  genres: string[];
  score?: number;
  popularity?: number;
  favourites?: number;
  format?: string;
  status?: string;
  episodes?: number;
  duration?: number;
  season?: string;
  seasonYear?: number;
  year?: number;
  studios: string[];
  trailerId?: string;
  trailerSite?: string;
  nextEpisode?: number;
  nextEpisodeAt?: number;
  siteUrl?: string;
  searchText: string;
  updatedAt: number;
};

export type NormalizedDetail = NormalizedCard & {
  characters: NormalizedCharacter[];
  relations: NormalizedTitleRef[];
  recommendations: NormalizedTitleRef[];
  streamEpisodes: NormalizedEpisode[];
  streams: NormalizedStream[];
  detailSyncedAt: number;
};

function text(value: Maybe<string>): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function num(value: Maybe<number>): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** AniList descriptions come back as light HTML — flatten them to plain text. */
export function plainText(value: Maybe<string>): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function uniqueStrings(values: Array<Maybe<string>>): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const clean = text(value);
    if (clean) seen.add(clean);
  }
  return Array.from(seen);
}

function displayTitle(media: RawMedia): string {
  return (
    text(media.title?.romaji) ??
    text(media.title?.english) ??
    text(media.title?.native) ??
    `AniList #${media.id}`
  );
}

function toTitleRef(
  node: Maybe<{
    id?: Maybe<number>;
    title?: Maybe<{ romaji?: Maybe<string>; english?: Maybe<string> }>;
    coverImage?: Maybe<{ large?: Maybe<string> }>;
    format?: Maybe<string>;
    averageScore?: Maybe<number>;
  }>,
  relationType?: Maybe<string>,
): NormalizedTitleRef | null {
  const id = num(node?.id);
  if (!id) return null;
  return {
    anilistId: id,
    title: text(node?.title?.romaji) ?? text(node?.title?.english) ?? `AniList #${id}`,
    cover: text(node?.coverImage?.large),
    format: text(node?.format),
    score: num(node?.averageScore),
    relationType: text(relationType),
  };
}

export function normalizeCard(media: RawMedia, now = Date.now()): NormalizedCard {
  const title = displayTitle(media);
  const titleEnglish = text(media.title?.english);
  const titleNative = text(media.title?.native);
  const studios = uniqueStrings((media.studios?.nodes ?? []).map((node) => node?.name));
  const trailerId = text(media.trailer?.id);
  const trailerSite = text(media.trailer?.site);

  const card: NormalizedCard = {
    anilistId: media.id,
    title,
    genres: uniqueStrings(media.genres ?? []),
    studios,
    searchText: uniqueStrings([title, titleEnglish, titleNative, ...studios]).join(" "),
    updatedAt: now,
  };

  const idMal = num(media.idMal);
  if (idMal) card.idMal = idMal;
  if (titleEnglish) card.titleEnglish = titleEnglish;
  if (titleNative) card.titleNative = titleNative;

  const synopsis = plainText(media.description);
  if (synopsis) card.synopsis = synopsis;

  const cover = text(media.coverImage?.extraLarge) ?? text(media.coverImage?.large);
  if (cover) card.cover = cover;
  const coverColor = text(media.coverImage?.color);
  if (coverColor) card.coverColor = coverColor;
  const banner = text(media.bannerImage);
  if (banner) card.banner = banner;

  const score = num(media.averageScore) ?? num(media.meanScore);
  if (score) card.score = score;
  const popularity = num(media.popularity);
  if (popularity) card.popularity = popularity;
  const favourites = num(media.favourites);
  if (favourites) card.favourites = favourites;

  const format = text(media.format);
  if (format) card.format = format;
  const status = text(media.status);
  if (status) card.status = status;
  const episodes = num(media.episodes);
  if (episodes) card.episodes = episodes;
  const duration = num(media.duration);
  if (duration) card.duration = duration;
  const season = text(media.season);
  if (season) card.season = season;
  const seasonYear = num(media.seasonYear);
  if (seasonYear) card.seasonYear = seasonYear;

  const year = num(media.startDate?.year) ?? seasonYear;
  if (year) card.year = year;

  if (trailerId && trailerSite) {
    card.trailerId = trailerId;
    card.trailerSite = trailerSite;
  }

  const nextEpisode = num(media.nextAiringEpisode?.episode);
  const nextEpisodeAt = num(media.nextAiringEpisode?.airingAt);
  if (nextEpisode && nextEpisodeAt) {
    card.nextEpisode = nextEpisode;
    card.nextEpisodeAt = nextEpisodeAt * 1000;
  }

  const siteUrl = text(media.siteUrl);
  if (siteUrl) card.siteUrl = siteUrl;

  return card;
}

export function normalizeDetail(media: RawMedia, now = Date.now()): NormalizedDetail {
  const card = normalizeCard(media, now);

  const characters: NormalizedCharacter[] = [];
  const seenCharacters = new Set<string>();
  for (const edge of media.characters?.edges ?? []) {
    const name = text(edge?.node?.name?.full);
    if (!name || seenCharacters.has(name)) continue;
    seenCharacters.add(name);
    const japanese = (edge?.voiceActors ?? []).find(
      (actor) => text(actor?.languageV2) === "Japanese",
    );
    const character: NormalizedCharacter = { name };
    const image = text(edge?.node?.image?.large);
    if (image) character.image = image;
    const role = text(edge?.role);
    if (role) character.role = role;
    const voiceActor = text(japanese?.name?.full);
    if (voiceActor) character.voiceActor = voiceActor;
    const voiceImage = text(japanese?.image?.large);
    if (voiceImage) character.voiceImage = voiceImage;
    characters.push(character);
    if (characters.length >= 12) break;
  }

  const relations: NormalizedTitleRef[] = [];
  const seenRelations = new Set<number>([card.anilistId]);
  for (const edge of media.relations?.edges ?? []) {
    const ref = toTitleRef(edge?.node, edge?.relationType);
    if (!ref || seenRelations.has(ref.anilistId)) continue;
    seenRelations.add(ref.anilistId);
    relations.push(ref);
    if (relations.length >= 12) break;
  }

  const recommendations: NormalizedTitleRef[] = [];
  const seenRecommendations = new Set<number>([card.anilistId]);
  for (const node of media.recommendations?.nodes ?? []) {
    const ref = toTitleRef(node?.mediaRecommendation);
    if (!ref || seenRecommendations.has(ref.anilistId)) continue;
    seenRecommendations.add(ref.anilistId);
    recommendations.push(ref);
    if (recommendations.length >= 12) break;
  }

  const streamEpisodes: NormalizedEpisode[] = [];
  for (const episode of media.streamingEpisodes ?? []) {
    const url = text(episode?.url);
    const title = text(episode?.title);
    if (!url || !title) continue;
    const entry: NormalizedEpisode = { title, url };
    const thumbnail = text(episode?.thumbnail);
    if (thumbnail) entry.thumbnail = thumbnail;
    const site = text(episode?.site);
    if (site) entry.site = site;
    streamEpisodes.push(entry);
    if (streamEpisodes.length >= 24) break;
  }

  const streams: NormalizedStream[] = [];
  const seenSites = new Set<string>();
  for (const link of media.externalLinks ?? []) {
    if (text(link?.type) !== "STREAMING") continue;
    const site = text(link?.site);
    const url = text(link?.url);
    if (!site || !url || seenSites.has(site)) continue;
    seenSites.add(site);
    const entry: NormalizedStream = { site, url };
    const icon = text(link?.icon);
    if (icon) entry.icon = icon;
    streams.push(entry);
    if (streams.length >= 12) break;
  }

  return {
    ...card,
    characters,
    relations,
    recommendations,
    streamEpisodes,
    streams,
    detailSyncedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Public fetch helpers
// ---------------------------------------------------------------------------

export type FeedRequest = {
  sort: string[];
  status?: string;
  perPage?: number;
};

export async function fetchFeed(input: FeedRequest): Promise<NormalizedCard[]> {
  const variables: Record<string, unknown> = {
    page: 1,
    perPage: input.perPage ?? 40,
    sort: input.sort,
  };
  if (input.status) variables.status = input.status;

  const data = await request<{ Page?: { media?: Array<Maybe<RawMedia>> } }>(FEED_QUERY, variables);
  const now = Date.now();
  return (data.Page?.media ?? [])
    .filter((media): media is RawMedia => Boolean(media?.id))
    .map((media) => normalizeCard(media, now));
}

export async function fetchSearch(term: string, perPage = 30): Promise<NormalizedCard[]> {
  const data = await request<{ Page?: { media?: Array<Maybe<RawMedia>> } }>(FEED_QUERY, {
    page: 1,
    perPage,
    search: term,
  });
  const now = Date.now();
  return (data.Page?.media ?? [])
    .filter((media): media is RawMedia => Boolean(media?.id))
    .map((media) => normalizeCard(media, now));
}

export async function fetchDetail(anilistId: number): Promise<NormalizedDetail | null> {
  const data = await request<{ Media?: Maybe<RawMedia> }>(DETAIL_QUERY, { id: anilistId });
  if (!data.Media?.id) return null;
  return normalizeDetail(data.Media);
}

export type NormalizedAiring = {
  episode: number;
  /** Epoch ms of the broadcast. */
  airingAt: number;
  media: NormalizedCard;
};

/**
 * Real broadcast entries between two epoch-ms instants, several pages deep.
 * AniList expects seconds, so the window is converted on the way out and the
 * timestamps are converted back to ms on the way in.
 */
export async function fetchAiring(
  from: number,
  to: number,
  maxPages = 3,
): Promise<NormalizedAiring[]> {
  const now = Date.now();
  const slots: NormalizedAiring[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const data = await request<{
      Page?: Maybe<{
        pageInfo?: Maybe<{ hasNextPage?: Maybe<boolean> }>;
        airingSchedules?: Maybe<
          Array<
            Maybe<{
              airingAt?: Maybe<number>;
              episode?: Maybe<number>;
              media?: Maybe<RawMedia>;
            }>
          >
        >;
      }>;
    }>(AIRING_QUERY, {
      page,
      perPage: 50,
      from: Math.floor(from / 1000),
      to: Math.floor(to / 1000),
    });

    const rows = data.Page?.airingSchedules ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const episode = num(row?.episode);
      const airingAt = num(row?.airingAt);
      const media = row?.media;
      if (!episode || !airingAt || !media?.id) continue;
      slots.push({
        episode,
        airingAt: airingAt * 1000,
        media: normalizeCard(media, now),
      });
    }

    if (!data.Page?.pageInfo?.hasNextPage) break;
  }

  return slots;
}
