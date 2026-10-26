/* =====================================================================
   SubReady Ontario — platform configuration (PUBLIC values only)
   ---------------------------------------------------------------------
   This is the ONLY file you edit to take the platform live.
   It is safe to commit: the Supabase anon key is designed to be public
   and is protected by Row Level Security (see supabase/schema.sql).
   NEVER paste a Supabase service_role key or a Stripe secret key here.

   GO-LIVE — fill in the three PLACEHOLDER values below:
   1. SUPABASE_URL + SUPABASE_ANON_KEY
      Supabase dashboard → your project → Settings → API.
      Steps: see supabase/README.md.
   2. STRIPE_PAYMENT_LINK
      Stripe Dashboard → Payment Links → create a link for
      "SubReady Ontario — Subcontractor Readiness Packet (1 sub)",
      CAD 59.00, one-time. Paste the full https://buy.stripe.com/... URL
      here. Until this is a real link, checkout buttons automatically
      show the "payments opening soon — join the list" state and orders
      are saved as waitlist/preview entries instead of going to Stripe.
   ===================================================================== */
window.PLATFORM_CONFIG = {
  BUSINESS_NAME: "SubReady Ontario",
  PRODUCT_NAME: "Subcontractor Readiness Packet (1 sub)",
  PRICE_CAD: 59,
  PRICE_LABEL: "$59",

  SUPABASE_URL: "https://ohjowgdgvcvaaksjaqdb.supabase.co",           // e.g. https://abcd1234.supabase.co
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oam93Z2RndmN2YWFrc2phcWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDczODIsImV4cCI6MjEwODM4MzM4Mn0.LB9FznxcIxbAfJrRWDtWV2p6vWLYhlVSju_X52A4rZU", // long anon/public key from Supabase

  STRIPE_PAYMENT_LINK: "https://buy.stripe.com/cNieVd1QM0S50z44ZYgEg01", // e.g. https://buy.stripe.com/...

  SUPPORT_EMAIL: "rufat.baghirov97@gmail.com",
  STORAGE_BUCKET: "documents" // Supabase Storage bucket name (see supabase/README.md step 5)
};
