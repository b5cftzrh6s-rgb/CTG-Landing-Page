# CTG Tools

Browser-based calculators for ceramic shell slurry control in investment casting. Every page runs entirely in the browser; uploaded files are not sent anywhere.

Pages:

- `index.html` - landing page with links to each tool
- `shell-control-correlation.html` - correlates manual cup efflux readings with an inline viscosity sensor
- `shell-control-value-calculator.html` - shell control value calculator
- `slurry-calculator.html` - slurry make-up calculator
- `tank-rpm-calculator.html` - tank volume and rotation speed calculator

To run locally: `python -m http.server 8000`, then open `http://localhost:8000`. `app.yaml` runs the same server as a Databricks App.

## Shell Control Correlation


## Cup formula sources

Cup seconds convert to kinematic viscosity (cSt) with V = k·T − C/T:

- **EZ-Zahn #4:** V = 13.26T − 673/T (Paul N. Gardner / GARDCO EZ™ Zahn cup manual)
- **EZ-Zahn #5:** V = 23.56T − 744/T (same GARDCO series)
- **ISO #6:** V = 6.90T − 570/T (ISO 2431 Table 1, 6 mm orifice; meaningful roughly 30–100 s)
- **ISO #8:** V = 21.78T − 306/T (common 8 mm flow-cup constants; not one of the ISO 2431 cups 3–6)

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

Each manual cup reading is paired with the sensor value on the same row. If that sensor value is missing or invalid, the tool averages the nearest valid values before and after it (or uses whichever one exists) and counts the row as interpolated.

### Reading the results

- **Quality filter (Max |Δ|)** drops pairs where the calculated cP and the sensor cP disagree by more than the slider value. Use it to exclude obvious bad readings, not to force a good fit.
- **Regression** is a straight-line fit of sensor cP (y) against cup seconds (x) on the pairs that pass the filter. Note that the regression uses raw cup seconds, while the quality filter uses the converted cP value.
  - **R²** is the share of sensor variation explained by the cup reading (1.0 is a perfect line, near 0 means no linear relationship).
  - **Mean |Δ|** is the average absolute gap in cP between calculated and sensor viscosity for the filtered pairs.
  - **Slope / intercept** define the line used to translate cup seconds into sensor cP.
- **Recommended sensor LSL / USL** runs your cup LSL and USL through the regression line to get equivalent sensor limits, shown for all data and for quality-filtered data. Coverage is the percentage of sensor readings that fall inside those limits.
- **Per-shift analysis** repeats the fit for each defined shift.
- **Data table and export** shows the paired rows and downloads them as CSV (DateTime, CupSec, CalcCst, CalcCP, SensorCP, AbsDiff, Interpolated, and Shift when shifts are defined).
