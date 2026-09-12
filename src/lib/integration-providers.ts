// Single source of truth for every integration's configuration form — one entry per provider,
// each field mapped to either the "configuration" (non-secret) or "credentials" (encrypted)
// object the backend (IntegrationConfigController/IntegrationConfigService) expects. Adding a
// new provider or field here is the only change needed on the frontend; the backend already
// stores whatever keys are sent without needing a matching column added.

export type IntegrationFieldType =
  | "text"
  | "secret"
  | "toggle"
  | "select"
  | "multiselect"
  | "url"
  | "number"
  | "textarea"
  | "file";

export type IntegrationField = {
  key: string;
  label: string;
  type: IntegrationFieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: { value: string; label: string }[];
  hint?: string;
};

export type IntegrationAction = "test" | "zoom-meeting" | "powerbi-publish" | "ecz-sync";

export type ProviderSchema = {
  code: string;
  name: string;
  category: string;
  description: string;
  warning?: string;
  hasCallbackUrl?: boolean;
  fields: IntegrationField[];
  credentialFields: IntegrationField[];
  actions: IntegrationAction[];
  /** True only for Power BI — renders the per-report management list (add/edit/delete) below the
   * connection-level fields, since a school may publish more than one report. */
  hasReports?: boolean;
};

const ENV_SANDBOX_PROD: IntegrationField["options"] = [
  { value: "sandbox", label: "Sandbox" },
  { value: "production", label: "Production" },
];

export const PROVIDER_SCHEMAS: ProviderSchema[] = [
  {
    code: "momo",
    name: "MTN Mobile Money",
    category: "Payments",
    description: "Collect school fees via MTN's Mobile Money Collections API.",
    hasCallbackUrl: true,
    fields: [
      { key: "environment", label: "Environment", type: "select", required: true, options: ENV_SANDBOX_PROD },
      { key: "country", label: "Country", type: "text", required: true, defaultValue: "Zambia" },
      { key: "currency", label: "Currency", type: "text", required: true, defaultValue: "ZMW" },
      { key: "merchantName", label: "Merchant name", type: "text", required: true },
      { key: "merchantAccountNumber", label: "Merchant account/wallet number", type: "text", required: true },
      { key: "apiBaseUrl", label: "API base URL", type: "url", required: true, placeholder: "https://sandbox.momodeveloper.mtn.com" },
      { key: "paymentPrefix", label: "Payment description/prefix", type: "text" },
      { key: "paymentTimeoutSeconds", label: "Payment timeout (seconds)", type: "number", required: true, defaultValue: "120" },
    ],
    credentialFields: [
      { key: "subscriptionKey", label: "Subscription key", type: "secret", required: true },
      { key: "apiUserId", label: "API user ID", type: "secret", required: true },
      { key: "apiKey", label: "API key", type: "secret", required: true },
      { key: "collectionSubscriptionKey", label: "Collection subscription key", type: "secret", required: true },
      { key: "disbursementSubscriptionKey", label: "Disbursement subscription key", type: "secret", hint: "Only needed for refunds/payouts" },
      { key: "callbackAuthSecret", label: "Callback authentication secret", type: "secret", hint: "Recommended" },
    ],
    actions: ["test"],
  },
  {
    code: "airtel",
    name: "Airtel Money",
    category: "Payments",
    description: "Collect school fees via Airtel Money's Collections API.",
    hasCallbackUrl: true,
    fields: [
      { key: "environment", label: "Environment", type: "select", required: true, options: ENV_SANDBOX_PROD },
      { key: "countryCode", label: "Country code", type: "text", required: true, defaultValue: "ZM" },
      { key: "currency", label: "Currency", type: "text", required: true, defaultValue: "ZMW" },
      { key: "merchantName", label: "Merchant name", type: "text", required: true },
      { key: "merchantAccountNumber", label: "Merchant account number", type: "text", required: true },
      { key: "apiBaseUrl", label: "API base URL", type: "url", required: true, placeholder: "https://openapiuat.airtel.africa" },
      { key: "collectionEnabled", label: "Collection enabled", type: "toggle", required: true },
      { key: "refundEnabled", label: "Refund/disbursement enabled", type: "toggle" },
      { key: "paymentTimeoutSeconds", label: "Payment timeout (seconds)", type: "number", required: true, defaultValue: "120" },
    ],
    credentialFields: [
      { key: "clientId", label: "Client ID", type: "secret", required: true },
      { key: "clientSecret", label: "Client secret", type: "secret", required: true },
      { key: "webhookSecret", label: "Webhook/signature secret", type: "secret", hint: "If your Airtel account provides one" },
    ],
    actions: ["test"],
  },
  {
    code: "zynlepay",
    name: "ZynlePay",
    category: "Payments",
    description: "Collect fees by card and mobile money via your own ZynlePay merchant account.",
    hasCallbackUrl: false,
    fields: [
      { key: "environment", label: "Environment", type: "select", required: true, options: ENV_SANDBOX_PROD },
      { key: "merchantId", label: "Merchant ID", type: "text", required: true },
      { key: "apiBaseUrl", label: "Deposit/collection URL", type: "url", required: true, placeholder: "https://sandbox.zynlepay.com/zynlepay/jsonapi" },
      { key: "paymentStatusUrl", label: "Payment status URL", type: "url", required: true, placeholder: "https://sandbox.zynlepay.com/zynlepay/jsonapi/paymentstatus" },
    ],
    credentialFields: [
      { key: "apiId", label: "API ID", type: "secret", required: true },
      { key: "apiKey", label: "API key", type: "secret", required: true },
    ],
    actions: ["test"],
  },
  {
    code: "sms",
    name: "Africa's Talking SMS",
    category: "Messaging",
    description: "Bulk SMS to parents and guardians — an alternative to the default Zamtel BulkSMS sender.",
    hasCallbackUrl: true,
    fields: [
      { key: "environment", label: "Environment", type: "select", required: true, options: ENV_SANDBOX_PROD },
      { key: "username", label: "Username", type: "text", required: true },
      { key: "senderId", label: "Sender ID/short code", type: "text", required: true },
      { key: "defaultCountryCode", label: "Default country code", type: "text", required: true, defaultValue: "+260" },
      { key: "defaultMessageTemplate", label: "Default message template", type: "textarea" },
      { key: "lowBalanceWarningLevel", label: "Low-balance warning level", type: "number", hint: "Recommended" },
      { key: "dailySmsLimit", label: "Daily SMS limit", type: "number", hint: "Recommended" },
      {
        key: "enabledMessageCategories", label: "Enabled message categories", type: "multiselect", required: true,
        options: [
          { value: "announcements", label: "Announcements" },
          { value: "attendance", label: "Attendance" },
          { value: "fees", label: "Fee reminders" },
          { value: "results", label: "Results" },
          { value: "emergency", label: "Emergency alerts" },
        ],
      },
    ],
    credentialFields: [
      { key: "apiKey", label: "API key", type: "secret", required: true },
    ],
    actions: ["test"],
  },
  {
    code: "ecz",
    name: "ECZ Sync",
    category: "Government",
    description: "Candidate registration and results download with the Examinations Council of Zambia.",
    warning: "Do not activate until the Examinations Council of Zambia has provided formal API access, credentials, approved endpoints, and a data-sharing agreement. The exact request/response contract below is this project's best-effort guess, not a confirmed ECZ specification.",
    hasCallbackUrl: false,
    fields: [
      { key: "environment", label: "Environment", type: "select", required: true, options: [{ value: "test", label: "Test" }, { value: "production", label: "Production" }] },
      { key: "institutionNumber", label: "Institution/centre number", type: "text", required: true },
      { key: "schoolName", label: "School name", type: "text", required: true },
      { key: "province", label: "Province", type: "text", required: true },
      { key: "district", label: "District", type: "text", required: true },
      { key: "apiBaseUrl", label: "API base URL", type: "url", required: true },
      { key: "candidateRegistrationSyncEnabled", label: "Candidate registration sync", type: "toggle", required: true },
      { key: "resultsDownloadEnabled", label: "Results download", type: "toggle", required: true },
      {
        key: "autoSyncSchedule", label: "Automatic sync schedule", type: "select", required: true,
        options: [
          { value: "manual", label: "Manual only" },
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
        ],
      },
    ],
    credentialFields: [
      { key: "clientIdOrUsername", label: "Client ID/API username", type: "secret", required: true },
      { key: "clientSecretOrPassword", label: "Client secret/API password", type: "secret", required: true },
      { key: "apiKeyOrToken", label: "API key or access token", type: "secret", hint: "As issued by ECZ" },
      { key: "certificatePrivateKey", label: "Certificate/private key", type: "file", hint: "Upload the PEM file if ECZ requires certificate auth" },
    ],
    actions: ["test", "ecz-sync"],
  },
  {
    code: "powerbi",
    name: "Power BI",
    category: "Analytics",
    description: "Publish curated dashboards for district and board reporting. Manage individual reports below, after saving these connection-level credentials.",
    hasCallbackUrl: false,
    fields: [
      { key: "tenantId", label: "Microsoft tenant ID", type: "text", required: true },
      { key: "applicationClientId", label: "Application/client ID", type: "text", required: true },
    ],
    credentialFields: [
      { key: "clientSecret", label: "Client secret", type: "secret", hint: "Required if not using a certificate" },
      { key: "certificate", label: "Certificate", type: "file", hint: "Preferred for production — upload the PEM/PFX file" },
      { key: "certificatePassword", label: "Certificate password", type: "secret", hint: "If the certificate is password-protected" },
    ],
    actions: ["test", "powerbi-publish"],
    hasReports: true,
  },
  {
    code: "google",
    name: "Google Workspace",
    category: "Identity",
    description: "Single sign-on for staff accounts via Google OpenID Connect.",
    hasCallbackUrl: false,
    fields: [
      { key: "workspaceDomain", label: "Google Workspace domain", type: "text", required: true, placeholder: "school.edu.zm" },
      { key: "googleCloudProjectId", label: "Google Cloud project ID", type: "text", required: true },
      { key: "oauthClientId", label: "OAuth client ID", type: "text", required: true },
      { key: "allowedEmailDomains", label: "Allowed email domains", type: "text", required: true, placeholder: "school.edu.zm, staff.school.edu.zm", hint: "Comma-separated" },
      {
        key: "requestedScopes", label: "Requested scopes", type: "multiselect", required: true,
        defaultValue: "openid,email,profile",
        options: [
          { value: "openid", label: "openid" },
          { value: "email", label: "email" },
          { value: "profile", label: "profile" },
        ],
        hint: "Do not request Drive, Gmail, or Calendar scopes unless SRMS genuinely uses those services",
      },
      { key: "enforceDomainRestriction", label: "Enforce Workspace-domain restriction", type: "toggle", hint: "Recommended" },
      { key: "autoCreateStaffAccounts", label: "Automatically create staff accounts", type: "toggle" },
      {
        key: "defaultRoleForNewUsers", label: "Default role for new users", type: "select",
        options: [
          { value: "teacher", label: "Teacher" },
          { value: "school_admin", label: "School admin" },
        ],
        hint: "Only used if auto-create is on",
      },
      { key: "requireVerifiedEmail", label: "Require verified email", type: "toggle", required: true, defaultValue: "true" },
    ],
    credentialFields: [
      { key: "oauthClientSecret", label: "OAuth client secret", type: "secret", required: true },
    ],
    actions: ["test"],
  },
  {
    code: "zoom",
    name: "Zoom Education",
    category: "Productivity",
    description: "Create and track Zoom meetings for virtual classes and staff meetings.",
    hasCallbackUrl: true,
    fields: [
      { key: "environment", label: "Environment", type: "select", required: true, options: [{ value: "development", label: "Development" }, { value: "production", label: "Production" }] },
      { key: "zoomAccountId", label: "Zoom account ID", type: "text", required: true },
      { key: "clientId", label: "Client ID", type: "text", required: true },
      { key: "meetingSdkKey", label: "Meeting SDK key", type: "text", hint: "Only for embedded meetings" },
      { key: "defaultHostEmail", label: "Default host email/user ID", type: "text", required: true },
      { key: "defaultTimezone", label: "Default timezone", type: "text", required: true, defaultValue: "Africa/Lusaka" },
      { key: "defaultMeetingDurationMinutes", label: "Default meeting duration (minutes)", type: "number" },
      { key: "waitingRoomEnabled", label: "Waiting room enabled", type: "toggle", hint: "Recommended" },
      {
        key: "recordingSetting", label: "Recording setting", type: "select",
        options: [
          { value: "none", label: "No recording" },
          { value: "local", label: "Local recording" },
          { value: "cloud", label: "Cloud recording" },
        ],
      },
      { key: "attendanceSyncEnabled", label: "Attendance sync", type: "toggle", hint: "Recommended" },
    ],
    credentialFields: [
      { key: "clientSecret", label: "Client secret", type: "secret", required: true },
      { key: "webhookSecretToken", label: "Webhook secret token", type: "secret", hint: "Recommended" },
      { key: "verificationToken", label: "Verification token", type: "secret", hint: "If issued" },
      { key: "meetingSdkSecret", label: "Meeting SDK secret", type: "secret", hint: "Only for embedded meetings — never sent to the browser" },
    ],
    actions: ["test", "zoom-meeting"],
  },
];

export function providerSchema(code: string): ProviderSchema | undefined {
  return PROVIDER_SCHEMAS.find((p) => p.code === code);
}
