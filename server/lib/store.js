const fs = require("fs/promises");
const path = require("path");

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureJsonFile(filePath, defaultValue) {
  await ensureDir(path.dirname(filePath));

  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), "utf8");
  }
}

async function readJson(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw.trim() ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

async function writeJson(filePath, value) {
  const tempPath = `${filePath}.tmp`;
  const serialized = JSON.stringify(value, null, 2);

  await fs.writeFile(tempPath, serialized, "utf8");
  await fs.rename(tempPath, filePath);
}

function toUnixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

module.exports = {
  ensureDir,
  ensureJsonFile,
  readJson,
  toUnixPath,
  writeJson
};
