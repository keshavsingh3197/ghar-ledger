export const environment = {
  production: true,
  // IMPORTANT: must be a keshavsingh.in subdomain so the shared SSO cookie (domain .keshavsingh.in)
  // is sent with credentialed requests — see admin/frontend's environment.prod.ts for the same rule.
  idpUrl: 'https://id.keshavsingh.in/api',
  apiUrl: 'https://ghar-ledger.onrender.com/api',
  loginUrl: 'https://admin.keshavsingh.in/login',
};
