/**
 * Shared by the trigger and the search. A response arrives in two shapes, a
 * webhook delivery and an API v2 row; Zapier needs one, so both are flattened
 * into the same fields: who sent it, when, and one field per question (by its
 * key when it has one, otherwise its wording).
 */

const API = process.env.FORMKIT_API || "https://formkit.app/api/v2";

const fieldName = (a) => a.key || a.question;

function flatten(input) {
  // A webhook delivery carries { event, form, response }; an API row is the response itself.
  const r = input.response ? input.response : input;
  const form = input.form || { id: r.formId };
  const out = {
    id: r.id,
    form_id: form.id,
    form_title: form.title || undefined,
    submitted_at: r.submittedAt,
    name: (r.respondent && r.respondent.name) || "",
    email: (r.respondent && r.respondent.email) || "",
  };
  for (const a of r.answers || []) {
    const value = Array.isArray(a.value) ? a.value.join(", ") : a.value == null ? "" : String(a.value);
    out[fieldName(a)] = a.fileUrl ? a.fileUrl : value;
  }
  return out;
}

module.exports = { API, flatten };
