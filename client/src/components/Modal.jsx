import React from "react";
import ReactDom from "react-dom";
import { Button } from "./Button";

const MODAL_STYLES = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  backgroundColor: "#FFF",
  padding: "50px",
  zIndex: 1000,
};

export function Modal({ open, children, buttons }) {
  // Buttons is an array of objects with keys label and onClick
  // e.g. [{ label: "OK", onClick: () => { ... } }]

  if (!open) return null;

  return ReactDom.createPortal(
    <>
      <div className="fixed top-0 left-0 bottom-0 right-0 bg-gray-500 bg-opacity-70" />
      <div style={MODAL_STYLES}>
        {children}

        <div className="flex justify-center">
          {buttons.map((button) => (
            <Button
              key={button.label}
              className="inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500"
              onClick={button.onClick}
            >
              {button.label}
            </Button>
          ))}
        </div>
      </div>
    </>,
    document.getElementById("portal")
  );
}
