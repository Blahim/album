const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function buildUrl(path) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${API_BASE}${path}`;
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

function withQuery(path, params) {
  const searchParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

export function getAssetUrl(relativeUrl) {
  return buildUrl(relativeUrl);
}

export function fetchPhotos(params) {
  return request(withQuery("/api/photos", params));
}

export function fetchAlbums() {
  return request("/api/albums");
}

export function fetchTags() {
  return request("/api/tags");
}

export function fetchSummary() {
  return request("/api/summary");
}

export function createAlbum(name) {
  return request("/api/albums", {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export function addPhotosToAlbum(albumId, photoIds) {
  return request(`/api/albums/${albumId}/photos`, {
    method: "POST",
    body: JSON.stringify({ photoIds })
  });
}

export function updatePhotoTags(photoId, tags) {
  return request(`/api/photos/${photoId}/tags`, {
    method: "PATCH",
    body: JSON.stringify({ tags })
  });
}

export function uploadPhotos({ files, albumId, tags }) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  if (albumId) {
    formData.append("albumId", albumId);
  }

  if (tags?.length) {
    formData.append("tags", tags.join(","));
  }

  return request("/api/upload", {
    method: "POST",
    body: formData
  });
}
