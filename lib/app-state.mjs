import { signal } from "./tiny-state.mjs";

import { coordinates } from "./data.mjs";

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
