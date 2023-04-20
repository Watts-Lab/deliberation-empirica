// Todo: use the "responses", "result" names we use in the other parts of the experiment

import { get } from "axios";

export async function getQualtricsData({ surveyId, sessionId }) {
  const datacenter = process.env.QUALTRICS_DATACENTER;
  const APItoken = process.env.QUALTRICS_API_TOKEN;

  // Get responseId from sessionId
  // https://github.com/Watts-Lab/deliberation-empirica/issues/452#issuecomment-1498077195
  const responseId = sessionId.replace("FS_", "R_");

  // Retrieve survey response:
  // https://api.qualtrics.com/1179a68b7183c-retrieve-a-survey-response

  const URL = `https://${datacenter}.qualtrics.com/API/v3/surveys/${surveyId}/responses/${responseId}`;

  const config = {
    headers: {
      "X-API-TOKEN": APItoken,
      "Content-Type": "application/json",
    },
  };

  try {
    const httpResponse = await get(URL, config);
    const {
      data: { result },
    } = httpResponse;

    if (httpResponse.status === 200) {
      // request succeeded
      return result;
    }
    if (httpResponse.status === 202) {
      // TODO: wait and try again?
      console.log("Qualtrics Data not Ready when requested");
    }
    console.log(
      `Fetched Qualtrics data from ${URL}, not sure what to do with it`,
      httpResponse
    );
  } catch (err) {
    console.log(
      `Error getting survey data from URL: ${URL} with config:`,
      config
    );
    console.log(err);
  }

  return { values: undefined };
}
