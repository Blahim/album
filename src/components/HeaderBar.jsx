import { LogOut, MoonStar, Search, SunMedium, UploadCloud } from "lucide-react";

function HeaderBar({
  loading,
  onOpenUpload,
  onSearchChange,
  onSignOut,
  onToggleTheme,
  searchValue,
  theme,
  userEmail
}) {
  return (
    <header className="glass-panel sticky top-4 z-30 overflow-hidden px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">
            Personal Cloud Gallery
          </p>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-[2.65rem]">
              Lumen Photos
            </h1>
            <p className="max-w-2xl text-sm text-muted sm:text-base">
              Store personal images, search instantly, and browse them in a cinematic masonry
              gallery.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="input-shell min-w-0 sm:min-w-[340px]">
            <Search className="h-4 w-4 shrink-0 text-muted" />
            <input
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
              placeholder="Search by filename, tags, or date"
            />
          </label>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {userEmail ? (
              <span className="chip max-w-[220px] truncate">
                {loading ? "Syncing library..." : userEmail}
              </span>
            ) : null}

            <button
              type="button"
              onClick={onToggleTheme}
              className="action-button border border-line/70 bg-panel/80 text-text hover:border-accent/60 hover:bg-accentSoft/70"
            >
              {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
              <span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"} mode</span>
            </button>

            <button
              type="button"
              onClick={onOpenUpload}
              className="action-button bg-text text-bg hover:translate-y-[-1px] hover:opacity-95"
            >
              <UploadCloud className="h-4 w-4" />
              Upload
            </button>

            <button
              type="button"
              onClick={() => {
                void onSignOut();
              }}
              className="action-button border border-line/70 bg-panel/80 text-text hover:border-accent/60 hover:bg-accentSoft/70"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default HeaderBar;
