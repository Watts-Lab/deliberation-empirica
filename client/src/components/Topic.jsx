import React from "react";
import ReactMarkdown from 'react-markdown'
// import { Button } from "../components/Button";
import { usePlayer } from "@empirica/player";
import { useState } from "react";

export function Radio({ selected, name, value, label, onChange }) {
    return (
        <p>
            <label className="text-sm font-medium text-gray-700">
            <input
                className="mr-2 shadow-sm sm:text-sm"
                type="radio"
                name={name}
                value={value}
                checked={selected === value}
                onChange={onChange}
            />
            {label}
            </label><br/>
      </p>
    );
  }

export default function Topic({topic, responseOwner, submitButton=true, whoClicked}) {

    //topic = JSON.stringify(topic)
    const question = topic.split("Prompt")[1].replace('"', "").split("Responses")[0].replace('"', "");
    const responses = topic.split("Responses")[1] //get everything after responses (the answers)
    const answers = responses.split("\n- ").filter((item) => item.length > 2)  // exclude empty rows
    const player = usePlayer()
    // for (let i = 0; i < answers.length; i++) {
    //     answers[i] = answers[i].replace("\\n", "");
    //     answers[i] = answers[i].replace('"', "")
    //   }
    
    // const player = usePlayer();
    // const stage = useStage();


    // useEffect(() => {
    //     if (stage.get("name") == "Discuss") {
    //         if (stage.get("discussionResponse") != null) {
    //             document.getElementById(stage.get("discussionResponse")).checked = true
    //         }
    //     } else {
    //         if (player.get("discussionResponse") != null) {
    //             document.getElementById(player.get("discussionResponse")).checked = true
    //         }
    //     }
    // })
    
    // function handleSelect() {
    //     player.set("discussionResponse", document.querySelector('input[name="response"]:checked').id);
    //     if (stage.get("name") === "Discuss") {
    //         //only update stage object if in disucssion
    //         stage.set("discussionResponse", document.querySelector('input[name="response"]:checked').id);
    //     }
    // }

   // const [hasClicked, setHasClicked] = useState(false);

    const handleChange = (e) => {
        responseOwner.set("hasClicked", true)
        responseOwner.set("topicResponse", e.target.value);
        responseOwner.set("clicker", whoClicked)
    }

    const hiding = document.getElementById('hiding');

    setTimeout(() => {
        if (hiding != null && (responseOwner.get("name") === "Discuss") && responseOwner.get("hasClicked")) {
            
  
            // 👇️ removes element from DOM
            console.log("hiding" + hiding);
            hiding.style.display = 'none';
           responseOwner.set("hasClicked", false)
          
            // 👇️ hides element (still takes up space on page)
            hiding.style.visibility = 'hidden';
        }

  }, 10000); // 👈️ time in milliseconds

    function renderAnswers (answers) {
        var rows = [];
        for (var i = 0; i < answers.length; i++) {
            rows.push( <Radio 
                name="answers" 
                value={answers[i]}
                label={answers[i]}
                selected={responseOwner.get("topicResponse")}
                onChange={handleChange} 
            />)
           
        }
        return <div>
            {rows}
            
            </div>;
    }


    return (
        <div>
            <ReactMarkdown className="block text-lg font-medium text-gray-1000 my-2">{question}</ReactMarkdown>
            <form>
                {renderAnswers(answers)}
                <br/>
                <br/>
                {submitButton && <input 
                    type="submit" 
                    onClick={() => player.stage.set("submit", true)}
                    className="inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500 border-transparent shadow-sm text-white bg-empirica-600 hover:bg-empirica-700"
                >
                </input>}
                { (responseOwner.get("name") === "Discuss") && responseOwner.get("hasClicked") && <h3 id="hiding" className="text-sm text-gray-500">{responseOwner.get("clicker")} changed the selected answer</h3>}
                {/* {submitButton && <Button handleClick={player.stage.set("submit", true)} primary>Submit</Button>} */}

            </form>
        </div>
        
    )
}

