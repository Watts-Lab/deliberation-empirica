// The main purpose of creating an etherpad here is to populate it
// with the default text from the prompt.

import axios from "axios";

const etherpadList = new Map();

export async function createEtherpad({ padId, defaultText }) {
  const clientURL = `${process.env.ETHERPAD_BASE_URL}/p/${padId}`;

  if (etherpadList.has(padId)) return clientURL;
  if (!defaultText) return clientURL;

  console.log(`Creating new etherpad at ${padId}`);

  const params = {
    apikey: process.env.ETHERPAD_API_KEY,
    padID: padId,
    text: defaultText,
  };

  // set pad text
  await axios
    .get(`${process.env.ETHERPAD_BASE_URL}/api/1.3.0/createPad`, {
      params,
    })
    .then((response) => {
      if (response.data.code !== 0) {
        console.log(
          `Status code error creating new etherpad at ${padId} with text: ${defaultText}`,
          response.data
        );
      }
    })
    .catch((error) => {
      console.log(
        `Error creating new etherpad at ${padId} with text: ${defaultText}`,
        error
      );
      return undefined;
    });

  etherpadList.set(padId, clientURL);
  return clientURL;
}

export async function getEtherpadText({ padId }) {
  const params = {
    apikey: process.env.ETHERPAD_API_KEY,
    padID: padId,
  };

  const result = await axios
    .get(`${process.env.ETHERPAD_BASE_URL}/api/1.3.0/getText`, {
      params,
    })
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
