import React, { useRef, useEffect } from "react";
import "./Video.css";

function VideoFunc({ stream, muted }) {
  const ref = useRef(null);
  const streamRef = useRef(stream);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      streamRef.current = stream;
    }
  }, [ref, stream]);

  useEffect(() => () => {
      const tracks = streamRef?.current?.getTracks();
      console.log(tracks);
      tracks?.forEach(track => track.stop());
      console.log(tracks);
      if (streamRef?.current) {
        streamRef.current = null;
      }
      if (ref?.current?.srcObject) {
        ref.current.srcObject = null;
      }
    }, []);

  return <video className="Video" ref={ref} playsInline autoPlay muted={muted}/>;
}

export const Video = React.memo(VideoFunc);
