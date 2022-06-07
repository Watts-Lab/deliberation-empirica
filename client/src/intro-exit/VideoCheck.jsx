import React from "react";
import { VideoCall } from "../components/VideoCall";
import { Button } from "../components/Button";


export default function VideoCheck({next, usePlayer}) {
    const player = usePlayer()

    const screenStyle = {
        display: 'flex',
        flexDirection: 'column',
        width: '1000px',
        height: '1000px',
        margin: '10px',
        alignItems: 'flex-start',
        gap: '10px',
        marginLeft: '50px'
    }

    const headerStyle = {
        marginLeft: '10px'
    }

    const questionsStyle = {
        display: 'flex',
        flexDirection: 'column',
        width: '1000px',
        height: '500px',
        margin: '10px',
        alignItems: 'flex-start',
        gap: '8px'
    }

    const [canSee, setSee] = React.useState(false);
    const [noName, setNoName] = React.useState(false);
    const [backgroundInfo, setBackground] = React.useState(false);
    const [safePlace, setSafePlace] = React.useState(false);
    const [noInterrupt, setNoInterrupt] = React.useState(false);
    const [speakFree, setSpeakFree] = React.useState(false);
    const [enabled, setEnabled] = React.useState(false);

    const Checkbox = ({ className, label, value, onChange }) => {
        return (
          <div className={className}>
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
    <div>
        <h1 style={headerStyle}>Step 2: Check your webcam</h1>
        <div style={screenStyle}>
            
            <VideoCall 
                playerName={player.get("name")} 
                roomName={Math.floor(Math.random() * 100) * Math.floor(Math.random() * 345459034)}
                position={'relative'} 
                left={'10px'} 
                right ={'10px'}
                height = {'400px'}
                width = {'100%'} 
            />

            <p>
                Please <strong>click "Join Meeting"</strong>to test that your webcam is working. 
                (You will be the only person in this meeting.)
            </p>
            <p> </p>
            <div style={questionsStyle}>
                <form onSubmit={handleSubmit}>
                    <Checkbox
                        className="mt-2"
                        label=" My camera and microphone are enabled."
                        value={enabled}
                        onChange={(e) => setEnabled(!enabled)}
                    />
                    <Checkbox
                        className="mt-2"
                        label=" I can see my full face in the video window."
                        value={canSee}
                        onChange={(e) => setSee(!canSee)}
                    />
                    <Checkbox
                        className="mt-2"
                        label=" Nothing in my background reveals my full name (i.e. a diploma on the wall, the name of an employer)."
                        value={noName}
                        onChange={(e) => setNoName(!noName)}
                    />
                    <Checkbox
                        className="mt-2"
                        label=" My background doesn't reveal other personal information I am not comfortable sharing."
                        value={backgroundInfo}
                        onChange={(e) => setBackground(!backgroundInfo)}
                    />
                    <Checkbox
                        className="mt-2"
                        label=" I am in a safe place to engage in a discussion."
                        value={safePlace}
                        onChange={(e) => setSafePlace(!safePlace)}
                    />
                    <Checkbox
                        className="mt-2"
                        label=" I am in a space where I can speak freely without bothering other people."
                        value={speakFree}
                        onChange={(e) => setSpeakFree(!speakFree)}
                    />
                    <Checkbox
                        className="mt-2"
                        label=" I will not be interrupted."
                        value={noInterrupt}
                        onChange={(e) => setNoInterrupt(!noInterrupt)}
                    />

                    <div>        
                        <Button 
                            type="submit"
                            base='px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500 autoFocus'
                        >
                            Next
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    </div>    
    )
}