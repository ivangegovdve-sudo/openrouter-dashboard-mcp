import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SERVER_VERSION } from "../src/version.js";

test("the handshake version is the version that gets published", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  // A server that announces 0.3.0 from a 0.4.0 tarball makes every bug report
  // point at the wrong code. Cheap to hold, invisible when it drifts.
  assert.equal(SERVER_VERSION, manifest.version);
});
