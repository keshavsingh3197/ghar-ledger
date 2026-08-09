export const environment = {
  production: false,
  // The identity provider's API — the shared SSO session lives here. Same-host-family in dev
  // (localhost) so the SSO cookie set by admin's backend is sent along with credentialed requests.
  idpUrl: 'http://localhost:5000/api',
  // This app's own API.
  apiUrl: 'http://localhost:5050/api',
  // Where to send the browser to sign in (interactive login lives on the admin app).
  loginUrl: 'http://localhost:4200/login',
};
