# Browser tests

End-to-end checks in a real Chromium, written with Playwright for Python.

```sh
pip install playwright && playwright install chromium   # once
tests/browser/run.sh                                     # all
tests/browser/run.sh color-picker gradient-handles       # some
```

`run.sh` starts a fresh Vite dev server on port 5199 for the feature tests (they import app modules
directly, e.g. `await import('/src/core/state.ts')`), then builds the app and runs `smoke.py` (a
click-through of the whole editor) on the production build. Each test prints a JSON report and a
final `FAILS [...]` line; screenshots and full reports go to `$KL_OUT` (default `/tmp/keyline-shots/`).

A single test can also run on its own against a dev server you started: `python3 tests/browser/zoom.py http://localhost:5199/`.
Restart that server after editing source files (a long-running one can serve stale module copies).

Checks that need the network (web fonts from jsDelivr) are skipped when it isn't reachable.
