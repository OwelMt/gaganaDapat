import { useRef, useState } from "react";

export default function VideoStream() {
  const [points, setPoints] = useState([]);

 const handleClick = async (e) => {
  const rect = e.target.getBoundingClientRect();

  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;

  console.log("NORMALIZED:", x, y);

  const newPoints = [...points, { x, y }];
  setPoints(newPoints);

  if (newPoints.length === 2) {
    await fetch("http://localhost:8000/set-line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: newPoints })
    });

    setPoints([]);
  }
};
  return (
  <div style={{ position: "relative", width: 800 }}>
    
    <img
      src="http://localhost:8000/video"
      style={{
        width: "800px",
        height: "auto",
        display: "block"
      }}
    />

    <div
      onClick={handleClick}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "800px",
        height: "100%",
        cursor: "crosshair",
        zIndex: 10
      }}
    />

    <p>Click 2 points to draw line</p>
  </div>
);
}