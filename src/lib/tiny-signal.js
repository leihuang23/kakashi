class StackNode {
  constructor(value, prev = null) {
    this.value = value;
    this.prev = prev;
  }
}

class Stack {
  constructor() {
    this.top = null;
  }

  push(value) {
    this.top = new StackNode(value, this.top);
  }

  pop() {
    if (!this.top) return undefined;
    const value = this.top.value;
    this.top = this.top.prev;
    return value;
  }

  peek() {
    return this.top ? this.top.value : undefined;
  }
}

const context = new Stack();

function subscribe(running, subscriptions) {
  subscriptions.add(running);
  running.dependencies.add(subscriptions);
}

export function signal(initialValue) {
  let value = initialValue;
  const subscriptions = new Set();

  return {
    get value() {
      const running = context.peek();
      if (running) subscribe(running, subscriptions);
      return value;
    },
    set value(nextValue) {
      if (deepEqual(value, nextValue)) return;
      value = nextValue;

      for (const sub of [...subscriptions]) {
        sub.execute();
      }
    },
    subscribe(subscriber) {
      subscriptions.add(subscriber);
      return () => subscriptions.delete(subscriber);
    },
  };
}

function clearDependencies(running) {
  for (const dep of running.dependencies) {
    dep.delete(running);
  }
  running.dependencies.clear();
}

export function effect(fn) {
  let lastCleanup;
  let isRunning = false;

  const execute = () => {
    if (isRunning) {
      console.warn("Detected possible infinite loop in effect.");
      return;
    }
    isRunning = true;
    clearDependencies(running);
    if (lastCleanup) {
      lastCleanup();
      lastCleanup = null;
    }
    context.push(running);
    try {
      const cleanupFn = fn();
      if (typeof cleanupFn === "function") {
        lastCleanup = cleanupFn;
      }
    } finally {
      context.pop();
      isRunning = false;
    }
  };

  const running = {
    execute,
    dependencies: new Set(),
  };

  execute();
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
