const { API } = require("./lib");

/** A Formkit API key, made in Settings → Developers, with "Read your forms" and "Read responses" ticked. */
module.exports = {
  type: "custom",
  fields: [
    {
      key: "apiKey",
      label: "API key",
      required: true,
      helpText:
        "Make one in Formkit under Settings → Developers. Tick **Read your forms** and **Read responses**. It starts fk_live_.",
    },
  ],
  test: { url: `${API}/me` },
  connectionLabel: "{{email}}",
};
