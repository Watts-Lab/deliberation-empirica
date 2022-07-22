import React, { useRef, useEffect } from 'react';
import './Video.css';

function Video({ stream }) {
  const ref = useRef(null);

  useEffect(() => {
    if(ref.current) {
      ref.current.srcObject = stream;
    }
  }, [ref]);

  return (
    <video className="Video" ref={ref} playsInline autoPlay />
  );
}

export default React.memo(Video)  