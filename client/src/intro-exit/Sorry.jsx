import React from "react";
import { Button } from "../components/Button";

export function Sorry({ next }) {
    return (
        <div className="ml-5 mt-1 sm:mt-5 p-5 basis-1/2">
            <h3 className="text-lg mb-10 mt-10 text-center leading-6 font-medium text-gray-500">
                Sorry, unfortunately all experiments are full at this time. 
            </h3>
            <h3 className="text-lg mb-10 mt-10 text-center leading-6 font-medium text-gray-500">
                Please click Next to proceed.
            </h3>
            <Button type="submit" base='inline-flex items-center px-4 py-2 mt-6 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500'>Next</Button>
        </div>
    )
}