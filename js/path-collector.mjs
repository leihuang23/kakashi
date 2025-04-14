import { coordinatesSignal } from "../lib/app-state.mjs";

document.addEventListener("DOMContentLoaded", function () {
  const canvas = document.getElementById("drawing-canvas");
  const ctx = canvas.getContext("2d");
  const canvasContainer = document.getElementById("drawing-canvas-container");
  const startBtn = document.getElementById("startBtn");
  const clearBtn = document.getElementById("clearBtn");
  //   const getPathBtn = document.getElementById("getPathBtn");
  const animatePathBtn = document.getElementById("animateBtn");
  const statusElem = document.getElementById("status");

  let isDrawing = false;
  let isRecording = false;
  let pathCoordinates = [];

  // Initialize canvas
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000000";

  // Start drawing button
  startBtn.addEventListener("click", function () {
    if (!isRecording) {
      isRecording = true;
      pathCoordinates = [];
      startBtn.textContent = "Stop Drawing";
      statusElem.textContent = "Recording your drawing...";
    } else {
      isRecording = false;
      startBtn.textContent = "Start Drawing";
      statusElem.textContent = `Drawing completed! Recorded ${pathCoordinates.length} points.`;
    }
  });

  clearBtn.addEventListener("click", clearCanvas);

  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pathCoordinates = [];
    isRecording = false;
    startBtn.textContent = "Start Drawing";
    statusElem.textContent = "Canvas cleared. Ready to draw.";
  }

  // Get path coordinates button
  //   getPathBtn.addEventListener("click", function () {
  //     if (pathCoordinates.length > 0) {
  //       const strData = JSON.stringify(pathCoordinates);
  //       navigator.clipboard
  //         .writeText(strData)
  //         .then(() => {
  //           console.log("Path coordinates copied to clipboard!");
  //           statusElem.textContent = `Path coordinates copied to clipboard! Total points: ${pathCoordinates.length}`;
  //         })
  //         .catch((err) => {
  //           console.error("Failed to copy: ", err);
  //           statusElem.textContent = "Failed to copy path coordinates.";
  //         });
  //     } else {
  //       statusElem.textContent = "No drawing recorded yet.";
  //     }
  //   });

  animatePathBtn.addEventListener("click", function () {
    if (pathCoordinates.length === 0) {
      statusElem.textContent =
        "No path coordinates to animate. Please draw something first!";
      return;
    }
    const smoothedPath = smoothPath(pathCoordinates);
    coordinatesSignal.value = smoothedPath;
    localStorage.setItem("pathCoordinates", JSON.stringify(smoothedPath));
    clearCanvas();
  });

  // Mouse events for drawing
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseout", stopDrawing);

  // Touch events for mobile devices
  canvas.addEventListener("touchstart", handleTouchStart);
  canvas.addEventListener("touchmove", handleTouchMove);
  canvas.addEventListener("touchend", handleTouchEnd);

  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();

  function startDrawing(e) {
    e.preventDefault();
    if (!isRecording) return;

    isDrawing = true;
    const pos = getPosition(e);

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);

    pathCoordinates.push([Math.round(pos.x), Math.round(pos.y)]);
  }

  let mouseX = 0,
    mouseY = 0;
  let ticking = false;

  function draw(e) {
    e.preventDefault();
    if (!isDrawing || !isRecording) return;
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!ticking) {
      window.requestAnimationFrame(function () {
        const pos = getPosition({ clientX: mouseX, clientY: mouseY });
        ctx.lineWidth = 2;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    pathCoordinates.push([Math.round(pos.x), Math.round(pos.y)]);
        ticking = false;
      });
      ticking = true;
    }
  }

  function stopDrawing() {
    isDrawing = false;
  }

  function getPosition(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handleTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent("mousedown", {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      canvas.dispatchEvent(mouseEvent);
    }
  }

  function handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent("mousemove", {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      canvas.dispatchEvent(mouseEvent);
    }
  }

  function handleTouchEnd(e) {
    e.preventDefault();
    const mouseEvent = new MouseEvent("mouseup");
    canvas.dispatchEvent(mouseEvent);
  }

  function resizeCanvas() {
    const newWidth = canvasContainer.clientWidth;
    const newHeight = newWidth * (2 / 3);

    canvas.style.width = newWidth + "px";
    canvas.style.height = newHeight + "px";

    const dpr = window.devicePixelRatio || 1;
    canvas.width = newWidth * dpr;
    canvas.height = newHeight * dpr;

    ctx.resetTransform();
    ctx.scale(dpr, dpr);
  }
});

function smoothPath(originalPath) {
  if (!originalPath || originalPath.length < 3) {
    return originalPath ? [...originalPath] : [];
  }

  const smoothedPath = [];
  const n = originalPath.length;

  smoothedPath.push([...originalPath[0]]);

  for (let i = 1; i < n - 1; i++) {
    const p_prev = originalPath[i - 1];
    const p_curr = originalPath[i];
    const p_next = originalPath[i + 1];

    const avgX = (p_prev[0] + p_curr[0] + p_next[0]) / 3;
    const avgY = (p_prev[1] + p_curr[1] + p_next[1]) / 3;

    smoothedPath.push([Math.round(avgX), Math.round(avgY)]);
  }

  smoothedPath.push([...originalPath[n - 1]]);

  return smoothedPath;
}
