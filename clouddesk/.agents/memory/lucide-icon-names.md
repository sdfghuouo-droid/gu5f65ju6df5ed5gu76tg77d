---
name: lucide-react icon names
description: Some icon names changed in lucide-react v5; use X not Cross2Icon.
---

`Cross2Icon` was removed from lucide-react in v5. The correct replacement is `X`.

**Why:** Breaking rename in lucide-react v5 upgrade. The workspace catalog pins a v5+ version.

**How to apply:** Any time you see `Cross2Icon` in imports, replace with `X as Cross2Icon` or just `X`.
