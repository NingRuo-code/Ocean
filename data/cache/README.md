# Local And Server Cache Boundary

This directory is the local equivalent of the server cache workspace.

Generated viewport cache files live under:

```text
data/cache/viewport/<cache-version>/<query-hash>.json
```

Cache keys include the viewport date, normalized bbox, step, and cache contract version. Generated JSON cache files are ignored by Git; commit only documentation or placeholders that explain the boundary.
