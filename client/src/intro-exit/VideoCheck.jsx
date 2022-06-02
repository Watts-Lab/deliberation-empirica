import React from "react";
import { VideoCall } from "../components/VideoCall";
import { Button } from "../components/Button";

export default function VideoCheck({next}) {

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

    const [canSee, setChecked1] = React.useState(false);
    const [noName, setChecked2] = React.useState(false);
    const [backgroundInfo, setChecked3] = React.useState(false);
    const [safePlace, setChecked4] = React.useState(false);
    const [noInterrupt, setChecked5] = React.useState(false);
    const [speakFree, setChecked6] = React.useState(false);
    const [enabled, setChecked7] = React.useState(false);

    const Checkbox = ({ label, value, onChange }) => {
        return (
          <label>
            <input type="checkbox" checked={value} onChange={onChange} />
            {label}
          </label>
        );
      };

    function handleButtonClick() {
        if (canSee && noName && backgroundInfo && safePlace && noInterrupt && speakFree) {
            next()
     }
    };
    
    return (
        <div style={screenStyle}>
            <h1 style={headerStyle}>Please join the test meeting and then confirm that your video works by checking the following:</h1>
        <VideoCall 
            playerName={"test"} 
            roomName={Math.floor(Math.random() * 100) * Math.floor(Math.random() * 345459034)}
            position={'relative'} 
            left={'10px'} 
            right ={'10px'}
            height = {'400px'}
            width = {'800px'} />
        <div style={questionsStyle}>
            <form></form>
        <Checkbox
            label=" My camera and microphone are enabled."
            value={enabled}
            onChange={(e) => setChecked7(!enabled)}
        />
        <Checkbox
            label=" I can see my full face in the video window."
            value={canSee}
            onChange={(e) => setChecked1(!canSee)}
        />
        <Checkbox
             label=" Nothing in my background reveals my full name (i.e. a diploma on the wall, the name of an employer)."
            value={noName}
            onChange={(e) => setChecked2(!noName)}
         />
        <Checkbox
            label=" My background doesn't reveal other personal information I am not comfortable sharing."
            value={backgroundInfo}
            onChange={(e) => setChecked3(!backgroundInfo)}
        />
        <Checkbox
            label=" I am in a safe place to engage in a discussion."
            value={safePlace}
            onChange={(e) => setChecked4(!safePlace)}
         />
        <Checkbox
            label=" I am in a space where I can speak freely without bothering other people."
            value={speakFree}
            onChange={(e) => setChecked6(!speakFree)}
        />
        <Checkbox
            label=" I will not be interrupted."
            value={noInterrupt}
            onChange={(e) => setChecked5(!noInterrupt)}
        />

                     <div>        
                <Button handleClick={handleButtonClick}
                base='px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500 autoFocus'>
                <p>Next</p>
                </Button>
            </div>
         </div>

        </div>
    )
}