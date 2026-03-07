import { Album, HardDrive, Images, LayoutGrid, Sparkles, Tags } from "lucide-react";
import { NavLink } from "react-router-dom";
import { formatAlbumDate, formatBytes } from "../lib/format";

function Sidebar({ albums, compact = false, smartAlbums, summary }) {
  const topSmartAlbums = smartAlbums.slice(0, compact ? 3 : 4);

  if (compact) {
    return (
      <div className="glass-panel space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2">
          <NavItem compact to="/" label="Moments" icon={<LayoutGrid className="h-4 w-4" />} />
          <NavItem compact to="/albums" label="Albums" icon={<Album className="h-4 w-4" />} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            icon={<Images className="h-4 w-4" />}
            label="Photos"
            value={summary?.totalPhotos ?? 0}
          />
          <SummaryCard
            icon={<Album className="h-4 w-4" />}
            label="Albums"
            value={albums.length}
          />
          <SummaryCard
            icon={<HardDrive className="h-4 w-4" />}
            label="Storage"
            value={formatBytes(summary?.totalSize ?? 0)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel space-y-6 px-5 py-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">Library</p>
        <h2 className="font-display text-2xl font-bold">Browse by story, not folders.</h2>
      </div>

      <nav className="space-y-2">
        <NavItem to="/" label="Moments" icon={<LayoutGrid className="h-4 w-4" />} />
        <NavItem to="/albums" label="Albums" icon={<Album className="h-4 w-4" />} />
      </nav>

      <div className="grid gap-3">
        <SummaryCard
          icon={<Images className="h-4 w-4" />}
          label="Photos"
          value={summary?.totalPhotos ?? 0}
        />
        <SummaryCard
          icon={<Album className="h-4 w-4" />}
          label="Custom albums"
          value={albums.length}
        />
        <SummaryCard
          icon={<Tags className="h-4 w-4" />}
          label="Tags"
          value={summary?.totalTags ?? 0}
        />
        <SummaryCard
          icon={<HardDrive className="h-4 w-4" />}
          label="Storage"
          value={formatBytes(summary?.totalSize ?? 0)}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold text-text">Auto-organized by date</p>
        </div>
        <div className="space-y-2">
          {topSmartAlbums.length ? (
            topSmartAlbums.map((album) => (
              <NavItem
                key={album.id}
                to={`/albums/${encodeURIComponent(album.id)}`}
                label={album.label}
                description={formatAlbumDate(album.key)}
                icon={<span className="h-2 w-2 rounded-full bg-accent" />}
              />
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-line/70 px-4 py-3 text-sm text-muted">
              Upload your first batch of photos to generate timeline albums.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function NavItem({ compact = false, description, icon, label, to }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 rounded-2xl border transition",
          compact
            ? "px-4 py-2.5"
            : "px-4 py-3",
          isActive
            ? "border-accent/50 bg-accentSoft/80 text-text"
            : "border-line/70 bg-panel/70 text-muted hover:border-accent/35 hover:bg-panel"
        ].join(" ")
      }
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface/80 text-text">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-current">{label}</span>
        {description ? <span className="block truncate text-xs text-muted">{description}</span> : null}
      </span>
    </NavLink>
  );
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="rounded-[22px] border border-line/70 bg-panel/80 px-4 py-3">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-accentSoft text-accent">
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-text">{value}</p>
    </div>
  );
}

export default Sidebar;
