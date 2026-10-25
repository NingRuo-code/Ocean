# Scientific display palettes

Numeric tables preserved from the official NCL gallery on 2026-10-25:

| Table | Rows | SHA-256 of preserved bytes |
| --- | --- | --- |
| [cmocean_thermal.rgb](https://www.ncl.ucar.edu/Document/Graphics/ColorTables/Files/cmocean_thermal.rgb) | 256 | `7d7934faab7d20668825105cef73ec804c9dfbabd7a6129db213ffd0c3dc0654` |
| [MPL_Purples.rgb](https://www.ncl.ucar.edu/Document/Graphics/ColorTables/Files/MPL_Purples.rgb) | 128 | `4bfdbc8783feeffac77b00ef3de7381681a8a81543ec0e74f4998d9a77fbb220` |

Gallery: [thermal](https://www.ncl.ucar.edu/Document/Graphics/ColorTables/cmocean_thermal.shtml), [Purples](https://www.ncl.ucar.edu/Document/Graphics/ColorTables/MPL_Purples.shtml). Upstream notices are preserved in LICENSE-NCL.txt and LICENSE-cmocean.txt; NCL identifies MPL_Purples as derived from Matplotlib. No gallery images or game assets are used.

Run `node tools/build-display-palettes.mjs` from the repository root to reproduce palettes.js and ../data/display-domains.js without network access. The builder retains table provenance and scans the 62 existing SST exports. Its 20.5–33°C domain is the extent of their encoded 0.5°C bins, limited to 2024-07-01 through 2024-08-31 and the recorded product/version. It is not a yearly or research qualification.

The map and legend use the same tables and display model. Temperature uses the full thermal table. Activity uses entries 0–64 of the 128-row Purples table in reverse order, restricted to its bright half. Activity colour/size use log1p only when a dated, versioned, unit- and resolution-matched scope with evidence is registered. The committed activity scope is pending; neutral equal-size markers preserve real hour readings. Synthetic browser fixtures register a clearly labelled contract scope and are not real data qualification.

Interpolation between adjacent palette colours does not interpolate data, fill missing cells, or increase source precision. Source SST grids are retained, with finer grids masking coarse grids even at missing cells. Scientific display metadata is separate from statistical eligibility, prediction inputs and export/research contracts.
