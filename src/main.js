import "./style.css";

import { setupAnimation } from "./animation";
import { setupDrawingCanvas } from "./path-collector";

document.addEventListener("DOMContentLoaded", function () {
  setupDrawingCanvas();
  setupAnimation();
});
