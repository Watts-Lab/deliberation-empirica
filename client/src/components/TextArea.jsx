import React from "react";

export function TextArea({ defaultText, onChange }) {
  return (
    <div>
      <textarea id="responseTextArea" rows="5" defaultValue={defaultText} />
    </div>
  );
}
