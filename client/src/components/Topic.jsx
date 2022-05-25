import React from "react";
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown'

export default function Topic(props) {

    return (
        <ReactMarkdown>{"Your deliberation topic is: " + props.topic}</ReactMarkdown>
        
    )
}

