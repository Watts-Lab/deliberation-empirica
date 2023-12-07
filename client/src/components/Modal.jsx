import React from "react";
import ReactDom from "react-dom";
import { Button } from "./Button";

const MODAL_STYLES = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  backgroundColor: "#FFF",
  padding: "20px",
  zIndex: 1000,
  borderRadius: "10px",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
};

export function Modal({ open, children, buttons, buttonOrientation }) {
  // Buttons is an array of objects with keys label and onClick
  // e.g. [{ label: "OK", onClick: () => { ... } }]

  if (!open) return null;

  return ReactDom.createPortal(
    <>
      <div className="fixed top-0 z-50 left-0 bottom-0 right-0 bg-gray-500 bg-opacity-70 " />
      <div style={MODAL_STYLES}>
        {children}

        <div
          className={`flex justify-center mt-4 ${
            buttonOrientation === "column"
              ? "flex-col space-y-4"
              : "flex-row space-x-4"
          }`}
        >
          {buttons.map((button) => (
            <Button
              key={button.label}
              className="inline-flex"
              handleClick={button.onClick}
            >
              {button.label}
            </Button>
          ))}
        </div>
      </div>
    </>,
    document.getElementById("modal-root")
  );
}
