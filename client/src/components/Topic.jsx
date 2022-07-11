import React from "react";
import ReactMarkdown from 'react-markdown'
import { Button } from "../components/Button";

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

export default function Topic({topic, responseOwner, submitButton=true, }) {

    //topic = JSON.stringify(topic)
    const question = topic.split("Prompt")[1].replace('"', "").split("Responses")[0].replace('"', "");
    const responses = topic.split("Responses")[1] //get everything after responses (the answers)
    const answers = responses.split("\n- ").filter((item) => item.length > 2)  // exclude empty rows
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


    function renderAnswers (answers) {
        var rows = [];
        for (var i = 0; i < answers.length; i++) {
            rows.push( <Radio 
                name="answers" 
                value={answers[i]}
                label={answers[i]}
                selected={responseOwner.get("topicResponse")}
                onChange={(e) => {responseOwner.set("topicResponse", e.target.value)}} 
            />)
           
        }
        return <div>{rows}</div>;
    }


    return (
        <div>
            <ReactMarkdown>{question}</ReactMarkdown>
            <form>
                {renderAnswers(answers)}
                <br/>
                <br/>
                {submitButton && <Button handleClick={player.stage.set("submit", true)} primary>Submit</Button>}

            </form>
        </div>
        
    )
}

