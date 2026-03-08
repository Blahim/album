import exifr from "exifr";

async function readImageDimensions(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = {
        width: bitmap.width,
        height: bitmap.height
      };

      if (typeof bitmap.close === "function") {
        bitmap.close();
      }

      return dimensions;
    } catch (error) {
      // Fall back to an Image element below.
    }
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({ width: image.naturalWidth || null, height: image.naturalHeight || null });
      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      resolve({ width: null, height: null });
      URL.revokeObjectURL(objectUrl);
    };

    image.src = objectUrl;
  });
}

export async function extractImageMetadata(file) {
  const fallbackTimestamp = new Date(file.lastModified || Date.now()).toISOString();
  const { width, height } = await readImageDimensions(file);
  let capturedAt = fallbackTimestamp;

  try {
    const exif = await exifr.parse(file, ["DateTimeOriginal", "CreateDate"]);
    const sourceDate = exif?.DateTimeOriginal || exif?.CreateDate;

    if (sourceDate) {
      capturedAt = new Date(sourceDate).toISOString();
    }
  } catch (error) {
    capturedAt = fallbackTimestamp;
  }

  return {
    capturedAt,
    width,
    height,
    resolution: width && height ? `${width}x${height}` : null
  };
}
