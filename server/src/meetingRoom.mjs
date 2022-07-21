import axios from 'axios';

export async function GetRoom(playerName, roomName) {
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
  });
  const { data: body } = resp;
  if (resp.status !== 201) {
    console.log(body.message);
    throw new Error('Join Room Failed');
  }
  const { access_key : accessKey, room : { id } } = body;
  
  return { accessKey, id };
}

export async function CloseRoom(roomId) {
  const resp = await axios.delete(`https://api.eyeson.team/rooms/${roomId}`, {
    headers: {
      'Authorization': process.env.EYESON_APIKEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
  const { data: body } = resp;
  if (resp.status === 204) {
    console.log(`Room ${roomId} closed successfully`);
  } else if (resp.status === 404) {
    console.log(`Room ${roomId} already closed`);
  } else {
    console.log(`Room ${roomId} closure request failed with status code ${resp.status}`);
    console.log(body);
  }
}