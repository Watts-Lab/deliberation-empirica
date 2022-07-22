import axios from 'axios';

export async function GetRoom(playerName, roomName) {
  try {
    const resp = await axios.post('https://api.eyeson.team/rooms', {
      'id': roomName,
      'user': {
        'name': playerName,
      },
      'options': {
        'show_label': false, // turn off eyeson logo
        'kick_available': false, // disable participant kick
      },
    }, {
      headers: {
        'Authorization': process.env.EYESON_APIKEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      validateStatus: status => status === 201,
    });
    const { data: { access_key : accessKey, room : { id } } } = resp;
    return { accessKey, id };
  } catch (err) {
    if (err.response) {
      console.log(`Request for access key to room ${id} failed with status ${err.response.status}`);
      console.log(err.response.data);
    } else {
      console.log(`Error occured while requesting access key to room ${id}`);
      console.log(err.message);
    }
  }
}

export async function CloseRoom(roomId) {
  try {
    const resp = await axios.delete(`https://api.eyeson.team/rooms/${roomId}`, {
      headers: {
        'Authorization': process.env.EYESON_APIKEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    if (resp.status === 204) {
      console.log(`Room ${roomId} closed successfully`);
    }
  } catch (err) {
    if (err.response) {
      if (err.status === 404) {
        console.log(`Room ${roomId} already closed`);
      } else {
        console.log(`Room ${roomId} closure request failed with status code ${resp.status}`);
        console.log(err.response.data);
      }
    } else {
      console.log(`Error occured while requesting to close room ${roomId}`);
      console.log(err.message);
    }
  }
}