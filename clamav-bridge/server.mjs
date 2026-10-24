import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { connect } from "node:net";
import { once } from "node:events";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CONCURRENT_SCANS = 2;
const token = process.env.CLAMAV_SCAN_TOKEN;
const port = Number(process.env.PORT ?? 8080);
const clamdHost = process.env.CLAMD_HOST ?? "127.0.0.1";
const clamdPort = Number(process.env.CLAMD_PORT ?? 3310);
let activeScans = 0;

if (!token || token.length < 32) {
  console.error("CLAMAV_SCAN_TOKEN must contain at least 32 characters.");
  process.exit(1);
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("PORT must be a valid TCP port.");
  process.exit(1);
}

class PayloadTooLargeError extends Error {}

function json(response, status, body) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

function isAuthorized(request) {
  const supplied = request.headers.authorization?.startsWith("Bearer ")
    ? Buffer.from(request.headers.authorization.slice(7))
    : Buffer.alloc(0);
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function writeSocket(socket, chunk) {
  return new Promise((resolve, reject) => {
    socket.write(chunk, (error) => (error ? reject(error) : resolve()));
  });
}

async function clamdCommand(command, input) {
  const socket = connect({ host: clamdHost, port: clamdPort });
  socket.setTimeout(60_000, () => socket.destroy(new Error("ClamAV scan timed out.")));
  const responsePromise = new Promise((resolve, reject) => {
    const chunks = [];
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.once("end", () => resolve(Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim()));
    socket.once("error", reject);
    socket.once("close", () => {
      if (chunks.length === 0) reject(new Error("ClamAV closed the connection without a result."));
    });
  });

  try {
    await once(socket, "connect");
    await writeSocket(socket, Buffer.from(command, "ascii"));

    if (input) {
      let total = 0;
      for await (const part of input) {
        const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
        total += chunk.byteLength;
        if (total > MAX_FILE_BYTES) throw new PayloadTooLargeError();
        if (chunk.byteLength === 0) continue;
        const length = Buffer.alloc(4);
        length.writeUInt32BE(chunk.byteLength);
        await writeSocket(socket, Buffer.concat([length, chunk]));
      }
      if (total === 0) throw new Error("The upload was empty.");
      await writeSocket(socket, Buffer.alloc(4));
    }

    socket.end();
    return await responsePromise;
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

async function checkClamd() {
  return (await clamdCommand("zPING\0")) === "PONG";
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/healthz") {
    try {
      if (await checkClamd()) json(response, 200, { status: "ok" });
      else json(response, 503, { status: "unavailable" });
    } catch {
      json(response, 503, { status: "unavailable" });
    }
    return;
  }

  if (request.method !== "POST" || request.url !== "/scan") {
    response.setHeader("Allow", "GET, POST");
    json(response, 404, { error: "Not found." });
    return;
  }
  if (!isAuthorized(request)) {
    json(response, 401, { error: "Authentication required." });
    request.resume();
    return;
  }
  if (request.headers["content-type"] !== "application/octet-stream") {
    json(response, 415, { error: "Expected an octet-stream file body." });
    request.resume();
    return;
  }

  const contentLength = request.headers["content-length"];
  if (contentLength !== undefined && Number(contentLength) > MAX_FILE_BYTES) {
    json(response, 413, { error: "File exceeds the scan size limit." });
    request.resume();
    return;
  }
  if (activeScans >= MAX_CONCURRENT_SCANS) {
    response.setHeader("Retry-After", "10");
    json(response, 429, { error: "Scanner is busy." });
    request.resume();
    return;
  }

  activeScans += 1;
  try {
    const result = await clamdCommand("zINSTREAM\0", request);
    if (result.includes(" FOUND")) json(response, 200, { status: "infected" });
    else if (result.endsWith(" OK")) json(response, 200, { status: "clean" });
    else {
      console.error("ClamAV returned an unexpected scan response.");
      json(response, 503, { error: "Scan result unavailable." });
    }
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      json(response, 413, { error: "File exceeds the scan size limit." });
    } else if (error instanceof Error && error.message === "The upload was empty.") {
      json(response, 400, { error: "The upload was empty." });
    } else {
      console.error("ClamAV scan request failed.", error);
      json(response, 503, { error: "Scan result unavailable." });
    }
  } finally {
    activeScans -= 1;
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`TrustVault ClamAV bridge listening on port ${port}.`);
});
