# LottoMind Repository Guardrails

These rules apply to the entire repository.

1. All upgrade work occurs on `upgrade-redesign`.
2. `main` is production and must not receive implementation commits.
3. `v1-final` must never be moved or deleted.
4. Production deployment requires explicit approval.
5. Preserve existing Supabase, Stripe, account-service, reward-service, and checkout contracts unless a task explicitly changes them.
6. Never expose private keys, service-role keys, passwords, or secrets in frontend code.
7. Staging must not use live payments or real redemption operations.
8. Never invent live viewers, member counts, purchases, testimonials, inventory, rankings, event status, or social proof.
9. Do not autoplay audio.
10. Preserve entertainment-only lottery disclaimers.
11. Keep changes narrowly scoped to the current task.
12. Every change must be keyboard accessible, responsive, and tested with reduced motion.
13. Do not edit generated hashed bundles directly; locate and edit their source files.
14. Preserve LottoMind's Detroit-inspired, Guardian, music-technology, arcade, and cinematic visual identity.
15. Simplification must improve hierarchy without making the project look generic.
