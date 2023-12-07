import axios from "axios";
import { error, info } from "@empirica/core/console";

export async function GetRoom(roomName) {
  try {
    const resp = await axios.get(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: {
        Authorization: `Bearer ${process.env.DAILY_APIKEY}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    const {
      data: { name, url },
    } = resp;
    return { url, name };
  } catch (err) {
    if (err.response) {
      if (err.response.status === 404) {
        error(`Room ${roomName} has not yet been created.`);
      } else {
        error(
          `Request for url to room ${roomName} failed with status ${err.response.status}`
        );
        error("Response data:", err.response.data);
      }
    } else {
      error(
        `Error occured while requesting url to room ${roomName}`,
        err.message
      );
    }
    return { url: undefined, name: undefined };
  }
}

export async function CreateRoom(roomName, videoStorageLocation, awsRegion) {
  if (!process.env.DAILY_APIKEY) {
    throw new Error("Missing required env variable DAILY_APIKEY");
  }
  if (!roomName) {
    throw new Error("Missing required parameter roomName");
  }
  if (!videoStorageLocation) {
    throw new Error("Missing required parameter videoStorageLocation");
  }

  const properties = {
    enable_people_ui: false,
    enable_screenshare: false,
    exp: Date.now() / 1000 + 3600,
    enable_prejoin_ui: false,
  };
  if (videoStorageLocation !== "none") {
    properties.enable_recording = "raw-tracks";
    properties.recordings_bucket = {
      bucket_name: videoStorageLocation,
      bucket_region: awsRegion || "us-east-1",
      assume_role_arn: "arn:aws:iam::941654414269:role/dailyco_video_upload",
      allow_api_access: false,
    };
  }

  try {
    const resp = await axios.post(
      "https://api.daily.co/v1/rooms",
      {
        name: roomName,
        properties,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DAILY_APIKEY}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    const {
      data: { name, url },
    } = resp;
    info(`Created room ${name} with url ${url}`);
    return { url, name };
  } catch (e) {
    if (e.response.data.info.includes("already exists")) {
      error(
        `Requested creation of existing room ${roomName}. Returning existing room details`
      );
      return GetRoom(roomName);
    }

    if (e.response.data.info.includes("unable to upload test file to bucket")) {
      error(`invalid videoStorageLocation "${videoStorageLocation}"`);
      throw e;
    }

    error(`Unknown error creating room ${roomName}`, e.response.data);
    throw e; // raise to handle in calling function
  }
}

export async function CloseRoom(roomName) {
  if (!roomName) error("Trying to close room with no name");
  // Safety, terminate all active recordings
  try {
    const recordResp = await axios.post(
      `https://api.daily.co/v1/rooms/${roomName}/recordings/stop`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DAILY_APIKEY}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    if (recordResp.status === 200) {
      info("Recordings closed successfully by API");
    }
  } catch (err) {
    if (err.response) {
      if (err.response.status === 400) {
        info(`No active recording for Room ${roomName}.`);
      } else {
        error(
          `Stop recording request for Room ${roomName} failed with status code ${err.response.status}`
        );
        error("Response data:", err.response.data);
      }
    } else {
      error(
        `Error occured while requesting to stop recording for room ${roomName}`,
        err.message
      );
    }
  }
  // Close room
  try {
    const resp = await axios.delete(
      `https://api.daily.co/v1/rooms/${roomName}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DAILY_APIKEY}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    if (resp.data.deleted) {
      info(`Room ${roomName} closed successfully`);
    }
  } catch (err) {
    if (err.response) {
      if (err.response.status === 404) {
        error(`Room ${roomName} already closed`);
      } else {
        error(
          `Room ${roomName} closure request failed with status code ${err.response.status}`,
          err.response.data
        );
      }
    } else {
      error(
        `Error occured while requesting to close room ${roomName}`,
        err.message
      );
    }
  }
}

export async function DailyCheck(roomName, videoStorageLocation, awsRegion) {
  try {
    await CreateRoom(roomName, videoStorageLocation, awsRegion);
    info("Video call recording connection check passed");
  } catch (err) {
    error("Video call recording connection check failed");
    throw err;
  }
  await CloseRoom(roomName);
}
