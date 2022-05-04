import { JitsiMeeting } from '@jitsi/react-sdk';
import PropTypes from "prop-types";
import React from "react";

export function VideoCall ({playerName, roomName}) {

    function handleJitsiIFrameRef (iframeRef) {
        iframeRef.style.border = '10px solid cadetblue';
        iframeRef.style.background = 'cadetblue';
        iframeRef.style.height = '400px';
    };

    return(
        <div>
            <JitsiMeeting
                domain="meet.jit.si"
                roomName={roomName}
                onApiReady={externalApi => {const api = externalApi}}
                getIFrameRef={handleJitsiIFrameRef}
                userInfo={{displayName: playerName}}
                configOverwrite={{  // options here: https://github.com/jitsi/jitsi-meet/blob/master/config.js
                    enableWelcomePage: false,  // this doesn't seem to be working...
                    readOnlyName: true,
                    toolbarButtons: ['camera', 'microphone'],
                    enableCalendarIntegration: false,
                }}
                interfaceConfigOverwrite={{
                    SHOW_CHROME_EXTENSION_BANNER: false,
                    SHOW_JITSI_WATERMARK: false,
                    MOBILE_APP_PROMO: false,  // Whether the mobile app Jitsi Meet is to be promoted to participants attempting to join a conference in a mobile Web browser.
                    
                }}
            />
        </div>
    )

}
