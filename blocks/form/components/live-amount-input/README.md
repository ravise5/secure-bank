# Live Amount Input

Indian rupee amount entry with a live, read-only amount-in-words display.

## How to Use

Insert **Live Amount Input** in the Universal Editor. For JSON forms, use:

```json
{
  "id": "amount",
  "name": "amount",
  "fieldType": "number-input",
  ":type": "live-amount-input",
  "type": "number",
  "label": { "value": "Amount" },
  "required": true,
  "minimum": 0,
  "maximum": 999999999.99,
  "default": 12345.67
}
```

## Authoring Properties

These custom properties are read from `fieldJson.properties`.

| Property | Default | Purpose |
|----------|---------|---------|
| `title` | `live-amount-input` | Card heading; empty hides the text |
| `subtitle` | `Amount input with live amount-in-words update` | Card introduction |
| `wordsLabel` | `Amount (in words)` | Accessible label for the derived output |
| `readOnlyLabel` | `Read-only` | Note identifying the derived output as non-editable |

Standard label, placeholder, required, minimum, maximum, enabled, read-only, and help properties remain available.

## Model Subscriptions

Uses `subscribe(..., { listenChanges: true })` for initialization and changes to `value`, `enabled`, `readOnly`, `minimum`, and `maximum`. External value changes update both the grouped input and words.

## Model Properties Set

Writes a numeric `model.value` on native `change`/blur, or `null` when cleared. Words update on every `input` event without running change rules. Comparing before assignment means a normal edit commits once, not once per keystroke or again on blur. Clearing commits immediately.

Invalid edits display an inline error and set native custom validity, blocking submission; they do not overwrite the last committed model value. Correct the input before committing. The words output is derived UI, not a second submitted field.

## Usage Notes

- Extends `number-input`; `fd:viewType` / `:type` is `live-amount-input`. Use numeric model type `number`, not `integer`.
- English Indian currency words use Thousand, Lakh, and Crore. Supported amounts are 0 through 99,99,99,999.99, with at most two decimal places; negatives, exponents, malformed grouping, and extra decimals show errors rather than being rounded.
- The input accepts ungrouped, Indian-grouped, or Western-grouped amounts. Indian digit grouping is applied initially and on commit, not while typing, so the caret remains stable.
- The rupee prefix is decorative. The live output has an accessible label and polite announcements; the clear button works with Enter/Space and returns focus to the amount.
- This component owns its display formatting; do not set `displayFormat` or `displayValueExpression`.
