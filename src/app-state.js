import { signal, createPersistMiddleware, use } from "./lib/tiny-signal.js";

import { coordinates } from "./lib/data.js";

use(createPersistMiddleware());

export const coordinatesSignal = signal(coordinates, {
  persist: {
    key: "pathCoordinates",
  },
});
