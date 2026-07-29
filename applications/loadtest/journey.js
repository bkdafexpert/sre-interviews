import http from 'k6/http';
import { check, sleep, fail } from 'k6';

// Full user-journey load test for sgcut (URL shortener). Authenticates against Cognito with USER_PASSWORD_AUTH
// (a dedicated native test user — no browser/Google flow), then loops: home -> create link -> read it -> follow the
// short link. Thresholds below are SLOs: if breached, k6 exits non-zero and the CI job fails (a real gate).
//
// Configured entirely via env (see .github/workflows/load-test.yml):
//   BASE_URL, COGNITO_REGION, COGNITO_CLIENT_ID, LOADTEST_USERNAME, LOADTEST_PASSWORD, VUS, DURATION, P95_MS

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/+$/, '');
const COGNITO_REGION = __ENV.COGNITO_REGION || 'eu-west-3';
const CLIENT_ID = __ENV.COGNITO_CLIENT_ID;
const USERNAME = __ENV.LOADTEST_USERNAME;
const PASSWORD = __ENV.LOADTEST_PASSWORD;
const P95_MS = Number(__ENV.P95_MS || 800);
const VUS = Number(__ENV.VUS || 10);

export const options = {
  scenarios: {
    journey: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '30s', target: VUS },
        { duration: __ENV.DURATION || '1m', target: VUS },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // < 1% errors
    http_req_duration: [`p(95)<${P95_MS}`], // p95 latency SLO
    checks: ['rate>0.99'], // > 99% functional checks pass
  },
};

// Runs once: obtain a Cognito ID token programmatically (USER_PASSWORD_AUTH), shared by all VUs.
export function setup() {
  if (!BASE_URL) fail('BASE_URL is required');
  if (!CLIENT_ID || !USERNAME || !PASSWORD) fail('COGNITO_CLIENT_ID / LOADTEST_USERNAME / LOADTEST_PASSWORD are required');

  const res = http.post(
    `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`,
    JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME, PASSWORD },
    }),
    {
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
    },
  );
  if (res.status !== 200) fail(`Cognito auth failed: ${res.status} ${res.body}`);
  const token = res.json('AuthenticationResult.IdToken');
  if (!token) fail('No IdToken in Cognito response');
  return { token };
}

export default function (data) {
  const authed = {
    headers: { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' },
  };

  // 1. Frontend home (through CloudFront -> ALB -> frontend).
  const home = http.get(`${BASE_URL}/`);
  check(home, { 'home 200': (r) => r.status === 200 });

  // 2. Create a short link (authenticated API).
  const destination = `https://example.com/loadtest/${__VU}-${__ITER}`;
  const created = http.post(`${BASE_URL}/api/v1/links`, JSON.stringify({ destination }), authed);
  const createdOk = check(created, { 'create link 2xx': (r) => r.status === 200 || r.status === 201 });
  if (!createdOk) {
    sleep(1);
    return;
  }
  const code = created.json('code');

  // 3. Read the link back (authenticated).
  const detail = http.get(`${BASE_URL}/api/v1/links/${code}`, authed);
  check(detail, { 'detail 200': (r) => r.status === 200 });

  // 4. Follow the short link (public 302 redirect to the destination).
  const redirect = http.get(`${BASE_URL}/${code}`, { redirects: 0 });
  check(redirect, {
    'redirect 302': (r) => r.status === 302,
    'redirect points to destination': (r) => (r.headers['Location'] || '').includes('example.com'),
  });

  sleep(1);
}
