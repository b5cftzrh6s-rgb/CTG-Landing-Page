# CTG Tools

Browser-based calculators for ceramic shell slurry control in investment casting. Every page runs entirely in the browser; uploaded files are not sent anywhere.

Pages:

- `index.html` - landing page with links to each tool
- `shell-control-correlation.html` - correlates manual cup efflux readings with an inline viscosity sensor
- `shell-control-value-calculator.html` - guided 8-step value worksheet (saved in the browser, printable with assumptions)
- `slurry-calculator.html` - slurry make-up calculator plus an **adjust / rebuild solver** (water, binder, polymer and flour additions to reach a target SG, % silica in liquid and % polymer of whole slurry by mass/volume balance; removal plan when the target can't be reached by additions; viscosity is not predicted). Material tables: values from product SDS and product information sheets (general-use values); polymer solids default 50 %.
- `biocide-calculator.html` - 6451 biocide addition: g = dose % ÷ 100 × liquid lb × 454 g/lb (or kg × 1000), mL = g ÷ 1.145 g/mL. Shows Maximum (0.15 %, specified max), Medium (0.10 %) and Low (0.05 %) side by side; Medium/Low are adjustable defaults. 1000 lb → 681 g / 594.76 mL at maximum.
- `tank-rpm-calculator.html` - tank volume and rotation speed calculator

Shared files: `ctg.css` (all styling, light/dark), `navbar.js` (tool registry `CTG_TOOLS`, navbar, landing tiles, footer version stamp), `calc.js` (all calculations, no DOM).

Tests: `node tests/calc.test.js` (no dependencies). `tests/sample-original-layout.csv` mimics the original export layout (14 prebuilt rows, headers on row 15, data from row 16); `tests/reference-main.js` is the original tool's parsing/pairing/export logic and the tests check the new code produces a byte-identical export. `tests/sample-correlation.csv` is a synthetic DD/MM sample file for the correlation tool (SG 1.7, EZ-Zahn #5, cup rows offset from sensor rows).

### Adding a tool

1. Copy `tank-rpm-calculator.html` as a template (it already loads `ctg.css`, `calc.js`, `navbar.js`).
2. Put the math in `calc.js` and add tests.
3. Add one entry to `CTG_TOOLS` in `navbar.js`. The nav link and landing tile appear automatically; `status: 'planned'` shows a "coming soon" tile.

To run locally: `python -m http.server 8000`, then open `http://localhost:8000`. `app.yaml` runs the same server as a Databricks App.

## Shell Control Correlation


## Cup formula sources

Cup seconds convert to kinematic viscosity (cSt) with V = k·T − C/T:

- **EZ-Zahn #4:** V = 13.26T − 673/T
- **EZ-Zahn #5:** V = 23.56T − 744/T
- **ISO #6:** V = 6.90T − 570/T
- **ISO #8:** V = 21.78T − 306/T

Source for all four: GARDCO (Paul N. Gardner Co.), the cup manufacturer. See the [GARDCO viscosity knowledge library](https://www.gardco.com/en-GB/resources/knowledge-library/viscosity-faq) and the [GARDCO EZ Zahn cup manual (PDF)](https://assets-cdn-prod-dfauhca6edaxdvgy.a01.azurefd.net/assets%2FMultimedia%2FGARDCO%2FAssets%2FDocuments%2FManuals%2FViscometers%2Fvi%2FEZ-Zahn-Cups-Manual.pdf).

### What to upload

A CSV export from the sensor system. The tool expects the column headers on row 15 and data starting on row 16. You need three columns:

- a date/time column
- the manual viscosity reading in cup seconds (efflux time)
- the sensor viscosity reading in cP

The tool tries to auto-detect these from the header names; check the mappings before pressing Process Data.

### Settings

- **Cup type** (EZ-Zahn #4, EZ-Zahn #5, ISO #6, ISO #8) picks the formula that converts cup seconds to kinematic viscosity in cSt.
- **Spec limits on cup seconds** (LSL/USL) are your current cup spec. They are needed for the recommended sensor limits.
- **Shifts** are optional time windows used for per-shift analysis.
- **Slurry density / SG** converts calculated cSt to cP (cP = cSt x density) so it can be compared with the sensor. Enter your measured slurry density. The default of 1.0 means no conversion.

### How readings are paired

- **Default: row order (original behavior).** Each cup reading uses the sensor value on the same row, else the average of the nearest valid rows before/after (counted as interpolated). Readings whose date cannot be parsed are skipped, as before.
- **Optional: timestamp pairing** (select "Timestamp" under Pairing): each cup reading is paired with the sensor samples nearest in *time*. If valid samples exist on both sides within the window (default ±5 min, configurable) the value is linearly interpolated in time; otherwise the nearest one within the window is used; otherwise the reading is counted as "No sensor match". Row order does not matter.
- **Date format:** Auto-detects MM/DD vs DD/MM when a day above 12 appears; if every date is ambiguous it assumes MM/DD and says so. You can force either. ISO `YYYY-MM-DD` is always recognised.
- **Without a date column:** always row order.
- **Cup valid range:** readings outside the cup's valid seconds range (editable; defaults EZ-Zahn 20–80 s, ISO #6 and #8 30–100 s) or giving cSt ≤ 0 are excluded and listed under "Excluded readings".

### Reading the results

- **Quality filter (Max |Δ|)** drops pairs where the calculated cP and the sensor cP disagree by more than the slider value. Use it to exclude obvious bad readings, not to force a good fit.
- **Regression** is a straight-line fit of sensor cP (y) against cup seconds (x) on the pairs that pass the filter. Note that the regression uses raw cup seconds, while the quality filter uses the converted cP value.
  - **R²** is the share of sensor variation explained by the cup reading (1.0 is a perfect line, near 0 means no linear relationship).
  - **Mean |Δ|** is the average absolute gap in cP between calculated and sensor viscosity for the filtered pairs.
  - **Slope / intercept** define the line used to translate cup seconds into sensor cP.
- **Recommended sensor LSL / USL** runs your cup LSL and USL through the regression line to get equivalent sensor limits, shown for all data and for quality-filtered data. Coverage is the percentage of sensor readings that fall inside those limits.
- **Per-shift analysis** repeats the fit for each defined shift.
- **Data table and export** shows the paired rows and downloads them as CSV (identical to the original tool: DateTime as MM/DD/YYYY HH:MM, CupSec, CalcCst, SensorCP, AbsDiff, Interpolated, and Shift when shifts are defined; numbers to 3 decimals). AbsDiff is |CalcCst × SG − SensorCP|, which equals the original |CalcCst − SensorCP| at the default SG 1.0.


## Slurry adjust / rebuild solver

- **Model:** four components, with volumes assumed additive (8.345 lb/gal water):
  - binder as supplied (solids % treated as silica; SG and polymer % from the table)
  - added water
  - polymer as supplied (solids % default 50 %, SG default 1.0, both editable)
  - refractory flour
- **SG** is the whole-slurry density: liquid, colloidal silica solids, polymer solids and flour, by total weight ÷ total volume.
- **% polymer (of whole slurry)** = polymer solids lb, including binder-borne polymer (binder × binder polymer % + polymer × polymer solids %), ÷ total slurry lb (binder + water + polymer + flour). This is the spec basis. Recipe cards show it as "Polymer, % of total slurry" and also show the liquid-basis value, labelled "% of liquid", for reference. % silica stays on the liquid basis (binder silica ÷ binder + water + polymer).
- **Adjust:** four balances split the tank into its four components: weight (or volume × SG), volume (weight ÷ SG), dry solids, and the **current % polymer (of whole slurry), which you must enter**. SG and % solids can't separate polymer from silica, so use the last measured or recipe value. Targets are SG, % silica (of liquid) and % polymer (of whole slurry). The solver gives the smallest additions of binder, water, polymer and flour in lb, or a remove-then-add plan when a component is in excess or the tank maximum or chosen final volume would be exceeded.
- **Rebuild:** target composition × batch volume.
- **Error messages:** unreachable targets get a clear message instead of a number:
  - an SG below liquid-only SG
  - silica at or above the binder's own solids
  - a polymer target below what the binder alone brings
  - measurements that don't fit the selected materials
- **Not modeled:** viscosity, evaporation and settling. Add in steps and re-measure.

## Install as an app (PWA, works offline)

The site is a Progressive Web App:

- `manifest.webmanifest`, icons in `icons/` (including maskable ones), and `sw.js`.
- The service worker precaches every page with a versioned cache. When a new version is deployed, a banner shows **"A new version of CTG Tools is available. Update"**.
- After the first visit, every tool works offline.
- All paths are relative, so it works at a domain root, under the Databricks app URL, or on a GitHub Pages sub-path.

Installing requires **HTTPS or localhost**. Databricks Apps and GitHub Pages are HTTPS, so they work. Plain `http://` on a LAN IP does not.

- **Desktop (Chrome / Edge):** open the site and click **⬇ Install** in the navbar, or the install icon in the address bar (Edge: *Apps → Install this site as an app*). It then opens in its own window, gets a Start menu / Dock entry, and works offline.
- **Android (Chrome):** menu → *Install app* / *Add to Home screen*.
- **iPhone / iPad (Safari):** Share → *Add to Home Screen*. The app icon and full-screen mode are set up.
- **Run locally:** `./run-local.sh` (macOS/Linux) or `run-local.bat` (Windows) starts `python -m http.server 8000`. Then open http://localhost:8000 and install from there. Python 3 is required.
- **Releasing:** bump `CTG_VERSION` in `navbar.js` **and** `CACHE_VERSION` in `sw.js` together (a test enforces this), and add any new page to `PRECACHE` in `sw.js` (a test checks every `.html` file is listed). Otherwise installed users keep the old cached version.
- **Electron:** a native desktop wrapper (Electron/Tauri) would be possible, but it isn't included. The PWA install already gives a desktop window and works offline, without the extra 100+ MB runtime.

## Print / Save PDF reports (`print.js`)
Every tool page has the same **Print / Save PDF** button, which is the first button in the toolbar at the top of the page. Next to it are **Download report (HTML)** and an optional **Report details** box for customer, site and notes. Printing, whether from the button or Ctrl+P, produces one consolidated report:
1. **Header:** CTG Tools, tool name, date/time, version, and customer/site/notes.
2. **Inputs (as applied):** every visible input with its label, value and unit, plus the selected presets and modes.
3. **Results:** all outputs with units, including charts.

The report always prints in a light theme. The navbar, buttons and interactive controls are hidden. To save a PDF, choose "Save as PDF" in the print dialog.

To add a new tool, load `print.js` and call `CTGPrint.register({ id, title, inputs?, extraInputs?, results })`. With no `inputs`, every visible control in `<main>` is collected automatically, and units come from the "(unit)" part of each label. Tests check that every tool page registers.
