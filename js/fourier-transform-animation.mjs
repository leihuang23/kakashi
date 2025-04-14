import { List } from "../lib/list.mjs";
import { effect } from "../lib/tiny-state.mjs";
import { coordinatesSignal } from "../lib/app-state.mjs";

document.addEventListener("DOMContentLoaded", function () {
  const canvas = document.getElementById("animation-canvas");
  const ctx = canvas.getContext("2d");
  const canvasContainer = document.getElementById("animation-canvas-container");

  const fullScreenBtn = document.getElementById("fullScreenBtn");

  fullScreenBtn.addEventListener("click", function () {
    canvasContainer.classList.toggle("fullscreen");
    // resize after layout change
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
  });

  effect(() => {
    const coordinates = coordinatesSignal.value;
    return drawAnimationCanvas(coordinates);
  });

  function drawAnimationCanvas(coordinates) {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    coordinates.forEach((pt) => {
      if (pt[0] < minX) minX = pt[0];
      if (pt[0] > maxX) maxX = pt[0];
      if (pt[1] < minY) minY = pt[1];
      if (pt[1] > maxY) maxY = pt[1];
    });

    const designWidth = maxX - minX;
    const designHeight = maxY - minY;
    const designCenterX = minX + designWidth / 2;
    const designCenterY = minY + designHeight / 2;

    const complexPoints = coordinates.map((pt) => ({
      re: pt[0],
      im: pt[1],
    }));

    // Discrete Fourier Transform (DFT)
    function dft(x) {
      const N = x.length;
      const X = [];
      for (let k = 0; k < N; k++) {
        let re = 0,
          im = 0;
        for (let n = 0; n < N; n++) {
          const phi = (2 * Math.PI * k * n) / N;
          // Multiply by e^(-i*phi) = cos(phi) - i*sin(phi)
          re += x[n].re * Math.cos(phi) + x[n].im * Math.sin(phi);
          im += -x[n].re * Math.sin(phi) + x[n].im * Math.cos(phi);
        }
        re /= N;
        im /= N;
        const freq = k;
        const amp = Math.hypot(re, im);
        const phase = Math.atan2(im, re);
        X.push({ re, im, freq, amp, phase });
      }
      return X;
    }

    let fourier = dft(complexPoints);
    fourier.sort((a, b) => b.amp - a.amp);

    let time = 0;
    const dt = (2 * Math.PI) / fourier.length; // Time step per frame
    let path = List(fourier.length);
    const animationSpeed = 1; // Lower = slower, 1.0 = original speed
    let lastFrameTime = 0;
    let animationFrameId = null;

    let isPaused = false;
    let pauseStartTime = 0;
    const pauseDuration = 1500;

    function resizeCanvas() {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      const newWidth = canvasContainer.clientWidth;

      const newHeight = Math.min(newWidth * (2 / 3), window.innerHeight);

      canvas.style.width = newWidth + "px";
      canvas.style.height = newHeight + "px";

      // Set the drawing surface resolution
      // Use devicePixelRatio for sharper rendering on high-DPI screens
      const dpr = window.devicePixelRatio || 1;
      canvas.width = newWidth * dpr;
      canvas.height = newHeight * dpr;

      // Scale the context once here to compensate for devicePixelRatio
      // This ensures 1 CSS pixel corresponds to 1 drawing unit before our dynamic scaling
      ctx.resetTransform(); // Clear previous transforms before scaling
      ctx.scale(dpr, dpr);

      path.clear();
      time = 0;
      lastFrameTime = 0;

      animationFrameId = requestAnimationFrame(draw);
    }

    function draw(currentTime) {
      if (lastFrameTime === 0) lastFrameTime = currentTime;
      if (isPaused) {
        if (currentTime - pauseStartTime >= pauseDuration) {
          isPaused = false;
          time = time % (2 * Math.PI);
          path.clear();
        } else {
          animationFrameId = requestAnimationFrame(draw);
          return;
        }
      }

      const elapsed = currentTime - lastFrameTime;

      // Only update if enough time has passed (for slower animation)
      if (elapsed > 1000 / 60 / animationSpeed) {
        lastFrameTime = currentTime;

        // Use CSS dimensions for drawing logic before DPR scaling
        const cssWidth = parseFloat(canvas.style.width) || canvas.width;
        const cssHeight = parseFloat(canvas.style.height) || canvas.height;

        // Clear the canvas (considering the DPR scaling applied in resizeCanvas)
        // We need to clear the *physical* pixel area
        ctx.save();
        ctx.resetTransform(); // Temporarily remove DPR scaling for clearRect
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        ctx.save();

        const scaleX = cssWidth / designWidth;
        const scaleY = cssHeight / designHeight;
        const scale = Math.min(scaleX, scaleY) * 0.9;

        ctx.translate(cssWidth / 2, cssHeight / 2);
        ctx.scale(scale, scale);
        ctx.translate(-designCenterX, -designCenterY);

        let x = 0;
        let y = 0;
        const baseLineWidth = 1;

        for (let i = 0; i < fourier.length; i++) {
          let prevX = x;
          let prevY = y;
          const freq = fourier[i].freq;
          const radius = fourier[i].amp;
          const phase = fourier[i].phase;
          x += radius * Math.cos(freq * time + phase);
          y += radius * Math.sin(freq * time + phase);

          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
          ctx.lineWidth = baseLineWidth / scale;
          ctx.beginPath();
          ctx.arc(prevX, prevY, radius, 0, 2 * Math.PI);
          ctx.stroke();

          ctx.strokeStyle = "#fff";
          ctx.lineWidth = baseLineWidth / scale;
          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }

        path.prepend({ x, y });
        // if (path.length > 700) {
        // path.pop();
        // }

        ctx.beginPath();
        if (path.length > 0) {
          ctx.moveTo(path[0].x, path[0].y);
          for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
          }
          ctx.strokeStyle = "#ff4081";
          ctx.lineWidth = (baseLineWidth * 2) / scale;
          ctx.stroke();
        }

        ctx.restore();

        time += dt;
        if (time >= 2 * Math.PI) {
          isPaused = true;
          pauseStartTime = currentTime;
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resizeCanvas);

    resizeCanvas();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }
});
