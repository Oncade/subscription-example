import { describe, expect, it } from 'vitest';

import { handleSessionPost } from '@/app/api/routes/session';
import { SESSION_HEADER } from '@/lib/constants';
import { buildAppUrl, buildJsonRequest } from './helpers/http';

const SESSION_CREATE_URL = buildAppUrl('/api/session');

function buildRequest(body: Record<string, unknown>) {
  return buildJsonRequest(SESSION_CREATE_URL, {
    method: 'POST',
    body,
  });
}

describe('POST /api/session', () => {
  it('creates a session', async () => {
    const request = buildRequest({ email: 'hero@ea.com' });
    const response = await handleSessionPost(request);

    expect(response.status).toBe(201);
    expect(response.headers.get(SESSION_HEADER)).toBeTypeOf('string');

    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.email).toBe('hero@ea.com');
  });

  it('requires email', async () => {
    const request = buildRequest({});
    const response = await handleSessionPost(request);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.success).toBe(false);
  });
});
