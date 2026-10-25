# SubReady Ontario — Supabase setup (click-by-click)

Do this ONCE for SubReady (separate project from LabelReady). ~10 minutes. No coding.

## 1. Create the project
1. Go to https://supabase.com → sign in → **New project**.
2. Name: `subready-ontario`. Region: closest Canadian option offered (e.g. Canada (Central) if listed, otherwise US East).
3. Set a strong database password and SAVE it in your password manager (the site never uses it).
4. Wait for provisioning to finish.

## 2. Run the schema
1. Left sidebar → **SQL Editor** → **New query**.
2. Paste the ENTIRE contents of `schema.sql` (this folder) → **Run**.
3. Expect "Success. No rows returned". This creates `profiles`, `orders`, the status enum, row-level security, and the private `documents` storage bucket.

## 3. Enable email auth
1. **Authentication → Providers → Email**: enabled (default).
2. Leaving "Confirm email" ON is fine.
3. **Authentication → URL Configuration**: set Site URL to the live site (e.g. `https://subready.ca`) when deployed, and add it under Redirect URLs. For local testing add `http://localhost:8000`.

## 4. Paste the keys into the site
1. **Settings → API**: copy the **Project URL** and the **anon / public** key. (NEVER put the `service_role` key in the website — it bypasses all security.)
2. Open `../assets/config.js` and replace:
   - `PLACEHOLDER_SUPABASE_URL` → Project URL
   - `PLACEHOLDER_SUPABASE_ANON_KEY` → anon key
3. Redeploy. The "Preview mode" banner disappears; users then see only their own orders (row-level security).

## 5. Storage (sub documents)
- The schema created a **private** bucket named `documents` with per-user folder policies (`documents/<user-id>/<order-id>/<file>`).
- Phase 1 shows the document checklist with uploads disabled; wiring the upload button is Phase 2. Access is via signed URLs only — never public links.
- Retention: customer-selectable and disclosed; WSIB principals retain clearances at least 3 years, so evidence is not auto-deleted early.

## 6. Stripe payment link (when Stripe sign-in works)
1. Stripe Dashboard → **Payment Links → New**: product "SubReady Ontario — Subcontractor Readiness Packet (1 sub)", **CAD 59.00**, one-time. (A $99 3-pack link can be added later as a second link — not wired in Phase 1.)
2. Paste the `https://buy.stripe.com/...` URL into `../assets/config.js` replacing `PLACEHOLDER_STRIPE_PAYMENT_LINK`, then redeploy.
3. The site appends `client_reference_id=<order id>` for reconciliation. Phase 2 adds a webhook to flip orders to `paid` automatically; until then, verify in Stripe and mark `paid` manually in Supabase → Table editor → `orders`.

## Hard rules carried into this backend
- No automated WSIB / Canada Business Registries scraping, no CAPTCHA or login bypass — verification is operator-assisted through permitted routes only.
- A COI alone never produces `INDEPENDENTLY_VERIFIED` (see the note at the top of `schema.sql`).
