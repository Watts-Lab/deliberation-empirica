import React, { useState, useEffect, useRef } from "react";
import { VideoCall } from "../components/VideoCall";
import { Button } from "../components/Button";
import { usePlayer, isDevelopment } from "@empirica/player";
import { Alert } from "../components/Alert";

const questionsStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start'
}

const vidStyle={
    padding:'15px',
    minWidth:'600px',
    width:'100%',
    maxWidth:'1000px'
}

const mainStyle={
    display: 'flex',
    flexDirection: 'row'
}

const flexStyle={
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start'
}

const rightStyle={
    width:'60%',
    minWidth:'400px'
}

export default function VideoCheck({next}) {
    const player = usePlayer()
    const accessKey = player.get("accessKey")
    console.log(`VideoCheck Access Key: ${accessKey}`)

    const urlParams = new URLSearchParams(window.location.search);
    const videoCallEnabledInDev = urlParams.get("videoCall") || false;
    
    
    const [canSee, setSee] = useState(false);
    const [noName, setNoName] = useState(false);
    const [backgroundInfo, setBackground] = useState(false);
    const [safePlace, setSafePlace] = useState(false);
    const [noInterrupt, setNoInterrupt] = useState(false);
    const [speakFree, setSpeakFree] = useState(false);
    const [enabled, setEnabled] = useState(false);
    const [incorrectResponse, setIncorrectResponse] = useState(false);

    useEffect(() => {
        console.log("Intro: Video Check")
        if (!isDevelopment || videoCallEnabledInDev) {
            console.log("Setting room name to player ID")
            player.set('roomName', player.id);

            return () => {
                player.set('roomName', null) // done with this room, close it
                player.set('accessKey', null)
            }
        }
        { isDevelopment && console.log(`Video Call Enabled: ${videoCallEnabledInDev}`) }
    }, []);


    useEffect(() => {
        // the following code works around https://github.com/empiricaly/empirica/issues/132
        // TODO: remove when empirica is updated
        if (!accessKey && (!isDevelopment || videoCallEnabledInDev)) {
            const timer = setTimeout(() => {
                console.log("Refreshing to load video")
                window.location.reload()
            }, 3000)
            return () => clearTimeout(timer);
        }
    });

    function handleSubmit(event) {

        let correctResponse = enabled && canSee && noName && backgroundInfo && safePlace && noInterrupt && speakFree

        if (correctResponse) {
            console.log("Videocheck complete")
            next()
        } else {
            console.log("Videocheck submitted with errors")
            setIncorrectResponse(true)
        }
        event.preventDefault();
    };

    if (incorrectResponse) {
        document.getElementById("alert").scrollIntoView(true)
    }

    return (
    <div style={flexStyle} id="alert" className="ml-5 mt-1 sm:mt-5 p-5">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Check your webcam</h3>
        <div className="mt-8 mb-8">
            {incorrectResponse && <div className="my-5">
                <Alert title="Not all of the necessary items were confirmed!" children="Please confirm all of the following to continue." kind="error" />
            </div>
            }

            <p className="my-8 text-md text-gray-700">
                Please wait for the meeting to connect and take a moment to familiarize yourself with the video call software. 
                (You will be the only person in this meeting.)
            </p>
        <div style={mainStyle}>
        <center>
                { isDevelopment && <input type="submit" data-test="skip" id="stageSubmitButton" onClick={() => next()} /> }
                { ! accessKey && <h2 data-test="loadingVideoCall"> Loading meeting room... </h2>}
                { isDevelopment && ! videoCallEnabledInDev && <h2> Videocall Disabled for testing. To enable, add URL parameter "&videoCall=true" </h2> }

                <div style={vidStyle}>
                    { accessKey && <VideoCall
                        accessKey={accessKey}
                        record={false}
                        height={'450px'}
                    />}
                </div>
            </center>


            <div style={rightStyle}>
            <p className="mt-2 text-md text-gray-700">
                <b>Please confirm the following to ensure you can participate in the discussion.</b>
            </p>
                <form style={questionsStyle} onSubmit={handleSubmit}>
                    <div className="ml-5 space-y-1">
                        <div className="mt-1">
                            <input type="checkbox" className="mr-2"  id="enabled" onClick={() => setEnabled(document.getElementById('enabled').checked)}/>
                            <label htmlFor="enabled" class="display-6" className="text-gray-700 my-2">
                                My camera and microphone are enabled.
                            </label>
                        </div>
                        <div className="mt-1">
                            <input className="mr-2" type="checkbox" id="see" onClick={() => setSee(document.getElementById('see').checked)}/>
                            <label htmlFor="see" class="display-6" className="text-gray-700 my-2">
                                I can see my full face in the video window.
                            </label>
                        </div>
                    <div className="mt-1">
                        <input className="mr-2" type="checkbox" id="noName" onClick={() => setNoName(document.getElementById('noName').checked)}/>
                        <label htmlFor="noName" class="display-6" className="text-gray-700 my-2">
                            Nothing in my background reveals my full name (i.e. a diploma on the wall, the name of an employer).
                        </label>
                    </div>
                    <div className="mt-1">
                        <input className="mr-2" type="checkbox" id="background" onClick={() => setBackground(document.getElementById('background').checked)}/> 
                        <label htmlFor="background" class="display-6" className="text-gray-700 my-2">
                            My background doesn't reveal other personal information I am not comfortable sharing.
                        </label> 
                    </div>
                    <div className="mt-1">
                        <input className="mr-2" type="checkbox" id="safeplace" onClick={() => setSafePlace(document.getElementById('safeplace').checked)}/>    
                        <label htmlFor="safeplace" class="display-6" className="text-gray-700 my-2">
                            I am in a safe place to engage in a discussion.
                        </label> 
                    </div>
                    <div className="mt-1">
                        <input className="mr-2" type="checkbox" id="speakFree" onClick={() => setSpeakFree(document.getElementById('speakFree').checked)}/>  
                        <label htmlFor="speakfree" class="display-6" className="text-gray-700 my-2">
                            I am in a space where I can speak freely without bothering other people.
                        </label>
                    </div>
                    <div className="mt-1">                   
                        <input className="mr-2" type="checkbox" id="noInterrupt" onClick={() => setNoInterrupt(document.getElementById('noInterrupt').checked)}/> 
                        <label htmlFor="noInterrupt" class="display-6" className="text-gray-700 my-2">
                            I will not be interrupted.
                        </label>    
                    </div> 
                    </div>

                    <Button type="submit" base='inline-flex items-center px-4 py-2 mt-6 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500'>
                        <p>Next</p>
                    </Button>
                </form>
            </div>
        </div>

        </div>
    </div>    
    )
}