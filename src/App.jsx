import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { fetchAlbums, fetchSummary, fetchTags } from "./lib/api";
import { useTheme } from "./hooks/useTheme";
import AppShell from "./components/AppShell";
import AlbumsPage from "./pages/AlbumsPage";
import GalleryPage from "./pages/GalleryPage";
import UploadPanel from "./upload/UploadPanel";

function App() {
  const { theme, toggleTheme } = useTheme();
  const [searchValue, setSearchValue] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [libraryState, setLibraryState] = useState({
    albums: [],
    smartAlbums: [],
    summary: null,
    tags: [],
    loading: true,
    error: ""
  });

  const refreshLibrary = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary, refreshToken]);

  const triggerRefresh = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  const shellProps = useMemo(
    () => ({
      albums: libraryState.albums,
      error: libraryState.error,
      onOpenUpload: () => setUploadOpen(true),
      onSearchChange: setSearchValue,
      onToggleTheme: toggleTheme,
      searchValue,
      smartAlbums: libraryState.smartAlbums,
      summary: libraryState.summary,
      theme
    }),
    [
      libraryState.albums,
      libraryState.error,
      libraryState.smartAlbums,
      libraryState.summary,
      searchValue,
      theme,
      toggleTheme
    ]
  );

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
