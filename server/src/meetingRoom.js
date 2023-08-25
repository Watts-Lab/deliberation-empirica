import axios from "axios";

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
        console.log(`Room ${roomName} has not yet been created.`);
      } else {
        console.log(
          `Request for url to room ${roomName} failed with status ${err.response.status}`
        );
        console.log("Response data:", err.response.data);
      }
    } else {
      console.log(
        `Error occured while requesting url to room ${roomName}`,
        err.message
      );
    }
    return { url: undefined, name: undefined };
  }
}

export async function CreateRoom(roomName, videoStorageLocation) {
  if (!process.env.DAILY_APIKEY) {
    throw new Error("Missing required env variable DAILY_APIKEY");
  }

  let enableRecording = "raw-tracks"
  if (videoStorageLocation === "none") {
    enableRecording = "<not set>";
  }

  try {
    const resp = await axios.post(
      "https://api.daily.co/v1/rooms",
      {
        name: roomName,
        properties: {
          enable_people_ui: false,
          enable_screenshare: false,
          exp: Date.now() / 1000 + 3600,
          enable_prejoin_ui: false,
          // enable_recording: 'cloud',
          // enable_recording: "raw-tracks",
          enable_recording: enableRecording,
          recordings_bucket: {
            bucket_name: videoStorageLocation,
            bucket_region: "us-east-1",
            assume_role_arn:
              "arn:aws:iam::941654414269:role/dailyco_video_upload",
            allow_api_access: false,
          },
        },
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
    return { url, name };
  } catch (err) {
    if (
      err.response?.status === 400 // &&
      // err.response?.data.includes("already exists")
    ) {
      console.log(`Requested creation of existing room ${roomName}`);
      console.log("response:", err.response);
      if (err.response.data.info.includes('unable to upload test file to bucket')) {
        throw new Error("invalid videoStorageLocation", err);
      }
    } else {
      // console.log(
      //   `Request to create room ${roomName} failed with status ${err.response?.status}`
      // );
      console.log("Error response", err.response);
      console.log("Error message", err.message);
      throw new Error("Failed to create daily room", err); // raise to handle in calling function
    }
  }
}

export async function CloseRoom(roomName) {
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
      console.log("Recordings closed sucessfully by API");
    }
  } catch (err) {
    if (err.response) {
      if (err.response.status === 400) {
        console.log("No active recording.");
      } else {
        console.log(
          `Stop recording request for Room ${roomName} failed with status code ${err.response.status}`
        );
        console.log("Response data:", err.response.data);
      }
    } else {
      console.log(
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
      console.log(`Room ${roomName} closed successfully`);
    }
  } catch (err) {
    if (err.response) {
      if (err.response.status === 404) {
        console.log(`Room ${roomName} already closed`);
      } else {
        console.log(
          `Room ${roomName} closure request failed with status code ${err.response.status}`,
          err.response.data
        );
      }
    } else {
      console.log(
        `Error occured while requesting to close room ${roomName}`,
        err.message
      );
    }
  }
}

export async function DailyCheck(roomName, videoStorageLocation) {
  console.log("daily check");
  await CreateRoom(roomName, videoStorageLocation);
  await CloseRoom(roomName);
}
