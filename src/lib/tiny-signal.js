/**
 * Tiny reactive signal system adapted from SolidJS.
 * (https://github.com/solidjs/solid/blob/main/packages/solid/src/reactive/signal.ts)
 * Provides primitives for creating reactive signals, memos, and effects.
 *
 * @module tiny-signal
 */

let Listener = null;
let Updates = null;
let Effects = null;
let ExecCount = 0;
let Scheduler = null;

/**
 * Performs a deep equality check between two values.
 * @param {*} a - The first value.
 * @param {*} b - The second value.
 * @returns {boolean} Whether the values are deeply equal.
 * @private
 */
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

/**
 * Subscribes a computation to a set of subscriptions.
 * @param {Object} running - The computation to subscribe.
 * @param {Set} subscriptions - The set of subscriptions.
 * @private
 */
function subscribe(running, subscriptions) {
  subscriptions.add(running);
  running.dependencies.add(subscriptions);
}

/**
 * Clears all dependencies for a computation.
 * @param {Object} running - The computation whose dependencies are to be cleared.
 * @private
 */
function clearDependencies(running) {
  for (const dep of running.dependencies) {
    dep.delete(running);
  }
  running.dependencies.clear();
}

/**
 * Runs all computations in a queue.
 * @param {Array} queue - The queue of computations.
 * @private
 */
function runQueue(queue) {
  for (let i = 0; i < queue.length; i++) {
    runTop(queue[i]);
  }
}

/**
 * Runs all effects in a queue, separating user effects from system effects.
 * @param {Array} queue - The queue of effects.
 * @private
 */
function runEffects(queue) {
  let userEffects = [];

  for (let i = 0; i < queue.length; i++) {
    const e = queue[i];
    if (!e.user) runTop(e);
    else userEffects.push(e);
  }

  for (let i = 0; i < userEffects.length; i++) {
    runTop(userEffects[i]);
  }
}

/**
 * Runs updates in a batch, handling errors and effect completion.
 * @param {Function} fn - The function to run.
 * @param {boolean} [init] - Whether this is an initial run.
 * @returns {*} The result of the function.
 * @private
 */
function runUpdates(fn, init) {
  if (Updates) return fn();

  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;
  else Effects = [];

  ExecCount++;

  try {
    const res = fn();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!wait) Effects = null;
    Updates = null;
    throw err;
  }
}

/**
 * Completes all pending updates and effects.
 * @param {boolean} wait - Whether to wait for effects.
 * @private
 */
function completeUpdates(wait) {
  if (Updates) {
    if (Scheduler) {
      scheduleQueue(Updates);
    } else {
      runQueue(Updates);
    }
    Updates = null;
  }

  if (wait) return;

  const e = Effects;
  Effects = null;

  if (e.length) {
    runUpdates(() => runEffects(e), false);
  }
}

/**
 * Schedules a queue of computations using the Scheduler.
 * @param {Array} queue - The queue to schedule.
 * @private
 */
function scheduleQueue(queue) {
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    Scheduler(() => {
      runUpdates(() => runTop(item), false);
    });
  }
}

/**
 * Executes a computation if it is not already up-to-date.
 * @param {Object} running - The computation to run.
 * @private
 */
function runTop(running) {
  if (running.state === 0) return;
  running.execute();
}

/**
 * Enables scheduling of updates using a specified scheduler.
 * @param {"animation"|"idle"|Function} [scheduler="animation"] - The scheduler to use for batching updates.
 *   - "animation": Uses `requestAnimationFrame` for scheduling.
 *   - "idle": Uses `window.requestIdleCallback` if available, otherwise falls back to `setTimeout`.
 *   - Function: A custom scheduling function that receives a callback to execute.
 */
export function enableScheduling(scheduler = "animation") {
  if (scheduler === "animation") {
    Scheduler = requestAnimationFrame;
  } else if (scheduler === "idle") {
    Scheduler = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
  } else if (typeof scheduler === "function") {
    Scheduler = scheduler;
  }
}

/**
 * Creates a reactive signal.
 * @template T
 * @param {T} initialValue - The initial value of the signal.
 * @returns {{
 *   value: T,
 *   subscribe: (subscriber: Object) => () => void
 * }}
 */
export function signal(initialValue) {
  let value = initialValue;
  const subscriptions = new Set();

  return {
    get value() {
      if (Listener) subscribe(Listener, subscriptions);
      return value;
    },
    set value(nextValue) {
      if (deepEqual(value, nextValue)) return;
      value = nextValue;

      runUpdates(() => {
        for (const sub of [...subscriptions]) {
          sub.state = 1;
          if (sub.pure) {
            if (!Updates) Updates = [];
            Updates.push(sub);
          } else {
            if (!Effects) Effects = [];
            Effects.push(sub);
          }
        }
      }, false);
    },
    subscribe(subscriber) {
      subscriptions.add(subscriber);
      return () => subscriptions.delete(subscriber);
    },
  };
}

/**
 * Creates a computation object for memoization or effects.
 * @param {Function} fn - The computation function.
 * @param {boolean} [pure=false] - Whether the computation is pure.
 * @returns {Object} The computation object.
 * @private
 */
function createComputation(fn, pure = false) {
  const computation = {
    fn,
    state: 1,
    dependencies: new Set(),
    pure,
    user: !pure,

    execute() {
      if (this.state === 0) return this.value;

      clearDependencies(this);

      const prevListener = Listener;
      Listener = this;

      try {
        const result = fn();
        this.value = result;
        this.state = 0;
        return result;
      } finally {
        Listener = prevListener;
      }
    },
  };

  return computation;
}

/**
 * Creates a memoized computation that updates when its dependencies change.
 * @template T
 * @param {Function} fn - The computation function.
 * @returns {() => T} A function that returns the memoized value.
 */
export function memo(fn) {
  const computation = createComputation(fn, true);

  runUpdates(() => {
    computation.execute();
  }, false);

  return () => computation.value;
}

/**
 * Creates a reactive effect that runs when its dependencies change.
 * @param {Function} fn - The effect function. May return a cleanup function.
 * @returns {Object} The effect computation object.
 */
export function effect(fn) {
  let lastCleanup;
  let isRunning = false;

  const running = createComputation(() => {
    if (isRunning) {
      if (import.meta.env?.DEV) {
        throw new Error(
          "Potential infinite loop detected: effect() called during re-entrancy."
        );
      }
      return;
    }
    isRunning = true;

    try {
      if (lastCleanup) {
        lastCleanup();
        lastCleanup = null;
      }

      const cleanupFn = fn();
      if (typeof cleanupFn === "function") {
        lastCleanup = cleanupFn;
      }
    } finally {
      isRunning = false;
    }
  }, false);

  running.user = true;

  runUpdates(() => {
    running.execute();
  }, false);

  return running;
}

/**
 * Batches multiple updates into a single transaction.
 * @param {Function} fn - The function to batch.
 * @returns {*} The result of the function.
 */
export function batch(fn) {
  return runUpdates(fn, false);
}
