const path = require("path");
const exifr = require("exifr");
const sizeOf = require("image-size");

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
  return [...new Set(tags.map(normalizeTag).filter(Boolean))];
}

function deriveTagsFromFilename(filename) {
  const name = path.parse(filename || "").name;
  const chunks = name
    .split(/[\s_.-]+/)
    .filter((part) => part.length > 2 && !/^\d+$/.test(part))
    .slice(0, 6);

  return dedupeTags(chunks);
}

async function extractImageMetadata(filePath, fallbackTimestamp) {
  let width = null;
  let height = null;

  try {
    const dimensions = sizeOf(filePath);
    width = dimensions?.width || null;
    height = dimensions?.height || null;
  } catch (error) {
    width = null;
    height = null;
  }

  let capturedAt = fallbackTimestamp;

  try {
    const exif = await exifr.parse(filePath, ["DateTimeOriginal", "CreateDate"]);
    const sourceDate = exif?.DateTimeOriginal || exif?.CreateDate;

    if (sourceDate) {
      capturedAt = new Date(sourceDate).toISOString();
    }
  } catch (error) {
    capturedAt = fallbackTimestamp;
  }

  return {
    capturedAt,
    height,
    resolution: width && height ? `${width}x${height}` : null,
    width
  };
}

module.exports = {
  dedupeTags,
  deriveTagsFromFilename,
  extractImageMetadata,
  normalizeTag,
  sanitizeBaseName
};
