// The main purpose of creating an etherpad here is to populate it
// with the default text from the prompt.

import axios from "axios";
import { error, warn, info } from "@empirica/core/console";

const etherpadList = new Map();

export async function createEtherpad({ padId, defaultText }) {
  if (etherpadList.has(padId)) return etherpadList.get(padId);

  const baseURL = process.env.ETHERPAD_BASE_URL;
  const createPadUrl = new URL(`${baseURL}/api/1/createPad`);
  createPadUrl.searchParams.set("apikey", process.env.ETHERPAD_API_KEY);
  createPadUrl.searchParams.set("padID", padId);
  createPadUrl.searchParams.set("text", defaultText);

  const padUrl = new URL(`${baseURL}/p/${padId}`);

  try {
    const response = await axios.get(createPadUrl.toString());

    if (response.data.message.includes("padID does already exist")) {
      warn(`Pad ${padId} already exists`);
      return padUrl.toString();
    }

    info(`Created new etherpad at ${padUrl}`);
    etherpadList.set(padId, padUrl.toString());
    return padUrl.toString();
  } catch (e) {
    error(`Error creating pad ${padId}`, e);
    return undefined;
  }
}

export async function getEtherpadText({ padId }) {
  const baseURL = process.env.ETHERPAD_BASE_URL;

  const getTextUrl = new URL(`${baseURL}/api/1/getText`);
  getTextUrl.searchParams.set("apikey", process.env.ETHERPAD_API_KEY);
  getTextUrl.searchParams.set("padID", padId);

  const result = await axios
    .get(getTextUrl.toString())
    .then((response) => {
      if (response.data.code !== 0) {
        error(
          `Status code error getting etherpad text at ${padId}`,
          response.data
        );
      }
      return response.data.data.text;
    })
    .catch((e) => {
      error(`Error getting data from etherpad ${padId}`, e);
      return undefined;
    });

  return result;
}
