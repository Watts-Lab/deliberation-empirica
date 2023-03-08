import * as fs from "fs";
import axios from "axios";

export function getFileURL(file) {
  const rawURL = `https://deliberation-assets.nyc3.cdn.digitaloceanspaces.com/${file}`;
  return encodeURI(rawURL);
}

export async function getText(file) {
  if (process.env.NODE_ENV2 === "development") {
    const path = `/deliberation-assets/${file}`;
    console.log(`Getting file from local path: ${path}`);
    const text = fs.readFileSync(path, "utf8");
    return text;
  }
  const cdnURL = getFileURL(file);
  console.log(`Getting file from url: ${cdnURL}`);
  const { data, status } = await axios.get(cdnURL);
  if (status !== 200) {
    throw new Error(
      `Could not fetch file from ${cdnURL} corresponding to file path ${file}`
    );
  }
  return data;
}
