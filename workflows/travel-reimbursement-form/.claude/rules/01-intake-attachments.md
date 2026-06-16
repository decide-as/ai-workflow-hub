# 01 — Attachment intake

Process every file the user provides for the trip (from `inbox/`, pasted images,
or given paths).

## Steps per file

1. **Hash for dedup.** Compute the SHA-256 of the original bytes:
   `shasum -a 256 <file>`. If that hash already exists in `manifest.json`, this
   is a duplicate — **skip it and tell the user** ("already added as `0X` /
   `<original_name>`, skipping"). Do not store it twice.
2. **Convert HEIC → JPG.** If the file is HEIC/HEIF (extension `.heic`/`.heif`,
   or `file <f>` reports HEIF), convert it to JPG before storing:
   `sips -s format jpeg "<in>" --out "<attachments>/<uuid>.jpg"`.
   Record `converted_from: "heic"`. (`sips` is built into macOS — no extra deps.)
3. **Store by UUID.** Otherwise copy the file to `attachments/<uuid>.<ext>`,
   where `<uuid>` is a freshly generated UUID (`uuidgen | tr 'A-Z' 'a-z'`) and
   `<ext>` is the lowercased original extension. **Files are stored under their
   UUID during processing** — not their final number.
4. **Log it** in `manifest.json`.

## manifest.json

A dict keyed by UUID. `number` (the `0#`) starts **null** and is assigned only
at the very end, once transactions are ordered:

```json
{
  "attachments": {
    "9f1c…": {
      "original_name": "hotel_oslo.pdf",
      "ext": "pdf",
      "sha256": "…",
      "converted_from": null,
      "number": null
    }
  }
}
```

A single receipt may cover several ledger rows, and one ledger row may cite
several receipts — that's fine; the `0#` is per attachment.

## Grouping — one transaction, several documents

SHA-256 dedup only catches **byte-identical** files. It will **not** catch the
common case where several *different* documents describe the **same purchase**:

- a **paper receipt** and the **bank-app screenshot** of that same charge;
- **boarding passes** plus the **flight e-ticket** for the same booking;
- two screenshots of the same line from different apps.

Group these into **one transaction** and cite **all** their attachment numbers —
do not create a duplicate ledger row per document. Match by merchant + amount +
date (and the foreign amount on the bank screenshot vs the paper receipt total).
When two documents look like the same purchase but the amounts differ, ask.

## Numbering & rename — the LAST step before output

`0#` numbers reflect the **final transaction order** (see `02-transactions.md`),
not intake order.

> **The user's original filenames are irrelevant** — even if the input files are
> already numbered (`06.png`, `29.pdf`, …), you **always** assign fresh `0#`
> numbers from the transaction order. This is exactly why files are stored under
> a UUID first and only renamed at the end. Never carry the source names through.

1. Build and order all transactions first.
2. Walk the ordered transactions; assign `01`, `02`, `03`, … to the attachments
   in the order they are first cited (a transaction citing several documents
   consumes several consecutive numbers). Write each number back into
   `manifest.json`.
3. **Rename** the stored files into `output/` using their `0#`:
   `attachments/<uuid>.jpg` → `output/01.jpg`. Use a zero-padded 2-digit number
   (`01`, `02`, … `10`, `11`).
4. Set each transaction's `attachment_no` (in `report.json`) to its new numbers,
   comma-separated (e.g. `01, 02, 03, 04`).

The "Attachment no." column in the report cites these final `0#` numbers.
