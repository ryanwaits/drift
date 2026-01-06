# @doccov/web

## 0.1.29

### Patch Changes

- refactor(sdk): use SpecTag.param for param parsing, bump openpkg-ts deps

  - utils.ts: rewrite extractParamFromTag to use SpecTag.param field directly
  - param-drift.ts: pass full SpecTag to extractParamFromTag
  - index.ts: remove normalizeParamName export (unused)
  - cli/writer.ts: use findProjectRoot for cleaner relative paths
  - bump @openpkg-ts/extract ^0.18.0 -> ^0.19.0 (root, sdk)
  - bump @openpkg-ts/spec ^0.12.0 -> ^0.19.0 (sdk, cli, web)

- Updated dependencies
  - @doccov/sdk@0.30.1

## 0.1.28

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.30.0
  - @doccov/api-shared@0.2.26

## 0.1.27

### Patch Changes

- feat(badge): use doccov.json report instead of openpkg.json

  Badge endpoints now read health score from `.doccov/doccov.json` instead of computing from `openpkg.json`. Added remote docs fetching to CLI (URL, GitHub patterns) with caching support. Moved spec cache to `.doccov/cache/` subdirectory.

- Updated dependencies
  - @doccov/sdk@0.29.0
  - @doccov/api-shared@0.2.25

## 0.1.26

### Patch Changes

- fix(deps): replace workspace:\* with actual versions in apps
- Updated dependencies
  - @doccov/api-shared@0.2.24
  - @doccov/auth@0.1.2

## 0.1.25

### Patch Changes

- Updated dependencies [24f04ff]
  - @doccov/sdk@0.28.1
  - @doccov/api-shared@0.2.23

## 0.1.24

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.28.0
  - @doccov/api-shared@0.2.22

## 0.1.23

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.27.5
  - @doccov/api-shared@0.2.21

## 0.1.22

### Patch Changes

- @doccov/sdk@0.27.4
- @doccov/api-shared@0.2.20

## 0.1.21

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.27.3
  - @doccov/api-shared@0.2.19

## 0.1.20

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.27.2
  - @doccov/api-shared@0.2.18

## 0.1.19

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.27.0
  - @doccov/api-shared@0.2.17

## 0.1.18

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.26.0
  - @doccov/api-shared@0.2.16

## 0.1.17

### Patch Changes

- @doccov/sdk@0.25.12
- @doccov/api-shared@0.2.15

## 0.1.16

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.25.11
  - @doccov/api-shared@0.2.14

## 0.1.15

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.25.10
  - @doccov/api-shared@0.2.13

## 0.1.14

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.25.9
  - @doccov/api-shared@0.2.12

## 0.1.13

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.25.8
  - @doccov/api-shared@0.2.11

## 0.1.12

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @doccov/api-shared@0.2.10
  - @doccov/sdk@0.25.7

## 0.1.11

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.25.5
  - @doccov/api-shared@0.2.9

## 0.1.10

### Patch Changes

- @doccov/sdk@0.25.4
- @doccov/api-shared@0.2.8

## 0.1.9

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @openpkg-ts/spec@0.12.0
  - @doccov/sdk@0.25.3
  - @doccov/api-shared@0.2.7

## 0.1.8

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.25.2
  - @doccov/api-shared@0.2.6

## 0.1.7

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.25.1
  - @doccov/api-shared@0.2.5

## 0.1.6

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.25.0
  - @doccov/api-shared@0.2.4

## 0.1.5

### Patch Changes

- @doccov/sdk@0.24.2
- @doccov/api-shared@0.2.3

## 0.1.4

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.24.1
  - @openpkg-ts/spec@0.11.1
  - @doccov/api-shared@0.2.2

## 0.1.3

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.24.0
  - @doccov/api-shared@0.2.1

## 0.1.2

### Patch Changes

- Updated dependencies
  - @doccov/api-shared@0.2.0
  - @doccov/sdk@0.23.0

## 0.1.1

### Patch Changes

- Updated dependencies
  - @doccov/db@0.2.0
  - @doccov/sdk@0.22.1
  - @doccov/api-shared@0.1.1
  - @doccov/auth@0.1.1
