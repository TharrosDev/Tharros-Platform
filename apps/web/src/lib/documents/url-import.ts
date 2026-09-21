import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

import { convert } from "html-to-text";

/**
 * Import a public web page into the knowledge base. SSRF-guarded: https only,
 * no credentials or custom ports, and every resolved IP is checked inside the
 * socket's own DNS lookup, so a rebinding hostname can't swap in a private
 * address between check and connect. Redirects are re-validated hop by hop.
 */

export const URL_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 127],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** True only for publicly routable unicast addresses. */
export function isPublicAddress(address: string): boolean {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return isPublicAddress(mapped);
  const family = isIP(address);
  if (family === 0) return false;
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

/** Validate a user-supplied URL; returns the parsed URL or an error message. */
export function parseImportUrl(raw: string): URL | { error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "Enter a full web address, e.g. https://example.com/policy." };
  }
  if (url.protocol !== "https:") return { error: "Only https:// pages can be imported." };
  if (url.username || url.password) return { error: "Addresses with credentials aren't allowed." };
  if (url.port && url.port !== "443") return { error: "Custom ports aren't allowed." };
  if (
    isIP(url.hostname.replace(/^\[|\]$/g, "")) &&
    !isPublicAddress(url.hostname.replace(/^\[|\]$/g, ""))
  ) {
    return { error: "That address isn't publicly reachable." };
  }
  return url;
}

const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as LookupAddress[];
    const bad = list.find((a) => !isPublicAddress(a.address));
    if (bad || list.length === 0) {
      return callback(new Error("Blocked non-public address"), "", 0);
    }
    if ((options as { all?: boolean }).all) {
      return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    }
    callback(null, list[0].address, list[0].family);
  });
};

type Fetched = { body: string; contentType: string; finalUrl: URL };

function getOnce(url: URL): Promise<{ status: number; location?: string } & Partial<Fetched>> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        lookup: guardedLookup,
        timeout: TIMEOUT_MS,
        headers: { "User-Agent": "TharrosKnowledgeImport/1.0", Accept: "text/html,text/plain" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location });
        }
        const contentType = String(res.headers["content-type"] ?? "");
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > URL_IMPORT_MAX_BYTES) {
            req.destroy(new Error("Page is too large to import (max 2 MB)."));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () =>
          resolve({
            status,
            contentType,
            body: Buffer.concat(chunks).toString("utf8"),
            finalUrl: url,
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("The page took too long to respond.")));
    req.on("error", reject);
    req.end();
  });
}

/** Fetch a public page, following up to 3 re-validated redirects. */
export async function fetchPublicPage(start: URL): Promise<Fetched> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await getOnce(url);
    if (res.location !== undefined) {
      const next = parseImportUrl(new URL(res.location, url).toString());
      if (!(next instanceof URL)) throw new Error(next.error);
      url = next;
      continue;
    }
    if (res.status !== 200) throw new Error(`The page responded with status ${res.status}.`);
    if (!/^text\/(html|plain)/i.test(res.contentType ?? "")) {
      throw new Error("Only web pages (HTML or plain text) can be imported.");
    }
    return { body: res.body!, contentType: res.contentType!, finalUrl: url };
  }
  throw new Error("Too many redirects.");
}

/** Page → readable text: drops nav/scripts/images, keeps headings, lists and tables. */
export function pageToText(body: string, contentType: string): string {
  if (!/html/i.test(contentType)) return body.trim();
  return convert(body, {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      { selector: "nav", format: "skip" },
      { selector: "header", format: "skip" },
      { selector: "footer", format: "skip" },
    ],
  }).trim();
}

/** Stable, readable filename for the imported page (host + path). */
export function importFilename(url: URL): string {
  const path = url.pathname.replace(/\/+$/, "").replace(/\//g, "-");
  return `${url.hostname}${path}`.slice(0, 120) + ".md";
}
