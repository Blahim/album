import {
  ChevronLeft,
  ChevronRight,
  Download,
  FolderPlus,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { addPhotosToAlbum, getAssetUrl, updatePhotoTags } from "../lib/api";
import { formatBytes, formatPhotoDateTime } from "../lib/format";

function PhotoViewer({ albums, index, onClose, onIndexChange, onLibraryChange, onPhotoUpdated, photos }) {
  const photo = index >= 0 ? photos[index] : null;
  const [zoom, setZoom] = useState(1);
  const [tagInput, setTagInput] = useState("");
  const [selectedAlbumId, setSelectedAlbumId] = useState("");
  const [savingTags, setSavingTags] = useState(false);
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canGoPrev = index > 0;
  const canGoNext = index < photos.length - 1;
  const customAlbums = useMemo(() => albums.slice().sort((a, b) => a.name.localeCompare(b.name)), [albums]);

  useEffect(() => {
    if (!photo) {
      return;
    }

    setZoom(1);
    setTagInput((photo.tags || []).join(", "));
    setSelectedAlbumId((current) => current || customAlbums[0]?.id || "");
    setError("");
    setNotice("");
  }, [photo, customAlbums]);

  useEffect(() => {
    if (!photo) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft" && canGoPrev) {
        onIndexChange(index - 1);
      } else if (event.key === "ArrowRight" && canGoNext) {
        onIndexChange(index + 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canGoNext, canGoPrev, index, onClose, onIndexChange, photo]);

  if (!photo) {
    return null;
  }

  function adjustZoom(amount) {
    setZoom((current) => Math.min(4, Math.max(1, Number((current + amount).toFixed(2)))));
  }

  async function handleSaveTags(event) {
    event.preventDefault();

    try {
      setSavingTags(true);
      setError("");
      const response = await updatePhotoTags(
        photo.id,
        tagInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      );
      onPhotoUpdated(response.item);
      setNotice("Tags saved.");
    } catch (requestError) {
      setError(requestError.message || "Failed to save tags.");
    } finally {
      setSavingTags(false);
    }
  }

  async function handleAddToAlbum() {
    if (!selectedAlbumId) {
      return;
    }

    try {
      setSavingAlbum(true);
      setError("");
      await addPhotosToAlbum(selectedAlbumId, [photo.id]);
      setNotice("Added to album.");
      onLibraryChange();
    } catch (requestError) {
      setError(requestError.message || "Could not add this photo to the album.");
    } finally {
      setSavingAlbum(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-xl">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{photo.originalName || photo.filename}</p>
            <p className="text-xs text-white/60">{formatPhotoDateTime(photo.capturedAt || photo.uploadedAt)}</p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={getAssetUrl(photo.url)}
              download={photo.originalName || photo.filename}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
            >
              <Download className="h-5 w-5" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr),380px]">
          <div className="relative flex min-h-[40vh] items-center justify-center overflow-hidden px-4 pb-4 sm:px-6">
            {canGoPrev ? (
              <button
                type="button"
                onClick={() => onIndexChange(index - 1)}
                className="absolute left-4 z-10 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}

            {canGoNext ? (
              <button
                type="button"
                onClick={() => onIndexChange(index + 1)}
                className="absolute right-4 z-10 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : null}

            <div
              className="flex h-full w-full items-center justify-center overflow-auto rounded-[30px] border border-white/10 bg-black/30"
              onWheel={(event) => {
                event.preventDefault();
                adjustZoom(event.deltaY < 0 ? 0.12 : -0.12);
              }}
            >
              <img
                src={getAssetUrl(photo.url)}
                alt={photo.originalName || photo.filename}
                className="max-h-full max-w-full rounded-[26px] object-contain transition duration-200"
                style={{ transform: `scale(${zoom})` }}
              />
            </div>

            <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-2 text-white backdrop-blur-md">
              <button
                type="button"
                onClick={() => adjustZoom(-0.15)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/15"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-[54px] text-center text-sm font-semibold">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => adjustZoom(0.15)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/15"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>

          <aside className="flex min-h-0 flex-col border-t border-white/10 bg-black/25 px-5 py-5 lg:border-l lg:border-t-0">
            <div className="space-y-5 overflow-y-auto">
              <section className="space-y-3 rounded-[28px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
                  Metadata
                </p>
                <MetadataRow label="Captured" value={formatPhotoDateTime(photo.capturedAt || photo.uploadedAt)} />
                <MetadataRow label="Size" value={formatBytes(photo.size)} />
                <MetadataRow label="Resolution" value={photo.resolution || "Unknown"} />
                <MetadataRow label="File" value={photo.filename} />
              </section>

              <form
                onSubmit={handleSaveTags}
                className="space-y-3 rounded-[28px] border border-white/10 bg-white/5 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {(photo.tags || []).length ? (
                    photo.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-sm text-white">
                        #{tag}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-white/60">No tags yet. Add a few to improve search.</p>
                  )}
                </div>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  className="w-full rounded-[20px] border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/70"
                  placeholder="travel, family, work"
                />
                <button
                  type="submit"
                  disabled={savingTags}
                  className="action-button w-full bg-white text-slate-950 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingTags ? "Saving..." : "Save tags"}
                </button>
              </form>

              <section className="space-y-3 rounded-[28px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
                  Add to album
                </p>
                <select
                  value={selectedAlbumId}
                  onChange={(event) => setSelectedAlbumId(event.target.value)}
                  className="w-full rounded-[20px] border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/70"
                >
                  {customAlbums.length ? null : <option value="">No albums available</option>}
                  {customAlbums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddToAlbum}
                  disabled={!selectedAlbumId || savingAlbum}
                  className="action-button w-full border border-white/10 bg-white/10 text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FolderPlus className="h-4 w-4" />
                  {savingAlbum ? "Adding..." : "Add to album"}
                </button>
              </section>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              {notice ? <p className="text-sm text-emerald-300">{notice}</p> : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function MetadataRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/20 px-3 py-2">
      <span className="text-sm text-white/60">{label}</span>
      <span className="text-right text-sm font-medium text-white">{value}</span>
    </div>
  );
}

export default PhotoViewer;
