/**
 * Comments under a title.
 *
 * • Top-level comments stream in one page at a time (`usePaginatedQuery`), so a
 *   thread with thousands of messages never blocks the page — the reader taps
 *   "Devamını gör" to pull the next page.
 * • Replies are one level deep and load only when a thread is expanded.
 * • Spoilers are blurred until the reader chooses to reveal them.
 * • The composer reports the reasons an account cannot post (signed out, guest,
 *   suspended) instead of failing silently.
 */

import { Panel } from "@/components/site/panel";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import {
  COMMENT_MAX_LENGTH,
  COMMENT_SORTS,
  communityRoleLabel,
  initialsFor,
  normalizeCommentSort,
  type CommentAuthorView,
  type CommentView,
} from "@/convex/communityView";
import { formatRelative } from "@/lib/anime-labels";
import { cn } from "@/lib/utils";
import type { FunctionReturnType } from "convex/server";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import {
  Eye,
  Heart,
  Loader2,
  Lock,
  MessageSquare,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";

const PAGE_SIZE = 10;

type CommentState = FunctionReturnType<typeof api.comments.myState>;
type CommentId = CommentView["id"];

function useCommentSort() {
  const [sort, setSort] = useState("new");
  return [normalizeCommentSort(sort), setSort] as const;
}

export function CommentSection({ anilistId }: { anilistId: number }) {
  const [sort, setSort] = useCommentSort();
  const total = useQuery(api.comments.count, { anilistId });
  const state = useQuery(api.comments.myState);

  const { results, status, loadMore } = usePaginatedQuery(
    api.comments.list,
    { anilistId, sort },
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <Panel
      title={`Yorumlar${total ? ` (${total.total})` : ""}`}
      action={
        <div className="flex items-center gap-1">
          {COMMENT_SORTS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              title={entry.hint}
              onClick={() => setSort(entry.value)}
              className={cn(
                "rounded-[3px] px-2 py-1 text-[11px] font-medium transition-colors",
                sort === entry.value
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      }
      bodyClassName="space-y-4 p-3.5"
    >
      <Composer anilistId={anilistId} state={state} />

      {status === "LoadingFirstPage" ? (
        <p className="flex items-center justify-center gap-2 py-6 text-[12px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Yorumlar yükleniyor…
        </p>
      ) : results.length === 0 ? (
        <div className="rounded-[3px] border border-dashed border-border bg-background/30 px-4 py-8 text-center">
          <MessageSquare className="mx-auto size-4 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-[13px] font-medium text-foreground">
            Henüz yorum yok
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            İlk yorumu sen yaz, tartışmayı başlat.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {results.map((comment) => (
            <li key={comment.id}>
              <CommentRow comment={comment} anilistId={anilistId} />
            </li>
          ))}
        </ul>
      )}

      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <div className="flex justify-center border-t border-border pt-3">
          <Button
            variant="outline"
            size="sm"
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(PAGE_SIZE)}
          >
            {status === "LoadingMore" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Devamını gör
            {total ? ` (${Math.max(total.total - results.length, 0)})` : ""}
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

function Composer({
  anilistId,
  state,
  parentId,
  compact = false,
  onDone,
}: {
  anilistId: number;
  state: CommentState | undefined;
  parentId?: CommentId;
  compact?: boolean;
  onDone?: () => void;
}) {
  const addComment = useMutation(api.comments.add);
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [busy, setBusy] = useState(false);
  const location = useLocation();

  if (state === undefined) return null;

  if (!state.canComment) {
    const bannedMessage = "message" in state ? state.message : undefined;
    const message =
      state.reason === "signin"
        ? "Yorum yazmak için giriş yapmalısın."
        : state.reason === "anonymous"
          ? "Yorum yazmak için e-posta ile giriş yapmalısın; misafir oturumları yorum yazamaz."
          : bannedMessage
            ? `Hesabın askıya alındı: ${bannedMessage}`
            : "Hesabın askıya alındığı için yorum yazamazsın.";

    return (
      <div className="flex items-start gap-2.5 rounded-[3px] border border-border bg-background/40 p-3">
        {state.reason === "banned" ? (
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        ) : (
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="text-[12px] leading-relaxed text-muted-foreground">{message}</p>
          {state.reason !== "banned" ? (
            <Link
              to={`/auth?returnTo=${encodeURIComponent(location.pathname)}`}
              className="mt-2 inline-flex h-7 items-center rounded-[3px] bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-brand-strong"
            >
              Giriş yap
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = body.trim();
    if (value.length < 2) return;

    setBusy(true);
    try {
      await addComment({
        anilistId,
        body: value,
        spoiler,
        parentId,
      });
      setBody("");
      setSpoiler(false);
      toast.success(parentId ? "Yanıtın gönderildi." : "Yorumun gönderildi.");
      onDone?.();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Yorum gönderilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={COMMENT_MAX_LENGTH}
        rows={compact ? 2 : 3}
        placeholder={parentId ? "Yanıtını yaz…" : "Bu yapım hakkında ne düşünüyorsun?"}
        aria-label={parentId ? "Yanıt yaz" : "Yorum yaz"}
        className="w-full resize-y rounded-[3px] border border-input bg-background/50 px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/80 focus:border-primary"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={spoiler}
            onChange={(event) => setSpoiler(event.target.checked)}
            className="size-3.5 accent-primary"
          />
          <TriangleAlert className="size-3" aria-hidden="true" />
          Spoiler içeriyor
        </label>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {body.length}/{COMMENT_MAX_LENGTH}
          </span>
          {onDone ? (
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Vazgeç
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={busy || body.trim().length < 2}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {parentId ? "Yanıtla" : "Gönder"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// One comment
// ---------------------------------------------------------------------------

function CommentRow({
  comment,
  anilistId,
}: {
  comment: CommentView;
  anilistId: number;
}) {
  const toggleLike = useMutation(api.comments.toggleLike);
  const remove = useMutation(api.comments.remove);
  const myState = useQuery(api.comments.myState);
  const [revealed, setRevealed] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replying, setReplying] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const like = async () => {
    try {
      await toggleLike({ id: comment.id });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "İşlem başarısız.");
    }
  };

  const destroy = async () => {
    try {
      await remove({ id: comment.id });
      toast.success("Yorum silindi.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Yorum silinemedi.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <article
      className={cn(
        "rounded-[3px] border border-border bg-background/40 p-3",
        comment.deleted && "opacity-70",
      )}
    >
      <header className="flex items-center gap-2.5">
        <AuthorAvatar author={comment.author} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
            <span className="font-medium text-foreground">
              {comment.author.name}
            </span>
            {comment.author.handle ? (
              <span className="text-[11px] text-muted-foreground">
                @{comment.author.handle}
              </span>
            ) : null}
            {communityRoleLabel(comment.author.role) ? (
              <span className="rounded-[2px] bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {communityRoleLabel(comment.author.role)}
              </span>
            ) : null}
            {comment.author.banned ? (
              <span className="rounded-[2px] bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                Askıda
              </span>
            ) : null}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {formatRelative(comment.createdAt)}
            {comment.editedAt ? " · düzenlendi" : ""}
          </p>
        </div>

        {comment.canDelete && !comment.deleted ? (
          confirming ? (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="destructive" onClick={() => void destroy()}>
                Sil
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Vazgeç
              </Button>
            </div>
          ) : (
            <button
              type="button"
              aria-label="Yorumu sil"
              onClick={() => setConfirming(true)}
              className="rounded-[3px] p-1.5 text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          )
        ) : null}
      </header>

      <div className="mt-2.5 pl-[42px]">
        {comment.deleted ? (
          <p className="text-[12px] italic text-muted-foreground">
            {comment.deletedByAdmin
              ? "Bu yorum yönetici tarafından kaldırıldı."
              : "Bu yorum silindi."}
          </p>
        ) : comment.spoiler && !revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="inline-flex items-center gap-2 rounded-[3px] border border-dashed border-border bg-card/60 px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Eye className="size-3.5" />
            Spoiler — göstermek için dokun
          </button>
        ) : (
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/90">
            {comment.body}
          </p>
        )}

        {!comment.deleted ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[11px]">
            <button
              type="button"
              onClick={() => void like()}
              className={cn(
                "inline-flex items-center gap-1.5 transition-colors",
                comment.likedByMe
                  ? "text-destructive"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Heart
                className={cn("size-3.5", comment.likedByMe && "fill-current")}
              />
              {comment.likeCount > 0 ? comment.likeCount : "Beğen"}
            </button>

            <button
              type="button"
              onClick={() => setReplying((value) => !value)}
              className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <MessageSquare className="size-3.5" />
              Yanıtla
            </button>

            {comment.replyCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowReplies((value) => !value)}
                className="inline-flex items-center gap-1.5 text-primary transition-colors hover:text-brand-bright"
              >
                {showReplies ? "Yanıtları gizle" : `${comment.replyCount} yanıtı gör`}
              </button>
            ) : null}
          </div>
        ) : null}

        {replying ? (
          <div className="mt-2.5">
            <Composer
              anilistId={anilistId}
              state={myState}
              parentId={comment.id}
              compact
              onDone={() => {
                setReplying(false);
                setShowReplies(true);
              }}
            />
          </div>
        ) : null}

        {showReplies ? (
          <RepliesList
            rootId={comment.id}
            onCollapse={() => setShowReplies(false)}
          />
        ) : null}
      </div>
    </article>
  );
}

function RepliesList({
  rootId,
  onCollapse,
}: {
  rootId: CommentId;
  onCollapse: () => void;
}) {
  const thread = useQuery(api.comments.replies, { rootId });

  if (thread === undefined) {
    return (
      <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Yanıtlar yükleniyor…
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2.5 border-l border-border pl-3">
      {thread.items.map((reply) => (
        <ReplyRow key={reply.id} reply={reply} />
      ))}
      {thread.total > thread.items.length ? (
        <p className="text-[11px] text-muted-foreground">
          {thread.total - thread.items.length} yanıt daha var.
        </p>
      ) : null}
      <button
        type="button"
        onClick={onCollapse}
        className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        Yanıtları gizle
      </button>
    </div>
  );
}

function ReplyRow({ reply }: { reply: CommentView }) {
  const toggleLike = useMutation(api.comments.toggleLike);
  const remove = useMutation(api.comments.remove);
  const [revealed, setRevealed] = useState(false);

  return (
    <article className="rounded-[3px] border border-border bg-card/60 p-2.5">
      <header className="flex items-center gap-2">
        <AuthorAvatar author={reply.author} small />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-[12px]">
            <span className="font-medium text-foreground">{reply.author.name}</span>
            {communityRoleLabel(reply.author.role) ? (
              <span className="rounded-[2px] bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {communityRoleLabel(reply.author.role)}
              </span>
            ) : null}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {formatRelative(reply.createdAt)}
          </p>
        </div>
        {reply.canDelete && !reply.deleted ? (
          <button
            type="button"
            aria-label="Yanıtı sil"
            onClick={() =>
              void remove({ id: reply.id }).catch((cause) =>
                toast.error(cause instanceof Error ? cause.message : "Silinemedi."),
              )
            }
            className="rounded-[3px] p-1 text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </button>
        ) : null}
      </header>

      <div className="mt-2 pl-[36px]">
        {reply.deleted ? (
          <p className="text-[11px] italic text-muted-foreground">Bu yanıt silindi.</p>
        ) : reply.spoiler && !revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="text-[11px] text-muted-foreground underline decoration-dotted"
          >
            Spoiler — göstermek için dokun
          </button>
        ) : (
          <p className="text-[12px] leading-relaxed whitespace-pre-wrap text-foreground/90">
            {reply.body}
          </p>
        )}

        {!reply.deleted ? (
          <button
            type="button"
            onClick={() =>
              void toggleLike({ id: reply.id }).catch((cause) =>
                toast.error(cause instanceof Error ? cause.message : "İşlem başarısız."),
              )
            }
            className={cn(
              "mt-1.5 inline-flex items-center gap-1.5 text-[10px] transition-colors",
              reply.likedByMe
                ? "text-destructive"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Heart className={cn("size-3", reply.likedByMe && "fill-current")} />
            {reply.likeCount > 0 ? reply.likeCount : "Beğen"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function AuthorAvatar({
  author,
  small = false,
}: {
  author: CommentAuthorView;
  small?: boolean;
}) {
  const size = small ? "size-7 text-[10px]" : "size-8 text-[11px]";

  if (author.image) {
    return (
      <img
        src={author.image}
        alt=""
        loading="lazy"
        className={cn("shrink-0 rounded-[2px] object-cover", size)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[2px] border border-border bg-secondary font-semibold text-muted-foreground",
        size,
      )}
    >
      {initialsFor(author.name)}
    </span>
  );
}
