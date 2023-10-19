import { get } from "axios";
import { error, warn, info, log } from "@empirica/core/console";

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
    const response = await get(URL, config);
    const {
      data: { result },
    } = response;

    if (response.status === 200) {
      // request succeeded
      return result;
    }
    if (response.status === 202) {
      // TODO: wait and try again?
      error("Qualtrics Data not Ready when requested");
    }
    info(
      `Fetched Qualtrics data from ${URL}, not sure what to do with it`,
      response
    );
  } catch (err) {
    error(`Error getting qualtrics survey data from URL: ${URL}`);
  }

  return { values: undefined };
}
