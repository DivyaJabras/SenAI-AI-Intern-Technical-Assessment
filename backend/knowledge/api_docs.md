# API Documentation

Our RESTful API allows you to integrate our CRM intelligence into your own applications.

## Rate Limits
Rate limits are applied based on your subscription tier:
- **Starter Plan**: 100 requests per minute
- **Standard Plan**: 500 requests per minute
- **Enterprise Plan**: Unlimited

## Authentication & Permissions
All API requests must include a valid Bearer token in the `Authorization` header.
Additionally, specific endpoints require explicit permission scopes (e.g., `read:emails`, `write:actions`). Ensure your API key has the necessary scopes granted.

## API v1 Deprecation
Please note that our v1 API is officially deprecated. The **sunset date is 6 months from today**. We strongly advise all customers to migrate to v2 before this date.

## v2 Breaking Changes
When migrating to v2, please be aware of the following breaking changes:
1. A new authentication header is required: `X-API-Version: 2`.
2. The response schema for error objects has been completely redesigned for better consistency.
3. **v2 endpoints require the `v2` permission scope**, which is not automatically granted to older legacy API keys. You must generate a new token or update your scopes in the dashboard.
