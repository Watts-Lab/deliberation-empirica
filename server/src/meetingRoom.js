import axios from 'axios';

export async function GetRoom(roomName) {
  try {
    const resp = await axios.get(
      `https://api.daily.co/v1/rooms/${roomName}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DAILY_APIKEY}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    );
    const { data: { name: id, url: accessKey } } = resp;
    return { accessKey, id };
  } catch (err) {
    if (err.status !== 404) {
      if (err.response) {
        console.log(
          `Request for access key to room ${roomName}} failed with status ${err.response.status}`,
        );
        console.log(err.response.data);
      } else {
        console.log(
          `Error occured while requesting access key to room ${roomName}`,
        );
        console.log(err.message);
      }
    }
  }
  try {
    const resp = await axios.post(
      'https://api.daily.co/v1/rooms',
      {
        name: roomName,
        properties: {
          enable_people_ui: false,
          enable_screenshare: false,
          exp: Date.now() / 1000 + 1800,
          // enable_recording: 'cloud',
          // recordings_bucket: { allow_api_access: true },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DAILY_APIKEY}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    );
    const { data: { name: id, url: accessKey } } = resp;
    return { accessKey, id };
  } catch (err) {
    if (err.response) {
      console.log(
        `Request for access key to room ${roomName}} failed with status ${err.response.status}`,
      );
      console.log(err.response.data);
    } else {
      console.log(
        `Error occured while requesting access key to room ${roomName}`,
      );
      console.log(err.message);
    }
  }
}

export async function CloseRoom(roomId) {
  try {
    const resp = await axios.delete(`https://api.daily.co/v1/rooms/${roomId}`, {
      headers: {
        Authorization: `Bearer ${process.env.DAILY_APIKEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    if (resp.data.deleted) {
      console.log(`Room ${roomId} closed successfully`);
    }
  } catch (err) {
    if (err.response) {
      if (err.response.status === 404) {
        console.log(`Room ${roomId} already closed`);
      } else {
        console.log(
          `Room ${roomId} closure request failed with status code ${err.response.status}`,
        );
        console.log(err.response.data);
      }
    } else {
      console.log(`Error occured while requesting to close room ${roomId}`);
      console.log(err.message);
    }
  }
}
