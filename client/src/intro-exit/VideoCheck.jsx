import React from "react";
import { VideoCall2 } from "../components/VideoCall2";
import { Button2 } from "../components/Button2";

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
        marginLeft: '50px'
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
     
    function handleChange1() {
        setChecked1(!canSee)
    }
    function handleChange2() {
        setChecked2(!noName)
    }    
    function handleChange3() {
        setChecked3(!backgroundInfo)
    }
    function handleChange4() {
        setChecked4(!safePlace)
    }
    function handleChange5() {
        setChecked5(!noInterrupt)
    }
    function handleChange6() {
        setChecked6(!speakFree)
    }
    
    return (
        <div style={screenStyle}>
            <h1 style={headerStyle}>Please confirm that your video works by checking the following:</h1>
        <VideoCall2 playerName={"test"} roomName={100}/>
        <div style={questionsStyle}>
        <Checkbox
            label=" I can see my face in the video window"
            value={canSee}
            onChange={handleChange1}
        />
        <Checkbox
             label=" My full name is not revealed anywhere in my video window"
            value={noName}
            onChange={handleChange2}
         />
        <Checkbox
            label=" Personal information is not revealed anywhere in my video window"
            value={backgroundInfo}
            onChange={handleChange3}
        />
        <Checkbox
            label=" I am in a safe place to engage in a discussion"
            value={safePlace}
            onChange={handleChange4}
         />
        <Checkbox
            label=" I will not be interrupted"
            value={noInterrupt}
            onChange={handleChange5}
        />
        <Checkbox
            label=" I am in a space where I can speak freely without bothering other people"
            value={speakFree}
            onChange={handleChange6}
         />
                     <div>        
                <Button2 handleClick={handleButtonClick} autoFocus>
                <p>Next</p>
                </Button2>
            </div>
         </div>

        </div>
    )
}