import { format } from "date-fns";
import { extractImageMetadata } from "./browser-metadata";
import { getCurrentUser, getSupabase, STORAGE_BUCKET } from "./supabase";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const QUERY_PAGE_SIZE = 500;
const signedUrlCache = new Map();

let libraryCache = null;
let libraryCachePromise = null;
let libraryCacheUserId = null;

function sanitizeBaseName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeTag(tag) {
  return String(tag || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

function dedupeTags(tags) {
  return [...new Set((tags || []).map(normalizeTag).filter(Boolean))];
}

function deriveTagsFromFilename(filename) {
  const name = String(filename || "").replace(/\.[^.]+$/, "");
  return dedupeTags(
    name
      .split(/[\s_.-]+/)
      .filter((part) => part.length > 2 && !/^\d+$/.test(part))
      .slice(0, 6)
  );
}

function parseDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPhotoTimestamp(photo) {
  return photo.capturedAt || photo.uploadedAt || photo.createdAt;
}

function sortPhotos(photos) {
  return [...photos].sort((left, right) => {
    const rightDate = parseDate(getPhotoTimestamp(right))?.getTime() || 0;
    const leftDate = parseDate(getPhotoTimestamp(left))?.getTime() || 0;
    return rightDate - leftDate;
  });
}

function buildDateSearchIndex(dateValue) {
  const parsed = parseDate(dateValue);

  if (!parsed) {
    return "";
  }

  return [format(parsed, "yyyy-MM-dd"), format(parsed, "MMMM yyyy"), format(parsed, "MMM d, yyyy")]
    .join(" ")
    .toLowerCase();
}

function getMonthKey(dateValue) {
  const parsed = parseDate(dateValue);
  return parsed ? format(parsed, "yyyy-MM") : "";
}

function buildTagSummary(photos) {
  const counts = new Map();

  for (const photo of photos) {
    for (const tag of photo.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

function buildSummary(photos, albums) {
  const totalSize = photos.reduce((sum, photo) => sum + (photo.size || 0), 0);
  const newest = sortPhotos(photos)[0];

  return {
    totalPhotos: photos.length,
    totalAlbums: albums.length,
    totalTags: buildTagSummary(photos).length,
    totalSize,
    newestCapture: newest ? getPhotoTimestamp(newest) : null
  };
}

function deriveDateAlbums(photos) {
  const grouped = new Map();

  for (const photo of sortPhotos(photos)) {
    const timestamp = parseDate(getPhotoTimestamp(photo));

    if (!timestamp) {
      continue;
    }

    const key = format(timestamp, "yyyy-MM");
    const current = grouped.get(key) || {
      id: `date:${key}`,
      key,
      label: format(timestamp, "MMMM yyyy"),
      type: "smart",
      photoCount: 0,
      coverUrl: null,
      rangeLabel: format(timestamp, "MMMM yyyy")
    };

    current.photoCount += 1;
    current.coverUrl = current.coverUrl || photo.url;
    grouped.set(key, current);
  }

  return [...grouped.values()].sort((left, right) => right.key.localeCompare(left.key));
}

function photoMatchesFilters(photo, albumsById, filters) {
  const timestamp = getPhotoTimestamp(photo);
  const albumNames = (photo.albums || [])
    .map((albumId) => albumsById.get(albumId)?.name)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (filters.albumId) {
    if (filters.albumId.startsWith("date:")) {
      const monthKey = getMonthKey(timestamp);

      if (`date:${monthKey}` !== filters.albumId) {
        return false;
      }
    } else if (!(photo.albums || []).includes(filters.albumId)) {
      return false;
    }
  }

  if (filters.tag && !(photo.tags || []).includes(filters.tag)) {
    return false;
  }

  if (!filters.search) {
    return true;
  }

  const searchIndex = [
    photo.filename,
    photo.originalName,
    (photo.tags || []).join(" "),
    albumNames,
    buildDateSearchIndex(timestamp)
  ]
    .join(" ")
    .toLowerCase();

  return searchIndex.includes(filters.search);
}

async function fetchAllRows(queryFactory) {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + QUERY_PAGE_SIZE - 1;
    const { data, error } = await queryFactory().range(from, to);

    if (error) {
      throw error;
    }

    const batch = data || [];
    rows.push(...batch);

    if (batch.length < QUERY_PAGE_SIZE) {
      return rows;
    }

    from += QUERY_PAGE_SIZE;
  }
}

function fileExtension(filename) {
  const parts = String(filename || "").split(".");
  return parts.length > 1 ? parts.at(-1).toLowerCase() : "jpg";
}

function buildStoragePath(userId, file) {
  const now = new Date();
  const safeBase = sanitizeBaseName(file.name.replace(/\.[^.]+$/, "")) || "photo";
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const ext = fileExtension(file.name);

  return [userId, format(now, "yyyy"), format(now, "MM"), `${safeBase}-${token}.${ext}`].join("/");
}

async function createSignedUrl(storagePath) {
  if (!storagePath) {
    return null;
  }

  const cached = signedUrlCache.get(storagePath);

  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.url;
  }

  const bucket = getSupabase().storage.from(STORAGE_BUCKET);
  const { data, error } = await bucket.createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error) {
    throw error;
  }

  const url = data?.signedUrl || data?.signedURL || null;

  if (!url) {
    throw new Error(`Could not create a signed URL for ${storagePath}.`);
  }

  signedUrlCache.set(storagePath, {
    url,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000
  });

  return url;
}

async function resolveSignedUrlMap(storagePaths) {
  const uniquePaths = [...new Set((storagePaths || []).filter(Boolean))];
  const uncached = uniquePaths.filter((path) => {
    const cached = signedUrlCache.get(path);
    return !cached || cached.expiresAt <= Date.now() + 60_000;
  });

  if (uncached.length) {
    const bucket = getSupabase().storage.from(STORAGE_BUCKET);

    for (let index = 0; index < uncached.length; index += 25) {
      const batch = uncached.slice(index, index + 25);
      let handledInBatch = false;

      if (typeof bucket.createSignedUrls === "function") {
        const { data, error } = await bucket.createSignedUrls(batch, SIGNED_URL_TTL_SECONDS);

        if (!error && Array.isArray(data)) {
          data.forEach((item, itemIndex) => {
            const path = item?.path || batch[itemIndex];
            const url = item?.signedUrl || item?.signedURL || null;

            if (path && url) {
              signedUrlCache.set(path, {
                url,
                expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000
              });
            }
          });
          handledInBatch = true;
        }
      }

      if (!handledInBatch) {
        await Promise.all(batch.map((path) => createSignedUrl(path)));
      }
    }
  }

  return new Map(
    uniquePaths.map((path) => [path, signedUrlCache.get(path)?.url || null])
  );
}

function mapPhotoRow(row, albumIdsByPhotoId, urlByPath) {
  const width = row.width || null;
  const height = row.height || null;

  return {
    id: row.id,
    filename: row.filename,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: row.size,
    width,
    height,
    resolution: row.resolution || (width && height ? `${width}x${height}` : null),
    capturedAt: row.captured_at,
    uploadedAt: row.uploaded_at,
    createdAt: row.created_at,
    storagePath: row.storage_path,
    url: urlByPath.get(row.storage_path) || null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    albums: albumIdsByPhotoId.get(row.id) || [],
    aspectRatio: width && height ? Number((width / height).toFixed(4)) : null
  };
}

function mapAlbumRow(row, albumPhotoIdsByAlbumId, photosById) {
  const photoIds = albumPhotoIdsByAlbumId.get(row.id) || [];
  const coverPhoto = photosById.get(row.cover_photo_id) || photosById.get(photoIds[0]);

  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    coverPhotoId: row.cover_photo_id,
    photoIds,
    coverUrl: coverPhoto?.url || null,
    photoCount: photoIds.length
  };
}

async function loadLibrary({ force = false } = {}) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Sign in to access your library.");
  }

  if (!force && libraryCache && libraryCacheUserId === user.id) {
    return libraryCache;
  }

  if (libraryCachePromise) {
    return libraryCachePromise;
  }

  libraryCachePromise = (async () => {
    const supabase = getSupabase();
    const [photoRows, albumRows, albumLinkRows] = await Promise.all([
      fetchAllRows(() =>
        supabase.from("photos").select("*").order("uploaded_at", { ascending: false }).order("id", { ascending: false })
      ),
      fetchAllRows(() =>
        supabase.from("albums").select("*").order("created_at", { ascending: false }).order("id", { ascending: false })
      ),
      fetchAllRows(() =>
        supabase
          .from("album_photos")
          .select("album_id, photo_id")
          .order("created_at", { ascending: false })
          .order("photo_id", { ascending: false })
      )
    ]);

    const albumIdsByPhotoId = new Map();
    const albumPhotoIdsByAlbumId = new Map();

    for (const link of albumLinkRows) {
      const photoAlbumIds = albumIdsByPhotoId.get(link.photo_id) || [];
      photoAlbumIds.push(link.album_id);
      albumIdsByPhotoId.set(link.photo_id, photoAlbumIds);

      const albumPhotoIds = albumPhotoIdsByAlbumId.get(link.album_id) || [];
      albumPhotoIds.push(link.photo_id);
      albumPhotoIdsByAlbumId.set(link.album_id, albumPhotoIds);
    }

    const urlByPath = await resolveSignedUrlMap(photoRows.map((row) => row.storage_path));
    const photos = sortPhotos(
      photoRows.map((row) => mapPhotoRow(row, albumIdsByPhotoId, urlByPath))
    );
    const photosById = new Map(photos.map((photo) => [photo.id, photo]));
    const albums = albumRows
      .map((row) => mapAlbumRow(row, albumPhotoIdsByAlbumId, photosById))
      .sort((left, right) => {
        const rightDate = parseDate(right.createdAt)?.getTime() || 0;
        const leftDate = parseDate(left.createdAt)?.getTime() || 0;
        return rightDate - leftDate;
      });

    const library = {
      photos,
      albums,
      smartAlbums: deriveDateAlbums(photos),
      tags: buildTagSummary(photos),
      summary: buildSummary(photos, albums)
    };

    libraryCache = library;
    libraryCacheUserId = user.id;

    return library;
  })();

  try {
    return await libraryCachePromise;
  } finally {
    libraryCachePromise = null;
  }
}

export function invalidateLibraryCache() {
  libraryCache = null;
  libraryCachePromise = null;
  libraryCacheUserId = null;
  signedUrlCache.clear();
}

export function getAssetUrl(url) {
  return url || "";
}

export async function fetchPhotos(params = {}) {
  const library = await loadLibrary();
  const albumsById = new Map(library.albums.map((album) => [album.id, album]));
  const filters = {
    albumId: typeof params.albumId === "string" ? params.albumId : "",
    search: typeof params.search === "string" ? params.search.trim().toLowerCase() : "",
    tag: typeof params.tag === "string" ? normalizeTag(params.tag) : ""
  };
  const cursor = Number.parseInt(params.cursor, 10) || 0;
  const limit = Math.max(1, Math.min(Number.parseInt(params.limit, 10) || 24, 60));
  const filtered = library.photos.filter((photo) => photoMatchesFilters(photo, albumsById, filters));
  const items = filtered.slice(cursor, cursor + limit);

  return {
    items,
    nextCursor: cursor + limit < filtered.length ? cursor + limit : null,
    total: filtered.length
  };
}

export async function fetchAlbums() {
  const library = await loadLibrary();

  return {
    items: library.albums,
    smartItems: library.smartAlbums
  };
}

export async function fetchTags() {
  const library = await loadLibrary();
  return { items: library.tags };
}

export async function fetchSummary() {
  const library = await loadLibrary();
  return { item: library.summary };
}

export async function createAlbum(name) {
  const trimmedName = String(name || "").trim();

  if (!trimmedName) {
    throw new Error("Album name is required.");
  }

  const { data, error } = await getSupabase()
    .from("albums")
    .insert({ name: trimmedName })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  invalidateLibraryCache();

  return {
    item: {
      id: data.id,
      name: data.name,
      createdAt: data.created_at,
      coverPhotoId: data.cover_photo_id,
      photoIds: [],
      coverUrl: null,
      photoCount: 0
    }
  };
}

async function ensureAlbumCover(albumId, fallbackPhotoId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("albums")
    .select("cover_photo_id")
    .eq("id", albumId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.cover_photo_id && fallbackPhotoId) {
    const { error: updateError } = await supabase
      .from("albums")
      .update({ cover_photo_id: fallbackPhotoId })
      .eq("id", albumId);

    if (updateError) {
      throw updateError;
    }
  }
}

export async function addPhotosToAlbum(albumId, photoIds) {
  const uniqueIds = [...new Set((photoIds || []).filter(Boolean))];

  if (!albumId || !uniqueIds.length) {
    throw new Error("Album and photo ids are required.");
  }

  const rows = uniqueIds.map((photoId) => ({ album_id: albumId, photo_id: photoId }));
  const { error } = await getSupabase().from("album_photos").upsert(rows, {
    onConflict: "album_id,photo_id"
  });

  if (error) {
    throw error;
  }

  await ensureAlbumCover(albumId, uniqueIds[0]);
  invalidateLibraryCache();

  return { item: { id: albumId } };
}

export async function updatePhotoTags(photoId, tags) {
  const sanitizedTags = dedupeTags(tags);
  const currentLibrary = await loadLibrary();
  const existingPhoto = currentLibrary.photos.find((photo) => photo.id === photoId);
  const { data, error } = await getSupabase()
    .from("photos")
    .update({ tags: sanitizedTags })
    .eq("id", photoId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  invalidateLibraryCache();

  return {
    item: {
      ...(existingPhoto || {}),
      id: data.id,
      filename: data.filename,
      originalName: data.original_name,
      mimeType: data.mime_type,
      size: data.size,
      width: data.width,
      height: data.height,
      resolution: data.resolution,
      capturedAt: data.captured_at,
      uploadedAt: data.uploaded_at,
      createdAt: data.created_at,
      storagePath: data.storage_path,
      url: existingPhoto?.url || (await createSignedUrl(data.storage_path)),
      tags: Array.isArray(data.tags) ? data.tags : [],
      albums: existingPhoto?.albums || [],
      aspectRatio:
        data.width && data.height ? Number((data.width / data.height).toFixed(4)) : null
    }
  };
}

export async function uploadPhotos({ files, albumId, tags }) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Sign in to upload photos.");
  }

  const supabase = getSupabase();
  const uploadedRows = [];
  const normalizedTags = dedupeTags(tags || []);

  for (const file of files || []) {
    const storagePath = buildStoragePath(user.id, file);
    const metadata = await extractImageMetadata(file);
    const mergedTags = dedupeTags([...deriveTagsFromFilename(file.name), ...normalizedTags]);

    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600"
    });

    if (uploadError) {
      throw uploadError;
    }

    const insertRow = {
      filename: storagePath.split("/").at(-1),
      original_name: file.name,
      mime_type: file.type || "image/jpeg",
      size: file.size,
      width: metadata.width,
      height: metadata.height,
      resolution: metadata.resolution,
      captured_at: metadata.capturedAt,
      uploaded_at: new Date().toISOString(),
      storage_path: storagePath,
      tags: mergedTags
    };

    const { data, error: insertError } = await supabase
      .from("photos")
      .insert(insertRow)
      .select("*")
      .single();

    if (insertError) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      throw insertError;
    }

    uploadedRows.push(data);
  }

  if (albumId && uploadedRows.length) {
    const { error } = await supabase.from("album_photos").upsert(
      uploadedRows.map((row) => ({ album_id: albumId, photo_id: row.id })),
      { onConflict: "album_id,photo_id" }
    );

    if (error) {
      throw error;
    }

    await ensureAlbumCover(albumId, uploadedRows[0].id);
  }

  const urlByPath = await resolveSignedUrlMap(uploadedRows.map((row) => row.storage_path));
  invalidateLibraryCache();

  return {
    items: uploadedRows.map((row) => ({
      id: row.id,
      filename: row.filename,
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: row.size,
      width: row.width,
      height: row.height,
      resolution: row.resolution,
      capturedAt: row.captured_at,
      uploadedAt: row.uploaded_at,
      createdAt: row.created_at,
      storagePath: row.storage_path,
      url: urlByPath.get(row.storage_path) || null,
      tags: Array.isArray(row.tags) ? row.tags : [],
      albums: albumId ? [albumId] : [],
      aspectRatio:
        row.width && row.height ? Number((row.width / row.height).toFixed(4)) : null
    })),
    message: `${uploadedRows.length} photo${uploadedRows.length === 1 ? "" : "s"} uploaded.`
  };
}
