# Local And Server Cache Boundary

This directory is the local equivalent of the server cache workspace.

Generated viewport cache files live under:

```text
data/cache/viewport/<cache-version>/<query-hash>.json
```

Cache keys include the viewport date, normalized bbox, step, and cache contract version. Generated JSON cache files are ignored by Git; commit only documentation or placeholders that explain the boundary.

Use the backend cache maintenance script from `backend/` for local or server cache operations:

```powershell
python scripts/manage_viewport_cache.py status
python scripts/manage_viewport_cache.py warm --date 2024-08-05 --bbox 122,27,124.2,29.6 --step 4
python scripts/manage_viewport_cache.py rebuild --date 2024-08-05 --bbox 122,27,124.2,29.6 --step 4
python scripts/manage_viewport_cache.py prune --max-files-per-version 2000
```

On the deployed server, the equivalent cache root is:

```text
/srv/ocean/data/cache/viewport/<cache-version>/<query-hash>.json
```

`rebuild` removes only the requested query's active viewport cache entry before warming it again. `prune` removes old viewport cache contract versions by default and can cap files per active version. These commands do not download raw data and must not turn missing coverage into zero-valued activity.
