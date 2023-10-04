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
  // const opts = {
  //   agent: new http.Agent({
  //     keepAlive: true,
  //   }),
  // };

  // fetch(createPadUrl.toString(), opts).then((res) => console.log(res));

  // const clientURL = `${process.env.ETHERPAD_BASE_URL}/p/${padId}`;

  // if (!defaultText) return clientURL;

  // console.log(`Creating new etherpad at ${padId}`);

  // const data = {
  //   apikey: process.env.ETHERPAD_API_KEY,
  //   padID: padId,
  //   text: encodeURI(defaultText),
  // };

  // axios
  //   .post(`${process.env.ETHERPAD_BASE_URL}/api/1/createPad`, data)
  //   .then((response) => {
  //     if (response.data.code !== 0) {
  //       console.log(
  //         `Status code error creating new etherpad at ${padId} with text: ${defaultText}`,
  //         response.data
  //       );
  //     }
  //     etherpadList.set(padId, clientURL);
  //     return clientURL;
  //   })
  //   .catch((error) => {
  //     console.log(
  //       `Error creating new etherpad at ${padId} with text: ${defaultText}`,
  //       error
  //     );
  //     return undefined;
  //   });

  // const headers = {
  //   "Content-Type": "application/x-www-form-urlencoded",
  // };
  // const data = {
  //   text: encodeURI(defaultText),
  // };

  // const params = new URLSearchParams({
  //   apikey: process.env.ETHERPAD_API_KEY,
  //   padID: padId,
  //   text: defaultText,
  // })

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

  // axios
  //   .get(createPadUrl.toString())
  //   .then((response) => {

  //   })
  //   .catch((error) => {
  //     console.log(`Error creating pad ${padId}`, error);
  //   });

  // const params = {
  //   apikey: process.env.ETHERPAD_API_KEY,
  //   padID: padId,
  //   text: encodeURI(defaultText),
  // };

  // axios
  //   .get(`${process.env.ETHERPAD_BASE_URL}/api/1/createPad`, {
  //     params,
  //     responseType: "json",
  //   })
  //   .then((response) => {
  //     console.log("Response", response);
  //     if (response.data.code !== 0) {
  //       console.log(
  //         `Status code error creating new etherpad at ${padId} with text: ${defaultText}`,
  //         response.data
  //       );
  //     }
  //     etherpadList.set(padId, clientURL);
  //     return clientURL;
  //   })
  //   .catch((error) => {
  //     console.log(
  //       `Error creating new etherpad at ${padId} with text: ${defaultText}`,
  //       error
  //     );
  //     return undefined;
  //   });

  // set pad text
  // await axios
  //   .get(`${process.env.ETHERPAD_BASE_URL}/api/1/createPad`, {
  //     params,
  //   })
  //   .then((response) => {
  //     if (response.data.code !== 0) {
  //       console.log(
  //         `Status code error creating new etherpad at ${padId} with text: ${defaultText}`,
  //         response.data
  //       );
  //     }
  //   })
  //   .catch((error) => {
  //     console.log(
  //       `Error creating new etherpad at ${padId} with text: ${defaultText}`,
  //       error
  //     );
  //     return undefined;
  //   });

  // etherpadList.set(padId, clientURL);
  // return clientURL;
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
