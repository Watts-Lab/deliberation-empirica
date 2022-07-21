import React, { useState, useEffect, useRef } from "react";
import { VideoCall } from "../components/VideoCall";
import { Button } from "../components/Button";
import { usePlayer } from "@empirica/player";

const invisibleStyle = {display: "none"};

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

const flexStyle={
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start'
}

export default function VideoCheck({next}) {
    const player = usePlayer()
    const accessKey = player.get("accessKey")
    console.log(`Access Key: ${accessKey}`)
    
    const [canSee, setSee] = useState(false);
    const [noName, setNoName] = useState(false);
    const [backgroundInfo, setBackground] = useState(false);
    const [safePlace, setSafePlace] = useState(false);
    const [noInterrupt, setNoInterrupt] = useState(false);
    const [speakFree, setSpeakFree] = useState(false);
    const [enabled, setEnabled] = useState(false);
    const [videoCallEnabled, setVideoCallEnabled] = useState(window.Cypress ? false : true); //default hide in cypress test

    useEffect(() => {
        console.log("Intro: Video Check")
    }, []);


    useEffect(() => {
        // the following code works around https://github.com/empiricaly/empirica/issues/132
        // TODO: remove when empirica is updated
        if (!accessKey && videoCallEnabled) {
            const timer = setTimeout(() => {
                console.log("Refreshing to load video")
                window.location.reload()
            }, 2000)
            return () => clearTimeout(timer);
        }
    });

    useEffect(() => {
        if (videoCallEnabled) {
          console.log("Setting room name to player ID")
          player.set('roomName', player.id);
        } else {
          player.set('roomName', null) // done with this room, close it
        }
    
        return () => {
          player.set('roomName', null) // done with this room, close it
        }
      }, [videoCallEnabled]);


    function handleSubmit(event) {
        if (enabled &&
            canSee && 
            noName && 
            backgroundInfo && 
            safePlace && 
            noInterrupt && 
            speakFree) {
            console.log("Videocheck complete")
            next()
        } else {
            console.log("Videocheck submitted with errors")
            alert("Please confirm that you are ready to proceed")
        }
        event.preventDefault();
    };
    
    return (
    <div style={flexStyle} className="ml-5 mt-1 sm:mt-5 p-5">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Check your webcam</h3>
        <div className="mt-5 mb-8">
            <p className="mb-5 text-md text-gray-700">
                Please wait for the meeting to connect and take a moment to familiarize yourself with the video call software. 
                (You will be the only person in this meeting.)
            </p>

            <center>
                <input type="submit" data-test="skip" id="stageSubmitButton" onClick={() => next()} style={invisibleStyle}></input>
                <input type="checkbox" data-test="enableVideoCall" id="videoCallEnableCheckbox" onClick={ e => setVideoCallEnabled(e.target.checked) } style={invisibleStyle}></input>
                
                <div style={vidStyle}>
                { videoCallEnabled && accessKey && <VideoCall //only display video call when not in cypress, or on purpose
                    accessKey={accessKey}
                    record={false}
                    height={'450px'}
                />}

                {! accessKey && videoCallEnabled && <h2 data-test="loadingVideoCall"> Loading meeting room... </h2>}
                {! videoCallEnabled && <h2> Videocall Disabled for testing </h2>}
                </div>
            </center>

            <p className="mt-5 text-md text-gray-700">
                <b>Please confirm the following to ensure you can participate in the discussion.</b>
            </p>
            <div className="mt-4">
                <form style={questionsStyle} onSubmit={handleSubmit}>
                    <div className="ml-5 space-y-1">
                        <div className="mt-1">
                            <input type="checkbox" className="mr-2"  id="enabled" onClick={() => setEnabled(document.getElementById('enabled').checked)}/>
                            <label htmlFor="enabled" className="text-sm font-medium text-gray-700 my-2">
                                My camera and microphone are enabled.
                            </label>
                        </div>
                        <div className="mt-1">
                            <input className="mr-2" type="checkbox" id="see" onClick={() => setSee(document.getElementById('see').checked)}/>
                            <label htmlFor="see" className="text-sm font-medium text-gray-700 my-2">
                                I can see my full face in the video window.
                            </label>
                        </div>
                    <div className="mt-1">
                        <input className="mr-2" type="checkbox" id="noName" onClick={() => setNoName(document.getElementById('noName').checked)}/>
                        <label htmlFor="noName" className="text-sm font-medium text-gray-700 my-2">
                            Nothing in my background reveals my full name (i.e. a diploma on the wall, the name of an employer).
                        </label>
                    </div>
                    <div className="mt-1">
                        <input className="mr-2" type="checkbox" id="background" onClick={() => setBackground(document.getElementById('background').checked)}/> 
                        <label htmlFor="background" className="text-sm font-medium text-gray-700 my-2">
                            My background doesn't reveal other personal information I am not comfortable sharing.
                        </label> 
                    </div>
                    <div className="mt-1">
                        <input className="mr-2" type="checkbox" id="safeplace" onClick={() => setSafePlace(document.getElementById('safeplace').checked)}/>    
                        <label htmlFor="safeplace" className="text-sm font-medium text-gray-700 my-2">
                            I am in a safe place to engage in a discussion.
                        </label> 
                    </div>
                    <div className="mt-1">
                        <input className="mr-2" type="checkbox" id="speakFree" onClick={() => setSpeakFree(document.getElementById('speakFree').checked)}/>  
                        <label htmlFor="speakfree" className="text-sm font-medium text-gray-700 my-2">
                            I am in a space where I can speak freely without bothering other people.
                        </label>
                    </div>
                    <div className="mt-1">                   
                        <input className="mr-2" type="checkbox" id="noInterrupt" onClick={() => setNoInterrupt(document.getElementById('noInterrupt').checked)}/> 
                        <label htmlFor="noInterrupt" className="text-sm font-medium text-gray-700 my-2">
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
    )
}