const test = require("node:test");
const assert = require("node:assert/strict");

const gate = require("./result-gate.js");

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("sanitizes student names into safe filename segments", () => {
  assert.equal(gate.sanitizeFileSegment("  Siti/Aisyah: VIII * A  "), "Siti-Aisyah-VIII-A");
});

test("builds a tidy screenshot filename", () => {
  assert.equal(
    gate.buildScreenshotFileName({ name: "Siti/Aisyah: VIII * A", date: "2026-06-18" }),
    "Hasil-Remedial-Siti-Aisyah-VIII-A-2026-06-18.png"
  );
  assert.equal(
    gate.buildScreenshotFileName({ name: "Siti Aisyah", date: "16-06-2026 22:30" }),
    "Hasil-Remedial-Siti-Aisyah-16-06-2026.png"
  );
});

test("builds attempt keys that distinguish attempts", () => {
  assert.equal(
    gate.buildAttemptKey({ name: "Siti Aisyah", attempt: 3, score: 85, duration: 91, date: "2026-06-18" }),
    "Siti-Aisyah|attempt:3|score:85|duration:91|date:2026-06-18"
  );
});

test("stores screenshot status per matching attempt key", () => {
  const storage = createStorage();
  const attemptKey = "Siti-Aisyah|attempt:3|score:85|duration:91|date:2026-06-18";
  const otherAttemptKey = "Siti-Aisyah|attempt:4|score:90|duration:80|date:2026-06-18";

  assert.equal(gate.hasScreenshotForAttempt(storage, attemptKey), false);

  gate.saveScreenshotStatus(storage, attemptKey);

  assert.equal(gate.hasScreenshotForAttempt(storage, attemptKey), true);
  assert.equal(gate.hasScreenshotForAttempt(storage, otherAttemptKey), false);

  gate.clearScreenshotStatus(storage);

  assert.equal(gate.hasScreenshotForAttempt(storage, attemptKey), false);
});
