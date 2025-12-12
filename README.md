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
- Valid authentication with permissions to:
  - Read User records
  - Read PermissionSetAssignment records
  - Delete PermissionSetAssignment records
- Salesforce instance URL

## Configuration

### Authentication

This action supports multiple authentication methods. Configure one of the following:

#### Option 1: Bearer Token
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `BEARER_AUTH_TOKEN` | Secret | Yes | A valid Salesforce OAuth access token |

#### Option 2: Basic Authentication
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `BASIC_USERNAME` | Secret | Yes | Username for basic auth |
| `BASIC_PASSWORD` | Secret | Yes | Password for basic auth |

#### Option 3: OAuth2 Client Credentials
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET` | Secret | Yes | OAuth2 client secret |
| `OAUTH2_CLIENT_CREDENTIALS_CLIENT_ID` | Environment | Yes | OAuth2 client ID |
| `OAUTH2_CLIENT_CREDENTIALS_TOKEN_URL` | Environment | Yes | Token endpoint URL |
| `OAUTH2_CLIENT_CREDENTIALS_SCOPE` | Environment | No | OAuth2 scope |
| `OAUTH2_CLIENT_CREDENTIALS_AUDIENCE` | Environment | No | OAuth2 audience |
| `OAUTH2_CLIENT_CREDENTIALS_AUTH_STYLE` | Environment | No | Auth style: `in_header` or `in_body` |

#### Option 4: OAuth2 Authorization Code
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN` | Secret | Yes | OAuth2 access token |

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `ADDRESS` | Yes | Default Salesforce API base URL | `https://mycompany.salesforce.com` |

### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Salesforce username (email) of the user to remove from the permission set |
| `permissionSetId` | string | Yes | The 15 or 18-character ID of the permission set |
| `address` | string | No | Salesforce instance URL (overrides `ADDRESS` environment variable) |

### Output Schema

```json
{
  "status": "success",
  "username": "user@example.com",
  "userId": "005000000000001",
  "permissionSetId": "0PS000000000001",
  "assignmentId": "0PA000000000001",
  "removed": true,
  "address": "https://mycompany.salesforce.com"
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

## Error Handling

The action implements comprehensive error handling:

### Error Behavior
All errors are re-thrown to allow the SGNL framework to handle retry logic based on the configured retry policy.

### Input Validation
- Validates required parameters (`username`, `permissionSetId`)
- Validates required authentication configuration
- Validates required `ADDRESS` environment variable

### API Error Handling
- **User Not Found**: Throws descriptive error if username doesn't exist
- **Assignment Not Found**: Treated as success (already in desired state)
- **API Errors**: Descriptive errors for failed Salesforce API calls with status codes
- **Authentication Errors**: Throws error when credentials are invalid or missing

## Security Considerations

### URL Encoding
The action properly URL-encodes usernames in SOQL queries to prevent injection attacks and handle special characters safely.

### Credential Security
- Credentials are handled securely through the authentication framework
- Credentials are never logged or exposed in outputs
- All authentication methods use secure transmission

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
- Error handler behavior
- Input validation
- Configuration validation

## API Reference

### Salesforce APIs Used

1. **SOQL Query (User)**: `GET /services/data/v61.0/query`
   - Query: `SELECT Id FROM User WHERE Username='{username}' ORDER BY Id ASC`
   - Used to find the user by username

2. **SOQL Query (Assignment)**: `GET /services/data/v61.0/query`
   - Query: `SELECT Id FROM PermissionSetAssignment WHERE AssigneeId='{userId}' AND PermissionSetId='{permissionSetId}'`
   - Used to find existing permission set assignment

3. **Delete Assignment**: `DELETE /services/data/v61.0/sobjects/PermissionSetAssignment/{assignmentId}`
   - Used to remove the permission set assignment

## Troubleshooting

### Common Issues

**"User not found" Error**
- Verify the username is correct and exists in Salesforce
- Ensure the username is the full email address
- Check that your credentials have permission to read User records

**"Failed to query permission set assignment" Error**
- Verify the permission set ID is correct (15 or 18 characters)
- Ensure your credentials have permission to read PermissionSetAssignment records
- Check that the permission set exists in the organization

**"Failed to delete permission set assignment" Error**
- Ensure your credentials have permission to delete PermissionSetAssignment records
- Verify you have sufficient privileges to remove permission set assignments
- Check for any Salesforce validation rules that might block the deletion

**"No authentication configured" Error**
- Ensure you have configured one of the supported authentication methods
- Verify that the credentials are properly set in secrets and environment variables

**Rate Limiting**
- The SGNL framework handles rate limits based on the configured retry policy
- If rate limiting persists, consider spacing out multiple operations or adjusting retry settings

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
    "ADDRESS": "https://mycompany.salesforce.com"
  }
}
```