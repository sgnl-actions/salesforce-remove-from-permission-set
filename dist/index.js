// SGNL Job Script - Auto-generated bundle
'use strict';

/**
 * SGNL Actions - Authentication Utilities
 *
 * Shared authentication utilities for SGNL actions.
 * Supports: Bearer Token, Basic Auth, OAuth2 Client Credentials, OAuth2 Authorization Code
 */

/**
 * User-Agent header value for all SGNL CAEP Hub requests.
 */
const SGNL_USER_AGENT = 'SGNL-CAEP-Hub/2.0';

/**
 * Get OAuth2 access token using client credentials flow
 * @param {Object} config - OAuth2 configuration
 * @param {string} config.tokenUrl - Token endpoint URL
 * @param {string} config.clientId - Client ID
 * @param {string} config.clientSecret - Client secret
 * @param {string} [config.scope] - OAuth2 scope
 * @param {string} [config.audience] - OAuth2 audience
 * @param {string} [config.authStyle] - Auth style: 'InParams' or 'InHeader' (default)
 * @returns {Promise<string>} Access token
 */
async function getClientCredentialsToken(config) {
  const { tokenUrl, clientId, clientSecret, scope, audience, authStyle } = config;

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error('OAuth2 Client Credentials flow requires tokenUrl, clientId, and clientSecret');
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');

  if (scope) {
    params.append('scope', scope);
  }

  if (audience) {
    params.append('audience', audience);
  }

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'User-Agent': SGNL_USER_AGENT
  };

  if (authStyle === 'InParams') {
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
  } else {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: params.toString()
  });

  if (!response.ok) {
    let errorText;
    try {
      const errorData = await response.json();
      errorText = JSON.stringify(errorData);
    } catch {
      errorText = await response.text();
    }
    throw new Error(
      `OAuth2 token request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('No access_token in OAuth2 response');
  }

  return data.access_token;
}

/**
 * Get the Authorization header value from context using available auth method.
 * Supports: Bearer Token, Basic Auth, OAuth2 Authorization Code, OAuth2 Client Credentials
 *
 * @param {Object} context - Execution context with environment and secrets
 * @param {Object} context.environment - Environment variables
 * @param {Object} context.secrets - Secret values
 * @returns {Promise<string>} Authorization header value (e.g., "Bearer xxx" or "Basic xxx")
 */
async function getAuthorizationHeader(context) {
  const env = context.environment || {};
  const secrets = context.secrets || {};

  // Method 1: Simple Bearer Token
  if (secrets.BEARER_AUTH_TOKEN) {
    const token = secrets.BEARER_AUTH_TOKEN;
    return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  // Method 2: Basic Auth (username + password)
  if (secrets.BASIC_PASSWORD && secrets.BASIC_USERNAME) {
    const credentials = btoa(`${secrets.BASIC_USERNAME}:${secrets.BASIC_PASSWORD}`);
    return `Basic ${credentials}`;
  }

  // Method 3: OAuth2 Authorization Code - use pre-existing access token
  if (secrets.OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN) {
    const token = secrets.OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN;
    return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  // Method 4: OAuth2 Client Credentials - fetch new token
  if (secrets.OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET) {
    const tokenUrl = env.OAUTH2_CLIENT_CREDENTIALS_TOKEN_URL;
    const clientId = env.OAUTH2_CLIENT_CREDENTIALS_CLIENT_ID;
    const clientSecret = secrets.OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET;

    if (!tokenUrl || !clientId) {
      throw new Error('OAuth2 Client Credentials flow requires TOKEN_URL and CLIENT_ID in env');
    }

    const token = await getClientCredentialsToken({
      tokenUrl,
      clientId,
      clientSecret,
      scope: env.OAUTH2_CLIENT_CREDENTIALS_SCOPE,
      audience: env.OAUTH2_CLIENT_CREDENTIALS_AUDIENCE,
      authStyle: env.OAUTH2_CLIENT_CREDENTIALS_AUTH_STYLE
    });

    return `Bearer ${token}`;
  }

  throw new Error(
    'No authentication configured. Provide one of: ' +
    'BEARER_AUTH_TOKEN, BASIC_USERNAME/BASIC_PASSWORD, ' +
    'OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN, or OAUTH2_CLIENT_CREDENTIALS_*'
  );
}

/**
 * Get the base URL/address for API calls
 * @param {Object} params - Request parameters
 * @param {string} [params.address] - Address from params
 * @param {Object} context - Execution context
 * @returns {string} Base URL
 */
function getBaseURL(params, context) {
  const env = context.environment || {};
  const address = params?.address || env.ADDRESS;

  if (!address) {
    throw new Error('No URL specified. Provide address parameter or ADDRESS environment variable');
  }

  // Remove trailing slash if present
  return address.endsWith('/') ? address.slice(0, -1) : address;
}

/**
 * Create full headers object with Authorization and common headers
 * @param {Object} context - Execution context with env and secrets
 * @returns {Promise<Object>} Headers object with Authorization, Accept, Content-Type
 */
async function createAuthHeaders(context) {
  const authHeader = await getAuthorizationHeader(context);
  return {
    'Authorization': authHeader,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': SGNL_USER_AGENT
  };
}

/**
 * Salesforce Remove from Permission Set
 *
 * Removes a user from a permission set in Salesforce using a three-step process:
 * 1. Find user by username
 * 2. Find existing permission set assignment
 * 3. Delete the permission set assignment
 */


/**
 * Performs a SOQL query to find a user by username
 * @param {string} username - The username to search for
 * @param {string} baseUrl - Salesforce instance URL
 * @param {Object} headers - Headers object (already formatted)
 * @returns {Promise<Response>} The fetch response
 */
async function findUserByUsername(username, baseUrl, headers) {
  const encodedUsername = encodeURIComponent(username);
  const query = `SELECT+Id+FROM+User+WHERE+Username='${encodedUsername}'+ORDER+BY+Id+ASC`;
  const url = `${baseUrl}/services/data/v61.0/query?q=${query}`;

  const response = await fetch(url, {
    method: 'GET',
    headers
  });

  return response;
}

/**
 * Finds an existing permission set assignment for a user and permission set
 * @param {string} userId - The user ID
 * @param {string} permissionSetId - The permission set ID
 * @param {string} baseUrl - Salesforce instance URL
 * @param {Object} headers - Headers object (already formatted)
 * @returns {Promise<Response>} The fetch response
 */
async function findPermissionSetAssignment(userId, permissionSetId, baseUrl, headers) {
  const query = `SELECT+Id+FROM+PermissionSetAssignment+WHERE+AssigneeId='${userId}'+AND+PermissionSetId='${permissionSetId}'`;
  const url = `${baseUrl}/services/data/v61.0/query?q=${query}`;

  const response = await fetch(url, {
    method: 'GET',
    headers
  });

  return response;
}

/**
 * Deletes a permission set assignment
 * @param {string} assignmentId - The assignment ID to delete
 * @param {string} baseUrl - Salesforce instance URL
 * @param {Object} headers - Headers object (already formatted)
 * @returns {Promise<Response>} The fetch response
 */
async function deletePermissionSetAssignment(assignmentId, baseUrl, headers) {
  const url = `${baseUrl}/services/data/v61.0/sobjects/PermissionSetAssignment/${assignmentId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers
  });

  return response;
}

var script = {
  /**
   * Main execution handler
   * @param {Object} params - Job input parameters
   * @param {string} params.username - Salesforce username to remove from permission set
   * @param {string} params.permissionSetId - Permission set ID
   * @param {string} params.address - Optional Salesforce API base URL
   * @param {Object} context - Execution context with secrets and environment
   * @param {string} context.environment.ADDRESS - Default Salesforce API base URL
   *
   * The configured auth type will determine which of the following environment variables and secrets are available
   * @param {string} context.secrets.BEARER_AUTH_TOKEN
   *
   * @param {string} context.secrets.BASIC_USERNAME
   * @param {string} context.secrets.BASIC_PASSWORD
   *
   * @param {string} context.secrets.OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_AUDIENCE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_AUTH_STYLE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_CLIENT_ID
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_SCOPE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_TOKEN_URL
   *
   * @param {string} context.secrets.OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN
   *
   * @returns {Promise<Object>} Action result
   */
  invoke: async (params, context) => {

    const { username, permissionSetId } = params;

    // Get base URL using utility function
    const baseUrl = getBaseURL(params, context);

    // Get authorization headers
    const headers = await createAuthHeaders(context);

    console.log(`Removing user ${username} from permission set ${permissionSetId}`);

    // Step 1: Find user by username
    console.log(`Step 1: Finding user by username: ${username}`);
    const userResponse = await findUserByUsername(username, baseUrl, headers);

    if (!userResponse.ok) {
      throw new Error(`Failed to query user: ${userResponse.status} ${userResponse.statusText}`);
    }

    const userData = await userResponse.json();
    if (!userData.records || userData.records.length === 0) {
      throw new Error(`User not found: ${username}`);
    }

    const userId = userData.records[0].Id;
    console.log(`Found user ID: ${userId}`);

    // Step 2: Find existing permission set assignment
    console.log(`Step 2: Finding permission set assignment for user ${userId} and permission set ${permissionSetId}`);
    const assignmentResponse = await findPermissionSetAssignment(userId, permissionSetId, baseUrl, headers);

    if (!assignmentResponse.ok) {
      throw new Error(`Failed to query permission set assignment: ${assignmentResponse.status} ${assignmentResponse.statusText}`);
    }

    const assignmentData = await assignmentResponse.json();
    if (!assignmentData.records || assignmentData.records.length === 0) {
      // No assignment found - user is already not in the permission set
      console.log('No permission set assignment found - user is already removed from permission set');
      return {
        status: 'success',
        username,
        userId,
        permissionSetId,
        assignmentId: null,
        removed: false,
        address: baseUrl
      };
    }

    const assignmentId = assignmentData.records[0].Id;
    console.log(`Found assignment ID: ${assignmentId}`);

    // Step 3: Delete the permission set assignment
    console.log(`Step 3: Deleting permission set assignment ${assignmentId}`);
    const deleteResponse = await deletePermissionSetAssignment(assignmentId, baseUrl, headers);

    if (!deleteResponse.ok) {
      throw new Error(`Failed to delete permission set assignment: ${deleteResponse.status} ${deleteResponse.statusText}`);
    }

    console.log('Successfully removed user from permission set');

    return {
      status: 'success',
      username,
      userId,
      permissionSetId,
      assignmentId,
      removed: true,
      address: baseUrl
    };
  },

  /**
   * Error handler - re-throws errors to let framework handle retry logic
   * @param {Object} params - Original params plus error information
   * @param {Object} context - Execution context
   * @returns {Object} Recovery results
   */
  error: async (params, _context) => {
    const { error } = params;
    throw error;
  },

  /**
   * Graceful shutdown handler
   * @param {Object} params - Original params plus halt reason
   * @param {Object} context - Execution context
   * @returns {Object} Cleanup results
   */
  halt: async (params, _context) => {
    const { reason, username } = params;
    console.log(`Permission set removal job halted (${reason}) for user ${username}`);

    return {
      status: 'halted',
      username: username || 'unknown',
      reason,
      halted_at: new Date().toISOString()
    };
  }
};

module.exports = script;
