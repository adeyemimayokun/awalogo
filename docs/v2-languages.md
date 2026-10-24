# V2 Languages

V2 supports English (default), Hausa (`ha`), Yoruba (`yo`), Igbo (`ig`) and Nigerian Pidgin (`pcm`). The language menu is in the top navigation. Preferences use `awalogo-v2-language` in local storage; blocked storage falls back to a working session preference.

Translations are local, with no translation service or transmission of user content. `V2LanguageProvider` is mounted only inside V2. It updates the document language while mounted and restores it on unmount. V1, the plugin, catalogs and artwork are unchanged.

UI messages live in `apps/web/src/v2-translations.ts`. Use `t()` for presentation only. Keep canonical option values, company identities, asset identifiers, code, URLs, filenames and submitted data unchanged. Use named interpolation tokens for variable messages, rather than concatenating translated fragments. Unknown messages fall back to English.

Published update stories and changelog entries remain in English and carry an explanatory notice. Browser-native validation and unknown server errors may also appear in English or the browser's language. Country names use the browser's locale data, with English for Pidgin.

Recent keys cover pack/drop/bulk undo, pagination and jump labels, related-name
suggestions for logos/flags, sounds and reset actions. The new V2 information
panels are localized; V2 preview release notes remain English. Company names,
country names from the pinned flag dataset, shortcut bindings and artwork/code
are not machine-translated. Country filter display names use locale data.

The initial translations are drafts, not professionally certified translations. Before public launch, ask fluent speakers of each language to review terminology, tone, diacritics and legal text. Do not claim native-speaker review has occurred. Add all four translations and matching tokens when adding a UI message; `v2-translations.test.tsx` checks completeness.
