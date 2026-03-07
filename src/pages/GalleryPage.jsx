import { Filter, RefreshCw, Sparkles, Tags } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import PhotoGrid from "../gallery/PhotoGrid";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { fetchPhotos } from "../lib/api";
import { formatBytes, formatPhotoDate } from "../lib/format";
import PhotoViewer from "../viewer/PhotoViewer";

function GalleryPage({ albums, onLibraryChange, refreshToken, searchValue, smartAlbums, summary, tags }) {
  const params = useParams();
  const albumId = params.albumId ? decodeURIComponent(params.albumId) : "";
  const [selectedTag, setSelectedTag] = useState("");
  const [viewerIndex, setViewerIndex] = useState(-1);
  const [feedState, setFeedState] = useState({
    items: [],
    nextCursor: null,
    total: 0,
    loading: true,
    loadingMore: false,
    error: ""
  });

  const debouncedSearch = useDebouncedValue(searchValue, 180);
  const sentinelRef = useRef(null);
  const requestLockRef = useRef(false);

  const activeAlbum = useMemo(
    () => [...albums, ...smartAlbums].find((album) => album.id === albumId) || null,
    [albumId, albums, smartAlbums]
  );

  const pageTitle = activeAlbum?.name || activeAlbum?.label || "All memories";
  const totalVisibleTags = tags.slice(0, 10);

  const loadFeed = useCallback(
    async ({ append = false, cursor = 0 } = {}) => {
      if (requestLockRef.current) {
        return;
      }

      requestLockRef.current = true;

      setFeedState((current) => ({
        ...current,
        error: "",
        loading: append ? current.loading : true,
        loadingMore: append
      }));

      try {
        const response = await fetchPhotos({
          albumId,
          cursor,
          limit: 24,
          search: debouncedSearch,
          tag: selectedTag
        });

        setFeedState((current) => ({
          items: append ? [...current.items, ...(response.items || [])] : response.items || [],
          nextCursor: response.nextCursor,
          total: response.total || 0,
          loading: false,
          loadingMore: false,
          error: ""
        }));
      } catch (error) {
        setFeedState((current) => ({
          ...current,
          loading: false,
          loadingMore: false,
          error: error.message || "Unable to load the gallery."
        }));
      } finally {
        requestLockRef.current = false;
      }
    },
    [albumId, debouncedSearch, selectedTag]
  );

  useEffect(() => {
    loadFeed({ append: false, cursor: 0 });
  }, [loadFeed, refreshToken]);

  useEffect(() => {
    if (!feedState.nextCursor || !sentinelRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (entry?.isIntersecting && !feedState.loadingMore) {
          loadFeed({ append: true, cursor: feedState.nextCursor });
        }
      },
      { rootMargin: "600px 0px" }
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [feedState.loadingMore, feedState.nextCursor, loadFeed]);

  useEffect(() => {
    if (viewerIndex >= feedState.items.length) {
      setViewerIndex(-1);
    }
  }, [feedState.items.length, viewerIndex]);

  const heroDescription = activeAlbum
    ? "This album view keeps the masonry grid, quick search, fullscreen viewer, and metadata tools."
    : "Search by filename, tag, or date, then dive into a fullscreen viewer with zoom and downloads.";

  const quickStats = [
    {
      label: "Loaded",
      value: `${feedState.items.length}/${feedState.total || feedState.items.length}`
    },
    {
      label: "Storage",
      value: formatBytes(summary?.totalSize || 0)
    },
    {
      label: "Latest",
      value: formatPhotoDate(summary?.newestCapture)
    }
  ];

  function handlePhotoUpdated(photo) {
    setFeedState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === photo.id ? photo : item))
    }));
    onLibraryChange();
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.35fr,0.85fr]">
        <div className="glass-panel-strong space-y-4 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
            {activeAlbum ? "Album view" : "Gallery"}
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {pageTitle}
          </h2>
          <p className="max-w-2xl text-sm text-muted sm:text-base">{heroDescription}</p>
          <div className="flex flex-wrap gap-2">
            <span className="chip border-none bg-accentSoft text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              Instant search
            </span>
            <span className="chip">
              <Filter className="h-3.5 w-3.5" />
              Masonry timeline
            </span>
            <span className="chip">
              <Tags className="h-3.5 w-3.5" />
              Editable tags
            </span>
          </div>
        </div>

        <div className="glass-panel grid gap-3 px-6 py-6 sm:grid-cols-3 lg:grid-cols-1">
          {quickStats.map((item) => (
            <div key={item.label} className="rounded-[22px] border border-line/70 bg-panel/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{item.label}</p>
              <p className="mt-2 text-xl font-bold text-text">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel space-y-5 px-6 py-6">
        <SectionHeader
          eyebrow="Filters"
          title={debouncedSearch ? `Results for "${debouncedSearch}"` : "Discover by tags"}
          description="Filters update the feed instantly. Clear them to get back to your full timeline."
          action={
            selectedTag ? (
              <button
                type="button"
                onClick={() => setSelectedTag("")}
                className="action-button border border-line/70 bg-panel/80 text-text hover:border-accent/60 hover:bg-accentSoft/70"
              >
                <RefreshCw className="h-4 w-4" />
                Clear tag
              </button>
            ) : null
          }
        />

        <div className="flex flex-wrap gap-2">
          {totalVisibleTags.length ? (
            totalVisibleTags.map((tag) => {
              const active = selectedTag === tag.tag;
              return (
                <button
                  key={tag.tag}
                  type="button"
                  onClick={() => setSelectedTag(active ? "" : tag.tag)}
                  className={["chip", active ? "border-accent/60 bg-accentSoft text-accent" : ""].join(" ")}
                >
                  #{tag.tag}
                  <span className="text-xs text-muted">{tag.count}</span>
                </button>
              );
            })
          ) : (
            <p className="text-sm text-muted">Tag counts appear once your photos have been uploaded.</p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Timeline"
          title={activeAlbum ? `Inside ${pageTitle}` : "All uploaded photos"}
          description={
            feedState.total
              ? `${feedState.total} photo${feedState.total === 1 ? "" : "s"} match the current view.`
              : "Upload photos to start building your gallery."
          }
        />

        <PhotoGrid
          error={feedState.error}
          hasMore={Boolean(feedState.nextCursor)}
          loading={feedState.loading}
          loadingMore={feedState.loadingMore}
          onOpenPhoto={setViewerIndex}
          photos={feedState.items}
          sentinelRef={sentinelRef}
        />
      </section>

      <PhotoViewer
        albums={albums}
        index={viewerIndex}
        onClose={() => setViewerIndex(-1)}
        onIndexChange={setViewerIndex}
        onLibraryChange={onLibraryChange}
        onPhotoUpdated={handlePhotoUpdated}
        photos={feedState.items}
      />
    </div>
  );
}

export default GalleryPage;
