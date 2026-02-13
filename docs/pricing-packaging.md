# Pricing & Packaging (One-Page Proposal)

## Goal

Keep Drift easy to adopt (`npm|pnpm|bun add -D @driftdev/cli`) while monetizing high-leverage hosted workflows:
- org-level visibility
- cross-repo docs automation
- governance and reliability controls

## Product Packaging

### 1) OSS Free (`@driftdev/cli`, `@driftdev/spec`)

- License: MIT
- Audience: individual developers and small teams
- Includes:
  - Local/CI drift checks (`scan`, `lint`, `coverage`, `diff`, `breaking`)
  - GitHub Action integration
  - JSON output for custom pipelines

### 2) Source-Available SDK (`@driftdev/sdk`)

- License: BUSL-1.1
- Audience: teams embedding Drift in internal tooling
- Includes:
  - Programmatic analysis APIs
  - Drift detection + markdown impact primitives
  - Example validation and report composition

Commercial use restriction remains focused on hosted third-party documentation coverage services.

### 3) Drift Cloud Pro (paid)

- Price: **$39/repo/month**
- Buyer: engineering managers, DX teams
- Value:
  - Hosted dashboards for coverage/health/drift trends
  - Weekly digest + regression alerts
  - Cross-repo visibility without building internal reporting infra

### 4) Drift Automation (paid add-on)

- Price: **$99/repo/month**
- Buyer: teams with external docs repos and release velocity
- Value:
  - Managed docs-sync PR generation on breaking changes
  - Execution logs, approvals, and rollback controls
  - Lower doc maintenance toil per release

### 5) Enterprise

- Price: custom
- Includes:
  - SSO/SAML, audit logs, retention controls
  - Self-hosted / VPC deployment option
  - Commercial SDK license + support SLA

## Join The Hosted Plan Pipeline

- Cloud Pro waitlist: https://github.com/ryanwaits/drift/issues/new?title=Cloud%20Pro%20Waitlist
- Automation pilot request: https://github.com/ryanwaits/drift/issues/new?title=Automation%20Pilot%20Request
- Enterprise inquiry: https://github.com/ryanwaits/drift/issues/new?title=Enterprise%20Inquiry

These links are the primary conversion path from OSS usage to paid adoption.

## Why This Works

- Free CLI drives top-of-funnel adoption.
- BUSL protects core hosted-service differentiation.
- Paid tiers monetize outcomes (fewer regressions, less manual docs work), not local command execution.

## Hosted Conversion Flow

1. Adopt free CLI and run `drift ci --all --min 80` on PRs.
2. Track docs quality for 1-2 weeks and identify repeated drift pain.
3. Join Cloud Pro waitlist for hosted dashboards and alerting.
4. Add Automation when cross-repo docs sync is consuming review bandwidth.
5. Expand to Enterprise when governance requirements (SSO, audit, VPC) become mandatory.

## Initial GTM

1. Keep OSS docs focused on the core promise: **fail PRs when docs drift**.
2. Add Cloud waitlist CTA in docs/site (`/pricing`).
3. Pilot Pro + Automation with 5 design partners using multi-repo API docs.

## Success Metrics

- Activation: `% repos running drift ci weekly`
- Reliability: `% PRs caught by Drift before merge`
- Monetization: `free -> pro conversion`, `pro -> automation attach rate`
- Retention: `% paid repos active after 90 days`
