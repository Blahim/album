import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import exifr from "exifr";
import sizeOf from "image-size";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const supabaseUrl = process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const targetUserId = process.env.SUPABASE_TARGET_USER_ID || "";
const bucketName = process.env.SUPABASE_BUCKET || "photos";
const localPhotosDir = path.resolve(ROOT_DIR, process.env.LOCAL_PHOTOS_DIR || "photos");

function assertEnv() {
  const missing = [];

  if (!supabaseUrl) {
    missing.push("SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!targetUserId) {
    missing.push("SUPABASE_TARGET_USER_ID");
  }

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

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
  const name = path.parse(filename || "").name;
  return dedupeTags(
    name
      .split(/[\s_.-]+/)
      .filter((part) => part.length > 2 && !/^\d+$/.test(part))
      .slice(0, 6)
  );
}

async function collectFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
      continue;
    }

    if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function extractMetadata(filePath, stats) {
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

  let capturedAt = new Date(stats.mtimeMs || Date.now()).toISOString();

  try {
    const exif = await exifr.parse(filePath, ["DateTimeOriginal", "CreateDate"]);
    const sourceDate = exif?.DateTimeOriginal || exif?.CreateDate;

    if (sourceDate) {
      capturedAt = new Date(sourceDate).toISOString();
    }
  } catch (error) {
    capturedAt = new Date(stats.mtimeMs || Date.now()).toISOString();
  }

  return {
    capturedAt,
    width,
    height,
    resolution: width && height ? `${width}x${height}` : null
  };
}

function buildStoragePath(filePath) {
  const relativePath = path.relative(localPhotosDir, filePath).split(path.sep).join("/");

  if (relativePath) {
    return `${targetUserId}/${relativePath}`;
  }

  const extension = path.extname(filePath).toLowerCase() || ".jpg";
  const safeBase = sanitizeBaseName(path.parse(filePath).name) || "photo";
  return `${targetUserId}/${safeBase}-${crypto.randomUUID().slice(0, 12)}${extension}`;
}

async function main() {
  assertEnv();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const files = await collectFiles(localPhotosDir);

  if (!files.length) {
    console.log(`No local photos found in ${localPhotosDir}`);
    return;
  }

  console.log(`Found ${files.length} photo(s) in ${localPhotosDir}`);

  let uploadedCount = 0;
  let skippedCount = 0;

  for (const filePath of files) {
    const relativePath = path.relative(ROOT_DIR, filePath);
    const filename = path.basename(filePath);
    const storagePath = buildStoragePath(filePath);
    const stats = await fs.stat(filePath);

    const { data: existingRow, error: existingError } = await supabase
      .from("photos")
      .select("id")
      .eq("storage_path", storagePath)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingRow) {
      console.log(`Skip existing: ${relativePath}`);
      skippedCount += 1;
      continue;
    }

    const fileBuffer = await fs.readFile(filePath);
    const metadata = await extractMetadata(filePath, stats);
    const mimeType =
      path.extname(filename).toLowerCase() === ".png"
        ? "image/png"
        : path.extname(filename).toLowerCase() === ".webp"
          ? "image/webp"
          : "image/jpeg";

    const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
      cacheControl: "3600"
    });

    if (uploadError) {
      throw uploadError;
    }

    const { error: insertError } = await supabase.from("photos").insert({
      user_id: targetUserId,
      filename,
      original_name: filename,
      mime_type: mimeType,
      size: stats.size,
      width: metadata.width,
      height: metadata.height,
      resolution: metadata.resolution,
      captured_at: metadata.capturedAt,
      uploaded_at: new Date(stats.mtimeMs || Date.now()).toISOString(),
      storage_path: storagePath,
      tags: deriveTagsFromFilename(filename)
    });

    if (insertError) {
      await supabase.storage.from(bucketName).remove([storagePath]);
      throw insertError;
    }

    uploadedCount += 1;
    console.log(`Imported: ${relativePath} -> ${storagePath}`);
  }

  console.log(`Import complete. Uploaded: ${uploadedCount}. Skipped: ${skippedCount}.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
