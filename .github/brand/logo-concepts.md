# Drift Logo Concepts

Exploring logo directions that communicate: documentation + coverage + quality + developer tools.

---

## Concept 1: The Doc Shield

Coverage as protection for your documentation. A shield shape with a document/page inside.

```
     ╭─────────╮
    ╱    ───    ╲
   │     ───     │
   │     ───     │
    ╲     ✓     ╱
     ╰─────────╯
```

```
    ┌───────────┐
   ╱│  ═══════  │╲
  │ │  ═══════  │ │
  │ │  ═══      │ │
  │ │     ✓     │ │
   ╲│           │╱
    └───────────┘
```

Minimal version:
```
   ╱─────╲
  │ ≡  ✓  │
   ╲─────╱
```

---

## Concept 2: The Coverage Meter

A circular progress indicator - the core visual of the product. Simple, iconic, immediately recognizable.

```
      ╭───────╮
    ╱    DC    ╲
   │            │
   │            │
    ╲          ╱
      ╰━━━━━━━╯
```

```
     ╭────────╮
   ╱╱          ╲╲
  ║      87%    ║
   ╲╲          ╱╱
     ╰━━━━━━━━╯
```

Abstract meter:
```
    ◐ DC
```

```
    ○━━━━━━━━●
       DC
```

---

## Concept 3: The Doc + Check

Document icon with a checkmark - documentation that's verified/validated.

```
   ┌──────┬──┐
   │      │  │
   │ ════ ├──┘
   │ ════
   │ ══   ✓
   │
   └─────────┘
```

```
   ┌────────┐
   │ ══════ │
   │ ══════ │ ✓
   │ ════   │
   └────────┘
```

Compact:
```
   ▤ ✓
```

```
   [≡]✓
```

---

## Concept 4: The Brackets

Code brackets containing a checkmark or percentage - developer-native, minimal.

```
   { ✓ }
```

```
   </ ✓ >
```

```
   /** ✓ */
```

```
   [ 87% ]
```

JSDoc-style (very on-brand for documentation):
```
   /**
    * ✓
    */
```

Compact JSDoc:
```
   /** ✓ */
```

---

## Concept 5: The DC Monogram

Letters D and C combined cleverly. Works as favicon, app icon, small badge.

```
   ╭────╮
   │ D  │
   │  C │
   ╰────╯
```

Interlocked:
```
    ┌──┐
   ┌┘DC└┐
   └────┘
```

Stacked:
```
   ╔════╗
   ║ DC ║
   ╚════╝
```

Rounded square (app icon style):
```
   ╭──────╮
   │      │
   │  DC  │
   │      │
   ╰──────╯
```

---

## Concept 6: The Coverage Bar

Horizontal progress bar - the signal breakdown visualization as a logo mark.

```
   ████████░░░░
      DC
```

```
   [████████░░░░] DC
```

```
   ─━━━━━━━━━───
       DC
```

Stacked bars (like the signal breakdown):
```
   ████████████░░░░
   ██████████░░░░░░
   ████████░░░░░░░░
        DC
```

---

## Concept 7: The Doc Layers

Stacked documents showing depth/coverage across multiple files.

```
      ┌────────┐
     ┌┴───────┐│
    ┌┴───────┐││
    │ ✓ 87%  │┘│
    │        │─┘
    └────────┘
```

```
    ▁▂▃▄▅▆▇█ DC
```

---

## Concept 8: The Percentage Badge

The coverage percentage itself as the logo - bold, direct, data-forward.

```
   ┌────────────┐
   │    87%     │
   │   ══════   │
   └────────────┘
```

```
   ( 87% )
```

Circle badge:
```
     ╭───╮
    │ 87% │
     ╰───╯
```

---

## Recommended Direction

For Drift, I'd recommend **Concept 4: The Brackets** (JSDoc style) or **Concept 2: The Coverage Meter**.

### Primary Logo: JSDoc Comment + Check

```
   /** ✓ */  Drift
```

This is perfect because:
1. **Instantly recognizable** to any JS/TS developer
2. **Directly references JSDoc** - exactly what Drift analyzes
3. **The checkmark** communicates validation/coverage
4. **Minimal and scalable** - works at any size
5. **Unique** - no other dev tool uses this

### Icon/Favicon Variations

Square:
```
   ╭──────╮
   │ /** │
   │  ✓  │
   │ */  │
   ╰──────╯
```

Compact:
```
   [*✓]
```

Ultra-minimal:
```
   *✓
```

### With Wordmark

```
   /** ✓ */  Drift
```

```
   /** ✓ */
   Drift
```

```
   *✓ Drift
```

---

## Color Application

With our warm monochromatic palette, the logo would be:

- **Primary**: `#1c1917` (Stone 900) - the warm black
- **On dark**: `#fafaf9` (Stone 50) - warm white
- **Accent version**: The checkmark could be `#16a34a` (green) to tie to coverage

```
   /** ✓ */  Drift
       ↑
     green (optional)
```

---

## Wordmark Typography

The "Drift" text should be:
- **Font**: IBM Plex Mono (matches the code-first aesthetic)
- **Weight**: Medium (500) or Semibold (600)
- **Case**: PascalCase "Drift" (like JavaScript conventions)

Alternative: "drift" in lowercase for a more modern, npm-package feel.

```
   /** ✓ */  drift
```
