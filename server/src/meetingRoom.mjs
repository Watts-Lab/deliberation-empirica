import axios from 'axios';

export async function GetRoomKey(playerName, roomName) {
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
  const { access_key } = body;
  // const record = await fetch(`https://api.eyeson.team/rooms/${access_key}/recording`, {
  //   method: 'POST',
  //   headers: {
  //       'Authorization': process.env.EYESON_APIKEY,
  //   }
  // })
  // if (record.status !== 201) {
  //   throw new Error('Failed to record meeting');
  // }
  return access_key;
}

export async function CloseRoom(access_key) {
  // const record = await axios.delete(`https://api.eyeson.team/rooms/${access_key}/recording`, {
  //   headers: {
  //     'Authorization': process.env.EYESON_APIKEY,
  //   }
  // })
  // if (record.status !== 200) {
  //   throw new Error('Failed to stop recording');
  // }
  const resp = await axios.get(`https://api.eyeson.team/rooms/${access_key}`, {
    headers: {
      'Authorization': process.env.EYESON_APIKEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
  const { data: body } = resp;
  if (resp.status !== 200) {
    console.log(body);
    throw new Error('Room Access Failed');
  }
  const { room: { id : rm_id }, recording: { id: recording_id } } = body;
  const rm = await axios.delete(`https://api.eyeson.team/rooms/${rm_id}`, {
    headers: {
      'Authorization': process.env.EYESON_APIKEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
  if (rm.status !== 204) {
    throw new Error('Room Closure failed');
  }
  return recording_id;
}

async function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function getRecording(id) {
  const recording = await axios.get(`https://api.eyeson.team/recordings/${id}`, {
    headers: {
      'Authorization': process.env.EYESON_APIKEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
  if (recording.status !== 200) {
    throw new Error('Failed to get Recording');
  }
  const { data: { links: { download } } } = recording;
  return download;
}

export async function DownloadRecording(recording_id) {
  let download = await getRecording(recording_id);
  while (!download) {
    await delay(1000);
    download = await getRecording(recording_id);
  }

  // const del_resp = await axios.delete(`https://api.eyeson.team/recordings/${recording_id}`, {
  //   headers: {
  //     'Authorization': process.env.EYESON_APIKEY,
  //     'Accept': 'application/json',
  //     'Content-Type': 'application/json',
  //   },
  // });
  // if (del_resp.status !== 200) {
  //   throw new Error('Failed to delete downloaded recording from eyeson cloud');
  // }
  return download;
}