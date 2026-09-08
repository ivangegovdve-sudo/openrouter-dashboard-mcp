/**
 * The version this server reports in the MCP handshake.
 *
 * Single-sourced deliberately. It used to be a literal inside createServer, one
 * hand-edit away from a published package whose handshake announced the previous
 * release -- a drift no test could see, in the one field a client logs.
 * `test/version.test.ts` holds this equal to package.json.
 */
export const SERVER_VERSION = "0.8.0";
