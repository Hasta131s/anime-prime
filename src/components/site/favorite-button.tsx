import { Button, buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Heart, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";

/**
 * Adds / removes a title from the signed-in account's favourites.
 *
 * Signed-out visitors get a link into the auth flow that returns them here, so
 * the intent is never lost.
 */
export function FavoriteButton({
  anilistId,
  className,
}: {
  anilistId: number;
  className?: string;
}) {
  const { isAuthenticated, user } = useAuth();
  const me = useQuery(api.profiles.me);
  const toggleFavorite = useMutation(api.profiles.toggleFavorite);
  const [busy, setBusy] = useState(false);
  const location = useLocation();

  const isGuest = Boolean(user?.isAnonymous);
  const favorite = me?.profile?.favoriteAnimeIds.includes(anilistId) ?? false;

  if (!isAuthenticated || isGuest) {
    return (
      <Link
        to={`/auth?returnTo=${encodeURIComponent(location.pathname)}`}
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), className)}
      >
        <Heart className="size-4" />
        Favorilere ekle
      </Link>
    );
  }

  const run = async () => {
    setBusy(true);
    try {
      const result = await toggleFavorite({ anilistId });
      toast.success(
        result.favorite
          ? "Favorilerine eklendi."
          : "Favorilerinden çıkarıldı.",
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={favorite ? "default" : "outline"}
      size="lg"
      disabled={busy}
      onClick={() => void run()}
      className={cn(favorite && "bg-destructive hover:bg-destructive/85", className)}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Heart className={cn("size-4", favorite && "fill-current")} />
      )}
      {favorite ? "Favorilerimde" : "Favorilere ekle"}
    </Button>
  );
}
