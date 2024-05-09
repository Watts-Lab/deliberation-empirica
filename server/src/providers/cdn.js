import axios from "axios";
import { error, debug } from "@empirica/core/console";

const cdnList = {
  test: "http://localhost:9091",
  local: "http://localhost:9090",
  prod: "https://s3.amazonaws.com/assets.deliberation-lab.org",
};

export async function getText({ cdn, path }) {
  const cdnURL = cdnList[cdn] || cdn || cdnList.prod;
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
