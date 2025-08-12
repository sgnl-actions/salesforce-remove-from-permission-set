// SGNL Job Script - Auto-generated bundle
'use strict';

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
 * @param {string} instanceUrl - Salesforce instance URL
 * @param {string} accessToken - Salesforce access token
 * @param {string} apiVersion - API version to use
 * @returns {Promise<Response>} The fetch response
 */
async function findUserByUsername(username, instanceUrl, accessToken, apiVersion) {
  const encodedUsername = encodeURIComponent(username);
  const query = `SELECT+Id+FROM+User+WHERE+Username='${encodedUsername}'+ORDER+BY+Id+ASC`;
  const url = new URL(`/services/data/${apiVersion}/query?q=${query}`, instanceUrl);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  return response;
}

/**
 * Finds an existing permission set assignment for a user and permission set
 * @param {string} userId - The user ID
 * @param {string} permissionSetId - The permission set ID
 * @param {string} instanceUrl - Salesforce instance URL
 * @param {string} accessToken - Salesforce access token
 * @param {string} apiVersion - API version to use
 * @returns {Promise<Response>} The fetch response
 */
async function findPermissionSetAssignment(userId, permissionSetId, instanceUrl, accessToken, apiVersion) {
  const query = `SELECT+Id+FROM+PermissionSetAssignment+WHERE+AssigneeId='${userId}'+AND+PermissionSetId='${permissionSetId}'`;
  const url = new URL(`/services/data/${apiVersion}/query?q=${query}`, instanceUrl);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  return response;
}

/**
 * Deletes a permission set assignment
 * @param {string} assignmentId - The assignment ID to delete
 * @param {string} instanceUrl - Salesforce instance URL
 * @param {string} accessToken - Salesforce access token
 * @param {string} apiVersion - API version to use
 * @returns {Promise<Response>} The fetch response
 */
async function deletePermissionSetAssignment(assignmentId, instanceUrl, accessToken, apiVersion) {
  const url = new URL(`/services/data/${apiVersion}/sobjects/PermissionSetAssignment/${assignmentId}`, instanceUrl);

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  return response;
}

var script = {
  /**
   * Main execution handler
   * @param {Object} params - Job input parameters
   * @param {string} params.username - Salesforce username to remove from permission set
   * @param {string} params.permissionSetId - Permission set ID
   * @param {string} params.apiVersion - API version (optional, defaults to v61.0)
   * @param {Object} context - Execution context with env, secrets, outputs
   * @returns {Object} Job results
   */
  invoke: async (params, context) => {
    const { username, permissionSetId, apiVersion = 'v61.0' } = params;

    // Validate required parameters
    if (!username) {
      throw new Error('username is required');
    }

    if (!permissionSetId) {
      throw new Error('permissionSetId is required');
    }

    // Get configuration from context
    const instanceUrl = context.environment.SALESFORCE_INSTANCE_URL;
    const accessToken = context.secrets.SALESFORCE_ACCESS_TOKEN;

    if (!instanceUrl) {
      throw new Error('SALESFORCE_INSTANCE_URL environment variable is required');
    }

    if (!accessToken) {
      throw new Error('SALESFORCE_ACCESS_TOKEN secret is required');
    }

    console.log(`Removing user ${username} from permission set ${permissionSetId}`);

    // Step 1: Find user by username
    console.log(`Step 1: Finding user by username: ${username}`);
    const userResponse = await findUserByUsername(username, instanceUrl, accessToken, apiVersion);

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
    const assignmentResponse = await findPermissionSetAssignment(userId, permissionSetId, instanceUrl, accessToken, apiVersion);

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
        removed: false
      };
    }

    const assignmentId = assignmentData.records[0].Id;
    console.log(`Found assignment ID: ${assignmentId}`);

    // Step 3: Delete the permission set assignment
    console.log(`Step 3: Deleting permission set assignment ${assignmentId}`);
    const deleteResponse = await deletePermissionSetAssignment(assignmentId, instanceUrl, accessToken, apiVersion);

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
      removed: true
    };
  },

  /**
   * Error recovery handler
   * @param {Object} params - Original params plus error information
   * @param {Object} context - Execution context
   * @returns {Object} Recovery results
   */
  error: async (params, _context) => {
    const { error } = params;
    console.error(`Error removing user from permission set: ${error.message}`);

    // Check for retryable errors
    if (error.message.includes('429') || error.message.includes('502') ||
        error.message.includes('503') || error.message.includes('504')) {
      // Rate limit or server errors - wait and retry
      console.log('Retryable error detected, waiting before retry...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      return { status: 'retry_requested' };
    }

    // Non-retryable errors
    if (error.message.includes('401') || error.message.includes('403')) {
      console.error('Authentication/authorization error - not retrying');
      throw error;
    }

    // Default: let framework retry
    return { status: 'retry_requested' };
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
