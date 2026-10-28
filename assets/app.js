/* SubReady Ontario — shared platform logic.
   Talks to Supabase (auth + Postgres) when assets/config.js is filled in.
   While config values are still PLACEHOLDER_*, the site runs in PREVIEW
   MODE: accounts and orders are kept in this browser's localStorage only,
   and checkout shows the "payments opening soon" state. Nothing in
   preview mode leaves the visitor's browser. */
(function () {
  "use strict";
  var cfg = window.PLATFORM_CONFIG || {};

  function isPlaceholder(v) { return !v || String(v).indexOf("PLACEHOLDER_") === 0; }
  var supabaseReady = !isPlaceholder(cfg.SUPABASE_URL) && !isPlaceholder(cfg.SUPABASE_ANON_KEY);
  var paymentsReady = !isPlaceholder(cfg.STRIPE_PAYMENT_LINK);
  var sb = null;
  if (supabaseReady && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  /* ---------- products ---------- */
  // config.js defines PRODUCTS (id, name, price_cad, price_label,
  // stripe_link); the first entry is the full product. When PRODUCTS is
  // absent, the legacy single-product fields are treated as that one
  // product. `paymentsReady` above stays the full product's link state
  // (page chrome); per-product checks use paymentsReadyFor().
  function products() {
    if (cfg.PRODUCTS && cfg.PRODUCTS.length) { return cfg.PRODUCTS; }
    return [{ id: "full", name: cfg.PRODUCT_NAME, price_cad: cfg.PRICE_CAD, price_label: cfg.PRICE_LABEL, stripe_link: cfg.STRIPE_PAYMENT_LINK }];
  }
  function productById(id) {
    var list = products();
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return list[0];
  }
  // Orders store the product name and price, so match on those (name
  // first, then price) to find which product an existing order is for.
  function productForOrder(order) {
    var list = products(), i;
    if (!order) { return list[0]; }
    for (i = 0; i < list.length; i++) { if (list[i].name === order.product) { return list[i]; } }
    for (i = 0; i < list.length; i++) { if (Number(list[i].price_cad) === Number(order.price_cad)) { return list[i]; } }
    return list[0];
  }
  function paymentsReadyFor(product) { return !!product && !isPlaceholder(product.stripe_link); }

  /* ---------- preview-mode local store ---------- */
  var LS_ORDERS = "sr_preview_orders";
  function lsOrders() { try { return JSON.parse(localStorage.getItem(LS_ORDERS)) || []; } catch (e) { return []; } }
  function lsSaveOrders(o) { localStorage.setItem(LS_ORDERS, JSON.stringify(o)); }

  /* ---------- auth ---------- */
  async function currentUser() {
    if (sb) { var r = await sb.auth.getUser(); return r.data.user || null; }
    try { return JSON.parse(localStorage.getItem("sr_preview_user")); } catch (e) { return null; }
  }
  async function signUp(email, password, meta) {
    if (sb) { return sb.auth.signUp({ email: email, password: password, options: { data: meta || {} } }); }
    localStorage.setItem("sr_preview_user", JSON.stringify({ email: email, user_metadata: meta || {} }));
    return { data: { user: { email: email } }, error: null };
  }
  async function signIn(email, password) {
    if (sb) { return sb.auth.signInWithPassword({ email: email, password: password }); }
    var u = await currentUser();
    if (u && u.email === email) { return { data: { user: u }, error: null }; }
    localStorage.setItem("sr_preview_user", JSON.stringify({ email: email, user_metadata: {} }));
    return { data: { user: { email: email } }, error: null };
  }
  async function signOut() {
    if (sb) { await sb.auth.signOut(); }
    localStorage.removeItem("sr_preview_user");
    window.location.href = "index.html";
  }

  /* ---------- orders ---------- */
  async function createOrder(intake, productId) {
    var product = productById(productId);
    var row = {
      product: product.name, price_cad: product.price_cad, currency: "CAD",
      status: paymentsReadyFor(product) ? "pending_payment" : "waitlist",
      intake: intake
    };
    if (sb) {
      var u = await currentUser();
      if (u) { row.user_id = u.id; }
      var r = await sb.from("orders").insert(row).select().single();
      if (r.error) { throw r.error; }
      return r.data;
    }
    row.id = "preview-" + Date.now();
    row.created_at = new Date().toISOString();
    var all = lsOrders(); all.unshift(row); lsSaveOrders(all);
    return row;
  }
  async function listOrders() {
    if (sb) {
      var r = await sb.from("orders").select("*").order("created_at", { ascending: false });
      if (r.error) { throw r.error; }
      return r.data;
    }
    return lsOrders();
  }
  async function getOrder(id) {
    if (sb) {
      var r = await sb.from("orders").select("*").eq("id", id).single();
      if (r.error) { throw r.error; }
      return r.data;
    }
    return lsOrders().filter(function (o) { return o.id === id; })[0] || null;
  }

  /* ---------- checkout ---------- */
  // Returns true if it redirected to Stripe; false if the caller should
  // show the "payments opening soon — join the list" state instead.
  function checkout(orderId, order) {
    var product = order ? productForOrder(order) : productById();
    if (!paymentsReadyFor(product)) { return false; }
    var url = product.stripe_link;
    // Lets Stripe pre-fill the buyer's email and lets us reconcile the
    // payment to the order later via the client_reference_id.
    url += (url.indexOf("?") === -1 ? "?" : "&") + "client_reference_id=" + encodeURIComponent(orderId || "");
    window.location.href = url;
    return true;
  }

  /* ---------- page chrome ---------- */
  function wireChrome() {
    var soon = document.querySelectorAll("[data-payments-soon]");
    soon.forEach(function (el) { el.style.display = paymentsReady ? "none" : ""; });
    var live = document.querySelectorAll("[data-payments-live]");
    live.forEach(function (el) { el.style.display = paymentsReady ? "" : "none"; });
    var mode = document.getElementById("mode-banner");
    if (mode && !supabaseReady) {
      mode.textContent = "Preview mode: accounts are not live yet. Join the list and we will email you when ordering opens.";
      mode.style.display = "";
    }
    var out = document.getElementById("signout-link");
    if (out) { out.addEventListener("click", function (e) { e.preventDefault(); signOut(); }); }
  }
  document.addEventListener("DOMContentLoaded", wireChrome);

  window.Platform = {
    cfg: cfg, supabaseReady: supabaseReady, paymentsReady: paymentsReady,
    products: products, productById: productById, productForOrder: productForOrder,
    paymentsReadyFor: paymentsReadyFor,
    currentUser: currentUser, signUp: signUp, signIn: signIn, signOut: signOut,
    createOrder: createOrder, listOrders: listOrders, getOrder: getOrder, checkout: checkout
  };
})();
