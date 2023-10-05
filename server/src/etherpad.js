// The main purpose of creating an etherpad here is to populate it
// with the default text from the prompt.

import axios from "axios";
// import fetch from "node-fetch";
// import http from "http";

const etherpadList = new Map();

export async function createEtherpad({ padId, defaultText }) {
  if (etherpadList.has(padId)) return etherpadList.get(padId);

  const baseURL = process.env.ETHERPAD_BASE_URL;

  const createPadUrl = new URL(`/api/1/createPad`, baseURL);
  createPadUrl.searchParams.set("apikey", process.env.ETHERPAD_API_KEY);
  createPadUrl.searchParams.set("padID", padId);
  createPadUrl.searchParams.set("text", defaultText);

  const padUrl = new URL(`/p/${padId}`, baseURL.replace("[::1]", "localhost"));

  try {
    const response = await axios.get(createPadUrl.toString());

    if (response.data.message.includes("padID does already exist")) {
      console.log(`Pad ${padId} already exists`);
      return padUrl.toString();
    }

    console.log(`Created new etherpad at ${padUrl}`);
    etherpadList.set(padId, padUrl.toString());
    return padUrl.toString();
  } catch (error) {
    console.log(`Error creating pad ${padId}`, error);
  }
}

export async function getEtherpadText({ padId }) {
  const baseURL = process.env.ETHERPAD_BASE_URL;

  const getTextUrl = new URL(`/api/1/getText`, baseURL);
  getTextUrl.searchParams.set("apikey", process.env.ETHERPAD_API_KEY);
  getTextUrl.searchParams.set("padID", padId);

  const result = await axios
    .get(getTextUrl.toString())
    .then((response) => {
      if (response.data.code !== 0) {
        console.log(
          `Status code error getting etherpad text at ${padId}`,
          response.data
        );
      }
      return response.data.data.text;
    })
    .catch((error) => {
      console.log(`Error getting data from etherpad ${padId}`, error);
      return undefined;
    });

  return result;
}
