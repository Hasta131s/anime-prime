import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Play } from "lucide-react";
import { useState, type ComponentProps } from "react";

/**
 * Plays the trailer AniList reports for a title. The iframe is only mounted
 * while the dialog is open so nothing autoplays behind the page.
 */
export function TrailerButton({
  trailerId,
  trailerSite,
  title,
  variant = "outline",
  size = "lg",
  className,
  label = "Fragmanı izle",
}: {
  trailerId?: string;
  trailerSite?: string;
  title: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!trailerId || trailerSite !== "youtube") return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Play className="fill-current" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="border-white/10 bg-black p-0 sm:max-w-4xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title} fragmanı</DialogTitle>
          <DialogDescription>
            AniList üzerinden sağlanan resmî YouTube fragmanı.
          </DialogDescription>
        </DialogHeader>
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          {open ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&rel=0&modestbranding=1`}
              title={`${title} fragmanı`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="size-full border-0"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
