import React from "react";
import { Button } from "../components/Button";

export function CheckUnderstanding() {
    const [time, setTime] = useState("");

    function handleTime() {
        setTime(e.target.value);
    }

    function handleSubmit() {

    }

    return (
        <form className="mt-12 space-y-8 divide-y divide-gray-200" onSubmit={handleSubmit}>
            <div className="mt-3 sm:mt-5 p-20">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Answer the following questions to confirm your understanding of the instructions.
                </h3>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 my-2">
                  How long is the commitment?
                </label>
                <div className="grid gap-2">
                  <Radio
                    selected={time}
                    name="time"
                    value="10-minutes"
                    label="10 minutes"
                    onChange={handleTime}
                  />
                  <Radio
                    selected={time}
                    name="time"
                    value="correct"
                    label="CORRECT ANSWER"
                    onChange={handleTime}
                  />
                  <Radio
                    selected={time}
                    name="time"
                    value="1-hour"
                    label="1 hour"
                    onChange={handleTime}
                  />
                  <Radio
                    selected={time}
                    name="time"
                    value="3-hours"
                    label="3 hours"
                    onChange={handleTime}
                  />
                </div>
                
              </div>
            <div className="mb-12">
                <Button type="submit">Submit</Button>
            </div> 
        </form>
    )


};