import script from '../src/script.mjs';
import { SGNL_USER_AGENT } from '@sgnl-actions/utils';

// Simple fetch mock
let mockFetch;

beforeAll(() => {
  mockFetch = {
    _responses: [],
    _calls: [],
    mockReturnValueOnce: function(response) {
      this._responses.push(response);
      return this;
    },
    mockClear: function() {
      this._responses = [];
      this._calls = [];
    }
  };

  global.fetch = (...args) => {
    mockFetch._calls.push(args);
    const response = mockFetch._responses.shift() || { ok: true };
    return Promise.resolve(response);
  };

  global.fetch.mockReturnValueOnce = mockFetch.mockReturnValueOnce.bind(mockFetch);
  global.fetch.mockClear = mockFetch.mockClear.bind(mockFetch);

  // Mock console with simple functions
  global.console.log = () => {};
  global.console.error = () => {};
});

describe('Salesforce Remove from Permission Set', () => {
  const mockContext = {
    environment: {
      ADDRESS: 'https://test.salesforce.com'
    },
    secrets: {
      BEARER_AUTH_TOKEN: 'test-access-token'
    }
  };

  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('invoke handler', () => {
    test('should successfully remove user from permission set', async () => {
      const params = {
        username: 'test@example.com',
        permissionSetId: '0PS000000000001'
      };

      // Mock Step 1: Find user
      global.fetch.mockReturnValueOnce({
        ok: true,
        json: () => Promise.resolve({
          records: [{ Id: '005000000000001' }]
        })
      });

      // Mock Step 2: Find assignment
      global.fetch.mockReturnValueOnce({
        ok: true,
        json: () => Promise.resolve({
          records: [{ Id: '0PA000000000001' }]
        })
      });

      // Mock Step 3: Delete assignment
      global.fetch.mockReturnValueOnce({
        ok: true
      });

      const result = await script.invoke(params, mockContext);

      expect(result.status).toBe('success');
      expect(result.username).toBe('test@example.com');
      expect(result.userId).toBe('005000000000001');
      expect(result.permissionSetId).toBe('0PS000000000001');
      expect(result.assignmentId).toBe('0PA000000000001');
      expect(result.removed).toBe(true);

      // Verify API calls
      expect(mockFetch._calls).toHaveLength(3);

      // Verify User-Agent on all calls
      for (const call of mockFetch._calls) {
        expect(call[1].headers['User-Agent']).toBe(SGNL_USER_AGENT);
      }
    });

    test('should handle no assignment found (already removed)', async () => {
      const params = {
        username: 'test@example.com',
        permissionSetId: '0PS000000000001'
      };

      // Mock Step 1: Find user
      global.fetch.mockReturnValueOnce({
        ok: true,
        json: () => Promise.resolve({
          records: [{ Id: '005000000000001' }]
        })
      });

      // Mock Step 2: No assignment found
      global.fetch.mockReturnValueOnce({
        ok: true,
        json: () => Promise.resolve({
          records: []
        })
      });

      const result = await script.invoke(params, mockContext);

      expect(result.status).toBe('success');
      expect(result.username).toBe('test@example.com');
      expect(result.userId).toBe('005000000000001');
      expect(result.permissionSetId).toBe('0PS000000000001');
      expect(result.assignmentId).toBe(null);
      expect(result.removed).toBe(false);

      // Should only make 2 API calls (no delete needed)
      expect(mockFetch._calls).toHaveLength(2);
    });

    test('should handle user not found', async () => {
      const params = {
        username: 'nonexistent@example.com',
        permissionSetId: '0PS000000000001'
      };

      // Mock Step 1: User not found
      global.fetch.mockReturnValueOnce({
        ok: true,
        json: () => Promise.resolve({
          records: []
        })
      });

      await expect(script.invoke(params, mockContext)).rejects.toThrow('User not found: nonexistent@example.com');
      expect(mockFetch._calls).toHaveLength(1);
    });


    test('should validate required environment variables', async () => {
      const contextNoEnv = {
        environment: {},
        secrets: { BEARER_AUTH_TOKEN: 'token' }
      };

      const params = {
        username: 'test@example.com',
        permissionSetId: '0PS000000000001'
      };

      await expect(script.invoke(params, contextNoEnv)).rejects.toThrow('No URL specified. Provide address parameter or ADDRESS environment variable');
    });

    test('should validate required secrets', async () => {
      const contextNoSecrets = {
        environment: { ADDRESS: 'https://test.salesforce.com' },
        secrets: {}
      };

      const params = {
        username: 'test@example.com',
        permissionSetId: '0PS000000000001'
      };

      await expect(script.invoke(params, contextNoSecrets)).rejects.toThrow('No authentication configured');
    });

    test('should handle API errors in user query', async () => {
      const params = {
        username: 'test@example.com',
        permissionSetId: '0PS000000000001'
      };

      global.fetch.mockReturnValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(script.invoke(params, mockContext)).rejects.toThrow('Failed to query user: 400 Bad Request');
    });
  });

  describe('error handler', () => {
    test('should rethrow errors', async () => {
      const testError = new Error('Test error');
      const params = { error: testError };

      await expect(script.error(params, mockContext)).rejects.toThrow(testError);
    });
  });

  describe('halt handler', () => {
    test('should handle graceful shutdown with username', async () => {
      const params = {
        username: 'test@example.com',
        reason: 'timeout'
      };

      const result = await script.halt(params, mockContext);

      expect(result.status).toBe('halted');
      expect(result.username).toBe('test@example.com');
      expect(result.reason).toBe('timeout');
      expect(result.halted_at).toBeDefined();
    });

    test('should handle halt without username', async () => {
      const params = {
        reason: 'system_shutdown'
      };

      const result = await script.halt(params, mockContext);

      expect(result.status).toBe('halted');
      expect(result.username).toBe('unknown');
      expect(result.reason).toBe('system_shutdown');
    });
  });
});