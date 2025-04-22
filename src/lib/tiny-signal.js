class I {
  constructor() {
    (this.queue = []), (this.seen = /* @__PURE__ */ new Set());
  }
  add(n, e = 0) {
    if (this.seen.has(n) || n.flags & DISPOSED) return;
    this.seen.add(n);
    let s = this.queue.length;
    for (; s > 0 && this.queue[s - 1].priority > e; ) s--;
    this.queue.splice(s, 0, { computation: n, priority: e });
  }
  next() {
    return this.queue.length === 0 ? null : this.queue.shift().computation;
  }
  get isEmpty() {
    return this.queue.length === 0;
  }
  clear() {
    (this.queue.length = 0), this.seen.clear();
  }
}
function V(t) {
  const n = /* @__PURE__ */ new Set(),
    e = /* @__PURE__ */ new Set(),
    s = [];
  function r(l) {
    if (n.has(l) || e.has(l)) return;
    e.add(l);
    const i = l.deps.values();
    let u;
    for (; !(u = i.next()).done; ) {
      const c = u.value;
      c.owner && c.owner !== l && r(c.owner);
    }
    e.delete(l), n.add(l), s.push(l);
  }
  for (let l = 0; l < t.length; l++) r(t[l]);
  return s;
}
function z(t, n) {
  n.add(t), t.deps.add(n);
}
function U(t) {
  var r, l;
  const n = t.deps;
  if (!n.size) return;
  const e = n.values();
  let s;
  for (; !(s = e.next()).done; )
    (l = (r = s.value) == null ? void 0 : r.delete) == null || l.call(r, t);
  n.clear();
}
let g = null,
  p = null,
  w = null,
  q = null;
const E = [],
  d = {},
  y = 50,
  O = [],
  b = 1,
  m = 2,
  M = 8,
  h = 16,
  A = 32;
let f = !1;
function C() {
  return O.pop() || {};
}
function x(t) {
  if (!(O.length >= y)) {
    for (const n in t) delete t[n];
    O.push(t);
  }
}
function o(t, n, e) {
  var l;
  if (!f && !((l = d[t]) != null && l.length)) return n;
  const s = d[t];
  if (s != null && s.length)
    for (let i = 0; i < s.length; i++)
      try {
        n = s[i](t, n, e) ?? n;
      } catch (u) {
        console.error(`[tiny-signal] Type middleware error in "${t}":`, u);
      }
  if (!f) return n;
  const r = E.length;
  for (let i = 0; i < r; i++)
    try {
      n = E[i](t, n, e) ?? n;
    } catch (u) {
      console.error(
        `[tiny-signal] Middleware error in "${t}" at index ${i}:`,
        u
      );
    }
  return n;
}
function v(t) {
  if (p) return t();
  const n = new I(),
    e = new I();
  (p = []), (w = []);
  let s;
  try {
    if (((s = t()), p.length > 0)) {
      const r = V(p);
      for (let l = 0; l < r.length; l++) {
        const i = r[l];
        i.flags & h || (i.flags & m ? n.add(i, 1) : e.add(i, 0));
      }
      if (q)
        for (; !n.isEmpty; ) {
          const l = n.next();
          q(() => S(l));
        }
      else for (; !n.isEmpty; ) S(n.next());
    }
    for (; !e.isEmpty; ) S(e.next());
    if (w.length > 0)
      for (let r = 0; r < w.length; r++) {
        const l = w[r];
        l.flags & h || S(l);
      }
    return n.clear(), e.clear(), (w = null), (p = null), s;
  } catch (r) {
    throw (n.clear(), e.clear(), (p = null), (w = null), r);
  }
}
function S(t) {
  if (t.flags & h || !(t.flags & b)) return t.value;
  (t.flags |= M), (t.flags &= -2), U(t);
  const n = g;
  g = t;
  try {
    const e = f ? C() : null;
    f &&
      ((e.computation = t),
      (e.isUser = !!(t.flags & m)),
      o("beforeCompute", null, e));
    let s = t.fn();
    if (f) {
      e.result = s;
      const r = o("compute", s, e);
      r !== void 0 && (s = r), x(e);
    }
    return (t.value = s), (t.flags &= ~M), s;
  } catch (e) {
    throw (
      ((t.flags |= A),
      (t.flags &= -9),
      console.error("[tiny-signal] Computation error:", e),
      e)
    );
  } finally {
    if (((g = n), f)) {
      const e = C();
      (e.computation = t),
        (e.isUser = !!(t.flags & m)),
        o("afterCompute", null, e),
        x(e);
    }
  }
}
function k(t, n) {
  return {
    fn: t,
    flags: b | m,
    deps: /* @__PURE__ */ new Set(),
    value: void 0,
    execute() {
      if (!(this.flags & h)) return S(this);
    },
    dispose() {
      this.flags & h || (U(this), (this.flags |= h));
    },
  };
}
function T(t = "animation") {
  q =
    t === "animation"
      ? requestAnimationFrame
      : t === "idle"
      ? typeof window < "u" && window.requestIdleCallback
        ? window.requestIdleCallback
        : (n) => setTimeout(n, 1)
      : typeof t == "function"
      ? t
      : null;
}
function D(t, n = {}) {
  let e = null;
  const s = f ? { type: "signal", ...n } : null;
  let r = f ? o("init", t, s) : t;
  function l() {
    return e || ((e = /* @__PURE__ */ new Set()), (e.owner = g)), e;
  }
  function i() {
    e && e.clear(), (e = null);
  }
  return {
    get value() {
      return g && z(g, l()), f ? o("get", r, s) : r;
    },
    peek() {
      return f ? o("peek", r, s) : r;
    },
    set value(u) {
      if (f) {
        const c = C();
        Object.assign(c, s || {}),
          (c.prevValue = r),
          (u = o("set", u, c)),
          x(c);
      }
      Object.is(r, u) ||
        ((r = u),
        !(!e || !e.size) &&
          v(() => {
            const c = e.values();
            let a;
            for (; !(a = c.next()).done; )
              (a = a.value),
                !(a.flags & h) &&
                  ((a.flags |= b), (a.flags & m ? w : p).push(a));
          }));
    },
    dispose: i,
  };
}
function N(t) {
  const n = k(t);
  v(() => n.execute());
  function e() {
    return n.value;
  }
  return (e.dispose = () => n.dispose()), e;
}
function P(t, n = {}) {
  const e = k(t);
  v(() => e.execute());
  const s = f ? { type: "computed", ...n } : null;
  return {
    get value() {
      return (
        g && z(g, e.deps),
        e.flags & b && S(e),
        f ? o("get", e.value, s) : e.value
      );
    },
    peek() {
      return e.flags & b && S(e), f ? o("peek", e.value, s) : e.value;
    },
    dispose() {
      e.dispose();
    },
  };
}
function R(t) {
  let n;
  const e = k(() => {
    if (f) {
      const r = C();
      (r.fn = t), o("beforeEffect", null, r), x(r);
    }
    n && (n(), (n = null));
    const s = t();
    if ((typeof s == "function" && (n = s), f)) {
      const r = C();
      (r.fn = t), (r.cleanup = n), o("afterEffect", null, r), x(r);
    }
  });
  return (
    v(() => e.execute()),
    {
      dispose: () => {
        n && n(), e.dispose();
      },
      get disposed() {
        return !!(e.flags & h);
      },
    }
  );
}
function $(t) {
  if (f) {
    const e = C();
    (e.fn = t), o("beforeBatch", null, e), x(e);
  }
  const n = v(t);
  if (f) {
    const e = C();
    e.fn = t;
    const s = o("afterBatch", n, e);
    return x(e), s;
  }
  return n;
}
function F(t, n) {
  const e = Array.isArray(t) ? t : [t];
  n && n.length
    ? n.forEach((r) => {
        (d[r] = d[r] || []), d[r].push(...e);
      })
    : E.push(...e),
    (f = E.length > 0);
  let s = !1;
  return () => {
    s ||
      ((s = !0),
      n && n.length
        ? n.forEach((r) => {
            d[r] &&
              (e.forEach((l) => {
                const i = d[r].indexOf(l);
                i > -1 && d[r].splice(i, 1);
              }),
              d[r].length === 0 && delete d[r]);
          })
        : e.forEach((r) => {
            let l;
            for (; (l = E.indexOf(r)) > -1; ) E.splice(l, 1);
          }),
      (f = E.length > 0));
  };
}
const L = D,
  Q = R,
  _ = N,
  j = P;
function B(t = {}) {
  const {
    logGets: n = 0,
    logSets: e = 1,
    logComputes: s = 0,
    logEffects: r = 0,
  } = t;
  return (l, i, u) => (
    l === "get" && n
      ? console.log("[signal:get]", i)
      : l === "set" && e
      ? console.log("[signal:set]", u.prevValue, "→", i)
      : l === "compute" && s
      ? console.log("[signal:compute]", i, u)
      : l === "beforeEffect" && r
      ? console.log("[signal:effect:start]", u)
      : l === "afterEffect" && r && console.log("[signal:effect:end]", u),
    i
  );
}
function G(t, n) {
  return (e, s, r) =>
    (e === "set" || e === "init") && !t(s, r)
      ? n
        ? n(s, r)
        : (console.error("[signal:validation] Value failed validation:", s),
          r.prevValue)
      : s;
}
function J(t = {}) {
  const { serialize: n = JSON.stringify, deserialize: e = JSON.parse } = t;
  return (s, r, l) => {
    if (!l.persist) return r;
    const i = l.persist.key;
    if (!i) return r;
    const u = l.persist.serialize || n,
      c = l.persist.deserialize || e;
    if (s === "init") {
      try {
        const a = localStorage.getItem(i);
        if (a != null) return c(a);
      } catch {}
      return r ?? l.persist.defaultValue;
    }
    if (s === "set")
      try {
        localStorage.setItem(i, u(r));
      } catch {}
    return r;
  };
}
export {
  $ as batch,
  P as computed,
  Q as createEffect,
  B as createLoggerMiddleware,
  _ as createMemo,
  J as createPersistMiddleware,
  L as createSignal,
  G as createValidatorMiddleware,
  j as derive,
  R as effect,
  T as enableScheduling,
  N as memo,
  D as signal,
  F as use,
};
