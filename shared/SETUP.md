# Plugging in accounts (all free)

Everything is switched off until you edit **`shared/labs-config.js`**. Each value is independent.

## 1. GoatCounter (anonymous, cookieless counts) → `GOATCOUNTER_CODE`

1. Sign up at <https://www.goatcounter.com/signup> with arupkumar.banerjee@gmail.com. Pick a site code, e.g. `arup-labs`
   (your dashboard is then `https://arup-labs.goatcounter.com`). Confirm the verification email.
2. Optional, for less data: in Settings → Data collection, untick what you don't need (e.g. region, language).
3. Set `GOATCOUNTER_CODE: "arup-labs"` in `shared/labs-config.js`. No other file needs editing
   (the CSPs already allow `https://*.goatcounter.com` images).

What shows up: page paths (`/`, `/case-study/`, `/agent-health-checker/`, `/cloud-bill-smell/`, `/observability-gap-finder/`)
and events `<page>/analyze_clicked`, `<page>/score_bucket/<0-24|25-49|50-74|75-100>`, `<page>/copy_clicked/<report|redteam>`,
`hub/glp1_link_clicked`. Counts only come from `https://ultimatixarup.github.io`.

## 2. Buttondown (double-opt-in "Get updates") → `LIST_FORM_ACTION`

1. Sign up at <https://buttondown.com> with arupkumar.banerjee@gmail.com and pick a username (e.g. `aruplabs`).
2. Double opt-in is on by default (Buttondown requires it). Leave it on. Edit the confirmation email text if you like.
3. Add a postal mailing address in the sender settings (CAN-SPAM needs one in every email; a P.O. box works).
4. Optional, to match the privacy promise: turn off open and click tracking in the newsletter settings.
5. Set `LIST_FORM_ACTION: "https://buttondown.com/api/emails/embed-subscribe/aruplabs"`.
6. Export: Subscribers → Export (CSV). The free tier covers 100 subscribers. Export and review before you reach that.

If you ever switch providers, also update `form-action` in the CSP in `agent-health-checker/index.html`.

## 3. Feedback / testimonial form → `FEEDBACK_FORM_URL`

Google Forms (free with the existing Google account) or Tally (free). Settings: do **not** collect email addresses and
do **not** require sign-in. Description: "Please don't paste configs, bills, keys or secrets. Nothing is published
automatically; quotes are approved by hand." Fields:

1. What did you use it for? (paragraph, required)
2. What helped, or what didn't? (paragraph, required)
3. Name (short answer, optional)
4. Role / company (short answer, optional)
5. Checkbox, optional, unticked: "OK to quote this publicly (first name/initial only unless I say otherwise)"
6. Checkbox, optional: "I know Arup personally or work with him" (so any quote can disclose the connection)

Paste the form's share link as `FEEDBACK_FORM_URL`.

## 4. GLP-1 Support usability form → `GLP1_FEEDBACK_FORM_URL`

A **separate** form. Description: "Please don't share medical details, weight, or medication info." No name or email
fields and no quote-consent box, because this form doesn't collect testimonials. Fields: "Was the page useful?" (1-5),
"What was confusing or hard to use?", "What would make it more useful?" (all optional). Paste its share link as
`GLP1_FEEDBACK_FORM_URL`. GLP-1 Support shows only a plain link to it, with no embed and no requests from the page.
