/**
 * ============================================================================
 *  ARUP BANERJEE LABS — SHARED CONFIG (the ONE place to plug in accounts)
 * ============================================================================
 *  GOATCOUNTER_CODE is live (`arup-labs`). Counts still go out only from
 *  https://ultimatixarup.github.io over https, and only when the browser does
 *  not send Do Not Track or Global Privacy Control.
 *  LIST_FORM_ACTION, FEEDBACK_FORM_URL, and GLP1_FEEDBACK_FORM_URL are still
 *  placeholders, so the signup form and feedback links stay hidden.
 *
 *  DATA ONLY. This file must never send anything or read the page.
 *  GLP-1 Support loads it just to read GLP1_FEEDBACK_FORM_URL (a plain link);
 *  that page never loads labs-counts.js and its CSP still blocks all requests.
 * ============================================================================
 */
window.LABS_CONFIG = Object.freeze({
  // GoatCounter site code: the "mycode" part of https://mycode.goatcounter.com
  // (lowercase letters, digits, hyphens). Used by shared/labs-counts.js.
  GOATCOUNTER_CODE: "arup-labs",

  // Counts are sent only when the page is served from this host (so local
  // copies, file:// and test servers never count).
  COUNT_HOST: "ultimatixarup.github.io",

  // Double-opt-in list form action, e.g. Buttondown:
  //   https://buttondown.com/api/emails/embed-subscribe/YOUR_USERNAME
  // If you switch to another provider, also update the form-action CSP in
  // agent-health-checker/index.html.
  LIST_FORM_ACTION: "LIST_FORM_ACTION",

  // "Share feedback / testimonial" form (Google Form or Tally share link) for
  // the hub and the 3 dev tools.
  FEEDBACK_FORM_URL: "FEEDBACK_FORM_URL",

  // SEPARATE GLP-1 Support usefulness / usability form (no health questions).
  GLP1_FEEDBACK_FORM_URL: "GLP1_FEEDBACK_FORM_URL"
});
