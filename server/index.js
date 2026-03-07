const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { format } = require("date-fns");

const {
  dedupeTags,
  deriveTagsFromFilename,
  extractImageMetadata,
  normalizeTag,
  sanitizeBaseName
} = require("./lib/metadata");
const {
  ensureDir,
  ensureJsonFile,
  readJson,
  toUnixPath,
  writeJson
} = require("./lib/store");

const app = express();

const ROOT_DIR = path.resolve(__dirname, "..");
const PHOTOS_DIR = path.join(ROOT_DIR, "photos");
const STORAGE_DIR = path.join(ROOT_DIR, "storage");
const PHOTOS_FILE = path.join(STORAGE_DIR, "photos.json");
const ALBUMS_FILE = path.join(STORAGE_DIR, "albums.json");
const DIST_DIR = path.join(ROOT_DIR, "dist");

const PORT = Number(process.env.PORT || 3001);
const UPLOAD_LIMIT_MB = Number(process.env.UPLOAD_LIMIT_MB || 25);
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getPhotoTimestamp(photo) {
  return photo.capturedAt || photo.uploadedAt || photo.createdAt;
}

function parseDate(dateValue) {
  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

  return [
    format(parsed, "yyyy-MM-dd"),
    format(parsed, "MMMM yyyy"),
    format(parsed, "MMM d, yyyy")
  ]
    .join(" ")
    .toLowerCase();
}

function getMonthKey(dateValue) {
  const parsed = parseDate(dateValue);
  return parsed ? format(parsed, "yyyy-MM") : "";
}

function createAlbumId() {
  return `album_${crypto.randomUUID().slice(0, 12)}`;
}

function createFileToken() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

function buildPhotoResponse(photo) {
  return {
    ...photo,
    aspectRatio:
      photo.width && photo.height ? Number((photo.width / photo.height).toFixed(4)) : null
  };
}

function buildAlbumResponse(album, photosById) {
  const coverPhoto = photosById.get(album.coverPhotoId) || photosById.get(album.photoIds?.[0]);

  return {
    ...album,
    coverUrl: coverPhoto?.url || null,
    photoCount: album.photoIds?.length || 0
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

function getTagSummary(photos) {
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

function getSummary(photos, albums) {
  const totalSize = photos.reduce((sum, photo) => sum + (photo.size || 0), 0);
  const newest = sortPhotos(photos)[0];

  return {
    totalPhotos: photos.length,
    totalAlbums: albums.length,
    totalTags: getTagSummary(photos).length,
    totalSize,
    newestCapture: newest ? getPhotoTimestamp(newest) : null
  };
}

function parseTagInput(input) {
  if (Array.isArray(input)) {
    return dedupeTags(input);
  }

  if (typeof input === "string") {
    return dedupeTags(input.split(","));
  }

  return [];
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

  if (filters.date) {
    const dateIndex = buildDateSearchIndex(timestamp);
    if (!dateIndex.includes(filters.date)) {
      return false;
    }
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

function mapPhotosById(photos) {
  return new Map(photos.map((photo) => [photo.id, photo]));
}

async function bootstrap() {
  await ensureDir(PHOTOS_DIR);
  await ensureJsonFile(PHOTOS_FILE, []);
  await ensureJsonFile(ALBUMS_FILE, []);
}

async function loadLibrary() {
  const [photos, albums] = await Promise.all([
    readJson(PHOTOS_FILE, []),
    readJson(ALBUMS_FILE, [])
  ]);

  return {
    albums,
    photos
  };
}

async function saveLibrary({ photos, albums }) {
  await Promise.all([writeJson(PHOTOS_FILE, photos), writeJson(ALBUMS_FILE, albums)]);
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    const folder = path.join(
      PHOTOS_DIR,
      format(new Date(), "yyyy"),
      format(new Date(), "MM")
    );

    fs.mkdirSync(folder, { recursive: true });
    callback(null, folder);
  },
  filename(req, file, callback) {
    const original = path.parse(file.originalname);
    const safeBase = sanitizeBaseName(original.name) || "photo";
    const ext = (original.ext || "").toLowerCase();
    callback(null, `${safeBase}-${createFileToken()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: UPLOAD_LIMIT_MB * 1024 * 1024,
    files: 40
  },
  fileFilter(req, file, callback) {
    if (ALLOWED_TYPES.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error("Only jpg, png, and webp files are supported."));
  }
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/photos", express.static(PHOTOS_DIR));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/photos", async (req, res, next) => {
  try {
    const { photos, albums } = await loadLibrary();
    const albumsById = new Map(albums.map((album) => [album.id, album]));
    const filters = {
      albumId: typeof req.query.albumId === "string" ? req.query.albumId : "",
      date: typeof req.query.date === "string" ? req.query.date.trim().toLowerCase() : "",
      search:
        typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "",
      tag: typeof req.query.tag === "string" ? normalizeTag(req.query.tag) : ""
    };
    const cursor = Number.parseInt(req.query.cursor, 10) || 0;
    const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit, 10) || 24, 60));

    const filtered = sortPhotos(photos)
      .filter((photo) => photoMatchesFilters(photo, albumsById, filters))
      .map(buildPhotoResponse);

    const items = filtered.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < filtered.length ? cursor + limit : null;

    res.json({
      items,
      nextCursor,
      total: filtered.length
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/photos/:photoId", async (req, res, next) => {
  try {
    const { photos } = await loadLibrary();
    const photo = photos.find((item) => item.id === req.params.photoId);

    if (!photo) {
      res.status(404).json({ error: "Photo not found." });
      return;
    }

    res.json({ item: buildPhotoResponse(photo) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/upload", upload.array("files", 40), async (req, res, next) => {
  try {
    const files = req.files || [];

    if (!files.length) {
      res.status(400).json({ error: "Select at least one image to upload." });
      return;
    }

    const { photos, albums } = await loadLibrary();
    const requestedAlbumId = typeof req.body.albumId === "string" ? req.body.albumId : "";
    const albumId = albums.some((item) => item.id === requestedAlbumId) ? requestedAlbumId : "";
    const extraTags = parseTagInput(req.body.tags);
    const uploadedAt = new Date().toISOString();

    const items = [];

    for (const file of files) {
      const relativePath = path.relative(ROOT_DIR, file.path);
      const metadata = await extractImageMetadata(file.path, uploadedAt);
      const tags = dedupeTags([...deriveTagsFromFilename(file.originalname), ...extraTags]);
      const photo = {
        id: crypto.randomUUID(),
        filename: path.basename(file.filename),
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        width: metadata.width,
        height: metadata.height,
        resolution: metadata.resolution,
        capturedAt: metadata.capturedAt,
        uploadedAt,
        relativePath: toUnixPath(relativePath),
        url: `/${toUnixPath(relativePath)}`,
        albums: albumId ? [albumId] : [],
        tags
      };

      photos.push(photo);
      items.push(buildPhotoResponse(photo));
    }

    if (albumId) {
      const album = albums.find((item) => item.id === albumId);

      if (album) {
        const newIds = items.map((photo) => photo.id);
        album.photoIds = [...new Set([...(album.photoIds || []), ...newIds])];
        album.coverPhotoId = album.coverPhotoId || newIds[0] || null;
      }
    }

    await saveLibrary({ photos, albums });

    res.status(201).json({
      items,
      message: `${items.length} photo${items.length === 1 ? "" : "s"} uploaded.`
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/photos/:photoId/tags", async (req, res, next) => {
  try {
    const { photos, albums } = await loadLibrary();
    const photo = photos.find((item) => item.id === req.params.photoId);

    if (!photo) {
      res.status(404).json({ error: "Photo not found." });
      return;
    }

    photo.tags = parseTagInput(req.body.tags);
    await saveLibrary({ photos, albums });

    res.json({ item: buildPhotoResponse(photo) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/albums", async (req, res, next) => {
  try {
    const { photos, albums } = await loadLibrary();
    const photosById = mapPhotosById(photos);

    res.json({
      items: albums.map((album) => buildAlbumResponse(album, photosById)),
      smartItems: deriveDateAlbums(photos)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/albums", async (req, res, next) => {
  try {
    const { photos, albums } = await loadLibrary();
    const name = String(req.body.name || "").trim();

    if (!name) {
      res.status(400).json({ error: "Album name is required." });
      return;
    }

    const album = {
      id: createAlbumId(),
      name,
      coverPhotoId: null,
      createdAt: new Date().toISOString(),
      photoIds: []
    };

    albums.unshift(album);
    await saveLibrary({ photos, albums });

    res.status(201).json({ item: album });
  } catch (error) {
    next(error);
  }
});

app.post("/api/albums/:albumId/photos", async (req, res, next) => {
  try {
    const { photos, albums } = await loadLibrary();
    const album = albums.find((item) => item.id === req.params.albumId);
    const requestedIds = Array.isArray(req.body.photoIds) ? req.body.photoIds : [];

    if (!album) {
      res.status(404).json({ error: "Album not found." });
      return;
    }

    const uniqueIds = [...new Set(requestedIds)].filter((photoId) =>
      photos.some((photo) => photo.id === photoId)
    );

    album.photoIds = [...new Set([...(album.photoIds || []), ...uniqueIds])];
    album.coverPhotoId = album.coverPhotoId || uniqueIds[0] || null;

    for (const photo of photos) {
      if (uniqueIds.includes(photo.id)) {
        photo.albums = [...new Set([...(photo.albums || []), album.id])];
      }
    }

    await saveLibrary({ photos, albums });

    res.json({
      item: buildAlbumResponse(album, mapPhotosById(photos))
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/tags", async (req, res, next) => {
  try {
    const { photos } = await loadLibrary();
    res.json({ items: getTagSummary(photos) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/summary", async (req, res, next) => {
  try {
    const { photos, albums } = await loadLibrary();
    res.json({ item: getSummary(photos, albums) });
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/photos")) {
      next();
      return;
    }

    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const message =
    error.message || "The server ran into an unexpected error while handling the request.";

  res.status(statusCode).json({ error: message });
});

bootstrap()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Lumen Photos API listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to bootstrap Lumen Photos", error);
    process.exit(1);
  });
