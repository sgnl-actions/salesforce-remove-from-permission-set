# Salesforce Remove from Permission Set

This action removes a user from a permission set in Salesforce using a three-step process to ensure safe and reliable operation.

## Overview

The action performs these steps:
1. **Find User**: Query Salesforce to find the user by username
2. **Find Assignment**: Check if the user is currently assigned to the permission set
3. **Remove Assignment**: Delete the permission set assignment (if it exists)

The action handles the case where no assignment exists gracefully, treating it as a successful operation since the desired state (user not in permission set) is already achieved.

## Prerequisites

- Salesforce organization with API access enabled
- Valid Salesforce access token with permissions to:
  - Read User records
  - Read PermissionSetAssignment records  
  - Delete PermissionSetAssignment records
- Salesforce instance URL

## Configuration

### Required Secrets

- `SALESFORCE_ACCESS_TOKEN`: Valid Salesforce access token (OAuth or session-based)

### Required Environment Variables

- `SALESFORCE_INSTANCE_URL`: Your Salesforce instance URL (e.g., `https://mycompany.salesforce.com`)

### Input Parameters

- `username` (required): Salesforce username (email) of the user to remove from the permission set
- `permissionSetId` (required): The 15 or 18-character ID of the permission set
- `apiVersion` (optional): Salesforce API version to use (defaults to `v61.0`)

### Output Schema

```json
{
  "status": "success",
  "username": "user@example.com",
  "userId": "005000000000001",
  "permissionSetId": "0PS000000000001", 
  "assignmentId": "0PA000000000001",
  "removed": true
}
```

- `status`: Operation result (`success`, `failed`, `halted`)
- `username`: The username that was processed
- `userId`: The Salesforce User ID that was found
- `permissionSetId`: The permission set ID from input
- `assignmentId`: The assignment ID that was removed (null if no assignment existed)
- `removed`: Boolean indicating whether an assignment was actually removed

## Usage Examples

### Basic Usage

```json
{
  "username": "john.doe@company.com",
  "permissionSetId": "0PS000000000001"
}
```

### With Custom API Version

```json
{
  "username": "john.doe@company.com", 
  "permissionSetId": "0PS000000000001",
  "apiVersion": "v60.0"
}
```

## Error Handling

The action includes comprehensive error handling:

### Input Validation
- Validates required parameters (`username`, `permissionSetId`)
- Validates required configuration (`SALESFORCE_ACCESS_TOKEN`, `SALESFORCE_INSTANCE_URL`)

### API Error Handling
- **User Not Found**: Throws descriptive error if username doesn't exist
- **Assignment Not Found**: Treated as success (already in desired state)
- **API Errors**: Descriptive errors for failed Salesforce API calls
- **Network Errors**: Automatic retry for rate limits (429) and server errors (502, 503, 504)
- **Auth Errors**: No retry for authentication/authorization failures (401, 403)

### Retryable vs Fatal Errors

**Retryable (with exponential backoff):**
- Rate limiting (429)
- Server errors (502, 503, 504)
- Network timeouts

**Fatal (no retry):**
- Authentication errors (401, 403)
- Invalid user data
- Malformed requests

## Security Considerations

### URL Encoding
The action properly URL-encodes usernames in SOQL queries to prevent injection attacks and handle special characters safely.

### Access Token Security
- Access tokens are accessed from secure secrets storage
- Tokens are never logged or exposed in outputs
- Bearer token format is used for API authentication

### Data Privacy
- Only necessary user data is queried (User ID only)
- No sensitive user information is logged or returned
- Assignment IDs are included for audit purposes

## Development

### Local Testing

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Test locally with sample data
npm run dev -- --params '{"username":"test@example.com","permissionSetId":"0PS000000000001"}'

# Lint code
npm run lint
```

### Test Coverage

The action includes comprehensive test coverage for:
- Successful permission set removal
- No assignment found scenario (already removed)
- User not found errors
- URL encoding edge cases
- API error responses
- Retry logic for various error types
- Input validation
- Configuration validation

## API Reference

### Salesforce APIs Used

1. **SOQL Query (User)**: `GET /services/data/{version}/query`
   - Query: `SELECT Id FROM User WHERE Username='{username}' ORDER BY Id ASC`
   - Used to find the user by username

2. **SOQL Query (Assignment)**: `GET /services/data/{version}/query` 
   - Query: `SELECT Id FROM PermissionSetAssignment WHERE AssigneeId='{userId}' AND PermissionSetId='{permissionSetId}'`
   - Used to find existing permission set assignment

3. **Delete Assignment**: `DELETE /services/data/{version}/sobjects/PermissionSetAssignment/{assignmentId}`
   - Used to remove the permission set assignment

## Troubleshooting

### Common Issues

**"User not found" Error**
- Verify the username is correct and exists in Salesforce
- Ensure the username is the full email address
- Check that the access token has permission to read User records

**"Failed to query permission set assignment" Error**  
- Verify the permission set ID is correct (15 or 18 characters)
- Ensure the access token has permission to read PermissionSetAssignment records
- Check that the permission set exists in the organization

**"Failed to delete permission set assignment" Error**
- Ensure the access token has permission to delete PermissionSetAssignment records
- Verify the user has sufficient privileges to remove permission set assignments
- Check for any Salesforce validation rules that might block the deletion

**Rate Limiting**
- The action automatically handles rate limits with exponential backoff
- If rate limiting persists, consider spacing out multiple operations

### Debugging

Enable debug logging by setting the environment variable:
```bash
LOG_LEVEL=debug
```

This will provide detailed information about:
- API requests and responses
- Query construction and parameter encoding
- Error details and retry attempts

## Deployment

1. **Test thoroughly**: `npm test && npm run test:coverage`
2. **Validate metadata**: `npm run validate`
3. **Build production bundle**: `npm run build`  
4. **Create release**: `git tag -a v1.0.0 -m "Release v1.0.0"`
5. **Push to GitHub**: `git push origin v1.0.0`

## Integration with SGNL

Reference this action in a workflow:

```json
{
  "id": "remove-salesforce-permission",
  "type": "nodejs-22",
  "script": {
    "repository": "github.com/sgnl-actions/salesforce-remove-from-permission-set",
    "version": "v1.0.0",
    "type": "nodejs"
  },
  "script_inputs": {
    "username": "john.doe@company.com",
    "permissionSetId": "0PS000000000001"
  },
  "environment": {
    "SALESFORCE_INSTANCE_URL": "https://mycompany.salesforce.com"
  }
}
```