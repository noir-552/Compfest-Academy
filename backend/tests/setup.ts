import http from 'node:http';
import { createRequire } from 'node:module';

// Two independent sources of cross-test HTTP flakiness, both rooted in
// supertest booting an ephemeral server per request:
//
// 1. Node >=19 enables keep-alive on http.globalAgent, which pools sockets by
//    host:port; when the OS recycles an ephemeral port for a later server,
//    superagent can reuse a stale socket from the previous server and read a
//    mismatched/leftover response (observed as "register failed with 200: {}").
//    Disabling keep-alive removes socket reuse entirely.
http.globalAgent = new http.Agent({ keepAlive: false });

// 2. supertest's serverAddress() calls app.listen(0) — a wildcard ('::',
//    dual-stack, SO_REUSEADDR) bind — and then targets http://127.0.0.1:port.
//    On macOS the kernel may assign an ephemeral wildcard port that a DIFFERENT
//    process already holds on 127.0.0.1 specifically (VS Code helpers, Notion,
//    language servers all squat in that range); BSD most-specific-binding
//    routing then delivers the client's 127.0.0.1 connection to the foreign
//    process (observed as 'login failed with 404: "404 page not found"' — a Go
//    server's default 404, not Express). Rewriting the client URL to [::1]
//    still reaches our dual-stack server but cannot hit IPv4-only squatters,
//    and keeps supertest's synchronous listen(0)/address() flow intact.
//    (Binding the server to 127.0.0.1 instead is NOT an option: listen with a
//    host string resolves asynchronously, so supertest's immediate
//    app.address() read returns null.)
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const SupertestTest = require('supertest/lib/test');
const originalServerAddress = SupertestTest.prototype.serverAddress as (
  app: unknown,
  path: string,
) => string;
SupertestTest.prototype.serverAddress = function serverAddressOnV6Loopback(
  app: unknown,
  path: string,
): string {
  const url = originalServerAddress.call(this, app, path);
  return url.replace('://127.0.0.1:', '://[::1]:');
};
