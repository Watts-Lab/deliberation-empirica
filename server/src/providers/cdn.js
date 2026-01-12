import axios from "axios";
import { error, debug } from "@empirica/core/console";

// CDN utilities live in this provider module so server fetching and
// server->client globals injection share the same mapping and resolution logic.

export function getCdnList() {
  return {
    // Used for Cypress/local fixture-style assets.
    test: process.env.CDN_TEST_URL || "http://localhost:9091",
    // Used for local development when a separate static server is running.
    local: process.env.CDN_LOCAL_URL || "http://localhost:9090",
    // Default production asset bucket.
    prod:
      process.env.CDN_PROD_URL ||
      "https://s3.amazonaws.com/assets.deliberation-lab.org",
  };
}

export function resolveCdnURL({ cdn, cdnList }) {
  if (!cdnList) {
    throw new Error("resolveCdnURL requires cdnList");
  }

  // `cdn` may be:
  // - a known key (test/local/prod), or
  // - a fully-qualified URL.
  return cdnList[cdn] || cdn || cdnList.prod;
}

export async function getText({ cdn, path }) {
  const cdnList = getCdnList();
  const cdnURL = resolveCdnURL({ cdn, cdnList });
  const fileURL = encodeURI(`${cdnURL}/${path}`);
  debug(`Getting file from url: ${fileURL}`);

  const { data, status } = await axios
    .get(fileURL, {
      // query URL without using browser cache
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
    .catch((err) => {
      error(`Failed to fetch file from ${fileURL}`, err);
      throw err;
    });

  if (status !== 200) {
    throw new Error(
      `Could not fetch file from ${cdnURL} corresponding to file path ${path}`
    );
  }

  return data;
}
