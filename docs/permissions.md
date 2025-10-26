# Permissions & Access Control

## Table of Contents

- [Overview](#overview)
- [RBAC Architecture](#rbac-architecture)
- [Role Hierarchy](#role-hierarchy)
- [Privileges](#privileges)
- [Permission Matrix](#permission-matrix)
- [Authorization Logic](#authorization-logic)
- [Resource Ownership](#resource-ownership)
- [Special Permissions](#special-permissions)

---

## Overview

The APS Dashboard implements a comprehensive **Role-Based Access Control (RBAC)** system with hierarchical roles and granular privileges. This system ensures that users can only perform actions they are authorized to perform.

### Key Concepts

- **User**: An account in the system
- **Role**: A collection of privileges (e.g., Rédacteur, Admin)
- **Privilege**: A specific permission to perform an action (e.g., `articles.create`)
- **Hierarchy**: Roles are organized in levels (1-5), with higher levels inheriting lower-level permissions
- **Multi-Role**: Users can have multiple roles simultaneously
- **Resource Ownership**: Users have extended permissions on resources they own

---

## RBAC Architecture

```
┌──────────────┐
│    User      │
└──────┬───────┘
       │
       │ has many
       ▼
┌──────────────────┐
│  User_Role       │
│  (Junction)      │
│  • isInterim     │
│  • endDate       │
└──────┬───────────┘
       │
       │ references
       ▼
┌──────────────────┐
│      Role        │
│  • id_role       │
│  • name          │
│  • description   │
└──────┬───────────┘
       │
       │ has many
       ▼
┌──────────────────────┐
│  Roles_Privileges    │
│  (Junction)          │
└──────┬───────────────┘
       │
       │ references
       ▼
┌──────────────────────┐
│    Privilege         │
│  • id_privileges     │
│  • name              │
│  • description       │
└──────────────────────┘
```

---

## Role Hierarchy

### Hierarchy Levels

The system implements a 5-level hierarchical role system:

```
Level 5: SuperUser          (Complete system access)
    │
Level 4: Admin              (System administration)
    │
Level 3: Rédacteur en chef  (Editorial leadership)
         Superviseur
    │
Level 2: Chef de vacation   (Section management)
    │
Level 1: Rédacteur          (Content creation)
         Infographe
         Vidéaste
         Photographe
```

### Role Definitions

#### Level 1: Content Creators

**Rédacteur (Writer)**
- **Purpose**: Create and edit articles
- **Key Responsibilities**:
  - Write news articles
  - Submit articles for validation
  - Edit own draft articles
- **Hierarchy Level**: 1

**Infographe (Infographer)**
- **Purpose**: Create infographic content
- **Key Responsibilities**:
  - Design infographics
  - Upload and process images
  - Manage infographic lifecycle
- **Hierarchy Level**: 1

**Vidéaste (Videographer)**
- **Purpose**: Manage video content
- **Key Responsibilities**:
  - Upload video metadata
  - Manage video thumbnails
  - Control video publication
- **Hierarchy Level**: 1

**Photographe (Photographer)**
- **Purpose**: Manage photography and galleries
- **Key Responsibilities**:
  - Upload and organize photos
  - Create photo galleries
  - Apply watermarks
  - Manage image metadata
- **Hierarchy Level**: 1

#### Level 2: Section Manager

**Chef de vacation (Shift Manager)**
- **Purpose**: Validate content and manage daily operations
- **Key Responsibilities**:
  - Validate articles from writers
  - Oversee daily content workflow
  - Manage Level 1 users
  - Ensure quality standards
- **Hierarchy Level**: 2

#### Level 3: Editorial Leadership

**Rédacteur en chef (Editor-in-Chief)**
- **Purpose**: Control publication and editorial strategy
- **Key Responsibilities**:
  - Publish validated articles
  - Manage homepage layout (blocks, pinning)
  - Schedule publications
  - Oversee editorial line
  - Manage all content creators
- **Hierarchy Level**: 3

**Superviseur (Supervisor)**
- **Purpose**: Oversight and quality control
- **Key Responsibilities**:
  - Monitor editorial operations
  - Ensure workflow compliance
  - Similar permissions to Rédacteur en chef
  - System oversight
- **Hierarchy Level**: 3

#### Level 4: System Administrator

**Admin**
- **Purpose**: System administration and user management
- **Key Responsibilities**:
  - Create and manage user accounts
  - Assign and remove roles (Level 1-3)
  - Configure system settings
  - Manage categories and system data
  - Access all content features
  - Cannot manage SuperUser accounts
- **Hierarchy Level**: 4

#### Level 5: Super Administrator

**SuperUser**
- **Purpose**: Complete system control
- **Key Responsibilities**:
  - Manage Admin accounts
  - System-level configurations
  - Database management
  - Security settings
  - Emergency access
- **Hierarchy Level**: 5

---

## Privileges

### Privilege Naming Convention

Privileges follow the pattern: `resource.action`

Examples:
- `articles.view` - View articles
- `articles.create` - Create articles
- `articles.edit` - Edit articles
- `articles.publish` - Publish articles

### Complete Privilege List

#### Article Privileges

| Privilege | Description | Typical Roles |
|-----------|-------------|---------------|
| `articles.view` | View articles | All |
| `articles.create` | Create new articles | Rédacteur+ |
| `articles.edit` | Edit articles | Rédacteur+ (own), Chef de vacation+ (all) |
| `articles.validate` | Validate articles | Chef de vacation+ |
| `articles.publish` | Publish/unpublish articles | Rédacteur en chef+ |
| `articles.delete` | Permanently delete articles | Admin+ |
| `articles.trash` | Send to trash | Rédacteur+ (own), Chef de vacation+ (all) |
| `articles.lock` | Lock/unlock articles | Rédacteur+ |
| `articles.pin` | Pin to homepage blocks | Rédacteur en chef+ |

#### User Management Privileges

| Privilege | Description | Typical Roles |
|-----------|-------------|---------------|
| `users.view` | View user list | Admin+ |
| `users.create` | Create user accounts | Admin+ |
| `users.edit` | Edit user information | Admin+ |
| `users.delete` | Delete user accounts | SuperUser |
| `users.block` | Block/unblock users | Admin+ |
| `users.activate` | Activate/deactivate users | Admin+ |
| `users.resetPassword` | Reset user passwords | Admin+ |
| `users.manageRoles` | Assign/remove roles | Admin+ (within hierarchy) |

#### Category & Tag Privileges

| Privilege | Description | Typical Roles |
|-----------|-------------|---------------|
| `categories.view` | View categories | All |
| `categories.create` | Create categories | Admin+ |
| `categories.edit` | Edit categories | Admin+ |
| `categories.delete` | Delete categories | SuperUser |
| `tags.view` | View tags | All |
| `tags.create` | Create tags | Rédacteur+ |
| `tags.edit` | Edit tags | Chef de vacation+ |
| `tags.delete` | Delete tags | Admin+ |

#### Media Privileges

| Privilege | Description | Typical Roles |
|-----------|-------------|---------------|
| `images.view` | View images | All |
| `images.create` | Upload images | All content creators |
| `images.edit` | Edit image metadata | Creator, Admin+ |
| `images.delete` | Delete images | Admin+ |
| `videos.view` | View videos | All |
| `videos.create` | Create video entries | Vidéaste+ |
| `videos.edit` | Edit videos | Vidéaste+ |
| `videos.publish` | Publish videos | Rédacteur en chef+ |
| `galleries.view` | View galleries | All |
| `galleries.create` | Create galleries | Photographe+ |
| `galleries.edit` | Edit galleries | Photographe+ |
| `galleries.publish` | Publish galleries | Rédacteur en chef+ |

#### System Privileges

| Privilege | Description | Typical Roles |
|-----------|-------------|---------------|
| `roles.view` | View roles | Admin+ |
| `roles.create` | Create roles | SuperUser |
| `roles.edit` | Edit roles | SuperUser |
| `roles.delete` | Delete roles | SuperUser |
| `logs.view` | View activity logs | Admin+ |
| `logs.export` | Export logs | Admin+ |
| `system.config` | System configuration | Admin+ |
| `system.maintenance` | Maintenance mode | SuperUser |

#### Content Type Privileges

Similar privilege patterns exist for:
- `banners.*` - Banner management
- `dossiers.*` - Dossier management
- `infographies.*` - Infographic management
- `cahiers.*` - Cahier management
- `emergencies.*` - Emergency band management
- `subscribers.*` - Subscriber management

---

## Permission Matrix

### Article Permissions by Role

| Action | Rédacteur | Chef de vacation | Rédacteur en chef | Admin | SuperUser |
|--------|-----------|------------------|-------------------|-------|-----------|
| View all articles | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create article | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit own draft | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit other's draft | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit validated article | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit published article | ❌ | ❌ | ✅ | ✅ | ✅ |
| Validate article | ❌ | ✅ | ✅ | ✅ | ✅ |
| Publish article | ❌ | ❌ | ✅ | ✅ | ✅ |
| Unpublish article | ❌ | ❌ | ✅ | ✅ | ✅ |
| Pin to block | ❌ | ❌ | ✅ | ✅ | ✅ |
| Schedule publish | ❌ | ❌ | ✅ | ✅ | ✅ |
| Lock/unlock | ✅ | ✅ | ✅ | ✅ | ✅ |
| Trash own article | ✅ | ✅ | ✅ | ✅ | ✅ |
| Trash any article | ❌ | ✅ | ✅ | ✅ | ✅ |
| Restore from trash | ❌ | ❌ | ✅ | ✅ | ✅ |
| Delete permanently | ❌ | ❌ | ❌ | ✅ | ✅ |

### User Management Permissions by Role

| Action | Rédacteur | Chef de vacation | Rédacteur en chef | Admin | SuperUser |
|--------|-----------|------------------|-------------------|-------|-----------|
| View own profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit own profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all users | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create users | ❌ | ❌ | ❌ | ✅ | ✅ |
| Edit users | ❌ | ❌ | ❌ | ✅ | ✅ |
| Reset passwords | ❌ | ❌ | ❌ | ✅ | ✅ |
| Block users | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage Level 1 roles | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage Level 2-3 roles | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage Admin roles | ❌ | ❌ | ❌ | ❌ | ✅ |
| Delete users | ❌ | ❌ | ❌ | ❌ | ✅ |

### Media Permissions by Role

| Action | Rédacteur | Photographe | Vidéaste | Infographe | Admin |
|--------|-----------|-------------|----------|------------|-------|
| Upload images | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create galleries | ❌ | ✅ | ❌ | ❌ | ✅ |
| Apply watermarks | ❌ | ✅ | ❌ | ❌ | ✅ |
| Create videos | ❌ | ❌ | ✅ | ❌ | ✅ |
| Create infographics | ❌ | ❌ | ❌ | ✅ | ✅ |
| Delete any media | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Authorization Logic

### Checking Permissions

The system checks permissions at multiple levels:

```javascript
// 1. Middleware Level (Route Protection)
router.post('/articles/create', 
  isAuthenticated,                    // Check authentication
  hasPrivilege('articles.create'),    // Check privilege
  CreateArticle                        // Controller
);

// 2. Controller Level (Additional Validation)
export const CreateArticle = tryCatch(async (req, res) => {
  // Validate input, prepare data
  const data = await createArticle(req.body, req.user);
  // ...
});

// 3. Service Level (Business Logic)
export const createArticle = async (articleData, user) => {
  // Check specific conditions
  if (!canCreateArticleInCategory(user, articleData.id_categorie)) {
    throw new ErrorHandler(403, 'Insufficient permissions');
  }
  // Process article creation
};
```

### Hierarchy-Based Authorization

```javascript
// rolesHierarchy.js

export const roleHierarchy = Object.freeze({
  Rédacteur: 1,
  Infographe: 1,
  Vidéaste: 1,
  Photographe: 1,
  "Chef de vacation": 2,
  "Rédacteur en chef": 3,
  Superviseur: 3,
  Admin: 4,
  SuperUser: 5,
});

// Check if user can manage target role
export const canManageRole = (userRoles, targetRole) => {
  const userLevel = getHighestRoleLevel(userRoles);
  const targetLevel = getRoleLevel(targetRole);
  return userLevel > targetLevel;  // Must be strictly higher
};
```

**Example:**
- Admin (Level 4) can manage Rédacteur (Level 1) ✅
- Admin (Level 4) can manage Chef de vacation (Level 2) ✅
- Admin (Level 4) can manage Rédacteur en chef (Level 3) ✅
- Admin (Level 4) cannot manage Admin (Level 4) ❌
- Admin (Level 4) cannot manage SuperUser (Level 5) ❌

---

## Resource Ownership

### Ownership Rules

Users have extended permissions on resources they own:

#### Articles
- **Creator** can edit own draft articles
- **Creator** can trash own draft articles
- **Others** with sufficient role can edit any article

```javascript
// Check if user can edit article
const canEditArticle = (user, article) => {
  // Own draft article
  if (article.created_by === user.username && !article.is_publish) {
    return hasPrivilege(user, 'articles.edit');
  }
  
  // Any article (requires higher role)
  if (user.roleLevel >= 2) {  // Chef de vacation+
    return hasPrivilege(user, 'articles.edit');
  }
  
  return false;
};
```

#### Images, Videos, Galleries
- **Creator** can edit and delete own uploads
- **Admin+** can manage any media

#### Categories & Tags
- **Creator** can edit own tags
- **Admin+** can manage any category/tag

---

## Special Permissions

### Interim Roles

Users can be assigned temporary roles with expiration dates:

```sql
INSERT INTO aps2024_user_role (
  id_user, 
  id_role, 
  isInterim, 
  endDate, 
  assigned_by
) VALUES (
  123, 
  2,  -- Role ID
  true, 
  '2025-12-31 23:59:59', 
  'admin'
);
```

**Use Cases:**
- Temporary editorial responsibilities
- Vacation coverage
- Project-specific permissions

**Expiration Handling:**
- Roles automatically expire after `endDate`
- User loses privileges when role expires
- Can be renewed or removed manually

### Multi-Role Assignment

Users can have multiple roles simultaneously:

```javascript
// User: john.doe
{
  "roles": ["Rédacteur", "Photographe"],
  "privileges": [
    "articles.view", "articles.create", "articles.edit",
    "images.view", "images.create", "images.edit",
    "galleries.view", "galleries.create", "galleries.edit"
  ],
  "roleLevel": 1  // Highest role level
}
```

**Privilege Combination:**
- User has **union** of all role privileges
- Hierarchy level is **highest** among all roles
- No privilege conflicts (all are additive)

### Protected Content

Some content can be marked as protected (`is_protected: true`):

```javascript
// Additional authorization required for protected content
if (article.is_protected && user.roleLevel < 3) {
  throw new ErrorHandler(403, 'This article is protected');
}
```

**Use Cases:**
- Sensitive political content
- Embargo content
- National security related

### Sovereignty Content

Content marked as sovereignty-related (`is_souverainete: true`):

```javascript
// Special handling for sovereignty content
if (article.is_souverainete) {
  // Additional logging
  // Special approval workflow
  // Restricted visibility
}
```

---

## Permission Checking Examples

### Example 1: Create Article

```javascript
// User: Rédacteur
// Action: Create article

// 1. Check authentication
if (!req.session.userId) {
  return 401 Unauthorized;
}

// 2. Check privilege
if (!hasPrivilege(req.user, 'articles.create')) {
  return 403 Forbidden;
}

// 3. Validate category access
if (!canAccessCategory(req.user, req.body.id_categorie)) {
  return 403 Forbidden;
}

// 4. Create article
await createArticle(req.body);
return 201 Created;
```

### Example 2: Publish Article

```javascript
// User: Rédacteur en chef
// Action: Publish article

// 1. Check authentication ✅

// 2. Check privilege
if (!hasPrivilege(req.user, 'articles.publish')) {
  return 403 Forbidden;
}

// 3. Check article state
if (!article.is_validated) {
  return 400 Bad Request - "Article must be validated first";
}

// 4. Check article lock
if (article.is_locked && article.locked_by !== req.user.username) {
  return 409 Conflict - "Article is locked by another user";
}

// 5. Publish article
await publishArticle(article.id_article);
return 200 OK;
```

### Example 3: Manage User Roles

```javascript
// User: Admin
// Action: Assign Rédacteur en chef role to user

// 1. Check authentication ✅

// 2. Check privilege
if (!hasPrivilege(req.user, 'users.manageRoles')) {
  return 403 Forbidden;
}

// 3. Check hierarchy
const targetRoleLevel = getRoleLevel('Rédacteur en chef');  // 3
const userRoleLevel = getHighestRoleLevel(req.user.roles);  // 4 (Admin)

if (userRoleLevel <= targetRoleLevel) {
  return 403 Forbidden - "Cannot assign role at or above your level";
}

// 4. Assign role
await addRoleToUser(targetUserId, targetRoleId);
return 200 OK;
```

---

## Session & Authentication

### Session Data

When user logs in, session stores:

```javascript
{
  sessionId: 12345,           // Database session ID
  userId: 789,                // User ID
  username: "john.doe",       // Username
  roles: ["Rédacteur"],       // User roles
  privileges: [...],          // Computed privileges
  roleLevel: 1                // Highest role level
}
```

### Session Validation

On each request:
1. Check session cookie exists
2. Validate session in Redis
3. Verify session is active in database
4. Load user privileges from cache or database
5. Proceed with authorization checks

### Session Expiration

- **Timeout**: 2 hours (configurable)
- **Rolling**: Session refreshed on each request
- **Logout**: Session destroyed in Redis and marked inactive in database
- **Concurrent**: User can have multiple active sessions (controlled by config)

---

## Access Control Lists (ACL)

### Category-Based ACL

Users can be restricted to specific categories:

```javascript
// Check category access
const canAccessCategory = (user, categoryId) => {
  // Admin+ can access all categories
  if (user.roleLevel >= 4) return true;
  
  // Check user's allowed categories
  if (user.allowedCategories && user.allowedCategories.length > 0) {
    return user.allowedCategories.includes(categoryId);
  }
  
  // No restrictions by default
  return true;
};
```

### Topic-Based Restrictions

Content can be restricted by topic or classification:

- **Public**: All authenticated users
- **Internal**: Staff only (Level 2+)
- **Confidential**: Senior staff (Level 3+)
- **Restricted**: Admin only (Level 4+)

---

## Security Considerations

### Privilege Escalation Prevention

1. **Hierarchy Enforcement**: Users cannot assign roles higher than their own
2. **Privilege Validation**: All privileges checked on server-side
3. **Session Validation**: Session integrity verified on each request
4. **Resource Ownership**: Additional checks for resource access
5. **Audit Logging**: All permission-sensitive actions logged

### Defense in Depth

- **Middleware**: Route-level protection
- **Controller**: Request validation
- **Service**: Business logic authorization
- **Database**: Row-level security (future enhancement)

---

## Best Practices

### For Developers

1. **Always check authentication** before authorization
2. **Use middleware** for common permission checks
3. **Validate at multiple layers** (middleware, controller, service)
4. **Log authorization failures** for security monitoring
5. **Return appropriate HTTP status codes** (401 vs 403)
6. **Don't leak information** in error messages

### For Administrators

1. **Assign minimum necessary roles** (principle of least privilege)
2. **Use interim roles** for temporary permissions
3. **Regularly audit user permissions**
4. **Monitor failed authorization attempts**
5. **Review and update roles** as organization evolves
6. **Document custom roles and permissions**

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-26  
**Maintained By**: APS Development Team
