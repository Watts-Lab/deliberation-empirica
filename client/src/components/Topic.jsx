import React from "react";
import PropTypes from 'prop-types';
import { usePlayer, useRound, useStage } from "@empirica/player";
import ReactMarkdown from 'react-markdown'

export default function Topic(props) {
    // TODO: replace default text with markdown renderer
    //const round = useRound;
    //const roundTopic = "abortion"

    return (
        <ReactMarkdown>{"Your deliberation topic is: " + props.topic}</ReactMarkdown>
    )
}

