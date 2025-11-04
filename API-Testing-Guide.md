# Kithul Flow Ops API Testing Guide

## Overview
This guide explains how to test all APIs in the Kithul Flow Ops project using Postman.

## API Structure

The backend server runs on **http://localhost:5000** by default and provides the following API modules:

### 📋 API Modules

1. **Health Check** - Service status monitoring
2. **Authentication** - User registration and login
3. **Admin** - User and center management  
4. **Profile** - User profile management
5. **Field Collection** - Draft and can management
6. **Processing** - Batch processing operations
7. **Packaging** - Packaging batch operations
8. **Labeling** - Product labeling operations
9. **Reports** - Production reporting

## Quick Start

### 1. Prerequisites
- Node.js installed
- PostgreSQL database running
- Backend server running (`npm run dev` in `/server` folder)

### 2. Import Postman Collection

1. Open Postman
2. Click **Import** button
3. Select the file `Kithul-Flow-Ops-API.postman_collection.json`
4. The collection will be imported with all endpoints organized by module

### 3. Setup Environment Variables

Create a new environment in Postman with these variables:

| Variable | Initial Value | Current Value | Description |
|----------|--------------|---------------|-------------|
| baseUrl | http://localhost:5000/api | http://localhost:5000/api | API base URL |
| authToken | (leave empty) | (auto-filled after login) | JWT authentication token |

### 4. Testing Workflow

#### Step 1: Health Check
```
GET /api/health
GET /api/db-ping
```
Verify the service is running and database is connected.

#### Step 2: Authentication

**Pre-configured Test Users:**

| Role | Username | Password |
|------|----------|----------|
| Administrator | admin01 | 12345678 |
| Field Collection | field01 | 12345678 |
| Processing | process01 | 12345678 |
| Packaging | package01 | 12345678 |
| Labeling | label01 | 12345678 |

Use the **🔑 Quick Role Login** folder in Postman for instant role switching:
```
- Login as Administrator - Full access
- Login as Field Collection - Field operations only
- Login as Processing - Processing operations only
- Login as Packaging - Packaging operations only
- Login as Labeling - Labeling operations only
```

**Note:** The login endpoint automatically saves the JWT token to the `authToken` variable for subsequent requests.

#### Step 3: Test Role-Based Endpoints

Different endpoints require different roles:

- **Administrator**: Full access to all endpoints
- **Field Collection**: Field collection module
- **Processing**: Processing module  
- **Packaging**: Packaging module
- **Labeling**: Labeling module

## Complete API Endpoints List

### 🔐 Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### 👤 Admin Endpoints (Admin only)
- `GET /api/admin/roles` - Get all roles
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:userId` - Get user details
- `POST /api/admin/users` - Create user
- `PATCH /api/admin/users/:userId` - Update user
- `DELETE /api/admin/users/:userId` - Delete user
- `GET /api/admin/centers` - List centers
- `GET /api/admin/centers/:centerId` - Get center
- `POST /api/admin/centers` - Create center
- `PATCH /api/admin/centers/:centerId` - Update center
- `DELETE /api/admin/centers/:centerId` - Delete center
- `GET /api/admin/stats` - Admin statistics

### 📝 Profile Endpoints
- `PATCH /api/profile` - Update profile (supports avatar upload)

### 🌾 Field Collection Endpoints
- `GET /api/field-collection/drafts` - List drafts
- `GET /api/field-collection/drafts/:draftId` - Get draft
- `POST /api/field-collection/drafts` - Create draft
- `PUT /api/field-collection/drafts/:draftId` - Update draft
- `DELETE /api/field-collection/drafts/:draftId` - Delete draft
- `POST /api/field-collection/drafts/:draftId/submit` - Submit draft
- `POST /api/field-collection/drafts/:draftId/reopen` - Reopen draft
- `GET /api/field-collection/drafts/:draftId/centers/:centerId/cans` - Get center cans
- `POST /api/field-collection/cans` - Create can
- `PUT /api/field-collection/cans/:canId` - Update can
- `DELETE /api/field-collection/cans/:canId` - Delete can
- `GET /api/field-collection/centers` - List centers
- `POST /api/field-collection/drafts/:draftId/centers/:centerId/submit` - Submit center
- `POST /api/field-collection/drafts/:draftId/centers/:centerId/reopen` - Reopen center
- `GET /api/field-collection/drafts/:draftId/completed-centers` - Get completed centers

### ⚙️ Processing Endpoints
- `GET /api/processing/cans` - List available cans
- `GET /api/processing/batches` - List batches
- `POST /api/processing/batches` - Create batch
- `GET /api/processing/batches/:batchId` - Get batch
- `PATCH /api/processing/batches/:batchId` - Update batch
- `PUT /api/processing/batches/:batchId/cans` - Assign cans to batch
- `POST /api/processing/batches/:batchId/submit` - Submit batch
- `POST /api/processing/batches/:batchId/reopen` - Reopen batch
- `DELETE /api/processing/batches/:batchId` - Delete batch

### 📦 Packaging Endpoints
- `GET /api/packaging/batches/available-processing` - Available for packaging
- `GET /api/packaging/batches` - List packaging batches
- `POST /api/packaging/batches` - Create packaging batch
- `GET /api/packaging/batches/:packagingId` - Get packaging batch
- `PATCH /api/packaging/batches/:packagingId` - Update packaging batch
- `DELETE /api/packaging/batches/:packagingId` - Delete packaging batch

### 🏷️ Labeling Endpoints
- `GET /api/labeling/available-packaging` - Available for labeling
- `GET /api/labeling/batches` - List labeling batches
- `GET /api/labeling/batches/:packagingId` - Get labeling batch
- `POST /api/labeling/batches` - Create labeling batch
- `PATCH /api/labeling/batches/:packagingId` - Update labeling batch
- `DELETE /api/labeling/batches/:packagingId` - Delete labeling batch

### 📊 Reports Endpoints
- `GET /api/reports/daily` - Get daily production report

## Query Parameters

Many GET endpoints support query parameters for filtering:

### Field Collection
- `product` - Filter by product type (sap/treacle)
- `status` - Filter by status (draft/submitted/completed)

### Processing
- `product` - Filter by product type
- `status` - Filter by status

### Reports
- `date` - Specific date (YYYY-MM-DD format)
- `product` - Filter by product type

## Sample Request Bodies

### User Registration
```json
{
  "userId": "testuser",
  "password": "12345678",
  "name": "Test User"
}
```

### Create Can
```json
{
  "draftId": "draft123",
  "collectionCenterId": "center123",
  "productType": "sap",
  "brixValue": 65.5,
  "phValue": 6.8,
  "quantity": 25.5
}
```

### Create Processing Batch
```json
{
  "scheduledDate": "2024-01-20",
  "productType": "sap"
}
```

### Update Packaging Batch
```json
{
  "status": "in-progress",
  "finishedQuantity": 145.0,
  "bottleQuantity": 290,
  "lidQuantity": 290,
  "alufoilQuantity": 290,
  "vacuumBagQuantity": 50,
  "parchmentPaperQuantity": 50,
  "notes": "Packaging completed successfully"
}
```

## Authentication Flow

1. **Register/Login**: First register a user or login with existing credentials
2. **Token Storage**: The JWT token is automatically saved in the Postman environment
3. **Authenticated Requests**: All subsequent requests will include the Bearer token
4. **Role Verification**: Ensure your user has the correct role for the endpoints you're testing

## Error Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Tips for Testing

1. **Start with Health Check**: Always verify the server is running first
2. **Login First**: Most endpoints require authentication
3. **Check User Role**: Ensure your user has the correct role
4. **Use Environment Variables**: Keep baseUrl and authToken in environment
5. **Test in Order**: Follow the workflow (Field Collection → Processing → Packaging → Labeling)
6. **Check Database**: Some operations require existing data (centers, users, etc.)
7. **Monitor Console**: Check server console for detailed error messages

## Troubleshooting

### Common Issues

1. **"Not allowed by CORS"**
   - Ensure you're using the correct URL (localhost:5000)
   - Check if the server is running

2. **"401 Unauthorized"**
   - Login first to get a valid token
   - Check if token is properly saved in environment

3. **"403 Forbidden"**
   - Verify user has the required role
   - Admin endpoints require Administrator role

4. **"Cannot connect"**
   - Ensure backend server is running (`npm run dev`)
   - Check PostgreSQL database is running
   - Verify port 5000 is not blocked

## Development Tips

- The API supports CORS for local development
- Rate limiting is applied to auth endpoints (10 requests per 15 minutes)
- File uploads are supported for profile avatars (max 5MB)
- All timestamps are in ISO 8601 format

## Additional Resources

- Check `/server/src/routes/` for route definitions
- Check `/server/src/controllers/` for business logic
- Database schema is in `/server/sql/`

## Need Help?

If you encounter issues:
1. Check server console for error details
2. Verify database connectivity
3. Ensure all required fields are provided in requests
4. Check user permissions and roles
