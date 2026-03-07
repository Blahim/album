import { CalendarRange, Folder, Images } from "lucide-react";
import { Link } from "react-router-dom";
import { getAssetUrl } from "../lib/api";

function AlbumCard({ album, smart = false }) {
  return (
    <Link
      to={`/albums/${encodeURIComponent(album.id)}`}
      className="group glass-panel overflow-hidden transition duration-300 hover:translate-y-[-2px] hover:border-accent/50"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {album.coverUrl ? (
          <img
            src={getAssetUrl(album.coverUrl)}
            alt={album.name || album.label}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(11,201,166,0.28),rgba(255,164,91,0.22))]">
            <Images className="h-12 w-12 text-text/80" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 py-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
            {smart ? <CalendarRange className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5" />}
            {smart ? "Auto album" : "Custom album"}
          </div>
        </div>
      </div>

      <div className="space-y-2 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-text">{album.name || album.label}</h3>
            <p className="text-sm text-muted">
              {album.photoCount || 0} photo{album.photoCount === 1 ? "" : "s"}
            </p>
          </div>
          <span className="chip border-none bg-accentSoft text-accent">
            {smart ? "Date" : "Manual"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default AlbumCard;
