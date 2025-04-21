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
let Middleware = [];

/**
 * Registers middleware to intercept and transform signals and computations.
 * @param {Function} middlewareFn - A function that receives (type, value, context) and returns a new value or undefined.
 * @returns {Function} A function to remove the middleware.
 */
export function use(middlewareFn) {
  Middleware.push(middlewareFn);
  return () => {
    const index = Middleware.indexOf(middlewareFn);
    if (index !== -1) {
      Middleware.splice(index, 1);
    }
  };
}

/**
 * Applies all registered middleware to a value.
 * @param {string} type - The type of operation ('get', 'set', 'compute', etc.).
 * @param {*} value - The value to transform.
 * @param {Object} context - Additional context for the middleware.
 * @returns {*} The transformed value.
 * @private
 */
function applyMiddleware(type, value, context = {}) {
  return Middleware.reduce((result, middleware) => {
    try {
      const transformed = middleware(type, result, context);
      return transformed !== undefined ? transformed : result;
    } catch (err) {
      console.error("Middleware error:", err);
      return result;
    }
  }, value);
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
 * @param {Object} [options] - Signal options.
 * @returns {{
 *   value: T,
 *   subscribe: (subscriber: Object) => () => void
 * }}
 */
export function signal(initialValue, options = {}) {
  let value = initialValue;
  const subscriptions = new Set();

  if (Middleware.length > 0) {
    value = applyMiddleware("init", value, {
      type: "signal",
      ...options,
    });
  }

  return {
    get value() {
      if (Listener) subscribe(Listener, subscriptions);

      if (Middleware.length > 0) {
        return applyMiddleware("get", value, {
          type: "signal",
          ...options,
        });
      }
      return value;
    },
    peek() {
      if (Middleware.length > 0) {
        return applyMiddleware("peek", value, {
          type: "signal",
          ...options,
        });
      }
      return value;
    },
    set value(nextValue) {
      let processedValue = nextValue;
      if (Middleware.length > 0) {
        processedValue = applyMiddleware("set", nextValue, {
          type: "signal",
          prevValue: value,
          ...options,
        });
      }

      if (Object.is(value, processedValue)) return;
      value = processedValue;

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
        applyMiddleware("beforeCompute", null, {
          computation: this,
          pure,
        });

        const result = fn();

        const processedResult = applyMiddleware("compute", result, {
          computation: this,
          pure,
        });

        this.value = processedResult;
        this.state = 0;
        return processedResult;
      } finally {
        Listener = prevListener;

        applyMiddleware("afterCompute", null, {
          computation: this,
          pure,
        });
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

    applyMiddleware("beforeEffect", null, { fn });
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

      applyMiddleware("afterEffect", null, { fn, cleanup: lastCleanup });
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
  applyMiddleware("beforeBatch", null, { fn });

  const result = runUpdates(fn, false);

  return applyMiddleware("afterBatch", result, { fn });
}

/**
 * Creates a middleware for logging signal operations.
 * @param {Object} options - Configuration options.
 * @param {boolean} [options.logGets=false] - Whether to log get operations.
 * @param {boolean} [options.logSets=true] - Whether to log set operations.
 * @param {boolean} [options.logComputes=false] - Whether to log computation results.
 * @param {boolean} [options.logEffects=false] - Whether to log effect executions.
 * @returns {Function} A middleware function.
 */
export function createLoggerMiddleware(options = {}) {
  const {
    logGets = false,
    logSets = true,
    logComputes = false,
    logEffects = false,
  } = options;

  return (type, value, context) => {
    if (type === "get" && logGets) {
      console.log(`[signal:get]`, value);
    } else if (type === "set" && logSets) {
      console.log(`[signal:set]`, context.prevValue, "→", value);
    } else if (type === "compute" && logComputes) {
      console.log(`[signal:compute]`, value, context);
    } else if (type === "beforeEffect" && logEffects) {
      console.log(`[signal:effect:start]`, context);
    } else if (type === "afterEffect" && logEffects) {
      console.log(`[signal:effect:end]`, context);
    }

    return value;
  };
}

/**
 * Creates middleware that validates signal values.
 * @param {Function} validator - Function that receives value and returns boolean.
 * @param {Function} [errorHandler] - Optional handler for invalid values.
 * @returns {Function} A middleware function.
 */
export function createValidatorMiddleware(validator, errorHandler) {
  return (type, value, context) => {
    if (type === "set" || type === "init") {
      if (!validator(value, context)) {
        if (errorHandler) {
          return errorHandler(value, context);
        }
        console.error(`[signal:validation] Value failed validation:`, value);
        return context.prevValue; // Return previous value if validation fails
      }
    }
    return value;
  };
}

/**
 * Creates middleware for persisting signal values to localStorage.
 * @param {Object} options - Global configuration options.
 * @param {Function} [options.serialize] - Function to serialize values (defaults to JSON.stringify).
 * @param {Function} [options.deserialize] - Function to deserialize values (defaults to JSON.parse).
 * @returns {Function} A middleware function.
 */
export function createPersistMiddleware(options = {}) {
  const { serialize = JSON.stringify, deserialize = JSON.parse } = options;

  return (type, value, context) => {
    if (!context.persist) {
      return value;
    }

    const key = context.persist.key;
    if (!key) {
      console.warn("[persist] Missing storage key in persist options", context);
      return value;
    }

    const signalOptions = context.persist;
    const signalSerialize = signalOptions.serialize || serialize;
    const signalDeserialize = signalOptions.deserialize || deserialize;

    if (type === "init") {
      try {
        const stored = localStorage.getItem(key);
        if (stored !== null) {
          return signalDeserialize(stored);
        }
      } catch (err) {
        console.error(`[persist] Failed to load value for key "${key}":`, err);
      }

      return value ?? signalOptions.defaultValue;
    }

    if (type === "set") {
      try {
        localStorage.setItem(key, signalSerialize(value));
      } catch (err) {
        console.error(`[persist] Failed to save value for key "${key}":`, err);
      }
    }

    return value;
  };
}
