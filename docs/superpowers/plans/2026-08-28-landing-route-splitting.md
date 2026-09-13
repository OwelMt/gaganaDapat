# Landing Route Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the public landing page startup bundle by lazy-loading heavy authenticated routes without changing any route behavior, UI, validations, or responsiveness.

**Architecture:** Keep the current routing structure in `tests/src/App.js`, but replace only the heaviest static route imports with `React.lazy(...)` so those modules are downloaded only when their routes are visited. Wrap route rendering in a shared `Suspense` fallback that preserves the current loading experience and avoids blank screens.

**Tech Stack:** React, React Router, Suspense, lazy, existing SplashScreen component

---

### Task 1: Convert Heavy Routes To Lazy Imports

**Files:**
- Modify: `tests/src/App.js`
- Test: `tests` production build

- [ ] **Step 1: Replace the heavy static imports with lazy imports**

Target these route components only:

```js
const EManagement = lazy(() => import("./components/EManagement"));
const ReliefRequestForm = lazy(() => import("./components/relief/ReliefRequestForm"));
const Inventory = lazy(() => import("./components/Donations/Inventory"));
const InventoryAdd = lazy(() => import("./components/Donations/InventoryAdd"));
const ReliefRequestsList = lazy(() => import("./components/relief/ReliefRequestsList"));
```

- [ ] **Step 2: Add `Suspense` to the React import and use the existing splash loader as the fallback**

Use this wrapper shape around routed elements:

```js
const withRouteFallback = (element) => (
  <Suspense fallback={<SplashScreen />}>
    {element}
  </Suspense>
);
```

- [ ] **Step 3: Keep route guards unchanged while routing lazy elements through the fallback**

Update route rendering so that:
- `/Login` still uses `LoginGate`
- protected routes still use `SessionGate`
- lazy and non-lazy routes both render through the same fallback wrapper

Expected shape:

```js
function renderRoute(route) {
  const routedElement = withRouteFallback(route.element);

  if (route.path === "/Login") {
    return <LoginGate>{routedElement}</LoginGate>;
  }

  if (!route.roles) {
    return routedElement;
  }

  return sessionElement(routedElement, route.roles);
}
```

- [ ] **Step 4: Run a production build**

Run:

```bash
npm run build
```

Expected:
- build exits with code `0`
- no route syntax errors
- chunk splitting output shows additional route chunks instead of pushing everything into `main.*.js`

- [ ] **Step 5: Record verification notes**

Confirm in the final report:
- no files other than `tests/src/App.js` were changed for this route-splitting pass
- build passed
- user should rerun Lighthouse on the landing page to verify the bundle reduction effect
