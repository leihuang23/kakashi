import { coordinatesSignal } from "./app-state.js";

const drawingState = {
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

export function setupDrawingCanvas() {
  initializeElements();
  initializeCanvas();
  attachEventListeners();
  resizeCanvas();
  updateStatus("Ready to draw.");
}

function initializeElements() {
  // Get canvas elements
  drawingState.canvas = document.getElementById("drawing-canvas");
  drawingState.ctx = drawingState.canvas.getContext("2d");
  drawingState.canvasContainer = document.getElementById(
    "drawing-canvas-container"
  );

  // Get UI elements
  drawingState.startBtn = document.getElementById("startBtn");
  drawingState.clearBtn = document.getElementById("clearBtn");
  drawingState.animatePathBtn = document.getElementById("animateBtn");
  drawingState.statusElem = document.getElementById("status");
  drawingState.confirmImageBtn = document.getElementById("confirmImageBtn");

  if (import.meta.env.DEV) {
    drawingState.uploadImageBtn = document.createElement("button");
    drawingState.uploadImageBtn.id = "uploadImageBtn";
    drawingState.uploadImageBtn.textContent = "Upload Image";
    drawingState.uploadImageBtn.type = "button";

    drawingState.imageUpload = document.createElement("input");
    drawingState.imageUpload.id = "imageUpload";
    drawingState.imageUpload.type = "file";
    drawingState.imageUpload.accept = "image/*";
    drawingState.imageUpload.style.display = "none";

    drawingState.startBtn.parentNode.insertBefore(
      drawingState.uploadImageBtn,
      drawingState.startBtn
    );
    drawingState.startBtn.parentNode.insertBefore(
      drawingState.imageUpload,
      drawingState.startBtn
    );
  }
}

function initializeCanvas() {
  drawingState.ctx.lineWidth = 3;
  drawingState.ctx.lineCap = "round";
  drawingState.ctx.lineJoin = "round";
  drawingState.ctx.strokeStyle = "#000000";
}

function attachEventListeners() {
  // Button click handlers
  drawingState.startBtn.addEventListener("click", toggleDrawing);
  drawingState.clearBtn.addEventListener("click", clearCanvas);
  drawingState.animatePathBtn.addEventListener("click", animatePath);
  drawingState.confirmImageBtn.addEventListener("click", confirmImagePosition);

  // Image upload handler
  if (
    import.meta.env.DEV &&
    drawingState.uploadImageBtn &&
    drawingState.imageUpload
  ) {
    drawingState.uploadImageBtn.addEventListener("click", () =>
      drawingState.imageUpload.click()
    );
    drawingState.imageUpload.addEventListener("change", handleImageUpload);
  }

  // Canvas mouse events
  drawingState.canvas.addEventListener("mousedown", handleMouseDown);
  drawingState.canvas.addEventListener("mousemove", handleMouseMove);
  drawingState.canvas.addEventListener("mouseup", handleMouseUp);
  drawingState.canvas.addEventListener("mouseout", stopDrawing);
  drawingState.canvas.addEventListener("wheel", handleMouseWheel);

  // Canvas touch events
  drawingState.canvas.addEventListener("touchstart", handleTouchStart);
  drawingState.canvas.addEventListener("touchmove", handleTouchMove);
  drawingState.canvas.addEventListener("touchend", handleTouchEnd);

  // Window resize event
  window.addEventListener("resize", resizeCanvas);
}

// ===== Status Management =====

function updateStatus(message) {
  drawingState.statusElem.textContent = message;
}

// ===== Drawing State Management =====

function toggleDrawing() {
  if (!drawingState.isRecording) {
    drawingState.isRecording = true;
    drawingState.pathCoordinates = [];
    drawingState.startBtn.textContent = "Stop Drawing";
    updateStatus("Recording your drawing...");
  } else {
    drawingState.isRecording = false;
    drawingState.startBtn.textContent = "Start Drawing";
    updateStatus(
      `Drawing completed! Recorded ${drawingState.pathCoordinates.length} points.`
    );

    navigator.clipboard
      .writeText(JSON.stringify(smoothPath(drawingState.pathCoordinates)))
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  }
}

function startDrawing(e) {
  e.preventDefault();
  if (!drawingState.isRecording || drawingState.isPositioningImage) return;

  drawingState.isDrawing = true;
  const pos = getPointerPosition(e);

  drawingState.ctx.beginPath();
  drawingState.ctx.moveTo(pos.x, pos.y);

  drawingState.pathCoordinates.push([Math.round(pos.x), Math.round(pos.y)]);
}

function draw(e) {
  e.preventDefault();
  if (
    !drawingState.isDrawing ||
    !drawingState.isRecording ||
    drawingState.isPositioningImage
  )
    return;

  drawingState.mouseX = e.clientX;
  drawingState.mouseY = e.clientY;

  if (!drawingState.ticking) {
    window.requestAnimationFrame(() => {
      const pos = getPointerPosition({
        clientX: drawingState.mouseX,
        clientY: drawingState.mouseY,
      });
      drawingState.ctx.lineWidth = 2;
      drawingState.ctx.lineTo(pos.x, pos.y);
      drawingState.ctx.stroke();

      drawingState.pathCoordinates.push([Math.round(pos.x), Math.round(pos.y)]);
      drawingState.ticking = false;
    });
    drawingState.ticking = true;
  }
}

function stopDrawing() {
  drawingState.isDrawing = false;
}

// ===== Canvas Management =====

function clearCanvas() {
  drawingState.ctx.clearRect(
    0,
    0,
    drawingState.canvas.width,
    drawingState.canvas.height
  );
  drawingState.pathCoordinates = [];
  drawingState.isRecording = false;
  drawingState.currentImage = null;
  drawingState.startBtn.textContent = "Start Drawing";
  drawingState.startBtn.disabled = false;
  drawingState.confirmImageBtn.style.display = "none";
  updateStatus("Canvas cleared. Ready to draw.");
}

function resizeCanvas() {
  const newWidth = drawingState.canvasContainer.clientWidth;
  const newHeight = newWidth * (2 / 3);

  drawingState.canvas.style.width = newWidth + "px";
  drawingState.canvas.style.height = newHeight + "px";

  const dpr = window.devicePixelRatio || 1;
  drawingState.canvas.width = newWidth * dpr;
  drawingState.canvas.height = newHeight * dpr;

  drawingState.ctx.resetTransform();
  drawingState.ctx.scale(dpr, dpr);

  if (drawingState.currentImage) {
    drawImageOnCanvas();
  }
}

// ===== Path Operations =====

function animatePath() {
  if (drawingState.pathCoordinates.length === 0) {
    updateStatus(
      "No path coordinates to animate. Please draw something first!"
    );
    return;
  }

  const smoothedPath = smoothPath(drawingState.pathCoordinates);
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
            drawingState.canvas.width / (img.width * window.devicePixelRatio),
            drawingState.canvas.height / (img.height * window.devicePixelRatio)
          ) * 0.8; // 80% of max size to leave room for adjustment

        drawingState.currentImage = img;
        drawingState.imageScale = scale;
        drawingState.imagePosition = {
          x:
            (drawingState.canvas.width / window.devicePixelRatio -
              img.width * scale) /
            2,
          y:
            (drawingState.canvas.height / window.devicePixelRatio -
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
  drawingState.isPositioningImage = true;
  drawingState.confirmImageBtn.style.display = "inline-block";
  drawingState.startBtn.disabled = true;
  updateStatus("Position the image and press Confirm when ready");
}

async function confirmImagePosition() {
  drawingState.isPositioningImage = false;
  drawingState.confirmImageBtn.style.display = "none";
  drawingState.startBtn.disabled = false;
  updateStatus("Image set! Click Start Drawing to trace over it.");

  drawImageOnCanvas();
}

function drawImageOnCanvas() {
  if (!drawingState.currentImage) return;

  drawingState.ctx.clearRect(
    0,
    0,
    drawingState.canvas.width,
    drawingState.canvas.height
  );

  drawingState.ctx.save();
  // Need to account for device pixel ratio in positioning
  drawingState.ctx.drawImage(
    drawingState.currentImage,
    drawingState.imagePosition.x,
    drawingState.imagePosition.y,
    drawingState.currentImage.width * drawingState.imageScale,
    drawingState.currentImage.height * drawingState.imageScale
  );
  drawingState.ctx.restore();

  if (
    !drawingState.isPositioningImage &&
    drawingState.pathCoordinates.length > 1
  ) {
    drawingState.ctx.beginPath();
    drawingState.ctx.moveTo(
      drawingState.pathCoordinates[0][0],
      drawingState.pathCoordinates[0][1]
    );
    for (let i = 1; i < drawingState.pathCoordinates.length; i++) {
      drawingState.ctx.lineTo(
        drawingState.pathCoordinates[i][0],
        drawingState.pathCoordinates[i][1]
      );
    }
    drawingState.ctx.stroke();
  }
}

// ===== Input Handling =====

function getPointerPosition(e) {
  const rect = drawingState.canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

// ===== Mouse Event Handlers =====

function handleMouseDown(e) {
  if (drawingState.isPositioningImage && drawingState.currentImage) {
    e.preventDefault();
    drawingState.isDraggingImage = true;
    drawingState.dragStart = getPointerPosition(e);
  } else {
    startDrawing(e);
  }
}

function handleMouseMove(e) {
  if (drawingState.isPositioningImage && drawingState.isDraggingImage) {
    e.preventDefault();
    const pos = getPointerPosition(e);
    const dx = pos.x - drawingState.dragStart.x;
    const dy = pos.y - drawingState.dragStart.y;

    drawingState.imagePosition.x += dx;
    drawingState.imagePosition.y += dy;
    drawingState.dragStart = pos;

    drawImageOnCanvas();
  } else {
    draw(e);
  }
}

function handleMouseUp(e) {
  if (drawingState.isDraggingImage) {
    drawingState.isDraggingImage = false;
  } else {
    stopDrawing();
  }
}

function handleMouseWheel(e) {
  if (drawingState.isPositioningImage && drawingState.currentImage) {
    e.preventDefault();

    // Get mouse position relative to image center
    const pos = getPointerPosition(e);

    // Adjust scale factor based on wheel direction
    const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = drawingState.imageScale * scaleFactor;

    // Don't allow the image to get too small or too large
    if (newScale > 0.1 && newScale < 5) {
      // Adjust position to zoom toward mouse position
      drawingState.imagePosition.x =
        pos.x - (pos.x - drawingState.imagePosition.x) * scaleFactor;
      drawingState.imagePosition.y =
        pos.y - (pos.y - drawingState.imagePosition.y) * scaleFactor;
      drawingState.imageScale = newScale;

      drawImageOnCanvas();
    }
  }
}

// ===== Touch Event Handlers =====

function handleTouchStart(e) {
  e.preventDefault();

  if (drawingState.isPositioningImage && drawingState.currentImage) {
    if (e.touches.length === 1) {
      // Single touch for dragging
      drawingState.isDraggingImage = true;
      drawingState.dragStart = {
        x:
          e.touches[0].clientX -
          drawingState.canvas.getBoundingClientRect().left,
        y:
          e.touches[0].clientY -
          drawingState.canvas.getBoundingClientRect().top,
      };
    } else if (e.touches.length === 2) {
      // Two fingers for pinching (zooming)
      drawingState.isDraggingImage = false;
      const touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      drawingState.lastPinchDistance = Math.hypot(
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
    drawingState.canvas.dispatchEvent(mouseEvent);
  }
}

function handleTouchMove(e) {
  e.preventDefault();

  if (drawingState.isPositioningImage && drawingState.currentImage) {
    if (e.touches.length === 1 && drawingState.isDraggingImage) {
      // Single touch drag
      const touchPos = {
        x:
          e.touches[0].clientX -
          drawingState.canvas.getBoundingClientRect().left,
        y:
          e.touches[0].clientY -
          drawingState.canvas.getBoundingClientRect().top,
      };

      const dx = touchPos.x - drawingState.dragStart.x;
      const dy = touchPos.y - drawingState.dragStart.y;

      drawingState.imagePosition.x += dx;
      drawingState.imagePosition.y += dy;
      drawingState.dragStart = touchPos;

      drawImageOnCanvas();
    } else if (e.touches.length === 2) {
      // Pinch to zoom
      const touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      const currentDistance = Math.hypot(
        touch1.x - touch2.x,
        touch1.y - touch2.y
      );

      if (drawingState.lastPinchDistance > 0) {
        const scaleFactor = currentDistance / drawingState.lastPinchDistance;
        const newScale = drawingState.imageScale * scaleFactor;

        // Calculate center between two fingers
        const centerX =
          (touch1.x + touch2.x) / 2 -
          drawingState.canvas.getBoundingClientRect().left;
        const centerY =
          (touch1.y + touch2.y) / 2 -
          drawingState.canvas.getBoundingClientRect().top;

        if (newScale > 0.1 && newScale < 5) {
          // Adjust position to zoom toward center of pinch
          drawingState.imagePosition.x =
            centerX - (centerX - drawingState.imagePosition.x) * scaleFactor;
          drawingState.imagePosition.y =
            centerY - (centerY - drawingState.imagePosition.y) * scaleFactor;
          drawingState.imageScale = newScale;

          drawImageOnCanvas();
        }
      }

      drawingState.lastPinchDistance = currentDistance;
    }
  } else if (e.touches.length === 1) {
    // Drawing mode
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    drawingState.canvas.dispatchEvent(mouseEvent);
  }
}

function handleTouchEnd(e) {
  e.preventDefault();
  if (drawingState.isDraggingImage) {
    drawingState.isDraggingImage = false;
  } else if (!drawingState.isPositioningImage) {
    // Only trigger mouseup in drawing mode
    const mouseEvent = new MouseEvent("mouseup");
    drawingState.canvas.dispatchEvent(mouseEvent);
  }

  // Reset pinch tracking
  drawingState.lastPinchDistance = 0;
}
