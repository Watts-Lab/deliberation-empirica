import React from "react";
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown'
import { usePlayer } from "@empirica/player";
import { useStage } from "@empirica/player";
import { useState } from "react";
import { useEffect } from "react";

export default function Topic(props) {
    const stringTopic = JSON.stringify(props.topic)
    const question = props.topic.split("Prompt")[1].replace('"', "").split("Responses")[0].replace('"', "");
    const responses = stringTopic.split("Responses")[1] //get everything after responses (the answers)
    const answers = responses.split("\\n- ")
    for (let i = 0; i < answers.length; i++) {
        answers[i] = answers[i].replace("\\n", "");
        answers[i] = answers[i].replace('"', "")
      }
    
    const player = usePlayer();
    const stage = useStage();
    const [checkedBtn, setCheckedBtn] = useState(stage.get("discussionResponse"));

    useEffect(() => {
        if (stage.get("name") == "Discuss") {
            if (stage.get("discussionResponse") != null) {
                document.getElementById(stage.get("discussionResponse")).checked = true
            }
        }
    })
    
    function handleSelect() {
        player.set("discussionResponse", document.querySelector('input[name="response"]:checked').id);
        if (stage.get("name") === "Discuss") {
            //only update stage object if in disucssion
            stage.set("discussionResponse", document.querySelector('input[name="response"]:checked').id);
        }
    }



    return (
        <form>
            <ReactMarkdown>{question}</ReactMarkdown>
            <input type="radio" id={answers[1]} name="response" onClick={handleSelect}></input> 
            <label htmlFor={answers[1]}> {answers[1]} </label><br></br>
            <input type="radio" id={answers[2]} name="response" onClick={handleSelect}></input>
            <label htmlFor={answers[2]}> {answers[2]}</label><br></br>
            <input type="radio" id={answers[3]} name="response" onClick={handleSelect}></input>
            <label htmlFor={answers[3]}> {answers[3]}</label><br></br>
            <input type="radio" id={answers[4]} name="response" onClick={handleSelect}></input>
            <label htmlFor={answers[4]}> {answers[4]}</label><br></br>
            <input type="radio" id={answers[5]} name="response" onClick={handleSelect}></input>
            <label htmlFor={answers[5]}> {answers[5]}</label><br></br>
        </form>
        
        
        // <ReactMarkdown>{props.topic}</ReactMarkdown>
        
    )
}

