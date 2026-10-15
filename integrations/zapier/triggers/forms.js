const { API } = require("../lib");

/** The account's forms, for the form picker. Hidden from people building Zaps. */
module.exports = {
  key: "forms",
  noun: "Form",
  display: { label: "Forms", description: "Lists your forms.", hidden: true },
  operation: {
    perform: async (z) => {
      const res = await z.request({ url: `${API}/forms` });
      return res.json.data.map((f) => ({ id: f.id, title: f.title }));
    },
  },
};
