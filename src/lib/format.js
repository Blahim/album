import { format } from "date-fns";

function toDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatPhotoDate(value) {
  const date = toDate(value);
  return date ? format(date, "MMM d, yyyy") : "Unknown date";
}

export function formatPhotoDateTime(value) {
  const date = toDate(value);
  return date ? format(date, "MMM d, yyyy 'at' h:mm a") : "Unknown date";
}

export function formatAlbumDate(value) {
  const date = toDate(value);
  return date ? format(date, "MMMM yyyy") : "Recent";
}

export function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const digits = exponent === 0 ? 0 : value >= 100 ? 0 : 1;

  return `${value.toFixed(digits)} ${units[exponent]}`;
}
