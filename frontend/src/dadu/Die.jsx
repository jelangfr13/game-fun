import React from "react";
import { PIPS } from "./constants";

export default function Die({ value, rolling }) {
  const cells = PIPS[value] || [];
  return (
    <div className={"die" + (rolling ? " die--rolling" : "")}>
      <div className="die__grid">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className={"pip" + (cells.includes(i) ? " pip--on" : "")} />
        ))}
      </div>
    </div>
  );
}
