# V2 Field Interactions

`apps/web/src/v2-fields.css` owns interaction states for text inputs, native
selects, report textareas, compound search fields and category picker triggers.
Keep page-specific sizing in the owning layout, not in the state rules.

- Default: surface background, line border and the shared field radius.
- Hover: muted border on enabled fields, only on devices supporting hover.
- Focus/open: neutral `--field-focus` border with a one-pixel inset emphasis; no outer glow,
  offset outline, scaling or layout shift. Keyboard and pointer focus agree.
- Invalid: error border after native user validation or `aria-invalid="true"`.
  The error color remains visible on hover and focus, not just by default.
- Disabled: one opacity reduction and a not-allowed cursor; never double-dim
  both a select and its wrapper. Read-only text remains readable.
- Checkboxes and radios retain native interaction with a theme-aware accent
  and visible keyboard outline. Hidden theme radios use their existing label.
- Reduced motion disables field transitions.

Search places its border on the label wrapper, never on the inner input.
Use native constraints for native validation. Set `aria-invalid` only for
field-specific validation, not for network or delivery failures.
V1 styles and behavior remain unchanged.
