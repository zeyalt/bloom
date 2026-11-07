
## Hover-only details don't work on phones
- Mistake: used a `title` tooltip ("hover for details") on the attendance strip; it never shows on tap.
- Rule: Bloom is used mainly on a phone. Any "see more" detail must work by tapping (a button that shows an inline detail). Verify with a Playwright touch device (`p.devices['iPhone 13']` + `.tap()`), not just a desktop screenshot.
