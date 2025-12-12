/**
 * Salesforce Remove from Permission Set
 *
 * Removes a user from a permission set in Salesforce using a three-step process:
 * 1. Find user by username
 * 2. Find existing permission set assignment
 * 3. Delete the permission set assignment
 */

import { getBaseURL, getAuthorizationHeader, resolveJSONPathTemplates} from '@sgnl-actions/utils';

/**
 * Performs a SOQL query to find a user by username
 * @param {string} username - The username to search for
 * @param {string} baseUrl - Salesforce instance URL
 * @param {string} authHeader - Authorization header value (already formatted)
 * @returns {Promise<Response>} The fetch response
 */
async function findUserByUsername(username, baseUrl, authHeader) {
  const encodedUsername = encodeURIComponent(username);
  const query = `SELECT+Id+FROM+User+WHERE+Username='${encodedUsername}'+ORDER+BY+Id+ASC`;
  const url = `${baseUrl}/services/data/v61.0/query?q=${query}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json'
    }
  });

  return response;
}

/**
 * Finds an existing permission set assignment for a user and permission set
 * @param {string} userId - The user ID
 * @param {string} permissionSetId - The permission set ID
 * @param {string} baseUrl - Salesforce instance URL
 * @param {string} authHeader - Authorization header value (already formatted)
 * @returns {Promise<Response>} The fetch response
 */
async function findPermissionSetAssignment(userId, permissionSetId, baseUrl, authHeader) {
  const query = `SELECT+Id+FROM+PermissionSetAssignment+WHERE+AssigneeId='${userId}'+AND+PermissionSetId='${permissionSetId}'`;
  const url = `${baseUrl}/services/data/v61.0/query?q=${query}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json'
    }
  });

  return response;
}

/**
 * Deletes a permission set assignment
 * @param {string} assignmentId - The assignment ID to delete
 * @param {string} baseUrl - Salesforce instance URL
 * @param {string} authHeader - Authorization header value (already formatted)
 * @returns {Promise<Response>} The fetch response
 */
async function deletePermissionSetAssignment(assignmentId, baseUrl, authHeader) {
  const url = `${baseUrl}/services/data/v61.0/sobjects/PermissionSetAssignment/${assignmentId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json'
    }
  });

  return response;
}

export default {
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
    const jobContext = context.data || {};

    // Resolve JSONPath templates in params
    const { result: resolvedParams, errors } = resolveJSONPathTemplates(params, jobContext);
    if (errors.length > 0) {
      console.warn('Template resolution errors:', errors);
    }

    const { username, permissionSetId } = resolvedParams;

    // Get base URL using utility function
    const baseUrl = getBaseURL(resolvedParams, context);

    // Get authorization header
    const authHeader = await getAuthorizationHeader(context);

    console.log(`Removing user ${username} from permission set ${permissionSetId}`);

    // Step 1: Find user by username
    console.log(`Step 1: Finding user by username: ${username}`);
    const userResponse = await findUserByUsername(username, baseUrl, authHeader);

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
    const assignmentResponse = await findPermissionSetAssignment(userId, permissionSetId, baseUrl, authHeader);

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
    const deleteResponse = await deletePermissionSetAssignment(assignmentId, baseUrl, authHeader);

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