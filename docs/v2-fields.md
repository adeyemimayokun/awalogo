# V2 Field Interactions

`apps/web/src/v2-fields.css` owns interaction states for text inputs, native
selects, report textareas, compound search fields and category picker triggers.
Keep sizing separate from state rules. `v2-compact.css` provides shared density:
36px desktop buttons/selects/inputs, 40px search and at least 44px coarse-pointer
targets. Textareas retain comfortable editing space. The shared field radius is
12px; navigation controls match it. Logo and flag controls use the same rules.

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

Primary request actions appear in navigation and the centered empty-logo state.
The navigation CTA explicitly overrides legacy muted dock text so text and icons
contrast with the primary background in both themes and interaction states.
The centered empty-flag state uses a primary reset action instead of a logo request.

Search places its border on the label wrapper, never on the inner input.
Use native constraints for native validation. Set `aria-invalid` only for
field-specific validation, not for network or delivery failures.
V1 styles and behavior remain unchanged.
