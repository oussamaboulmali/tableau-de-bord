# System Architecture

## Table of Contents

- [Overview](#overview)
- [High-Level Architecture](#high-level-architecture)
- [Backend Architecture](#backend-architecture)
- [Database Architecture](#database-architecture)
- [Caching & Session Management](#caching--session-management)
- [Security Architecture](#security-architecture)
- [Scalability & Performance](#scalability--performance)
- [Data Flow](#data-flow)
- [Technology Stack](#technology-stack)

---

## Overview

The APS Dashboard is built as a **monolithic backend API** with a **three-tier architecture**:

1. **Presentation Layer**: Frontend application (React) - separate repository
2. **Business Logic Layer**: Express.js REST API
3. **Data Layer**: PostgreSQL database with Redis caching

The system is designed for:
- **High availability**: Session persistence, graceful shutdowns
- **Scalability**: Horizontal scaling capability, caching layer
- **Security**: Multi-layered security approach
- **Maintainability**: Modular code structure, comprehensive logging

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT TIER                              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Browser    │  │   Mobile     │  │   Desktop    │         │
│  │   (React)    │  │   Apps       │  │   Clients    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         └─────────────────┴─────────────────┘                  │
│                            │ HTTPS                              │
└────────────────────────────┼───────────────────────────────────┘
                             │
┌────────────────────────────┼───────────────────────────────────┐
│                   REVERSE PROXY TIER                            │
│                            │                                    │
│  ┌─────────────────────────▼────────────────────────┐          │
│  │          Apache2 / Nginx Reverse Proxy           │          │
│  │  • SSL/TLS Termination                           │          │
│  │  • Load Balancing                                │          │
│  │  • Request Routing                               │          │
│  │  • Static File Serving                           │          │
│  └─────────────────────────┬────────────────────────┘          │
└────────────────────────────┼───────────────────────────────────┘
                             │
┌────────────────────────────┼───────────────────────────────────┐
│                    APPLICATION TIER                             │
│                            │                                    │
│  ┌─────────────────────────▼────────────────────────┐          │
│  │              Express.js API Server                │          │
│  │                   (Node.js)                       │          │
│  │                                                   │          │
│  │  ┌──────────────┐  ┌──────────────┐            │          │
│  │  │ Middleware   │  │  Controllers │            │          │
│  │  │  Pipeline    │─▶│   Services   │            │          │
│  │  └──────────────┘  └──────┬───────┘            │          │
│  │         │                  │                     │          │
│  │         │        ┌─────────▼────────┐           │          │
│  │         │        │   Prisma ORM     │           │          │
│  │         │        └─────────┬────────┘           │          │
│  │         │                  │                     │          │
│  └─────────┼──────────────────┼─────────────────────┘          │
│            │                  │                                │
│      ┌─────▼─────┐     ┌─────▼─────┐                         │
│      │  Redis    │     │PostgreSQL │                         │
│      │ (Sessions)│     │ (Primary) │                         │
│      └───────────┘     └───────────┘                         │
└─────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼───────────────────────────────────┐
│                       DATA TIER                                 │
│                            │                                    │
│  ┌─────────────────────────▼────────────────────────┐          │
│  │            PostgreSQL Cluster                     │          │
│  │                                                   │          │
│  │  ┌──────────────┐         ┌──────────────┐      │          │
│  │  │   Master DB  │────────▶│  Replica DB  │      │          │
│  │  │   (Write)    │  Async  │   (Read)     │      │          │
│  │  │              │  Repl.  │              │      │          │
│  │  └──────────────┘         └──────────────┘      │          │
│  │                                                   │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                 │
│  ┌─────────────────────────────────────────────────┐           │
│  │             Redis Cluster                       │           │
│  │  • Session Store                                │           │
│  │  • Cache Layer (optional)                       │           │
│  │  • Rate Limiting Store                          │           │
│  └─────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture

### Layered Architecture

The backend follows a **clean architecture** pattern with clear separation of concerns:

```
┌──────────────────────────────────────────────────────────┐
│                    HTTP REQUEST                          │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│                  MIDDLEWARE LAYER                        │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │  Security  │→ │   Auth     │→ │ Validation │        │
│  │  Helmet    │  │  Session   │  │    Joi     │        │
│  │  CORS      │  │  Check     │  │   Schema   │        │
│  │  Rate Lim  │  │            │  │            │        │
│  └────────────┘  └────────────┘  └────────────┘        │
│         │               │               │               │
│  ┌──────▼───────────────▼───────────────▼──────┐        │
│  │          Request Enrichment                 │        │
│  │   • Add request ID                          │        │
│  │   • Log HTTP request                        │        │
│  │   • Parse body/cookies                      │        │
│  └─────────────────────┬───────────────────────┘        │
└────────────────────────┼──────────────────────────────────┘
                         │
┌────────────────────────▼──────────────────────────────────┐
│                   ROUTING LAYER                           │
│                                                           │
│  /api/v1/                                                 │
│   ├── /auth      (Authentication endpoints)              │
│   ├── /articles  (Article CRUD)                          │
│   ├── /users     (User management)                       │
│   ├── /categories                                        │
│   ├── /images, /videos, /galleries                      │
│   └── /... (other resources)                            │
└────────────────────────┬──────────────────────────────────┘
                         │
┌────────────────────────▼──────────────────────────────────┐
│                 CONTROLLER LAYER                          │
│                                                           │
│  • Request handling                                       │
│  • Input validation (Joi schemas)                        │
│  • Call service layer                                    │
│  • Format response                                       │
│  • Error handling (try-catch wrapper)                   │
│                                                           │
│  Example: articleController.js                           │
│   └── GetAllArticles()                                   │
│   └── CreateArticle()                                    │
│   └── PublishArticle()                                   │
└────────────────────────┬──────────────────────────────────┘
                         │
┌────────────────────────▼──────────────────────────────────┐
│                  SERVICE LAYER                            │
│                                                           │
│  • Business logic implementation                         │
│  • Transaction management                                │
│  • Data transformation                                   │
│  • Authorization checks                                  │
│  • Logging business actions                             │
│                                                           │
│  Example: articleService.js                              │
│   └── getAllArticles() - Filtering, pagination          │
│   └── createArticle() - Validation, alias generation    │
│   └── publishArticle() - Workflow checks, update DB     │
└────────────────────────┬──────────────────────────────────┘
                         │
┌────────────────────────▼──────────────────────────────────┐
│                   DATA ACCESS LAYER                       │
│                                                           │
│  ┌─────────────────────────────────────────┐             │
│  │          Prisma ORM                     │             │
│  │  • Type-safe database client            │             │
│  │  • Query building                       │             │
│  │  • Relation handling                    │             │
│  │  • Transaction support                  │             │
│  └─────────────────┬───────────────────────┘             │
└────────────────────┼──────────────────────────────────────┘
                     │
┌────────────────────▼──────────────────────────────────────┐
│                DATABASE (PostgreSQL)                      │
└───────────────────────────────────────────────────────────┘
```

### Module Structure

#### Controllers (`src/controllers/`)
- Handle HTTP requests and responses
- Validate request data using Joi schemas
- Delegate business logic to services
- Format responses consistently
- Wrapped with `tryCatch` for error handling

**Example Controller:**
```javascript
export const CreateArticle = tryCatch(async (req, res) => {
  // 1. Validate input
  const { error } = articleSchema.validate(req.body);
  if (error) throw new ValidationError(error.message);
  
  // 2. Call service
  const data = await createArticle({
    ...req.body,
    id_user: req.session.userId,
    created_by: req.session.username,
  });
  
  // 3. Log action
  logger.info(`Article created: ${req.body.title}`);
  
  // 4. Return response
  return res.status(201).json({
    success: true,
    message: "Article created successfully",
    data,
  });
});
```

#### Services (`src/services/`)
- Implement business logic
- Interact with database via Prisma
- Handle complex operations and transactions
- Enforce business rules and workflows
- Reusable across multiple controllers

**Responsibilities:**
- Data validation (business rules)
- Database operations
- Transaction management
- Data transformation
- Authorization logic
- Integration with external services

#### Middleware (`src/middlewares/`)

1. **authMiddleware.js**: Authentication & Authorization
   - Verify session
   - Check user privileges
   - Role-based access control

2. **errorMiddleware.js**: Global error handling
   - Catch all errors
   - Format error responses
   - Log errors
   - Hide sensitive info in production

3. **rateLimitMiddleware.js**: Rate limiting
   - Per-IP limits
   - Per-user limits
   - Endpoint-specific limits

4. **securityMiddleware.js**: Security checks
   - Suspicious activity detection
   - Block detection
   - Request validation

5. **forbiddenWordsMiddleware.js**: Content filtering
   - Check for prohibited words
   - Reject inappropriate content

6. **uploadMiddleware.js**: File upload handling
   - File validation
   - Size limits
   - Type restrictions

#### Utilities (`src/utils/`)

- **logger.js**: Winston-based logging
- **tryCatch.js**: Async error wrapper
- **createAlias.js**: URL-friendly slug generation
- **rolesHierarchy.js**: RBAC hierarchy logic
- **enum.js**: Constants and enums
- **blockMessage.js**: User blocking messages

#### Helpers (`src/helpers/`)

- **authHelper.js**: OTP generation, email sending
- **imageHelper.js**: Image processing with Sharp
- **forbiddenWordsHelper.js**: Content moderation
- **analyticsHelper.js**: Statistics and analytics

---

## Database Architecture

### Database Schema Overview

The database uses **PostgreSQL 14+** with **Prisma ORM** for type-safe access.

#### Core Entities

```
Users & Authentication
├── aps2024_users          (User accounts)
├── aps2024_sessions       (Active sessions)
├── aps2024_roles          (Role definitions)
├── aps2024_privileges     (Permission definitions)
├── aps2024_user_role      (User-role assignments)
└── aps2024_roles_privileges (Role-permission mappings)

Content Management
├── aps2024_articles       (Main content)
├── aps2024_categories     (Content categories)
├── aps2024_subCategories  (Subcategories)
├── aps2024_tag            (Tags)
├── aps2024_article_tag    (Article-tag relations)
├── aps2024_images         (Image assets)
├── aps2024_videos         (Video content)
├── aps2024_infographies   (Infographic content)
├── aps2024_cahiers_aps    (Cahiers publications)
├── aps2024_dossiers       (Thematic collections)
└── aps2024_article_dossier (Article-dossier relations)

Gallery Management
├── aps2024_gallery        (Article galleries)
├── aps2024_gallery_image  (Gallery-image relations)
├── aps2024_home_gallery   (Homepage galleries)
├── aps2024_index          (Image indexing)
└── aps2024_image_index    (Image-index relations)

Homepage Management
├── aps2024_blocks         (Content blocks)
├── aps2024_block_position (Block positions)
├── aps2024_block_position_actualites (Category block positions)
├── aps2024_banners        (Banner ads)
├── aps2024_banner_categories (Banner placements)
└── aps2024_emergency_bands (Breaking news alerts)

System & Configuration
├── aps2024_configuration  (System settings)
├── aps2024_languages      (Supported languages)
├── aps2024_article_translated (Translation links)
├── aps2024_subscriber     (Newsletter subscribers)
├── aps2024_forbiddenword  (Content filter words)
├── aps2024_archive        (Archived articles)
└── aps2024_defaultCategorie (Default category setting)
```

### Key Relationships

```
User → User_Role → Role → Roles_Privileges → Privileges
  │
  └──> Articles, Images, Videos, Galleries, etc. (created_by)

Article
  ├──> Category (id_categorie)
  ├──> SubCategory (id_subCategorie - optional)
  ├──> Image (id_image - main image)
  ├──> Gallery (id_gallery - optional)
  ├──> User (id_user - author)
  ├──> Session (id_session)
  ├──> Block (id_block - if pinned)
  ├──> Article_Tag (many-to-many with Tags)
  └──> Article_Dossier (many-to-many with Dossiers)

Homepage Structure:
Block
  └──> Block_Position (Fixed positions within block)
         └──> Article (pinned article)

Banner
  ├──> Image (banner image)
  ├──> Banner_Categories (placement in categories)
  └──> Position (homepage position 1-7)
```

### Database Indexes

**Performance-critical indexes:**

```sql
-- Article indexes for common queries
INDEX ON articles (is_publish, publish_date DESC)
INDEX ON articles (id_categorie, id_subCategorie, is_publish, publish_date DESC)
INDEX ON articles (is_publish, id_block, publish_date DESC)
INDEX ON articles (id_block, is_pinned, is_publish)

-- Category indexes
INDEX ON categories (state)
INDEX ON subCategories (state, id_categorie)

-- Block position indexes
INDEX ON block_position (id_block, position)
INDEX ON block_position_actualites (id_block, id_categorie, id_subCategorie, position)

-- Session index for quick lookups
INDEX ON sessions (id_session, id_user, is_active)

-- Gallery indexes
INDEX ON home_gallery (is_publish, position)
INDEX ON home_gallery (is_publish, publish_date DESC)
INDEX ON videos (is_publish, is_main, position)
INDEX ON videos (is_publish, is_main, publish_date DESC)
```

### Database Transactions

Prisma transactions ensure data consistency:

```javascript
// Example: Publishing article with block pinning
await prisma.$transaction(async (tx) => {
  // 1. Update article
  await tx.aps2024_articles.update({
    where: { id_article },
    data: { is_publish: true, publish_date: new Date() }
  });
  
  // 2. Update block position
  await tx.aps2024_block_position.update({
    where: { id_block_position },
    data: { id_article }
  });
  
  // 3. Log action
  await tx.aps2024_logs.create({
    data: { action: 'publish', ... }
  });
});
```

### Master-Slave Replication (Production)

```
┌──────────────────┐
│   Master DB      │ ◄─── Write Operations
│  (Primary)       │
└────────┬─────────┘
         │ Async Replication
         ├──────────┐
         ▼          ▼
┌────────────┐  ┌────────────┐
│ Replica 1  │  │ Replica 2  │ ◄─── Read Operations
│  (Slave)   │  │  (Slave)   │      (Load Balanced)
└────────────┘  └────────────┘
```

**Benefits:**
- **Read scalability**: Distribute read queries
- **High availability**: Failover capability
- **Backup**: Real-time data replication
- **Analytics**: Run reports on replica without affecting master

**Implementation:**
- Configure multiple `DATABASE_URL` in Prisma
- Route reads to replicas, writes to master
- Automatic failover with monitoring

---

## Caching & Session Management

### Redis Architecture

```
┌─────────────────────────────────────────┐
│           Redis Instance                │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │      Session Store                │ │
│  │  • User sessions                  │ │
│  │  • Session data                   │ │
│  │  • TTL: 2 hours (configurable)    │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │      Rate Limiting                │ │
│  │  • Request counters               │ │
│  │  • Per-IP limits                  │ │
│  │  • Per-endpoint limits            │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │    Cache Layer (Optional)         │ │
│  │  • Frequently accessed data       │ │
│  │  • Category lists                 │ │
│  │  • User permissions cache         │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Session Management

**Session Flow:**

```
1. Login:
   User provides credentials
   ↓
   OTP sent to email
   ↓
   User verifies OTP
   ↓
   Session created in database (aps2024_sessions)
   ↓
   Session ID stored in Redis (connect-redis)
   ↓
   Cookie sent to client (httpOnly, secure)

2. Authenticated Request:
   Client sends cookie
   ↓
   Express-session checks Redis
   ↓
   Session found → req.session populated
   ↓
   Middleware checks permissions
   ↓
   Request processed

3. Logout:
   Client requests logout
   ↓
   Session destroyed in Redis
   ↓
   Session marked inactive in database
   ↓
   Cookie cleared on client
```

**Session Data Structure:**

```javascript
{
  sessionId: 12345,        // Database session ID
  userId: 789,             // User ID
  username: "john.doe",    // Username
  cookie: {
    maxAge: 7200000,       // 2 hours
    httpOnly: true,
    secure: true,          // HTTPS only
    sameSite: "none"
  }
}
```

### Caching Strategy

**Cache Layers:**

1. **Application Cache** (Redis - optional)
   - Frequently accessed data
   - TTL-based expiration
   - Invalidation on updates

2. **HTTP Cache** (Response headers)
   - Public content
   - Browser caching
   - CDN integration

**Cacheable Data:**
- Category/subcategory lists (rarely change)
- Published article lists (5-minute TTL)
- User permission lookups
- System configuration

**Cache Invalidation:**
- On data updates
- Manual purge endpoints
- Time-based expiration

---

## Security Architecture

### Multi-Layered Security

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Network Security                              │
│  • Firewall rules                                       │
│  • IP whitelisting (optional)                           │
│  • DDoS protection                                      │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Layer 2: Transport Security                            │
│  • HTTPS/TLS 1.2+                                       │
│  • SSL certificate (Let's Encrypt)                      │
│  • HSTS headers                                         │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Layer 3: Application Security (Middleware)             │
│  • Helmet (security headers)                            │
│  • CORS (origin validation)                             │
│  • Rate limiting (brute-force prevention)               │
│  • Request size limits                                  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Layer 4: Authentication                                │
│  • Session-based auth                                   │
│  • Two-factor authentication (OTP)                      │
│  • Password hashing (bcryptjs)                          │
│  • Session expiration                                   │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Layer 5: Authorization                                 │
│  • Role-Based Access Control (RBAC)                     │
│  • Privilege checking                                   │
│  • Resource ownership validation                        │
│  • Hierarchical role system                             │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Layer 6: Input Validation                              │
│  • Joi schema validation                                │
│  • Type checking                                        │
│  • Sanitization                                         │
│  • Forbidden words filtering                            │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Layer 7: Data Security                                 │
│  • Parameterized queries (Prisma ORM)                   │
│  • SQL injection prevention                             │
│  • XSS prevention                                       │
│  • CSRF protection                                      │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Layer 8: Monitoring & Logging                          │
│  • Comprehensive audit logs                             │
│  • Security event logging                               │
│  • Failed login monitoring                              │
│  • Alert system                                         │
└─────────────────────────────────────────────────────────┘
```

For detailed security documentation, see [security.md](./security.md).

---

## Scalability & Performance

### Horizontal Scaling

```
                    ┌─────────────┐
                    │ Load Balancer│
                    │   (Nginx)    │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
     ┌────▼────┐      ┌────▼────┐     ┌────▼────┐
     │ Node.js │      │ Node.js │     │ Node.js │
     │  API 1  │      │  API 2  │     │  API 3  │
     └────┬────┘      └────┬────┘     └────┬────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Shared Redis│
                    │  (Sessions) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ PostgreSQL  │
                    │   Cluster   │
                    └─────────────┘
```

**Scaling Capabilities:**
- Stateless API servers (session in Redis)
- Multiple API instances behind load balancer
- Shared Redis for session consistency
- Database read replicas for load distribution

### Performance Optimization

1. **Database Optimization**
   - Strategic indexes on frequently queried columns
   - Query optimization with Prisma
   - Connection pooling
   - Read replicas for heavy queries

2. **Caching**
   - Redis caching for frequent data
   - Response caching headers
   - Static asset caching

3. **Response Compression**
   - Gzip compression middleware
   - Reduces bandwidth usage

4. **Pagination**
   - All list endpoints support pagination
   - Cursor-based pagination for large datasets
   - Configurable page sizes

5. **Lazy Loading**
   - Load relations only when needed
   - Selective field fetching with Prisma

6. **Image Optimization**
   - Multiple image sizes (thumbnail, medium, full)
   - WebP format support
   - Lazy image loading
   - CDN integration (future)

---

## Data Flow

### Article Creation Flow

```
User Creates Article
        │
        ▼
┌───────────────────┐
│  Frontend Form    │
└────────┬──────────┘
         │ POST /api/v1/articles/create
         │ { title, introtext, fulltext, ... }
         ▼
┌───────────────────┐
│  Express Router   │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Middleware Pipeline│
│  • Auth check      │
│  • Validation      │
│  • Logging         │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Controller       │
│  • Parse request  │
│  • Validate input │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Service Layer    │
│  • Generate alias │
│  • Check perms    │
│  • Business logic │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Prisma ORM       │
│  • Build query    │
│  • Execute        │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  PostgreSQL       │
│  • Insert record  │
│  • Return data    │
└────────┬──────────┘
         │
         ▼
Response bubbles back up:
Service → Controller → Response
         │
         ▼
┌───────────────────┐
│  Log Action       │
│  • Winston logger │
│  • Database log   │
└───────────────────┘
         │
         ▼
JSON Response to Client
```

---

## Technology Stack

### Core Technologies

- **Node.js v18+**: JavaScript runtime
- **Express.js v5**: Web framework
- **Prisma v6**: ORM and database toolkit
- **PostgreSQL 14+**: Relational database
- **Redis v5**: In-memory data store

### Security & Authentication

- **express-session**: Session management
- **connect-redis**: Redis session store
- **bcryptjs**: Password hashing
- **helmet**: Security headers
- **cors**: Cross-origin resource sharing
- **express-rate-limit**: Rate limiting

### Validation & Processing

- **Joi**: Schema validation
- **Sharp**: Image processing
- **Multer**: File upload handling

### Logging & Monitoring

- **Winston**: Application logging
- **Morgan**: HTTP request logging
- **winston-daily-rotate-file**: Log rotation

### Utilities

- **nodemailer**: Email sending
- **uuid**: Unique identifier generation
- **compression**: Response compression
- **dotenv**: Environment configuration

---

## Deployment Architecture (Production)

```
┌────────────────────────────────────────────────────────────┐
│                    Internet                                │
└───────────────────────┬────────────────────────────────────┘
                        │ Port 443 (HTTPS)
┌───────────────────────▼────────────────────────────────────┐
│              Firewall / Security Group                     │
└───────────────────────┬────────────────────────────────────┘
                        │
┌───────────────────────▼────────────────────────────────────┐
│                 Apache2 Reverse Proxy                      │
│  • SSL/TLS Termination                                     │
│  • Virtual Host Configuration                              │
│  • ProxyPass to Node.js                                    │
└───────────────────────┬────────────────────────────────────┘
                        │ Port 5000 (HTTP - internal)
┌───────────────────────▼────────────────────────────────────┐
│                   PM2 Process Manager                      │
│  • Auto-restart on crash                                   │
│  • Cluster mode (multiple instances)                       │
│  • Log management                                          │
│  • Monitoring                                              │
│                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Node.js  │  │ Node.js  │  │ Node.js  │                │
│  │  API 1   │  │  API 2   │  │  API 3   │                │
│  └──────────┘  └──────────┘  └──────────┘                │
└────────────────────┬───────────────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
┌────▼────┐   ┌──────▼──────┐  ┌────▼─────┐
│ Redis   │   │ PostgreSQL  │  │  File    │
│ Server  │   │   Server    │  │  Storage │
└─────────┘   └─────────────┘  └──────────┘
```

**Server Configuration:**
- **OS**: Ubuntu 20.04+ LTS
- **Node.js**: v18+ (via nvm or apt)
- **PM2**: Process manager (cluster mode)
- **Apache2**: Reverse proxy + SSL
- **PostgreSQL**: Database server
- **Redis**: Session and cache store

---

**Last Updated**: 2025-10-26  
**Document Version**: 1.0
