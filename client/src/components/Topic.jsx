import React from "react";
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown'
import { marked } from 'marked';
import { useState } from "react";

export default function Topic(props) {
    const [index, setIndex] = useState(0);
    console.log(props.topic)
    const parsedTopic = marked.parse(props.topic);
    const topic = JSON.stringify(props.topic)
    console.log("parsed topic" + topic);
    const splitTopic = topic.split("Responses")
    const question = JSON.parse(splitTopic[0]);
    const responses = splitTopic[1] //get everything after responses (the answers)
    console.log("responses " + responses )
    const answers = responses.split("\\n- ")
    for (let i = 0; i < answers.length; i++) {
        answers[i] = answers[i].replace("\\n", "");
        answers[i] = answers[i].replace('"', "")
      }
    // answers.forEach((answer) => {
    //     if (answer.contains("\\n")) {
    //         answer.replace("\\n", "")
    //     }
    // })
    console.log(" length " + answers.length)



    return (
        <form>
            <ReactMarkdown>{question}</ReactMarkdown>
            <input type="radio" id={answers[1]} name="response"></input> 
            <label htmlFor={answers[1]}> {answers[1]}</label><br></br>
            <input type="radio" id={answers[2]} name="response"></input>
            <label htmlFor={answers[2]}> {answers[2]}</label><br></br>
            <input type="radio" id={answers[3]} name="response"></input>
            <label htmlFor={answers[3]}> {answers[3]}</label><br></br>
            <input type="radio" id={answers[4]} name="response"></input>
            <label htmlFor={answers[4]}> {answers[4]}</label><br></br>
            <input type="radio" id={answers[5]} name="response"></input>
            <label htmlFor={answers[5]}> {answers[5]}</label><br></br>
        </form>
        
        
        // <ReactMarkdown>{props.topic}</ReactMarkdown>
        
    )
}

