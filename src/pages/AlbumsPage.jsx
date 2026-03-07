import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AlbumCard from "../components/AlbumCard";
import EmptyState from "../components/EmptyState";
import SectionHeader from "../components/SectionHeader";
import { createAlbum } from "../lib/api";

function AlbumsPage({ albums, searchValue, smartAlbums, onLibraryChange }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const searchTerm = searchValue.trim().toLowerCase();
  const filteredAlbums = useMemo(
    () => albums.filter((album) => (album.name || "").toLowerCase().includes(searchTerm)),
    [albums, searchTerm]
  );
  const filteredSmartAlbums = useMemo(
    () => smartAlbums.filter((album) => (album.label || "").toLowerCase().includes(searchTerm)),
    [smartAlbums, searchTerm]
  );

  async function handleCreateAlbum(event) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Give the album a name before creating it.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const response = await createAlbum(name.trim());
      setName("");
      onLibraryChange();
      navigate(`/albums/${encodeURIComponent(response.item.id)}`);
    } catch (requestError) {
      setError(requestError.message || "Failed to create album.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.25fr,0.95fr]">
        <div className="glass-panel-strong space-y-4 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
            Albums
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Collect trips, projects, and family moments into clean stories.
          </h2>
          <p className="max-w-2xl text-sm text-muted sm:text-base">
            Custom albums stay editable, while automatic monthly albums keep your timeline organized
            with zero manual work.
          </p>
        </div>

        <form onSubmit={handleCreateAlbum} className="glass-panel space-y-4 px-6 py-6">
          <SectionHeader
            eyebrow="Create"
            title="Start a new album"
            description="Name a collection and begin adding photos from the fullscreen viewer."
          />

          <label className="input-shell">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Weekend in Lisbon"
              className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
            />
          </label>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="action-button w-full bg-text text-bg hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {submitting ? "Creating..." : "Create album"}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Custom"
          title="Manual collections"
          description="Your hand-picked albums with cover previews and editable membership."
        />

        {filteredAlbums.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredAlbums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No matching albums"
            description={
              searchTerm
                ? "The current search does not match any custom album names."
                : "Create your first album to start collecting photos by story."
            }
          />
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Automatic"
          title="Timeline albums"
          description="Date-based groupings generated automatically from captured or uploaded metadata."
        />

        {filteredSmartAlbums.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredSmartAlbums.map((album) => (
              <AlbumCard key={album.id} album={album} smart />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No timeline albums yet"
            description="Once photos exist in the library, monthly date albums will appear here."
          />
        )}
      </section>
    </div>
  );
}

export default AlbumsPage;
