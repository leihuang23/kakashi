let currentObserver = null;
let currentCleanup = null;

export function effect(fn) {
  const runEffect = () => {
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }

    currentObserver = runEffect;

    const cleanup = fn();

    currentCleanup = typeof cleanup === "function" ? cleanup : null;

    currentObserver = null;

    return cleanup;
  };

  return runEffect();
}

export function signal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();
  const cleanups = new Map();

  return {
    get value() {
      if (currentObserver) {
        subscribers.add(currentObserver);
      }
      return value;
    },
    set value(newValue) {
      if (!deepEqual(newValue, value)) {
        value = newValue;

        subscribers.forEach((subscriber) => {
          const cleanup = cleanups.get(subscriber);
          if (cleanup) {
            cleanup();
          }

          const newCleanup = subscriber();
          if (typeof newCleanup === "function") {
            cleanups.set(subscriber, newCleanup);
          } else {
            cleanups.delete(subscriber);
          }
        });
      }
    },
    subscribe(subscriber) {
      subscribers.add(subscriber);

      const cleanup = subscriber();
      if (typeof cleanup === "function") {
        cleanups.set(subscriber, cleanup);
      }

      return () => {
        subscribers.delete(subscriber);
        const subscriberCleanup = cleanups.get(subscriber);
        if (subscriberCleanup) {
          subscriberCleanup();
          cleanups.delete(subscriber);
        }
      };
    },
  };
}

function deepEqual(a, b) {
  if (a === b) return true;

  if (
    a == null ||
    b == null ||
    typeof a !== "object" ||
    typeof b !== "object"
  ) {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key])
  );
}
