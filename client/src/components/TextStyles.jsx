// tailwind has a class "prose" that contains headers, lists, and lets you set
// a default for those objects. You can set those defaults.
// https://tailwindcss.com/docs/typography-plugin  (Windi may have similar)
import React from "react";

export function H1({ children }) {
  return (
    <h2 className="text-2xl mt-6 font-medium text-gray-1000">{children}</h2>
  );
}

export function H2({ children }) {
  return (
    <h2 className="text-xl mt-4 font-medium text-gray-1000">{children}</h2>
  );
}

export function H3({ children }) {
  return <h3 className="text-lg mt-8 font-medium text-gray-900">{children}</h3>;
}

export function H4({ children }) {
  return <h3 className="mt-4 text-md font-medium text-gray-800">{children}</h3>;
}

export function UL({ children }) {
  return <ul className="list-circle list-inside">{children}</ul>;
}

export function LI({ children }) {
  return (
    <li className="mt-2 list-disc font-normal text-sm text-gray-600">
      {children}
    </li>
  );
}

export function P({ children }) {
  return <p className="mt-2 font-normal text-sm text-gray-700">{children}</p>;
}

// function that allows for hyperlinks, highlighted in blue and underlined
// potentially overwrites remarkGfm. you can't just say example.com and expect it to redirect.
// you must say (example.com)[example.com]
export function A({ href, children }) {
  return <a href = {href} className="text-blue-500 underline">{children}</a>
}