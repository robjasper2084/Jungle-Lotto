# Collector Access Recovery Review

- Review date: 2026-08-03
- Branch: `upgrade-redesign`
- Staging URL: Local only (`http://127.0.0.1:8385/`)
- Production reference: `v1-final` at `975c637cea7003533cdc30aed9d96be51929bfc8`
- Routes reviewed: `/index.html#lottomind-refined`, `/memberships.html?collector=access#lm-access-hero`
- Viewports: `1440x900`, `390x844`

## Visual Comparisons

- Production Home: [`../visual-baseline/v1/home--desktop.png`](../visual-baseline/v1/home--desktop.png), [`../visual-baseline/v1/home--mobile.png`](../visual-baseline/v1/home--mobile.png)
- Staging Home: [`collector-access-recovery-assets/home-collector-entry--desktop.png`](collector-access-recovery-assets/home-collector-entry--desktop.png), [`collector-access-recovery-assets/home-collector-entry--mobile.png`](collector-access-recovery-assets/home-collector-entry--mobile.png)
- Production Memberships: [`../visual-baseline/v1/memberships--desktop.png`](../visual-baseline/v1/memberships--desktop.png), [`../visual-baseline/v1/memberships--mobile.png`](../visual-baseline/v1/memberships--mobile.png)
- Staging Collector Access: [`collector-access-recovery-assets/memberships-collector-access--desktop.png`](collector-access-recovery-assets/memberships-collector-access--desktop.png), [`collector-access-recovery-assets/memberships-collector-access--mobile.png`](collector-access-recovery-assets/memberships-collector-access--mobile.png)

## Review Findings

- Improvements: Home now provides a direct Collector Access action beside Unlock Vault. The sign-in panel adds an accessible password visibility control, session persistence choice, Forgot Password action, and password-update form.
- Intentional visual departure: The Home action group contains one additional outlined command, and the Collector form is taller to accommodate recovery controls.
- Regressions: None found. Both affected routes have zero horizontal overflow at desktop and mobile widths.
- Features intentionally removed: None.
- Features unintentionally lost: None found.
- Accessibility: Password visibility buttons expose state with `aria-pressed`; labels remain associated with inputs; recovery status is announced; keyboard and mobile checks passed.
- Performance: No new media was added. The change adds small HTML, CSS, and JavaScript controls only.
- Safety: Staging blocks password reset emails, password updates, production account writes, live payments, real redemptions, and production analytics. Raw passwords are never stored; Remember me controls session-token persistence only.
- Backend limitation: Password recovery endpoint source is prepared but not deployed. Staging has no isolated account backend and correctly reports the blocked action.
- Recommended corrections: Deploy and validate the recovery endpoints only in an approved isolated environment before enabling password recovery on a hosted preview.
- Approval status: Ready for next phase

