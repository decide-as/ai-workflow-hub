# Workflow Card Height Uniformity

All workflow cards in the masonry grid must render at the same height. Cards are
compared visually side-by-side; height variation breaks the grid rhythm.

## Rule

Every card footer — regardless of action type — must occupy exactly one row of
controls. The footer row height is set by `btn-sm` (28 px) and `form-input`
(also 28 px via `padding: 5px 10px`). No card footer may be taller than that.

## Allowed footer patterns

| Pattern | Example card |
|---|---|
| Single action button (Open / Run / Create) | Travel Reimbursement, Scaffold |
| Inline input + buttons row | Reading List (`Paste a URL…`) |
| Compact icon + label + buttons row | Voucher Folder Creator (drop strip) |
| Record / transcribe button(s) | Transcribe-to-Claude |

## Prohibited footer patterns

- `flex-col` drop zones with centred icon + multiline text (`py-4` or larger)
- Scrollable folder/result lists rendered inside the card
- Multi-row status expansions

## Implementation requirement for file-drop controls

File drop targets on cards must use the **compact strip** pattern:

```tsx
<label
  className="flex items-center gap-2 rounded-lg px-3 cursor-pointer w-full border border-dashed ..."
  style={{ height: "28px" }}
>
  <Upload size={11} />
  <span className="text-[11px] truncate">Drop files here</span>
  <input type="file" className="sr-only" ... />
</label>
```

Post-drop states (processing, done, error) must also fit in a single `flex
items-center` row: icon + truncated text + action buttons.

## Enforcement

When adding or modifying any `WorkflowCard` footer component, verify the idle
state renders at 28 px tall before committing.
