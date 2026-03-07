import { CalendarDays, Download, Tag } from "lucide-react";
import { getAssetUrl } from "../lib/api";
import { formatPhotoDate } from "../lib/format";

function PhotoCard({ onClick, photo }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative mb-5 block w-full break-inside-avoid overflow-hidden rounded-[26px] border border-line/70 bg-surface/80 text-left transition duration-300 hover:-translate-y-1 hover:border-accent/50"
    >
      <img
        src={getAssetUrl(photo.url)}
        alt={photo.originalName || photo.filename}
        loading="lazy"
        className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.02]"
      />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-4 opacity-0 transition duration-300 group-hover:opacity-100">
        <div className="chip border-none bg-black/45 text-white backdrop-blur-md">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatPhotoDate(photo.capturedAt || photo.uploadedAt)}
        </div>
        <div className="chip border-none bg-black/45 text-white backdrop-blur-md">
          <Download className="h-3.5 w-3.5" />
          Open
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent px-4 pb-4 pt-14 text-white">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{photo.originalName || photo.filename}</p>
            <p className="truncate text-xs text-white/70">{photo.resolution || "Image"}</p>
          </div>
          {photo.tags?.length ? (
            <span className="chip shrink-0 border-none bg-white/12 text-white backdrop-blur-md">
              <Tag className="h-3.5 w-3.5" />
              {photo.tags[0]}
              {photo.tags.length > 1 ? ` +${photo.tags.length - 1}` : ""}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default PhotoCard;
