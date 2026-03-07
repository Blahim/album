import HeaderBar from "./HeaderBar";
import Sidebar from "./Sidebar";

function AppShell({
  albums,
  children,
  error,
  onOpenUpload,
  onSearchChange,
  onToggleTheme,
  searchValue,
  smartAlbums,
  summary,
  theme
}) {
  return (
    <div className="relative min-h-screen">
      <div className="mx-auto flex w-full max-w-[1600px] gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <aside className="hidden w-[300px] shrink-0 xl:block">
          <div className="sticky top-4">
            <Sidebar albums={albums} smartAlbums={smartAlbums} summary={summary} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <HeaderBar
            onOpenUpload={onOpenUpload}
            onSearchChange={onSearchChange}
            onToggleTheme={onToggleTheme}
            searchValue={searchValue}
            theme={theme}
          />

          <div className="mt-4 xl:hidden">
            <Sidebar compact albums={albums} smartAlbums={smartAlbums} summary={summary} />
          </div>

          {error ? (
            <div className="mt-4 rounded-[24px] border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <main className="mt-6 space-y-6 pb-12">{children}</main>
        </div>
      </div>
    </div>
  );
}

export default AppShell;
