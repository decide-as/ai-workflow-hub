# Allowance section (`standardsatser`) — rates & row map

The **template is authoritative** for the rate values: the rates live in column E
of `Sheet1` (rows 47–67) as formulas, and the totals (column J) compute as
`rate × quantity`. You never set rates — you set **quantities**.

## How to fill it

In `report.json`, add `allowance` entries keyed by **template row**:

```json
"allowance": [
  { "row": 47, "quantity": 3 },              // 3 nights hotel per diem
  { "row": 48, "quantity": 2 },              // 2 breakfasts covered → deducted
  { "row": 64, "quantity": 120, "quantity_rebilled": 0 }  // 120 km mileage
]
```

- `quantity` → column H (days / nights / km).
- `quantity_rebilled` → column I (optional).
- The template computes the per-row total and the section Sum.

## Row map

| Row | Meaning | Quantity unit |
|----:|---------|---------------|
| 47 | Per diem with hotel accommodation | days |
| 48 | — deduction breakfast (covered/provided/included) | meals |
| 49 | — deduction lunch | meals |
| 50 | — deduction dinner | meals |
| 51 | Per diem, other accommodation **without** cooking facilities | days |
| 52 / 53 / 54 | — deduction breakfast / lunch / dinner | meals |
| 55 | Per diem, work travel **with** cooking facilities | days |
| 56 / 57 / 58 | — deduction breakfast / lunch / dinner | meals |
| 59 | Day allowance — 6 up to 12 hours | days |
| 61 | Day allowance — over 12 hours | days |
| 63 | Night supplement (domestic travel only) | nights |
| 64 | Mileage allowance (incl. EV) | km |
| 65 | Passenger supplement (per km per passenger) | km |
| 66 | Forest/construction roads (per km) | km |
| 67 | Transport of equipment/materials (per km) | km |

A meal that is **also** claimed via an actual receipt in the ledger, was provided,
or was included in the lodging price **must** be deducted via the matching
breakfast/lunch/dinner row — never claim both the per diem meal and the receipt.

## Rate verification

The template's current base rates are **693 / 400 / 107** (hotel / other / cooking)
with breakfast-lunch-dinner deductions of 20% / 30% / 50% for hotel and 20% each
otherwise; day 200 / 400, night 435, mileage 3,50, supplements 1,00 per km. These
sit in column E. If they don't match the official Directorate of Taxes rates for
the trip's year, update column E in the template (not here, not the generator).
