import { get } from "axios";
import { error, warn, info, log } from "@empirica/core/console";

export async function getQualtricsData({ surveyId, sessionId, retries = 0 }) {
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
      "X-API-TOKEN": APItoken.trim(),
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
      info(`Fetched Qualtrics data from ${URL}.`);
      return result;
    }
    log(response);
    if (response.status === 202) {
      // TODO: wait and try again?
      error("Qualtrics Data not Ready when requested");
      throw new Error("Qualtrics Data not Ready when requested");
    }
  } catch (err) {
    if (retries > 0) {
      log(
        `Retrying survey data fetch from URL: ${URL}, (${retries} tries left)`
      );
      const result = await getQualtricsData({
        surveyId,
        sessionId,
        retries: retries - 1,
      });
      return result;
    }

    error(`Error getting qualtrics survey data from URL: ${URL}`);
    log(err);
  }
  return { values: {} };
}
