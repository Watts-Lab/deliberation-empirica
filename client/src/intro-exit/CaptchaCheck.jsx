import React, { useEffect, useState } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { useGlobal } from "@empirica/core/player/react";
import { Button } from "../components/Button";

export function CaptchaCheck({ next }) {
  const [userAnswer, setUserAnswer] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [loadedTime, setLoadedTime] = useState(-1);
  const [error, setError] = useState("");
  const [captchaQuestion, setCaptchaQuestion] = useState(null);
  const player = usePlayer();
  const globals = useGlobal();

  useEffect(() => {
    console.log("Intro: CAPTCHA Check");
    setLoadedTime(Date.now());
    generateCaptcha();
  }, []);

  const generateCaptcha = () => {
    // Generate a simple math problem
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operations = ['+', '-', '×'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    let answer;
    let question;
    
    switch (operation) {
      case '+':
        answer = num1 + num2;
        question = `${num1} + ${num2}`;
        break;
      case '-':
        // Ensure positive result
        const larger = Math.max(num1, num2);
        const smaller = Math.min(num1, num2);
        answer = larger - smaller;
        question = `${larger} - ${smaller}`;
        break;
      case '×':
        answer = num1 * num2;
        question = `${num1} × ${num2}`;
        break;
      default:
        answer = num1 + num2;
        question = `${num1} + ${num2}`;
    }
    
    setCaptchaQuestion({ question, answer });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    
    if (!captchaQuestion) {
      return;
    }

    const parsedAnswer = parseInt(userAnswer, 10);
    
    if (isNaN(parsedAnswer)) {
      setError("Please enter a valid number");
      return;
    }

    if (parsedAnswer === captchaQuestion.answer) {
      // Success
      const elapsed = (Date.now() - loadedTime) / 1000;
      player.set("duration_CaptchaCheck", { time: elapsed });
      player.set("captchaScore", {
        passed: true,
        attempts: attempts + 1,
        timestamp: Date.now(),
      });
      
      // Auto-advance after successful CAPTCHA
      setTimeout(() => {
        next();
      }, 500);
    } else {
      // Failed attempt
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError(`Incorrect answer. Please try again. (Attempt ${newAttempts})`);
      
      if (newAttempts >= 3) {
        // After 3 failed attempts, record failure
        player.set("captchaScore", {
          passed: false,
          attempts: newAttempts,
          timestamp: Date.now(),
        });
        setError("Too many failed attempts. You cannot proceed with this study.");
      } else {
        // Generate a new question
        setUserAnswer("");
        generateCaptcha();
      }
    }
  };

  if (!captchaQuestion) {
    return <div className="grid justify-center"><h1>⏳ Loading...</h1></div>;
  }

  // If failed 3 times, show failure message
  if (attempts >= 3) {
    return (
      <div className="grid justify-center">
        <div className="max-w-xl">
          <h1>❌ Verification Failed</h1>
          <p className="my-4 text-red-600">
            We could not verify that you are a human participant. 
            Thank you for your interest, but you cannot proceed with this study.
          </p>
          <p className="my-4 text-sm text-gray-600">
            If you believe this is an error, please contact the research team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid justify-center">
      <div className="max-w-xl">
        <h1>🤖 Human Verification</h1>
        <p className="my-4">
          To ensure you are a human participant, please solve the following simple math problem:
        </p>
        
        <div className="my-6 p-6 bg-gray-100 rounded-lg text-center">
          <p className="text-2xl font-bold mb-4">
            What is {captchaQuestion.question}?
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            className="mb-3 appearance-none block px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 w-full"
            type="text"
            autoComplete="off"
            id="inputCaptcha"
            data-test="inputCaptcha"
            placeholder="Enter your answer"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            disabled={attempts >= 3}
            autoFocus
          />
          
          {error && (
            <p className="text-red-600 text-sm italic mb-5" data-test="captchaError">
              {error}
            </p>
          )}
          
          {attempts < 3 && (
            <Button testId="continueCaptcha" handleClick={handleSubmit}>
              Submit
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
