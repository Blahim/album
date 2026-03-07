import EmptyState from "../components/EmptyState";
import PhotoCard from "./PhotoCard";

function PhotoGrid({ error, hasMore, loading, loadingMore, onOpenPhoto, photos, sentinelRef }) {
  if (loading && !photos.length) {
    return (
      <div className="columns-1 gap-5 sm:columns-2 xl:columns-3 2xl:columns-4">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="mb-5 h-64 break-inside-avoid rounded-[26px] border border-line/60 bg-panel/70"
          />
        ))}
      </div>
    );
  }

  if (error && !photos.length) {
    return <EmptyState title="Could not load this gallery" description={error} />;
  }

  if (!photos.length) {
    return (
      <EmptyState
        title="No photos match this view"
        description="Try a different search term, clear the tag filter, or upload a new batch of images."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="columns-1 gap-5 sm:columns-2 xl:columns-3 2xl:columns-4">
        {photos.map((photo, index) => (
          <PhotoCard key={photo.id} photo={photo} onClick={() => onOpenPhoto(index)} />
        ))}
      </div>

      {loadingMore ? (
        <p className="text-center text-sm text-muted">Loading more photos...</p>
      ) : null}

      {hasMore ? <div ref={sentinelRef} className="h-12 w-full" /> : null}
    </div>
  );
}

export default PhotoGrid;
