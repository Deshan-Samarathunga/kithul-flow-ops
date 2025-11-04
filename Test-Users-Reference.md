# Test Users Quick Reference

## 🔐 Test User Credentials

| Role | Username | Password | Access Level |
|------|----------|----------|--------------|
| **Administrator** | admin01 | 12345678 | Full access to all endpoints |
| **Field Collection** | field01 | 12345678 | Field collection operations |
| **Processing** | process01 | 12345678 | Processing batch operations |
| **Packaging** | package01 | 12345678 | Packaging operations |
| **Labeling** | label01 | 12345678 | Labeling operations |

## 🚀 Quick Start with Postman

### 1. Import Files
- Import `Kithul-Flow-Ops-API.postman_collection.json`
- Import `Kithul-Flow-Ops.postman_environment.json`
- Select the environment from dropdown

### 2. Quick Role Login
The collection now includes a **🔑 Quick Role Login** folder at the top with:
- **Login as Administrator** - Full access
- **Login as Field Collection** - Field operations
- **Login as Processing** - Processing operations
- **Login as Packaging** - Packaging operations
- **Login as Labeling** - Labeling operations
- **Get Current User Info** - Check who's logged in

### 3. Testing Different Roles
1. Click on any "Login as [Role]" request
2. Click "Send" - token auto-saves
3. Test endpoints specific to that role
4. Switch roles anytime by running another login

## 📋 Role-Based Access Matrix

### Administrator (admin01)
✅ **Full Access** - Can access all endpoints including:
- Admin panel (users, centers, roles)
- All operational modules
- Reports and statistics
- User management

### Field Collection (field01)
✅ **Can Access:**
- `/api/field-collection/*` - All field collection endpoints
- `/api/reports/daily` - Daily reports
- `/api/profile` - Own profile

❌ **Cannot Access:**
- Admin endpoints
- Other users' data

### Processing (process01)
✅ **Can Access:**
- `/api/processing/*` - All processing endpoints
- `/api/reports/daily` - Daily reports
- `/api/profile` - Own profile

❌ **Cannot Access:**
- Admin endpoints
- Field collection drafts (unless admin)

### Packaging (package01)
✅ **Can Access:**
- `/api/packaging/*` - All packaging endpoints
- `/api/processing/*` - View processing batches
- `/api/reports/daily` - Daily reports
- `/api/profile` - Own profile

❌ **Cannot Access:**
- Admin endpoints
- Field collection endpoints

### Labeling (label01)
✅ **Can Access:**
- `/api/labeling/*` - All labeling endpoints
- `/api/packaging/*` - View packaging batches
- `/api/reports/daily` - Daily reports
- `/api/profile` - Own profile

❌ **Cannot Access:**
- Admin endpoints
- Field collection endpoints
- Processing endpoints (create/modify)

## 💡 Testing Tips

### Quick Role Switching
```
1. Go to "🔑 Quick Role Login" folder
2. Run "Login as [desired role]"
3. Token updates automatically
4. All requests now use new role
```

### Check Current User
```
Run "Get Current User Info" to see:
- Current username
- Role
- User details
```

### Test Authorization
```
1. Login as field01
2. Try accessing /api/admin/users
3. Should get 403 Forbidden
4. Login as admin01
5. Try again - should work
```

## 🔧 Environment Variables

The following variables are pre-configured:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `{{adminUsername}}` | Admin username | admin01 |
| `{{adminPassword}}` | Admin password | 12345678 |
| `{{fieldUsername}}` | Field Collection username | field01 |
| `{{fieldPassword}}` | Field Collection password | 12345678 |
| `{{processUsername}}` | Processing username | process01 |
| `{{processPassword}}` | Processing password | 12345678 |
| `{{packageUsername}}` | Packaging username | package01 |
| `{{packagePassword}}` | Packaging password | 12345678 |
| `{{labelUsername}}` | Labeling username | label01 |
| `{{labelPassword}}` | Labeling password | 12345678 |
| `{{authToken}}` | Current JWT token | (auto-filled) |
| `{{baseUrl}}` | API base URL | http://localhost:5000/api |

## 📝 Notes

- All test passwords are set to `12345678` for simplicity
- Tokens auto-save after successful login
- Each login shows the current role in console
- These users should be pre-seeded in your database
- Remember to change passwords in production!

## 🎯 Common Test Scenarios

### 1. Test Role Isolation
```
- Login as field01
- Create a draft
- Login as process01
- Try to modify the draft (should fail)
- Login as admin01
- Modify the draft (should work)
```

### 2. Test Workflow
```
- Login as field01 → Create draft & cans
- Login as process01 → Create processing batch
- Login as package01 → Create packaging batch
- Login as label01 → Create labeling batch
```

### 3. Test Admin Powers
```
- Login as admin01
- Access all modules
- Create/modify users
- Access all reports
```
