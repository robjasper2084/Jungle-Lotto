# Owner launch checklist — Store conversion v2

Local work dated 2026-08-28. This checklist is not release approval, legal certification, or permission to collect personal data. The current branch is an interest preview; the live site has not been changed by this work.

## 1. Before collecting email

- [ ] Confirm selling identity, privacy controller, monitored contact, purposes, processors, retention, jurisdiction, and the process for exercising rights.
- [ ] Publish and approve the service-specific privacy notice and consent wording.
- [ ] Choose an owner-controlled HTTPS subscription service; configure allowed origins, server-side validation, abuse protection, rate limits, consent records, confirmation, and unsubscribe.
- [ ] Test success, pending confirmation, rejected requests, timeout, offline behavior, duplicate submissions, and unsubscribe using the real service.
- [ ] Set PUBLIC_NEWSLETTER_ENDPOINT and then launchOwner.subscriptionApproved in store/content/launch.ts only after these reviews.
- [ ] Review film transcripts/captions and rights before a public campaign.
- [ ] Do not put a secret API key in a PUBLIC variable or endpoint query string. The public form sends no credentials.

The default form does not send or save email. A locally saved loadout is not an email subscription, stock reservation, order, or payment.

## 2. Before accepting orders

- [ ] Provide approved public selling identity, business contact, support email, and accessibility email.
- [ ] Complete approvedProductInformation for every offered handle: approved price and photography, production status, materials, care, processing, shipping, returns, and SKU or Shopify ID.
- [ ] Supply measurements and size guide for sized physical products; confirm included items for bundles.
- [ ] Supply digital contents, file formats, delivery method, license, and refund limitations for digital products.
- [ ] Review every Shopify variant ID, option, price/currency, availability, shipping requirement, and tax configuration.
- [ ] Provide shipping regions, processing time, delivery expectations, shipping policy, return window, refund process, and return address/process.
- [ ] Complete privacy notice/controller/processors/retention, jurisdiction, consumer-rights information, terms, and accessibility statement.
- [ ] Review policies with the appropriate professional; set policiesApproved only after owner approval.
- [ ] Test approved Shopify checkout in a controlled merchant test environment, including inventory changes, repricing, unavailable variants, shipping, taxes, cancellation/refund, and fulfillment. Record evidence before setting checkoutTested.
- [ ] Run npm.cmd run check:launch-readiness with the intended settings. A passing script is necessary, not sufficient, for a merchant launch.
- [ ] Obtain separate approval for release, payment activation, and deployment. PUBLIC_LAUNCH_APPROVED alone cannot bypass missing facts.

## 3. Before public indexing

- [ ] Complete product descriptions, rights review, policies, contacts, and social-sharing images.
- [ ] Recheck canonical URLs, sitemap, nested base path, redirects, and any separately approved custom domain.
- [ ] Review accessibility and deployed performance on actual devices.
- [ ] Set indexingApproved only after owner approval. Interest mode continues to emit noindex,follow even when this flag is true.
- [ ] Remember noindex is a crawler preference, not access control.

## 4. Before manufacturing claims

- [ ] Obtain supplier-verified composition, weight, finish, construction, measurements, care, country of manufacture, tolerances, packaging, and included items.
- [ ] Inspect physical samples and match all imagery and labels to the real item.
- [ ] Do not equate Detroit design origin with Detroit manufacture.
- [ ] Do not label a generated concept as production evidence.

## 5. Before reviews

- [ ] Select a real review service, permissions/consent, moderation, privacy/retention, and accurate purchaser-verification process.
- [ ] Display only actual permitted reviews; do not seed ratings, testimonials, purchase counts, or urgency.

## 6. Before customer accounts

- [ ] Separately approve authentication, session security, recovery, deletion/export, privacy, and support.
- [ ] Keep customer and payment data out of local loadout storage.
- [ ] Keep accounts disabled until the implementation and security review exist.

## Current blockers

All owner fields and product approvals remain pending. No real mailing endpoint, live Shopify checkout, customer accounts, reviews, merchant fulfillment, or public indexing approval was exercised in this task. Preserved 3D model files are not approved product models and remain unbound.
