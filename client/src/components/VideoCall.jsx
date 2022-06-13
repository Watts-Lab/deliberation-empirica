import { JitsiMeeting } from '@jitsi/react-sdk';
import PropTypes from "prop-types";
import React from "react";

export function VideoCall (props) {

    function handleJitsiIFrameRef (iframeRef) {
        iframeRef.style.border = '10px solid cadetblue';
        iframeRef.style.background = 'cadetblue';
        iframeRef.style.position = props.position
        iframeRef.style.left = props.left;
        iframeRef.style.right = props.right;
        iframeRef.style.height = props.height;
        iframeRef.style.width = props.width;
    };

    return(
        <div>
            <JitsiMeeting
                domain="meet.jit.si"
                roomName={props.roomName}
                onApiReady={externalApi => {const api = externalApi}}
                getIFrameRef={handleJitsiIFrameRef}
                userInfo={{displayName: props.playerName}}
                configOverwrite={{  // options here: https://github.com/jitsi/jitsi-meet/blob/master/config.js
                    enableWelcomePage: false,  // this doesn't seem to be working...
                    readOnlyName: false,
                    toolbarButtons: ['camera', 'microphone'],
                    enableCalendarIntegration: false,
                    //disableRemoteMute: true, //disables muting other participants
                    remoteVideoMenu: {
                        disabled: true, //disables entire menu
                        //disableKick: true, //disables just kicking
                    }
                    
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
