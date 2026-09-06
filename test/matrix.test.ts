import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardClient } from "../src/dashboard/client.js";
import { runMatrix } from "../src/tools/matrix.js";
import { appModelMatrixUnavailableFixture } from "./fixtures.js";

test("preserves approval-pending matrix state and explains it", async () => {
  const client: DashboardClient = {
    async get(_path, query, schema) {
      assert.equal(query.toString(), "appLimit=10&modelLimit=10&window=latest-complete");
      return schema.parse({ ...appModelMatrixUnavailableFixture, reason: "approval_incomplete" });
    },
  };
  const result = await runMatrix({}, { client });
  assert.equal(result.status, "unavailable");
  if (result.status !== "unavailable") return;
  assert.equal(result.response.reason, "approval_incomplete");
  assert.match(result.warnings.join(" "), /approvals are pending/i);
});

test("keeps disabled matrix collection distinct from approval pending", async () => {
  const client: DashboardClient = {
    async get(_path, _query, schema) {
      return schema.parse(appModelMatrixUnavailableFixture);
    },
  };
  const result = await runMatrix({}, { client });
  assert.equal(result.status, "unavailable");
  if (result.status !== "unavailable") return;
  assert.equal(result.response.reason, "collection_disabled");
  assert.match(result.warnings.join(" "), /disabled by configuration/i);
});
