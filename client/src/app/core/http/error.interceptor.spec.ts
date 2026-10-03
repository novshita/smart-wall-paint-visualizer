import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './error.interceptor';

describe('toApiError', () => {
  it('passes through the API error shape', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: {
        status: 400,
        message: 'Validation failed',
        errors: [{ field: 'email', message: 'bad' }],
      },
    });
    expect(toApiError(err)).toEqual({
      status: 400,
      message: 'Validation failed',
      errors: [{ field: 'email', message: 'bad' }],
    });
  });

  it('gives a friendly message when the server is unreachable', () => {
    expect(toApiError(new HttpErrorResponse({ status: 0 })).message).toContain('Cannot reach');
  });

  it('falls back to a generic message for non-JSON errors', () => {
    const err = new HttpErrorResponse({ status: 502, error: '<html>Bad gateway</html>' });
    expect(toApiError(err)).toEqual({ status: 502, message: expect.any(String), errors: [] });
  });
});
