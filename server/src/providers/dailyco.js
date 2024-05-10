import axios from "axios";
import { error, info } from "@empirica/core/console";

export async function getRoom(roomName) {
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

export async function createRoom(roomName, videoStorage) {
  if (!process.env.DAILY_APIKEY) {
    throw new Error("Missing required env variable DAILY_APIKEY");
  }
  if (!roomName) {
    throw new Error("Missing required parameter roomName");
  }
  if (!videoStorage) {
    throw new Error("Missing required parameter videoStorage");
  }

  const properties = {
    enable_people_ui: false,
    enable_screenshare: false,
    exp: Date.now() / 1000 + 3600,
    enable_prejoin_ui: false,
  };
  if (videoStorage !== "none") {
    properties.enable_recording = "raw-tracks";
    properties.recordings_bucket = {
      bucket_name: videoStorage.bucket,
      bucket_region: videoStorage.region,
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
      return getRoom(roomName);
    }

    if (e.response.data.info.includes("unable to upload test file to bucket")) {
      error(`invalid video storage location "${JSON.stringify(videoStorage)}"`);
      throw Error(e.response.data.info);
    }

    error(`Unknown error creating room ${roomName}`, e.response.data);
    throw e; // raise to handle in calling function
  }
}

export async function startRecording(roomName, retries = 10) {
  if (!roomName) {
    error("Trying to start recording with no room name");
    return false;
  }

  try {
    const response = await axios.post(
      `https://api.daily.co/v1/rooms/${roomName}/recordings/start`,
      {
        type: "raw-tracks",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DAILY_APIKEY}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    if (response.status === 200) {
      info(`Recording ${roomName}`);
      return true;
    }
    throw new Error(`Unexpected response code ${response.status}`, response);
  } catch (e) {
    if (
      e.response?.data?.info?.includes(
        "does not seem to be hosting a call currently"
      )
    ) {
      if (retries > 0) {
        info(
          `Tried to start recording for room ${roomName} but no call is active, retrying in 3 seconds. ${retries} retries left.`
        );
        const timeout = (ms) =>
          new Promise((resolve) => {
            setTimeout(resolve, ms);
          });
        await timeout(3000); // wait 3 seconds
        return startRecording(roomName, retries - 1);
      }
      error(
        `Tried to start recording for room ${roomName} but no call is active, no retries left`
      );
    }
    error(`Error ocurred while trying to start recording room ${roomName}`, e);
  }
  return false;
}

export async function stopRecording(roomName) {
  if (!roomName) {
    error("Trying to stop recording with no room name");
    return false;
  }

  try {
    const response = await axios.post(
      `https://api.daily.co/v1/rooms/${roomName}/recordings/stop`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DAILY_APIKEY}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    if (response.status === 200) {
      info(`Closed recording for ${roomName}`);
      return true;
    }
    throw new Error(`Unexpected response code ${response.status}`, response);
  } catch (err) {
    if (err.response) {
      if (err.response.status === 400) {
        info(`No active recording for Room ${roomName}.`);
        return true;
      }
      error(
        `Failed to stop recording room ${roomName}`,
        `Status code ${err.response.status}`,
        `Response data: ${err.response.data}`
      );
    } else {
      error(
        `Error ocurred while requesting to stop recording for room ${roomName}`,
        err.message
      );
    }
    return false;
  }
}

export async function closeRoom(roomName) {
  if (!roomName) error("Trying to close room with no name");
  // Safely terminate all active recordings
  stopRecording(roomName);

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

  // Get recordings data
  try {
    const resp = await axios.get(`https://api.daily.co/v1/recordings`, {
      headers: {
        Authorization: `Bearer ${process.env.DAILY_APIKEY}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      params: {
        room_name: roomName,
      },
    });
    return resp.data;
  } catch (err) {
    error(
      `Error occured while requesting recording data for room ${roomName}`,
      err.message
    );
    return {};
  }
}

export async function dailyCheck(roomName, videoStorage) {
  try {
    await createRoom(roomName, videoStorage);
    info("Video call recording connection check passed");
  } catch (err) {
    error("Video call recording connection check failed");
    throw err;
  }
  await closeRoom(roomName);
}
