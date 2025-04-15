import { coordinatesSignal } from "../lib/app-state.mjs";

document.addEventListener("DOMContentLoaded", function () {
  initializeDrawingApp();
});

const appState = {
  // Canvas elements
  canvas: null,
  ctx: null,
  canvasContainer: null,

  // UI elements
  startBtn: null,
  clearBtn: null,
  animatePathBtn: null,
  statusElem: null,
  uploadImageBtn: null,
  imageUpload: null,
  confirmImageBtn: null,

  // Drawing state
  isDrawing: false,
  isRecording: false,
  pathCoordinates: [],

  // Image state
  currentImage: null,
  imagePosition: { x: 0, y: 0 },
  imageScale: 1,
  isPositioningImage: false,
  isDraggingImage: false,
  dragStart: { x: 0, y: 0 },
  lastPinchDistance: 0,

  // For throttling mouse move events
  mouseX: 0,
  mouseY: 0,
  ticking: false,
};

// ===== Initialization Functions =====

function initializeDrawingApp() {
  initializeElements();
  initializeCanvas();
  attachEventListeners();
  resizeCanvas();
  updateStatus("Ready to draw. You can upload an image or start drawing.");
}

function initializeElements() {
  // Get canvas elements
  appState.canvas = document.getElementById("drawing-canvas");
  appState.ctx = appState.canvas.getContext("2d");
  appState.canvasContainer = document.getElementById(
    "drawing-canvas-container"
  );

  // Get UI elements
  appState.startBtn = document.getElementById("startBtn");
  appState.clearBtn = document.getElementById("clearBtn");
  appState.animatePathBtn = document.getElementById("animateBtn");
  appState.statusElem = document.getElementById("status");
  appState.uploadImageBtn = document.getElementById("uploadImageBtn");
  appState.imageUpload = document.getElementById("imageUpload");
  appState.confirmImageBtn = document.getElementById("confirmImageBtn");
}

function initializeCanvas() {
  appState.ctx.lineWidth = 3;
  appState.ctx.lineCap = "round";
  appState.ctx.lineJoin = "round";
  appState.ctx.strokeStyle = "#000000";
}

function attachEventListeners() {
  // Button click handlers
  appState.startBtn.addEventListener("click", toggleDrawing);
  appState.clearBtn.addEventListener("click", clearCanvas);
  appState.animatePathBtn.addEventListener("click", animatePath);
  appState.uploadImageBtn.addEventListener("click", () =>
    appState.imageUpload.click()
  );
  appState.confirmImageBtn.addEventListener("click", confirmImagePosition);

  // Image upload handler
  appState.imageUpload.addEventListener("change", handleImageUpload);

  // Canvas mouse events
  appState.canvas.addEventListener("mousedown", handleMouseDown);
  appState.canvas.addEventListener("mousemove", handleMouseMove);
  appState.canvas.addEventListener("mouseup", handleMouseUp);
  appState.canvas.addEventListener("mouseout", stopDrawing);
  appState.canvas.addEventListener("wheel", handleMouseWheel);

  // Canvas touch events
  appState.canvas.addEventListener("touchstart", handleTouchStart);
  appState.canvas.addEventListener("touchmove", handleTouchMove);
  appState.canvas.addEventListener("touchend", handleTouchEnd);

  // Window resize event
  window.addEventListener("resize", resizeCanvas);
}

// ===== Status Management =====

function updateStatus(message) {
  appState.statusElem.textContent = message;
}

// ===== Drawing State Management =====

function toggleDrawing() {
  if (!appState.isRecording) {
    appState.isRecording = true;
    appState.pathCoordinates = [];
    appState.startBtn.textContent = "Stop Drawing";
    updateStatus("Recording your drawing...");
  } else {
    appState.isRecording = false;
    appState.startBtn.textContent = "Start Drawing";
    updateStatus(
      `Drawing completed! Recorded ${appState.pathCoordinates.length} points.`
    );

    navigator.clipboard
      .writeText(JSON.stringify(smoothPath(appState.pathCoordinates)))
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  }
}

function startDrawing(e) {
  e.preventDefault();
  if (!appState.isRecording || appState.isPositioningImage) return;

  appState.isDrawing = true;
  const pos = getPointerPosition(e);

  appState.ctx.beginPath();
  appState.ctx.moveTo(pos.x, pos.y);

  appState.pathCoordinates.push([Math.round(pos.x), Math.round(pos.y)]);
}

function draw(e) {
  e.preventDefault();
  if (
    !appState.isDrawing ||
    !appState.isRecording ||
    appState.isPositioningImage
  )
    return;

  appState.mouseX = e.clientX;
  appState.mouseY = e.clientY;

  if (!appState.ticking) {
    window.requestAnimationFrame(() => {
      const pos = getPointerPosition({
        clientX: appState.mouseX,
        clientY: appState.mouseY,
      });
      appState.ctx.lineWidth = 2;
      appState.ctx.lineTo(pos.x, pos.y);
      appState.ctx.stroke();

      appState.pathCoordinates.push([Math.round(pos.x), Math.round(pos.y)]);
      appState.ticking = false;
    });
    appState.ticking = true;
  }
}

function stopDrawing() {
  appState.isDrawing = false;
}

// ===== Canvas Management =====

function clearCanvas() {
  appState.ctx.clearRect(0, 0, appState.canvas.width, appState.canvas.height);
  appState.pathCoordinates = [];
  appState.isRecording = false;
  appState.currentImage = null;
  appState.startBtn.textContent = "Start Drawing";
  appState.startBtn.disabled = false;
  appState.confirmImageBtn.style.display = "none";
  updateStatus("Canvas cleared. Ready to draw.");
}

function resizeCanvas() {
  const newWidth = appState.canvasContainer.clientWidth;
  const newHeight = newWidth * (2 / 3);

  appState.canvas.style.width = newWidth + "px";
  appState.canvas.style.height = newHeight + "px";

  const dpr = window.devicePixelRatio || 1;
  appState.canvas.width = newWidth * dpr;
  appState.canvas.height = newHeight * dpr;

  appState.ctx.resetTransform();
  appState.ctx.scale(dpr, dpr);

  if (appState.currentImage) {
    drawImageOnCanvas();
  }
}

// ===== Path Operations =====

function animatePath() {
  if (appState.pathCoordinates.length === 0) {
    updateStatus(
      "No path coordinates to animate. Please draw something first!"
    );
    return;
  }

  const smoothedPath = smoothPath(appState.pathCoordinates);
  coordinatesSignal.value = smoothedPath;
  localStorage.setItem("pathCoordinates", JSON.stringify(smoothedPath));
  clearCanvas();
}

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

// ===== Image Handling =====

function handleImageUpload(e) {
  if (e.target.files && e.target.files[0]) {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        clearCanvas();

        const scale =
          Math.min(
            appState.canvas.width / (img.width * window.devicePixelRatio),
            appState.canvas.height / (img.height * window.devicePixelRatio)
          ) * 0.8; // 80% of max size to leave room for adjustment

        appState.currentImage = img;
        appState.imageScale = scale;
        appState.imagePosition = {
          x:
            (appState.canvas.width / window.devicePixelRatio -
              img.width * scale) /
            2,
          y:
            (appState.canvas.height / window.devicePixelRatio -
              img.height * scale) /
            2,
        };

        // Draw image and enable positioning
        drawImageOnCanvas();
        enableImagePositioning();
      };
      img.src = event.target.result;
    };

    reader.readAsDataURL(e.target.files[0]);
  }
}

function enableImagePositioning() {
  appState.isPositioningImage = true;
  appState.confirmImageBtn.style.display = "inline-block";
  appState.startBtn.disabled = true;
  updateStatus("Position the image and press Confirm when ready");
}

function confirmImagePosition() {
  appState.isPositioningImage = false;
  appState.confirmImageBtn.style.display = "none";
  appState.startBtn.disabled = false;
  updateStatus("Image set! Click Start Drawing to trace over it.");

  drawImageOnCanvas();
}

function drawImageOnCanvas() {
  if (!appState.currentImage) return;

  appState.ctx.clearRect(0, 0, appState.canvas.width, appState.canvas.height);

  appState.ctx.save();
  // Need to account for device pixel ratio in positioning
  appState.ctx.drawImage(
    appState.currentImage,
    appState.imagePosition.x,
    appState.imagePosition.y,
    appState.currentImage.width * appState.imageScale,
    appState.currentImage.height * appState.imageScale
  );
  appState.ctx.restore();

  if (!appState.isPositioningImage && appState.pathCoordinates.length > 1) {
    appState.ctx.beginPath();
    appState.ctx.moveTo(
      appState.pathCoordinates[0][0],
      appState.pathCoordinates[0][1]
    );
    for (let i = 1; i < appState.pathCoordinates.length; i++) {
      appState.ctx.lineTo(
        appState.pathCoordinates[i][0],
        appState.pathCoordinates[i][1]
      );
    }
    appState.ctx.stroke();
  }
}

// ===== Input Handling =====

function getPointerPosition(e) {
  const rect = appState.canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

// ===== Mouse Event Handlers =====

function handleMouseDown(e) {
  if (appState.isPositioningImage && appState.currentImage) {
    e.preventDefault();
    appState.isDraggingImage = true;
    appState.dragStart = getPointerPosition(e);
  } else {
    startDrawing(e);
  }
}

function handleMouseMove(e) {
  if (appState.isPositioningImage && appState.isDraggingImage) {
    e.preventDefault();
    const pos = getPointerPosition(e);
    const dx = pos.x - appState.dragStart.x;
    const dy = pos.y - appState.dragStart.y;

    appState.imagePosition.x += dx;
    appState.imagePosition.y += dy;
    appState.dragStart = pos;

    drawImageOnCanvas();
  } else {
    draw(e);
  }
}

function handleMouseUp(e) {
  if (appState.isDraggingImage) {
    appState.isDraggingImage = false;
  } else {
    stopDrawing();
  }
}

function handleMouseWheel(e) {
  if (appState.isPositioningImage && appState.currentImage) {
    e.preventDefault();

    // Get mouse position relative to image center
    const pos = getPointerPosition(e);

    // Adjust scale factor based on wheel direction
    const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = appState.imageScale * scaleFactor;

    // Don't allow the image to get too small or too large
    if (newScale > 0.1 && newScale < 5) {
      // Adjust position to zoom toward mouse position
      appState.imagePosition.x =
        pos.x - (pos.x - appState.imagePosition.x) * scaleFactor;
      appState.imagePosition.y =
        pos.y - (pos.y - appState.imagePosition.y) * scaleFactor;
      appState.imageScale = newScale;

      drawImageOnCanvas();
    }
  }
}

// ===== Touch Event Handlers =====

function handleTouchStart(e) {
  e.preventDefault();

  if (appState.isPositioningImage && appState.currentImage) {
    if (e.touches.length === 1) {
      // Single touch for dragging
      appState.isDraggingImage = true;
      appState.dragStart = {
        x: e.touches[0].clientX - appState.canvas.getBoundingClientRect().left,
        y: e.touches[0].clientY - appState.canvas.getBoundingClientRect().top,
      };
    } else if (e.touches.length === 2) {
      // Two fingers for pinching (zooming)
      appState.isDraggingImage = false;
      const touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      appState.lastPinchDistance = Math.hypot(
        touch1.x - touch2.x,
        touch1.y - touch2.y
      );
    }
  } else if (e.touches.length === 1) {
    // Drawing mode
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    appState.canvas.dispatchEvent(mouseEvent);
  }
}

function handleTouchMove(e) {
  e.preventDefault();

  if (appState.isPositioningImage && appState.currentImage) {
    if (e.touches.length === 1 && appState.isDraggingImage) {
      // Single touch drag
      const touchPos = {
        x: e.touches[0].clientX - appState.canvas.getBoundingClientRect().left,
        y: e.touches[0].clientY - appState.canvas.getBoundingClientRect().top,
      };

      const dx = touchPos.x - appState.dragStart.x;
      const dy = touchPos.y - appState.dragStart.y;

      appState.imagePosition.x += dx;
      appState.imagePosition.y += dy;
      appState.dragStart = touchPos;

      drawImageOnCanvas();
    } else if (e.touches.length === 2) {
      // Pinch to zoom
      const touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      const currentDistance = Math.hypot(
        touch1.x - touch2.x,
        touch1.y - touch2.y
      );

      if (appState.lastPinchDistance > 0) {
        const scaleFactor = currentDistance / appState.lastPinchDistance;
        const newScale = appState.imageScale * scaleFactor;

        // Calculate center between two fingers
        const centerX =
          (touch1.x + touch2.x) / 2 -
          appState.canvas.getBoundingClientRect().left;
        const centerY =
          (touch1.y + touch2.y) / 2 -
          appState.canvas.getBoundingClientRect().top;

        if (newScale > 0.1 && newScale < 5) {
          // Adjust position to zoom toward center of pinch
          appState.imagePosition.x =
            centerX - (centerX - appState.imagePosition.x) * scaleFactor;
          appState.imagePosition.y =
            centerY - (centerY - appState.imagePosition.y) * scaleFactor;
          appState.imageScale = newScale;

          drawImageOnCanvas();
        }
      }

      appState.lastPinchDistance = currentDistance;
    }
  } else if (e.touches.length === 1) {
    // Drawing mode
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    appState.canvas.dispatchEvent(mouseEvent);
  }
}

function handleTouchEnd(e) {
  e.preventDefault();
  if (appState.isDraggingImage) {
    appState.isDraggingImage = false;
  } else if (!appState.isPositioningImage) {
    // Only trigger mouseup in drawing mode
    const mouseEvent = new MouseEvent("mouseup");
    appState.canvas.dispatchEvent(mouseEvent);
  }

  // Reset pinch tracking
  appState.lastPinchDistance = 0;
}
