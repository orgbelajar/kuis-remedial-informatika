(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RemedialResultGate = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "remedialResultScreenshotStatus";

  function sanitizeFileSegment(value) {
    const cleaned = String(value || "Siswa")
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
    return cleaned || "Siswa";
  }

  function buildScreenshotFileName(details) {
    const dateOnly = String(details.date || "").split(" ")[0];
    return `Hasil-Remedial-${sanitizeFileSegment(details.name)}-${sanitizeFileSegment(dateOnly)}.png`;
  }

  function buildAttemptKey(details) {
    return [
      sanitizeFileSegment(details.name),
      `attempt:${Number(details.attempt) || 0}`,
      `score:${Math.round(Number(details.score) || 0)}`,
      `duration:${Math.max(0, Math.round(Number(details.duration) || 0))}`,
      `date:${sanitizeFileSegment(details.date)}`,
    ].join("|");
  }

  function readScreenshotStatus(storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data.attemptKey !== "string") return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveScreenshotStatus(storage, attemptKey) {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        attemptKey: String(attemptKey),
        capturedAt: new Date().toISOString(),
      })
    );
  }

  function clearScreenshotStatus(storage) {
    storage.removeItem(STORAGE_KEY);
  }

  function hasScreenshotForAttempt(storage, attemptKey) {
    const status = readScreenshotStatus(storage);
    return Boolean(status && status.attemptKey === attemptKey);
  }

  return {
    STORAGE_KEY,
    sanitizeFileSegment,
    buildScreenshotFileName,
    buildAttemptKey,
    readScreenshotStatus,
    saveScreenshotStatus,
    clearScreenshotStatus,
    hasScreenshotForAttempt,
  };
});
