import React from "react";
import { useEffect } from "react";

export function ImmediateAdvance ({ next }) {
    useEffect(() => {
        next()
    })
    return (
        <h2>Redirecting...</h2>
    )
    
}