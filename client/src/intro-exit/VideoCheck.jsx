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
    const [iframeEnabled, setIframeEnabled] = React.useState(window.Cypress ? false : true); //default hide in cypress test

    // const Checkbox = ({ label, value, onChange, }) => {
    //     return (
    //       <div>
    //         <label>
    //             <input type="checkbox" checked={value} onChange={onChange}/>
    //             {label}
    //         </label>
    //       </div>
    //     );
    //   };

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
            <input type="submit" data-test="skip" id="invisible-button" onClick={() => next()} style={invisibleStyle}></input>
            <input type="checkbox" data-test="enableIframe" id="invisible-button2" onClick={(cb)=>setIframeEnabled(cb.checked)} style={invisibleStyle}></input>

            {iframeEnabled && <VideoCall //only display video call when iframeEnabled
                playerName={player.get("name")} 
                roomName={Math.floor(Math.random() * 100) * Math.floor(Math.random() * 345459034)}
                position={'relative'} 
                left={'0px'} 
                right={'10px'}
                height={'500px'}
                width={'60%'} 
            />}
            </center>

            <p className="mt-5 text-md text-gray-700">
                <b>Please confirm the following to ensure you can participate in the discussion.</b>
            </p>
            <div className="mt-4">
                <form style={questionsStyle} onSubmit={handleSubmit}>
                    <div className="ml-5 space-y-1">
                        <div className="mt-1">
                            <input className="mr-2" type="checkbox" id="enabled" onClick={(cb) => setEnabled(cb.checked)}/>
                            <label htmlFor="enabled" className="text-sm font-medium text-gray-700 my-2">
                                My camera and microphone are enabled.
                            </label>
                        </div>
                        <div className="mt-1">
                            <input className="mr-2" type="checkbox" id="see" onClick={(cb) => setSee(cb.checked)}/>
                            <label htmlFor="see" className="text-sm font-medium text-gray-700 my-2">
                                I can see my full face in the video window.
                            </label>
                        </div>
                    <div className="mt-1">
                        <input className="mr-2" type="checkbox" id="noName" onClick={(cb) => setNoName(cb.checked)}/>
                        <label htmlFor="noName" className="text-sm font-medium text-gray-700 my-2">
                            Nothing in my background reveals my full name (i.e. a diploma on the wall, the name of an employer).
                        </label>
                    </div>
                    <div className="mt-1">
                        <input className="mr-2" type="checkbox" id="background" onClick={(cb) => setBackground(cb.checked)}/> 
                        <label htmlFor="background" className="text-sm font-medium text-gray-700 my-2">
                            My background doesn't reveal other personal information I am not comfortable sharing.
                        </label> 
                    </div>
                    <div className="mt-1">
                        <input className="mr-2" type="checkbox" id="safeplace" onClick={(cb) => setSafePlace(cb.checked)}/>    
                        <label htmlFor="safeplace" className="text-sm font-medium text-gray-700 my-2">
                            I am in a safe place to engage in a discussion.
                        </label> 
                    </div>
                    <div className="mt-1">
                        <input className="mr-2" type="checkbox" id="speakFree" onClick={(cb) => setSpeakFree(cb.checked)}/>  
                        <label htmlFor="speakfree" className="text-sm font-medium text-gray-700 my-2">
                            I am in a space where I can speak freely without bothering other people.
                        </label>
                    </div>
                    <div className="mt-1">                   
                        <input className="mr-2" type="checkbox" id="noInterrupt" onClick={(cb) => setNoInterrupt(cb.checked)}/> 
                        <label htmlFor="noInterrupt" className="text-sm font-medium text-gray-700 my-2">
                            I will not be interrupted.
                        </label>    
                    </div> 
                        {/* <Checkbox
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
                        /> */}
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