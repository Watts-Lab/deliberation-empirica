import axios from "axios";
import { debug } from "@empirica/core/console";

// Resolves a treatment-file reference to a fetch target. Mirrors
// client/src/components/stagebookAdapter/helpers.js:resolveAssetURL —
// stagebook accepts only http(s):// and asset:// schemes (per its
// urlSchema spec), and naked paths are treatment-file-relative. This
// helper is the server-side equivalent so an `asset://` or absolute
// URL in a treatment file behaves the same way at validation time as
// it will at participant runtime.
const ASSET_SCHEME_RE = /^asset:\/\//i;
const HTTP_URL_RE = /^(?:https?:)?\/\//i;
const ANY_URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

// Pure helper: resolve `filePath` relative to `dir`, collapsing
// `.`/`..` and empty segments. Exported for unit tests.
export function joinRelativeToDir(dir, filePath) {
  if (filePath == null) return "";
  const combined = dir ? `${dir}/${filePath}` : filePath;
  const segments = combined.split("/").reduce((acc, seg) => {
    if (seg === "" || seg === ".") return acc;
    if (seg === "..") {
      acc.pop();
      return acc;
    }
    acc.push(seg);
    return acc;
  }, []);
  return segments.join("/");
}

// Resolve a treatment-file reference to a fetch target.
//   - `asset://X` → prefix-relative path `X` with `.`/`..`/empty-segment
//     collapsing (so `asset://../../foo` resolves to `foo`, not a path
//     that could escape the configured `assetBaseUrl`). Without the
//     collapse, a treatment with `asset://../../other-study/secret.md`
//     would join to `${assetBaseUrl}/../../other-study/secret.md` —
//     which most web servers normalize and could let one Study read
//     another's assets in manager-launched mode. Reject malformed
//     `asset:` (without `//`) here so a typo doesn't fall through.
//   - `http(s)://...` (and protocol-relative `//host/...`) → fetch
//     directly, no prefix.
//   - Other URL schemes (`data:`, `file:`, `mailto:`, ...) → reject.
//   - Naked relative path → join with treatment-dir when called from
//     within an element; skip the join when called for the treatment
//     file itself (which IS the root).
export function resolveAssetReference(
  rawPath,
  { treatmentFileDir = "", treatmentRelative = true } = {},
) {
  if (ASSET_SCHEME_RE.test(rawPath)) {
    return {
      type: "relative",
      path: joinRelativeToDir("", rawPath.replace(ASSET_SCHEME_RE, "")),
    };
  }
  if (/^asset:/i.test(rawPath)) {
    throw new Error(
      `Malformed asset reference "${rawPath}" — the asset: scheme requires "//" (use "asset://${rawPath.replace(/^asset:/i, "")}")`,
    );
  }
  if (HTTP_URL_RE.test(rawPath)) {
    return { type: "absolute", url: rawPath };
  }
  if (ANY_URL_SCHEME_RE.test(rawPath)) {
    throw new Error(
      `Unsupported URL scheme in "${rawPath}" — stagebook accepts only http(s):// and asset:// references (per stagebook urlSchema spec).`,
    );
  }
  return {
    type: "relative",
    path: treatmentRelative
      ? joinRelativeToDir(treatmentFileDir, rawPath)
      : rawPath,
  };
}

// Fetch text content from the per-batch `assetBaseUrl` prefix. Both
// solo-dev and manager-launched modes work the same way — the deploy
// (researcher in solo, manager in multi-tenant) provides a public-read
// URL prefix and we do flat join + axios GET. Absolute http(s)://
// references in treatment files bypass the prefix entirely.
export async function fetchAssetText({
  assetBaseUrl,
  rawPath,
  treatmentFileDir = "",
  treatmentRelative = true,
}) {
  const ref = resolveAssetReference(rawPath, {
    treatmentFileDir,
    treatmentRelative,
  });

  const fileURL =
    ref.type === "absolute"
      ? encodeURI(ref.url)
      : encodeURI(`${assetBaseUrl}/${ref.path}`);

  debug(`Getting file from URL: ${fileURL}`);

  const { data, status } = await axios.get(fileURL, {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
  if (status !== 200) {
    throw new Error(`Could not fetch file from ${fileURL} (status ${status})`);
  }
  return data;
}
