import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import xarray as xr

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def scalar(value: Any) -> Any:
    if isinstance(value, np.generic):
        return value.item()
    return value


def summarize(path: Path) -> dict[str, Any]:
    with xr.open_dataset(path, decode_cf=False) as dataset:
        variables: dict[str, Any] = {}
        for name, variable in dataset.variables.items():
            entry: dict[str, Any] = {
                "dimensions": list(variable.dims),
                "shape": list(variable.shape),
                "dtype": str(variable.dtype),
                "attributes": {key: scalar(value) for key, value in variable.attrs.items()},
            }
            if variable.size and variable.size <= 20_000_000:
                values = np.asarray(variable.values)
                numeric = np.issubdtype(values.dtype, np.number)
                if numeric:
                    valid = values[np.isfinite(values)]
                    if valid.size:
                        entry["min"] = scalar(valid.min())
                        entry["max"] = scalar(valid.max())
                        entry["unique_preview"] = [
                            scalar(value) for value in np.unique(valid)[:20]
                        ]
            variables[name] = entry

        return {
            "file": str(path.resolve()),
            "dimensions": dict(dataset.sizes),
            "attributes": {key: scalar(value) for key, value in dataset.attrs.items()},
            "variables": variables,
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect a NetCDF sample without modifying it.")
    parser.add_argument("path", type=Path, help="Path to a .nc or .nc4 file")
    args = parser.parse_args()
    if not args.path.is_file():
        parser.error(f"file does not exist: {args.path}")
    print(json.dumps(summarize(args.path), ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
