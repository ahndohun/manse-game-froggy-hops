# Manse platform shell mobile check

- Viewport contract: 390 by 844 CSS pixels.
- The shell collapses from 68 pixels to 64 pixels and remains a single line.
- The inner row uses `white-space: nowrap` and clips overflow at the shell boundary.
- The action group clips overflow independently, while the localized return action is capped at 112 pixels with an ellipsis fallback.
- The exact 390 by 844 contract and these CSS guards are exercised by `tests/routes.test.mjs`.
- No synthetic mobile screenshot is claimed because a resizable browser viewport was unavailable for this pass.
