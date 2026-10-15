const { API, flatten } = require("../lib");

/** Find a response to a form by anything it says: an email address, a name, a word. */
module.exports = {
  key: "find_response",
  noun: "Response",
  display: { label: "Find Response", description: "Finds a response to a form by an email address, a name or any word in it." },
  operation: {
    inputFields: [
      { key: "form", label: "Form", required: true, dynamic: "forms.id.title" },
      { key: "query", label: "Look for", required: true, helpText: "An email address, a name, or any word in the answers." },
    ],
    perform: async (z, bundle) => {
      const res = await z.request({ url: `${API}/forms/${bundle.inputData.form}/search`, params: { q: bundle.inputData.query, limit: 5 } });
      return res.json.data.map(flatten);
    },
    sample: { id: "j57c0000", form_id: "k17a0000", submitted_at: "2026-10-14T09:30:00.000Z", name: "Sam Taylor", email: "sam@example.com" },
  },
};
