const authentication = require("./authentication");
const newResponse = require("./triggers/newResponse");
const forms = require("./triggers/forms");
const findResponse = require("./searches/findResponse");

/** Every request carries the account's API key. */
const withKey = (request, z, bundle) => {
  if (bundle.authData && bundle.authData.apiKey) request.headers.Authorization = `Bearer ${bundle.authData.apiKey}`;
  return request;
};

/** Formkit's errors come back as { error: { message } }; Zapier shows that message. */
const explain = (response, z) => {
  if (response.status >= 400) {
    const message = (response.json && response.json.error && response.json.error.message) || `Formkit answered ${response.status}.`;
    throw new z.errors.Error(message, "FormkitError", response.status);
  }
  return response;
};

module.exports = {
  version: require("./package.json").version,
  platformVersion: require("zapier-platform-core").version,
  authentication,
  beforeRequest: [withKey],
  afterResponse: [explain],
  triggers: { [newResponse.key]: newResponse, [forms.key]: forms },
  searches: { [findResponse.key]: findResponse },
};
