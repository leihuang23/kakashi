import { signal } from "./tiny-state.mjs";

import { coordinates } from "./data.mjs";

const storedCoordinates = localStorage.getItem("pathCoordinates");

const initialCoordinates = storedCoordinates
  ? JSON.parse(storedCoordinates)
  : coordinates;

export const coordinatesSignal = signal(initialCoordinates);
