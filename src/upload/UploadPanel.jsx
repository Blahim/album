import { ImagePlus, UploadCloud, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { uploadPhotos } from "../lib/api";
import { formatBytes } from "../lib/format";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function UploadPanel({ albums, onClose, onUploaded, open }) {
  const [queuedFiles, setQueuedFiles] = useState([]);
  const [albumId, setAlbumId] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const queuedFilesRef = useRef([]);

  useEffect(() => {
    queuedFilesRef.current = queuedFiles;
  }, [queuedFiles]);

  useEffect(
    () => () => {
      queuedFilesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    []
  );

  useEffect(() => {
    if (!open) {
      setError("");
      setIsDragging(false);
    }
  }, [open]);

  const canSubmit = queuedFiles.length > 0 && !submitting;
  const albumOptions = useMemo(() => albums.slice().sort((a, b) => a.name.localeCompare(b.name)), [albums]);

  function normalizeFiles(fileList) {
    return Array.from(fileList || [])
      .filter((file) => ACCEPTED_TYPES.has(file.type))
      .map((file) => ({
        file,
        id: `${file.name}-${file.lastModified}-${file.size}`,
        previewUrl: URL.createObjectURL(file)
      }));
  }

  function addFiles(fileList) {
    const freshFiles = normalizeFiles(fileList);

    if (!freshFiles.length) {
      setError("Only jpg, png, and webp images are accepted.");
      return;
    }

    setError("");
    setQueuedFiles((current) => {
      const knownIds = new Set(current.map((item) => item.id));
      return [...current, ...freshFiles.filter((item) => !knownIds.has(item.id))];
    });
  }

  function removeFile(id) {
    setQueuedFiles((current) => {
      const target = current.find((item) => item.id === id);

      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return current.filter((item) => item.id !== id);
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await uploadPhotos({
        files: queuedFiles.map((item) => item.file),
        albumId,
        tags: tagInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      });
      queuedFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setQueuedFiles([]);
      setAlbumId("");
      setTagInput("");
      onUploaded();
    } catch (requestError) {
      setError(requestError.message || "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="glass-panel-strong relative max-h-[92vh] w-full max-w-5xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-line/70 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Upload</p>
            <h3 className="font-display text-2xl font-bold">Add photos to your library</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line/70 bg-panel/80 text-text transition hover:border-accent/60 hover:bg-accentSoft/70"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid max-h-[calc(92vh-88px)] gap-0 overflow-hidden lg:grid-cols-[1.15fr,0.85fr]"
        >
          <div className="overflow-y-auto px-6 py-6">
            <label
              className={[
                "flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed px-6 py-10 text-center transition",
                isDragging
                  ? "border-accent bg-accentSoft/70"
                  : "border-line/80 bg-panel/75 hover:border-accent/50 hover:bg-panel"
              ].join(" ")}
              onDragEnter={() => setIsDragging(true)}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                addFiles(event.dataTransfer.files);
              }}
            >
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => addFiles(event.target.files)}
              />
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-accentSoft text-accent">
                <UploadCloud className="h-8 w-8" />
              </div>
              <h4 className="font-display text-2xl font-bold">Drop photos here</h4>
              <p className="mt-3 max-w-md text-sm text-muted sm:text-base">
                Drag images from your desktop or click to select multiple files at once.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <span className="chip">jpg</span>
                <span className="chip">png</span>
                <span className="chip">webp</span>
              </div>
            </label>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-text">Upload queue</h4>
                <p className="text-sm text-muted">
                  {queuedFiles.length} file{queuedFiles.length === 1 ? "" : "s"}
                </p>
              </div>

              {queuedFiles.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {queuedFiles.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-[22px] border border-line/70 bg-panel/80 p-3"
                    >
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        className="h-16 w-16 rounded-2xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">{item.file.name}</p>
                        <p className="text-xs text-muted">{formatBytes(item.file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(item.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line/70 bg-surface/80 text-text transition hover:border-accent/60 hover:bg-accentSoft/70"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-line/70 px-4 py-6 text-center text-sm text-muted">
                  Selected photos will appear here with instant previews.
                </div>
              )}
            </div>
          </div>

          <aside className="border-t border-line/70 bg-panel/70 px-6 py-6 lg:border-l lg:border-t-0">
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Options</p>
                <h4 className="font-display text-2xl font-bold">Organize on upload</h4>
                <p className="text-sm text-muted">
                  Apply starter tags or drop this upload into one of your existing albums.
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-text">Album</span>
                <select
                  value={albumId}
                  onChange={(event) => setAlbumId(event.target.value)}
                  className="w-full rounded-[22px] border border-line/70 bg-surface/80 px-4 py-3 text-sm text-text outline-none transition focus:border-accent/70"
                >
                  <option value="">No album</option>
                  {albumOptions.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-text">Tags</span>
                <div className="input-shell rounded-[22px]">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    placeholder="travel, family, event"
                    className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
                  />
                </div>
              </label>

              <div className="rounded-[24px] border border-line/70 bg-surface/80 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accentSoft text-accent">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-text">Metadata extraction included</p>
                    <p className="mt-1 text-sm text-muted">
                      Every uploaded photo is indexed with size, resolution, and capture date when
                      available in EXIF metadata.
                    </p>
                  </div>
                </div>
              </div>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}

              <button
                type="submit"
                disabled={!canSubmit}
                className="action-button w-full bg-text text-bg hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <UploadCloud className="h-4 w-4" />
                {submitting ? "Uploading..." : `Upload ${queuedFiles.length || ""}`.trim()}
              </button>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

export default UploadPanel;
