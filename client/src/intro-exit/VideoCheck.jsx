import React from "react";
import { VideoCall } from "../components/VideoCall";
import { Button } from "../components/Button";


export default function VideoCheck({next, usePlayer}) {
    const player = usePlayer()

    const invisibleStyle = {display: "none"};

    const questionsStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start'
    }

    const [canSee, setSee] = React.useState(false);
    const [noName, setNoName] = React.useState(false);
    const [backgroundInfo, setBackground] = React.useState(false);
    const [safePlace, setSafePlace] = React.useState(false);
    const [noInterrupt, setNoInterrupt] = React.useState(false);
    const [speakFree, setSpeakFree] = React.useState(false);
    const [enabled, setEnabled] = React.useState(false);

    const Checkbox = ({ label, value, onChange }) => {
        return (
          <div>
            <label>
                <input type="checkbox" checked={value} onChange={onChange} />
                {label}
            </label>
          </div>
        );
      };

    function handleSubmit(event) {
        if (canSee && 
            noName && 
            backgroundInfo && 
            safePlace && 
            noInterrupt && 
            speakFree) {
            next()
        } else {
            alert("Please confirm that you are ready to proceed")
        }
        event.preventDefault();
    };
    
    return (
    <div className="ml-5 mt-1 sm:mt-5 p-5">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Check your webcam</h3>
        <div className="mt-5 mb-8">
            <p className="mb-5 text-md text-gray-700">
                Please <b>click "Join Meeting"</b>to test that your webcam is working. 
                (You will be the only person in this meeting.)
            </p>

            <center>
            <VideoCall 
                playerName={player.get("name")} 
                roomName={Math.floor(Math.random() * 100) * Math.floor(Math.random() * 345459034)}
                position={'relative'} 
                left={'0px'} 
                right={'10px'}
                height={'500px'}
                width={'60%'} 

            />
            <input type="submit" id="invisible-button" onClick={() => next()} style={invisibleStyle}></input>
            </center>

            <p className="mt-5 text-md text-gray-700">
                <b>Please confirm the following to ensure you can participate in the discussion.</b>
            </p>
            <div className="mt-4">
                <form style={questionsStyle} onSubmit={handleSubmit}>
                    <div className="ml-5 space-y-1">
                        <Checkbox
                            label=" My camera and microphone are enabled."
                            value={enabled}
                            onChange={(e) => setEnabled(!enabled)}
                        />
                        <Checkbox
                            label=" I can see my full face in the video window."
                            value={canSee}
                            onChange={(e) => setSee(!canSee)}
                        />
                        <Checkbox
                            label=" Nothing in my background reveals my full name (i.e. a diploma on the wall, the name of an employer)."
                            value={noName}
                            onChange={(e) => setNoName(!noName)}
                        />
                        <Checkbox
                            label=" My background doesn't reveal other personal information I am not comfortable sharing."
                            value={backgroundInfo}
                            onChange={(e) => setBackground(!backgroundInfo)}
                        />
                        <Checkbox
                            label=" I am in a safe place to engage in a discussion."
                            value={safePlace}
                            onChange={(e) => setSafePlace(!safePlace)}
                        />
                        <Checkbox
                            label=" I am in a space where I can speak freely without bothering other people."
                            value={speakFree}
                            onChange={(e) => setSpeakFree(!speakFree)}
                        />
                        <Checkbox
                            label=" I will not be interrupted."
                            value={noInterrupt}
                            onChange={(e) => setNoInterrupt(!noInterrupt)}
                        />
                    </div>

                    <Button type="submit" autoFocus base='inline-flex items-center px-4 py-2 mt-6 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500'>
                        <p>Next</p>
                    </Button>
                </form>
            </div>
        </div>
    </div>    
    )
}