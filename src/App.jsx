import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { fetchAlbums, fetchSummary, fetchTags, invalidateLibraryCache } from "./lib/api";
import { getSession, isSupabaseConfigured, signOut, subscribeToAuthChanges } from "./lib/supabase";
import { useTheme } from "./hooks/useTheme";
import AppShell from "./components/AppShell";
import AuthScreen from "./components/AuthScreen";
import AlbumsPage from "./pages/AlbumsPage";
import GalleryPage from "./pages/GalleryPage";
import UploadPanel from "./upload/UploadPanel";

const EMPTY_LIBRARY_STATE = {
  albums: [],
  smartAlbums: [],
  summary: null,
  tags: [],
  loading: false,
  error: ""
};

function App() {
  const { theme, toggleTheme } = useTheme();
  const [searchValue, setSearchValue] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [libraryState, setLibraryState] = useState(EMPTY_LIBRARY_STATE);
  const [authState, setAuthState] = useState({
    checking: isSupabaseConfigured,
    session: null,
    error: ""
  });

  const refreshLibrary = useCallback(async () => {
    if (!authState.session) {
      setLibraryState(EMPTY_LIBRARY_STATE);
      return;
    }

    try {
      setLibraryState((current) => ({ ...current, loading: true, error: "" }));
      const [albumsResponse, tagsResponse, summaryResponse] = await Promise.all([
        fetchAlbums(),
        fetchTags(),
        fetchSummary()
      ]);

      setLibraryState({
        albums: albumsResponse.items || [],
        smartAlbums: albumsResponse.smartItems || [],
        summary: summaryResponse.item || null,
        tags: tagsResponse.items || [],
        loading: false,
        error: ""
      });
    } catch (error) {
      setLibraryState((current) => ({
        ...current,
        loading: false,
        error: error.message || "Failed to load your library."
      }));
    }
  }, [authState.session]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthState({ checking: false, session: null, error: "" });
      return undefined;
    }

    let active = true;

    getSession()
      .then((session) => {
        if (active) {
          setAuthState({ checking: false, session, error: "" });
        }
      })
      .catch((error) => {
        if (active) {
          setAuthState({ checking: false, session: null, error: error.message || "Auth failed." });
        }
      });

    const subscription = subscribeToAuthChanges((event, session) => {
      invalidateLibraryCache();
      setAuthState({ checking: false, session, error: "" });
      setUploadOpen(false);
      setSearchValue("");
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary, refreshToken]);

  const triggerRefresh = useCallback(() => {
    invalidateLibraryCache();
    setRefreshToken((value) => value + 1);
  }, []);

  const shellProps = useMemo(
    () => ({
      albums: libraryState.albums,
      error: libraryState.error,
      loading: libraryState.loading,
      onOpenUpload: () => setUploadOpen(true),
      onSearchChange: setSearchValue,
      onSignOut: async () => {
        await signOut();
        invalidateLibraryCache();
      },
      onToggleTheme: toggleTheme,
      searchValue,
      smartAlbums: libraryState.smartAlbums,
      summary: libraryState.summary,
      theme,
      userEmail: authState.session?.user?.email || ""
    }),
    [
      authState.session?.user?.email,
      libraryState.albums,
      libraryState.error,
      libraryState.loading,
      libraryState.smartAlbums,
      libraryState.summary,
      searchValue,
      theme,
      toggleTheme
    ]
  );

  if (authState.checking) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-panel-strong w-full max-w-xl px-6 py-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">Lumen Photos</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Preparing your library</h1>
          <p className="mt-3 text-sm text-muted sm:text-base">
            Restoring the authenticated session and reconnecting to Supabase.
          </p>
        </div>
      </div>
    );
  }

  if (!isSupabaseConfigured || !authState.session) {
    return <AuthScreen configured={isSupabaseConfigured} theme={theme} onToggleTheme={toggleTheme} />;
  }

  return (
    <>
      <AppShell {...shellProps}>
        <Routes>
          <Route
            path="/"
            element={
              <GalleryPage
                albums={libraryState.albums}
                searchValue={searchValue}
                smartAlbums={libraryState.smartAlbums}
                summary={libraryState.summary}
                tags={libraryState.tags}
                refreshToken={refreshToken}
                onLibraryChange={triggerRefresh}
              />
            }
          />
          <Route
            path="/albums"
            element={
              <AlbumsPage
                albums={libraryState.albums}
                searchValue={searchValue}
                smartAlbums={libraryState.smartAlbums}
                onLibraryChange={triggerRefresh}
              />
            }
          />
          <Route
            path="/albums/:albumId"
            element={
              <GalleryPage
                albums={libraryState.albums}
                searchValue={searchValue}
                smartAlbums={libraryState.smartAlbums}
                summary={libraryState.summary}
                tags={libraryState.tags}
                refreshToken={refreshToken}
                onLibraryChange={triggerRefresh}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>

      <UploadPanel
        open={uploadOpen}
        albums={libraryState.albums}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setUploadOpen(false);
          triggerRefresh();
        }}
      />
    </>
  );
}

export default App;
