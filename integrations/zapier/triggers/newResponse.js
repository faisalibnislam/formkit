const { API, flatten } = require("../lib");

/**
 * New response: Formkit sends each one to Zapier the moment it is sent
 * (a REST hook), so nothing polls. Needs Pro, like every webhook.
 */
module.exports = {
  key: "new_response",
  noun: "Response",
  display: { label: "New Response", description: "Starts when someone sends a response to one of your forms." },
  operation: {
    type: "hook",
    inputFields: [{ key: "form", label: "Form", required: true, dynamic: "forms.id.title" }],
    performSubscribe: async (z, bundle) => {
      const res = await z.request({
        url: `${API}/hooks`,
        method: "POST",
        body: { formId: bundle.inputData.form, url: bundle.targetUrl, event: "response.created", label: "Zapier" },
      });
      return res.json;
    },
    performUnsubscribe: async (z, bundle) => {
      const res = await z.request({ url: `${API}/hooks/${bundle.subscribeData.id}`, method: "DELETE" });
      return res.json;
    },
    perform: async (z, bundle) => [flatten(bundle.cleanedRequest)],
    // Real responses, newest first, so a Zap can be tested before anything new arrives.
    performList: async (z, bundle) => {
      const res = await z.request({ url: `${API}/forms/${bundle.inputData.form}/responses`, params: { limit: 3, complete: "true" } });
      return res.json.data.map(flatten);
    },
    sample: {
      id: "j57c0000",
      form_id: "k17a0000",
      form_title: "Client onboarding",
      submitted_at: "2026-10-14T09:30:00.000Z",
      name: "Sam Taylor",
      email: "sam@example.com",
      budget: "5000",
    },
  },
};
