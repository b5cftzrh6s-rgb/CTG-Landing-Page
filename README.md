# CTG Tools

Browser-based calculators for ceramic shell slurry control in investment casting. Every page runs entirely in the browser; uploaded files are not sent anywhere.

Pages:

- `index.html` - landing page with links to each tool
- `shell-control-correlation.html` - correlates manual cup efflux readings with an inline viscosity sensor
- `shell-control-value-calculator.html` - guided 8-step value worksheet (saved in the browser, printable with assumptions)
- `slurry-calculator.html` - slurry make-up calculator. Material tables: values from product SDS and product information sheets (general-use values); polymer solids default 50 %.
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
