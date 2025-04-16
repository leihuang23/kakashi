import { signal } from "./lib/tiny-state.js";

import { coordinates } from "./lib/data.js";

const storedCoordinatesStr = localStorage.getItem("pathCoordinates");
const safeParse = (data) => {
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error("Error parsing coordinates from localStorage:", error);
    return null;
  }
};

const initialCoordinates = safeParse(storedCoordinatesStr) ?? coordinates;

export const coordinatesSignal = signal(initialCoordinates);
