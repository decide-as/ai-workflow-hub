# Fiken / MVA FAQ — registering foreign & business-expense purchases

Reference for how the user should register each receipt when they book the
reimbursement in their accounts. The firm is VAT-registered (mva-registrert). Cite
the relevant point when recommending how to register a transaction — especially
foreign-currency receipts, which almost always fall under **point 4**.

> Quick rule: a receipt paid in foreign currency for something consumed abroad
> (taxi, Tube, meal) → **point 4**: mva-kode **"Ingen"**, no VAT deduction, and
> enter the **NOK actually drawn from the account**. On this form such rows carry
> `vat_rate` **0**.

## 4. Kjøp i utenlandsk valuta der varen/tjenesten aldri tas inn i Norge
F.eks. taxi eller mat betalt i utenlandsk valuta på en reise. Føres under
**Kjøp → Nytt kjøp**:
1. Velg samme regnskapskonto som om kjøpt i Norge. Legg inn beløpet i valutaen.
2. Velg mva-kode **"Ingen"** — ingen mva-fradrag.
3. Velg riktig **valuta**.
4. I «Beløp i NOK» legger du inn summen som faktisk ble trukket fra bankkontoen.

## 5. Kjøp av vare i utenlandsk valuta der varen tas inn i Norge
Vare kjøpt i utlandet og tatt med til Norge. **Kjøp → Nytt kjøp**:
1. Samme konto som i Norge; beløp i valuta.
2. Ikke mva-fradrag, men bruk mva-kode **"Grunnlag 25%"** hvis varen ville hatt
   25% mva i Norge, ellers **"Grunnlag 0%"**.
3. Velg valuta; legg også inn summen i NOK på betalingen.

## 6. Kjøp av vare i norske kroner der varen tas inn i Norge
Som punkt 5, men beløpet er i NOK. Bruk **"Grunnlag 25%"** eller **"Grunnlag 0%"**.

## 7. Kjøp av tjeneste i utenlandsk valuta der tjenesten tas inn i Norge
F.eks. et programvareabonnement brukt i Norge. **Kjøp → Nytt kjøp**:
1. Samme konto; beløp i valuta.
2. mva-kode: **"Tjeneste utlandet 25%"** (rett til fradrag),
   **"Tjeneste utlandet uten fradrag, 25%"** (mva men ikke fradrag), eller
   **"Ingen"** (ingen mva i Norge, f.eks. undervisning/kurs).
3. Velg valuta; legg inn summen i NOK på betalingen.

## 8. Kjøp av tjeneste i norske kroner der tjenesten tas inn i Norge
Som punkt 7, men beløp i NOK. Samme mva-koder.

## 9. Kjøp og betaling i fremmed valuta på forskjellige tidspunkt
Kjøp på én dato, betaling senere → valutagevinst/-tap. Legg inn kjøpet med riktig
dato og valuta, registrer NOK-beløpet som ble trukket på betalingsdatoen; Fiken
beregner gevinst/tap automatisk.

## 10. VOEC — norsk mva på varer fra utlandet
VOEC-butikker legger 25% norsk mva på salg til **privatpersoner**, ikke bedrifter.
Er du feilaktig belastet mva, gis ikke fradrag — før som vanlig utenlandskjøp uten
fradrag (punkt 5): varer som ville hatt 25% i Norge → **"Grunnlag 25%"**,
tjenester → **"Tjenester utlandet 25%"**. Be evt. om refusjon fra selger.

## 11. Kjøp i fremmed valuta der mva er spesifisert i norske kroner
Du kan få vanlig mva-fradrag bare hvis: mva er spesifisert på fakturaen; mva-beløpet
er oppgitt i **NOK**; leverandøren er registrert i Brønnøysund med norsk
organisasjonsnummer; og org.nr. står på fakturaen. Før hele fakturaen i NOK.

## Representation / entertainment (konto 7350)
Representasjon gir normalt **ikke mva-fradrag** — før uten fradrag, og legg ved
**formål og deltakerliste (navn + selskap)** slik Skatteetaten krever. På dette
skjemaet føres slike linjer med `vat_rate` **0**.
