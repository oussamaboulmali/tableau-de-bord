# API Documentation

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Common Patterns](#common-patterns)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Articles](#article-endpoints)
  - [Users](#user-endpoints)
  - [Roles & Permissions](#roles--permissions-endpoints)
  - [Categories](#category-endpoints)
  - [Tags](#tag-endpoints)
  - [Images](#image-endpoints)
  - [Videos](#video-endpoints)
  - [Galleries](#gallery-endpoints)
  - [Banners](#banner-endpoints)
  - [Dossiers](#dossier-endpoints)
  - [Infographies](#infographie-endpoints)
  - [Cahiers](#cahier-endpoints)
  - [Emergency Band](#emergency-band-endpoints)
  - [Subscribers](#subscriber-endpoints)
  - [Logs](#log-endpoints)

---

## Overview

The APS Dashboard API is a RESTful API that provides comprehensive content management capabilities. The API uses JSON for request and response bodies, session-based authentication, and implements role-based access control (RBAC).

### API Principles

- **RESTful Design**: Resource-based URLs
- **JSON Format**: All requests and responses use JSON
- **Session Authentication**: Cookie-based sessions with Redis storage
- **RBAC**: Role-based access control on all endpoints
- **Pagination**: List endpoints support pagination
- **Validation**: Joi schema validation on all inputs
- **Error Handling**: Consistent error response format

---

## Base URL

**Development:**
```
http://localhost:5000/api/v1
```

**Production:**
```
https://dashboard.aps.dz/api/v1
```

---

## Authentication

### Authentication Flow

1. **Login**: POST `/auth/login` - Get OTP sent to email
2. **Verify OTP**: POST `/auth/verifiy` - Verify OTP and establish session
3. **Authenticated Requests**: Include session cookie in subsequent requests
4. **Logout**: POST `/auth/logout` - Destroy session

### Session Cookie

- **Name**: `aps_session` (configurable via SESSION_NAME env var)
- **Type**: `httpOnly`, `secure` (in production), `sameSite: none`
- **Duration**: 120 minutes (configurable via SESSION_TIME env var)
- **Storage**: Redis

### Required Headers

```http
Content-Type: application/json
Cookie: aps_session=<session_id>
```

---

## Common Patterns

### Pagination

Most list endpoints support pagination:

**Request:**
```json
{
  "page": 1,
  "pageSize": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Data fetched successfully",
  "count": 150,
  "data": [...]
}
```

### Filtering

List endpoints support filtering:

```json
{
  "filter": {
    "is_publish": true,
    "id_categorie": 5,
    "created_by": "john.doe"
  }
}
```

### Sorting

```json
{
  "order": {
    "created_date": "desc"
  }
}
```

### Search

Search endpoints support multiple fields:

```json
{
  "keyword": "économie",
  "searchFields": ["title", "introtext", "fulltext"]
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400,
  "stack": "..." // Only in development mode
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful request |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Validation error or invalid input |
| 401 | Unauthorized | Authentication required or invalid session |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (e.g., duplicate) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## API Endpoints

## Authentication Endpoints

### POST /auth/login

**Description**: Initiate login process. Validates credentials and sends OTP to user's email.

**Permission**: Public

**Request:**
```json
{
  "username": "john.doe",
  "password": "securePassword123"
}
```

**Response (No Active Session):**
```json
{
  "success": true,
  "message": "OTP sent to your email. Please enter it.",
  "hasSession": false,
  "data": {
    "userId": 123,
    "email": "j***@example.com"
  }
}
```

**Response (Active Session Found):**
```json
{
  "success": true,
  "message": "You have a session, do you want to close it?",
  "hasSession": true,
  "data": {
    "userId": 123,
    "sessionId": 456,
    "loginDate": "2025-10-26T10:30:00Z"
  }
}
```

**Error Responses:**
- 400: Invalid credentials
- 429: Too many failed login attempts

---

### POST /auth/close

**Description**: Close existing active session and send new OTP.

**Permission**: Public

**Request:**
```json
{
  "userId": 123
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to your email. Please enter it.",
  "hasSession": false,
  "data": {
    "userId": 123,
    "email": "j***@example.com"
  }
}
```

---

### POST /auth/resend

**Description**: Resend OTP to user's email.

**Permission**: Public

**Request:**
```json
{
  "userId": 123
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP envoyé à votre email. Veuillez le saisir.",
  "hasSession": false,
  "data": {
    "userId": 123
  }
}
```

---

### POST /auth/verifiy

**Description**: Verify OTP and complete login. Creates session on success.

**Permission**: Public

**Request:**
```json
{
  "userId": 123,
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Two-Factor Authentication successful. You are now logged in.",
  "data": {
    "userId": 123,
    "username": "john.doe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["Rédacteur", "Photographe"],
    "privileges": ["articles.view", "articles.create", "images.view", "images.create"]
  }
}
```

**Error Responses:**
- 400: Invalid or expired OTP
- 401: OTP verification failed

---

### POST /auth/logout

**Description**: Logout current user and destroy session.

**Permission**: Authenticated

**Request:** No body required

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Article Endpoints

### POST /articles

**Description**: Get all articles with filtering, sorting, and pagination.

**Permission**: `articles.view`

**Request:**
```json
{
  "page": 1,
  "pageSize": 10,
  "filter": {
    "is_publish": true,
    "id_categorie": 5,
    "created_by": "john.doe"
  },
  "order": {
    "publish_date": "desc"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Articles Successfully fetched",
  "count": 150,
  "data": [
    {
      "id_article": 1234,
      "title": "Article Title",
      "supTitle": "Sur-titre",
      "introtext": "Introduction text...",
      "categorie": "Économie",
      "subCategorie": "Finance",
      "image": {
        "id_image": 567,
        "url": "/uploads/image-567.jpg"
      },
      "is_publish": true,
      "is_validated": true,
      "is_pinned": false,
      "is_locked": false,
      "views": 1250,
      "created_by": "john.doe",
      "created_date": "2025-10-25T08:00:00Z",
      "publish_date": "2025-10-25T10:00:00Z"
    }
  ]
}
```

**Filterable Fields:**
- `is_publish`: Boolean
- `is_validated`: Boolean
- `is_trash`: Boolean
- `is_pinned`: Boolean
- `is_locked`: Boolean
- `id_categorie`: Integer
- `id_subCategorie`: Integer
- `created_by`: String
- `publish_by`: String
- `id_block`: Integer

---

### POST /articles/detail

**Description**: Get single article by ID with full details.

**Permission**: `articles.view`

**Request:**
```json
{
  "id_article": 1234
}
```

**Response:**
```json
{
  "success": true,
  "message": "Article Successfully fetched",
  "data": {
    "id_article": 1234,
    "title": "Article Title",
    "alias": "article-title",
    "supTitle": "Sur-titre",
    "introtext": "Introduction text...",
    "fulltext": "Full article content...",
    "lien_vedio": "https://youtube.com/...",
    "categorie": {
      "id_categorie": 5,
      "name": "Économie"
    },
    "subCategorie": {
      "id_subCategorie": 12,
      "name": "Finance"
    },
    "image": {
      "id_image": 567,
      "url": "/uploads/image-567.jpg",
      "description": "Image description"
    },
    "gallery": {
      "id_gallery": 89,
      "name": "Gallery Name",
      "images": [...]
    },
    "tags": [
      { "id_tag": 10, "name": "économie" },
      { "id_tag": 15, "name": "finance" }
    ],
    "dossiers": [
      { "id_dossier": 3, "name": "Economic Recovery 2025" }
    ],
    "is_publish": true,
    "is_validated": true,
    "is_pinned": false,
    "is_locked": false,
    "locked_by": null,
    "locked_date": null,
    "views": 1250,
    "created_by": "john.doe",
    "created_date": "2025-10-25T08:00:00Z",
    "modified_by": "jane.smith",
    "modified_date": "2025-10-25T09:30:00Z",
    "publish_by": "editor.chief",
    "publish_date": "2025-10-25T10:00:00Z",
    "translations": [
      {
        "id_lang": 2,
        "code": "fr",
        "label": "Français",
        "url": "https://fr.example.com/article-url"
      }
    ]
  }
}
```

---

### POST /articles/create

**Description**: Create a new article (draft state).

**Permission**: `articles.create`

**Request:**
```json
{
  "title": "New Article Title",
  "supTitle": "Optional Sur-titre",
  "introtext": "Introduction text (required)",
  "fulltext": "Full article content (optional)",
  "id_image": 567,
  "id_categorie": 5,
  "id_subCategorie": 12,
  "id_gallery": 89,
  "lien_vedio": "https://youtube.com/...",
  "tags": [10, 15, 20],
  "dossiers": [3, 7],
  "is_souverainete": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Un article a été creé avec succès.",
  "data": {
    "id_article": 1235,
    "alias": "new-article-title",
    "created_date": "2025-10-26T10:45:00Z"
  }
}
```

**Validation Rules:**
- `title`: Required, 3-255 characters
- `introtext`: Required, 10-1000 characters
- `fulltext`: Optional, max 50000 characters
- `id_image`: Required, must exist
- `id_categorie`: Required, must exist and be active
- `id_subCategorie`: Optional, must exist and be active
- `tags`: Optional array of tag IDs
- `dossiers`: Optional array of dossier IDs

---

### PUT /articles/update

**Description**: Update an existing article.

**Permission**: `articles.edit`

**Request:**
```json
{
  "id_article": 1234,
  "title": "Updated Title",
  "introtext": "Updated introduction...",
  "fulltext": "Updated content...",
  "id_image": 568,
  "id_categorie": 5,
  "id_subCategorie": 12,
  "tags": [10, 15, 25],
  "dossiers": [3]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Un article a été modifié avec succès."
}
```

**Authorization Rules:**
- Creator can edit their own draft articles
- Chef de vacation+ can edit any draft/validated article
- Published articles can be edited with appropriate permissions

---

### PUT /articles/publish

**Description**: Publish a validated article.

**Permission**: `articles.publish` (Level 3+: Rédacteur en chef)

**Request:**
```json
{
  "id_article": 1234,
  "publish_date": "2025-10-26T12:00:00Z",  // Optional: for scheduled publishing
  "publish_down": "2025-10-27T12:00:00Z",  // Optional: scheduled unpublish
  "is_programmed": false  // true if scheduled for future
}
```

**Response:**
```json
{
  "success": true,
  "message": "L'article a été publié avec succès."
}
```

**Business Rules:**
- Article must be validated (`is_validated: true`)
- Only Rédacteur en chef or higher can publish
- If `publish_date` is future, sets `is_programmed: true`
- Article becomes visible on website when published

---

### PUT /articles/unpublish

**Description**: Unpublish a published article (returns to validated state).

**Permission**: `articles.publish` (Level 3+)

**Request:**
```json
{
  "id_article": 1234
}
```

**Response:**
```json
{
  "success": true,
  "message": "L'article a été dépublié avec succès."
}
```

---

### PUT /articles/pin

**Description**: Pin or unpin article to homepage block.

**Permission**: `articles.publish` (Level 3+)

**Request:**
```json
{
  "id_article": 1234,
  "is_pinned": true,
  "id_block": 1,
  "position": 2
}
```

**Response:**
```json
{
  "success": true,
  "message": "Un article a été modifié avec succès.",
  "data": [
    // Array of articles currently pinned in the block
  ]
}
```

**Business Rules:**
- Only published articles can be pinned
- Each block/position combination is unique
- Unpins previous article at that position

---

### PUT /articles/lock

**Description**: Lock or unlock article for editing (prevents concurrent edits).

**Permission**: `articles.edit`

**Request:**
```json
{
  "id_article": 1234
}
```

**Response:**
```json
{
  "success": true,
  "message": "L'article a été verrouillé/déverrouillé avec succès."
}
```

**Locking Logic:**
- If unlocked: Lock for current user
- If locked by current user: Unlock
- If locked by another user: Return error with lock info

---

### PUT /articles/trash

**Description**: Send article to trash (soft delete).

**Permission**: `articles.edit` (own articles) or higher

**Request:**
```json
{
  "id_article": 1234
}
```

**Response:**
```json
{
  "success": true,
  "message": "L'article a été envoyé à la corbeille avec succès."
}
```

---

### POST /articles/search

**Description**: Search articles by keywords.

**Permission**: `articles.view`

**Request:**
```json
{
  "keyword": "économie",
  "searchFields": ["title", "introtext", "fulltext"],
  "page": 1,
  "pageSize": 10,
  "filter": {
    "is_publish": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Articles Successfully fetched",
  "count": 25,
  "data": [...]
}
```

---

### POST /articles/blocks

**Description**: Get homepage blocks with their positions.

**Permission**: `articles.view`

**Request:** Empty body `{}`

**Response:**
```json
{
  "success": true,
  "message": "Blocks Successfully fetched",
  "data": [
    {
      "id_block": 1,
      "name": "Block 1",
      "max_positions": 4,
      "positions": [
        {
          "position": 1,
          "id_article": 1234,
          "article": { ... }
        },
        {
          "position": 2,
          "id_article": 1235,
          "article": { ... }
        }
      ]
    }
  ]
}
```

---

### POST /articles/lang

**Description**: Get available languages for article translation.

**Permission**: `articles.view`

**Request:** Empty body `{}`

**Response:**
```json
{
  "success": true,
  "message": "Lang Successfully fetched",
  "data": [
    {
      "id_lang": 2,
      "code": "fr",
      "label": "Français"
    },
    {
      "id_lang": 3,
      "code": "en",
      "label": "English"
    }
  ]
}
```

---

## User Endpoints

### POST /users

**Description**: Get all users with filtering and pagination.

**Permission**: `users.view` (Admin+)

**Request:**
```json
{
  "page": 1,
  "pageSize": 10,
  "filter": {
    "state": 1  // 1=active, 0=inactive, 2=blocked
  },
  "order": {
    "register_date": "desc"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "users Successfully fetched",
  "data": {
    "users": [
      {
        "id_user": 123,
        "username": "john.doe",
        "email": "john@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "post": "Journaliste",
        "phoneNumber": "+213555123456",
        "state": 1,
        "roles": ["Rédacteur", "Photographe"],
        "registerDate": "2025-01-15T08:00:00Z",
        "lastVisit": "2025-10-26T09:30:00Z"
      }
    ],
    "count": 45
  }
}
```

**User States:**
- `0`: Inactive
- `1`: Active
- `2`: Blocked

---

### POST /users/create

**Description**: Create a new user account.

**Permission**: `users.create` (Admin+)

**Request:**
```json
{
  "username": "jane.smith",
  "email": "jane@example.com",
  "password": "SecurePassword123!",
  "firstName": "Jane",
  "lastName": "Smith",
  "phoneNumber": "+213555987654",
  "post": "Photographe",
  "birthDay": "1990-05-15",
  "roles": [1, 4]  // Array of role IDs
}
```

**Response:**
```json
{
  "success": true,
  "message": "Un utilisateur créé avec succès.",
  "data": {
    "id_user": 124,
    "username": "jane.smith",
    "email": "jane@example.com",
    "roles": ["Rédacteur", "Photographe"]
  }
}
```

**Validation Rules:**
- `username`: Required, 3-30 characters, unique
- `email`: Required, valid email format, unique
- `password`: Required, min 8 characters, must include uppercase, lowercase, number
- `roles`: Required, array of valid role IDs (user can only assign roles they can manage)

---

### PUT /users/update

**Description**: Update user information.

**Permission**: `users.edit` (Admin+)

**Request:**
```json
{
  "id_user": 123,
  "firstName": "John",
  "lastName": "Doe Updated",
  "phoneNumber": "+213555123456",
  "post": "Senior Journalist"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Les informations de l'utilisateur ont été modifié avec succés."
}
```

---

### PUT /users/reset-password

**Description**: Reset user password (admin action).

**Permission**: `users.edit` (Admin+)

**Request:**
```json
{
  "id_user": 123,
  "newPassword": "NewSecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mot de passe de l'utilisateur a été réinitialisé avec succès."
}
```

**Side Effects:**
- Logs out user from all active sessions
- Sends email notification to user

---

### PUT /users/change-password

**Description**: Change own password (logged-in user).

**Permission**: Authenticated

**Request:**
```json
{
  "oldPassword": "CurrentPassword123!",
  "newPassword": "NewSecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mot de passe a été changé avec succès."
}
```

---

### PUT /users/block

**Description**: Block user account.

**Permission**: `users.edit` (Admin+)

**Request:**
```json
{
  "id_user": 123,
  "blockCode": 1  // Block reason code
}
```

**Block Codes:**
- `1`: Violation of usage policy
- `2`: Security concern
- `3`: Inactive account
- `4`: Administrative decision

**Response:**
```json
{
  "success": true,
  "message": "Le compte de l'utilisateur a été bloqué."
}
```

**Side Effects:**
- Sets `state: 2`
- Logs out user from all sessions
- Sends email alert to administrators

---

### PUT /users/unblock

**Description**: Unblock user account.

**Permission**: `users.edit` (Admin+)

**Request:**
```json
{
  "id_user": 123,
  "type": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Le déblocage de l'utilisateur a été effectué avec succés."
}
```

---

### PUT /users/activate

**Description**: Activate or deactivate user account.

**Permission**: `users.edit` (Admin+)

**Request:**
```json
{
  "id_user": 123,
  "type": true  // true=activate, false=deactivate
}
```

**Response:**
```json
{
  "success": true,
  "message": "L'utilisateur a été activé/désactivé avec succès."
}
```

---

### POST /users/roles

**Description**: Add roles to user.

**Permission**: `users.edit` (Admin+)

**Request:**
```json
{
  "id_user": 123,
  "roles": [2, 3],  // Array of role IDs to add
  "isInterim": false,  // Optional: temporary role
  "endDate": "2025-12-31T23:59:59Z"  // Required if isInterim=true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Les roles ont été attribués à l'utilisateur avec succès."
}
```

**Authorization:**
- Can only assign roles below your highest role level
- Admin (Level 4) cannot assign SuperUser role

---

### PUT /users/roles

**Description**: Remove role from user.

**Permission**: `users.edit` (Admin+)

**Request:**
```json
{
  "id_user": 123,
  "id_role": 2
}
```

**Response:**
```json
{
  "success": true,
  "message": "Un role a été retiré d'utilsateur avec succés."
}
```

---

### POST /users/menu

**Description**: Get user's accessible menu items based on privileges.

**Permission**: Authenticated

**Request:** Empty body `{}`

**Response:**
```json
{
  "success": true,
  "message": "Menu Successfully fetched",
  "data": [
    {
      "id": "articles",
      "label": "Articles",
      "icon": "article",
      "children": [
        { "id": "articles.list", "label": "Liste", "path": "/articles" },
        { "id": "articles.create", "label": "Créer", "path": "/articles/create" }
      ]
    },
    {
      "id": "users",
      "label": "Utilisateurs",
      "icon": "users",
      "children": [...]
    }
  ]
}
```

---

### POST /users/stats

**Description**: Get dashboard statistics.

**Permission**: Authenticated

**Request:** Empty body `{}`

**Response:**
```json
{
  "success": true,
  "message": "Stats Successfully fetched",
  "data": {
    "articles": {
      "total": 1500,
      "published": 1200,
      "draft": 250,
      "trash": 50
    },
    "users": {
      "total": 45,
      "active": 40,
      "blocked": 5
    },
    "today": {
      "articles_created": 12,
      "articles_published": 8,
      "views": 15000
    }
  }
}
```

---

## Category Endpoints

### POST /categories

**Description**: Get all categories with subcategories.

**Permission**: `categories.view`

**Request:**
```json
{
  "filter": {
    "state": true  // Only active categories
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Categories Successfully fetched",
  "data": [
    {
      "id_categorie": 5,
      "name": "Économie",
      "alias": "economie",
      "state": true,
      "created_by": "admin",
      "created_date": "2025-01-01T00:00:00Z",
      "subCategories": [
        {
          "id_subCategorie": 12,
          "name": "Finance",
          "alias": "finance",
          "state": true
        },
        {
          "id_subCategorie": 13,
          "name": "Commerce",
          "alias": "commerce",
          "state": true
        }
      ]
    }
  ]
}
```

---

### POST /categories/create

**Description**: Create a new category or subcategory.

**Permission**: `categories.create` (Admin+)

**Request (Main Category):**
```json
{
  "name": "Culture",
  "isSubCategorie": false
}
```

**Request (Subcategory):**
```json
{
  "name": "Cinéma",
  "isSubCategorie": true,
  "id_categorie": 8  // Parent category ID
}
```

**Response:**
```json
{
  "success": true,
  "message": "Une catégorie a été créé avec succès.",
  "data": {
    "id_categorie": 9,
    "name": "Culture",
    "alias": "culture"
  }
}
```

---

### PUT /categories/update

**Description**: Update category or subcategory.

**Permission**: `categories.edit` (Admin+)

**Request:**
```json
{
  "id_categorie": 5,
  "name": "Économie et Finance",
  "isSubCategorie": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Une catégorie a été modifié avec succès."
}
```

---

### PUT /categories/changestate

**Description**: Enable or disable category/subcategory.

**Permission**: `categories.edit` (Admin+)

**Request:**
```json
{
  "id_categorie": 5,
  "type": false,  // false=disable, true=enable
  "isSubCategorie": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "L'état de la catégorie a été modifié avec succés."
}
```

---

## Additional Endpoints

Due to the comprehensive nature of the API, here is a summary of remaining endpoint categories. Each follows similar patterns to the above:

### Tag Endpoints (`/api/v1/tags`)
- POST `/` - Get all tags
- POST `/create` - Create tag
- PUT `/update` - Update tag
- POST `/detail` - Get tag details
- POST `/search` - Search tags

### Image Endpoints (`/api/v1/images`)
- POST `/` - Get all images
- POST `/create` - Upload image (multipart/form-data)
- POST `/detail` - Get image details
- POST `/search` - Search images
- PUT `/update` - Update image metadata
- POST `/indexes` - Get image indexes

### Video Endpoints (`/api/v1/videos`)
- POST `/` - Get all videos
- POST `/create` - Create video entry
- PUT `/update` - Update video
- PUT `/publish` - Publish video
- PUT `/unpublish` - Unpublish video
- PUT `/pin` - Pin/unpin video to homepage

### Gallery Endpoints (`/api/v1/galleries`)
- POST `/` - Get galleries for articles
- POST `/create` - Create article gallery
- PUT `/update` - Update gallery
- POST `/detail` - Get gallery details

### Home Gallery Endpoints (`/api/v1/galleryhome`)
- POST `/` - Get homepage galleries
- POST `/create` - Create homepage gallery
- PUT `/update` - Update gallery
- PUT `/publish` - Publish gallery
- PUT `/pin` - Pin gallery to homepage position

### Banner Endpoints (`/api/v1/banners`)
- POST `/` - Get all banners
- POST `/create` - Create banner
- PUT `/update` - Update banner
- PUT `/publish` - Publish banner
- PUT `/unpublish` - Unpublish banner
- PUT `/position` - Set banner position

### Dossier Endpoints (`/api/v1/dossiers`)
- POST `/` - Get all dossiers
- POST `/create` - Create dossier
- PUT `/update` - Update dossier
- PUT `/publish` - Publish dossier
- PUT `/changestate` - Change dossier state

### Infographie Endpoints (`/api/v1/infographies`)
- POST `/` - Get all infographics
- POST `/create` - Create infographic
- PUT `/update` - Update infographic
- PUT `/publish` - Publish infographic

### Cahier Endpoints (`/api/v1/cahiers`)
- POST `/` - Get all cahiers
- POST `/create` - Create cahier
- PUT `/update` - Update cahier
- PUT `/publish` - Publish cahier

### Emergency Band Endpoints (`/api/v1/emergencies`)
- POST `/` - Get emergency bands
- POST `/create` - Create emergency band
- PUT `/update` - Update emergency band
- PUT `/publish` - Publish emergency band
- PUT `/unpublish` - Unpublish emergency band

### Subscriber Endpoints (`/api/v1/subscribers`)
- POST `/` - Get all subscribers
- POST `/create` - Create subscriber
- PUT `/update` - Update subscriber
- PUT `/activate` - Activate/deactivate subscriber

### Role Endpoints (`/api/v1/roles`)
- POST `/` - Get all roles
- POST `/create` - Create role
- PUT `/update` - Update role
- POST `/detail` - Get role with privileges

### Log Endpoints (`/api/v1/logs`)
- POST `/` - Get activity logs with filters
- POST `/search` - Search logs by keyword

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| General API | 100 requests | 15 minutes |
| Search | 30 requests | 1 minute |
| Upload | 10 requests | 1 hour |

**Rate Limit Response:**
```json
{
  "success": false,
  "error": "Too many requests, please try again later.",
  "statusCode": 429,
  "retryAfter": 900  // seconds
}
```

---

## API Versioning

Current version: **v1**

The API version is included in the base URL: `/api/v1/`

Future versions will be released as `/api/v2/`, etc., with backward compatibility maintained for at least one major version.

---

## Postman Collection

A Postman collection is available for testing all endpoints. Import the collection and set up environment variables:

```
BASE_URL=http://localhost:5000/api/v1
SESSION_COOKIE=<your_session_cookie>
```

---

## WebSocket / Real-time Features

While most of the API is REST-based, the system includes Socket.io for real-time features:

- Article lock notifications
- New content alerts
- Dashboard updates

**Connection:**
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  withCredentials: true
});

socket.on('article:locked', (data) => {
  console.log('Article locked:', data);
});
```

---

## Best Practices

### Request Best Practices

1. **Always include pagination** for list endpoints
2. **Use filters** to reduce response size
3. **Cache responses** where appropriate
4. **Handle errors gracefully**
5. **Respect rate limits**

### Error Handling

```javascript
try {
  const response = await fetch('/api/v1/articles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ page: 1, pageSize: 10 })
  });
  
  const data = await response.json();
  
  if (!data.success) {
    // Handle API error
    console.error(data.error);
  }
  
  return data.data;
} catch (error) {
  // Handle network error
  console.error('Network error:', error);
}
```

---

**API Version**: 1.0  
**Last Updated**: 2025-10-26  
**Maintainer**: APS Development Team
