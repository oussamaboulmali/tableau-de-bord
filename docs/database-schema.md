# Database Schema Documentation

## Table of Contents

- [Overview](#overview)
- [Database Design Principles](#database-design-principles)
- [Core Entity Groups](#core-entity-groups)
- [Detailed Schema](#detailed-schema)
- [Relationships](#relationships)
- [Indexes](#indexes)
- [Constraints](#constraints)
- [ERD Diagrams](#erd-diagrams)

---

## Overview

The APS Dashboard uses **PostgreSQL 14+** as its primary database, with **Prisma ORM** for type-safe database access. The schema is designed to support a comprehensive content management system with role-based access control, editorial workflow, and multi-media content types.

### Database Statistics

- **Total Tables**: 40+
- **Primary Content Tables**: 15
- **Junction Tables**: 8
- **System Tables**: 10
- **Total Relationships**: 60+

### Technology

- **Database**: PostgreSQL 14+
- **ORM**: Prisma v6
- **Migration Tool**: Prisma Migrate
- **Schema Definition**: `prisma/schema.prisma`

---

## Database Design Principles

### 1. Normalization
- **3NF Compliance**: Tables are normalized to Third Normal Form
- **Reduced Redundancy**: Minimal data duplication
- **Referential Integrity**: Foreign keys maintain data consistency

### 2. Audit Trail
Every content table includes:
- `created_by`: Username of creator
- `created_date`: Creation timestamp
- `modified_by`: Username of last modifier
- `modified_date`: Last modification timestamp

### 3. Soft Deletes
- Articles use `is_trash` flag instead of hard delete
- Allows recovery of accidentally deleted content
- Archive table for historical data

### 4. Performance Optimization
- Strategic indexes on frequently queried columns
- Composite indexes for multi-column queries
- Timestamp indexes for date-based queries

### 5. Flexibility
- JSON fields for extensible data (tags)
- Boolean flags for state management
- Optional relationships for flexibility

---

## Core Entity Groups

### 1. Authentication & Authorization
- `aps2024_users` - User accounts
- `aps2024_sessions` - Active sessions
- `aps2024_roles` - Role definitions
- `aps2024_privileges` - Permission definitions
- `aps2024_user_role` - User-role assignments
- `aps2024_roles_privileges` - Role-permission mappings

### 2. Content Management
- `aps2024_articles` - Main content (news articles)
- `aps2024_videos` - Video content
- `aps2024_infographies` - Infographic content
- `aps2024_cahiers_aps` - Cahier publications
- `aps2024_dossiers` - Thematic content collections
- `aps2024_emergency_bands` - Breaking news alerts

### 3. Media Management
- `aps2024_images` - Image assets
- `aps2024_gallery` - Article galleries
- `aps2024_home_gallery` - Homepage galleries
- `aps2024_gallery_image` - Gallery-image relations
- `aps2024_index` - Image indexing/tagging
- `aps2024_image_index` - Image-index relations

### 4. Organization
- `aps2024_categories` - Content categories
- `aps2024_subCategories` - Subcategories
- `aps2024_tag` - Content tags
- `aps2024_article_tag` - Article-tag relations
- `aps2024_article_dossier` - Article-dossier relations

### 5. Homepage Management
- `aps2024_blocks` - Content block definitions
- `aps2024_block_position` - Block positions
- `aps2024_block_position_actualites` - Category-specific blocks
- `aps2024_banners` - Banner advertisements
- `aps2024_banner_categories` - Banner placements

### 6. System & Configuration
- `aps2024_configuration` - System settings
- `aps2024_languages` - Supported languages
- `aps2024_article_translated` - Translation links
- `aps2024_defaultCategorie` - Default category setting
- `aps2024_forbiddenword` - Content moderation
- `aps2024_subscriber` - Newsletter subscribers
- `aps2024_archive` - Historical articles

---

## Detailed Schema

### aps2024_users

User accounts table with authentication and profile information.

```prisma
model aps2024_users {
  id_user               Int       @id @default(autoincrement())
  username              String    @unique @db.VarChar(30)
  email                 String    @unique @db.VarChar(30)
  password              String    @db.VarChar(60)  // bcrypt hash
  
  // Profile
  first_name            String?
  last_name             String?
  birth_day             DateTime? @db.Date
  phone_number          String?
  post                  String?  // Job title
  
  // Account state
  state                 Int       @default(1) @db.SmallInt  // 0=inactive, 1=active, 2=blocked
  register_date         DateTime  @default(now()) @db.Timestamptz(3)
  lastvisit_date        DateTime? @db.Timestamptz(3)
  
  // Account management
  blocked_date          DateTime? @db.Timestamptz(3)
  desactivate_date      DateTime? @db.Timestamptz(3)
  unblocked_date        DateTime? @db.Timestamptz(3)
  activate_date         DateTime? @db.Timestamptz(3)
  modified_date         DateTime? @db.Timestamptz(3)
  
  // Audit fields
  register_by           String
  deactivated_by        String?
  modified_by           String?
  unblocked_by          String?
  activate_by           String?
  
  // Security
  otpkey                Int?      // OTP for 2FA
  otpTime               DateTime? @db.Timestamptz(3)
  login_attempts        Int       @default(0)
  block_code            Int?      // Reason for blocking
  
  // Relations
  aps2024_user_role     aps2024_user_role[]
  aps2024_sessions      aps2024_sessions[]
  aps2024_articles      aps2024_articles[]
  // ... other relations
}
```

**Key Points:**
- `username` and `email` must be unique
- `password` stores bcrypt hash (60 chars)
- `state`: 0=inactive, 1=active, 2=blocked
- `otpkey` for two-factor authentication
- `login_attempts` for brute-force protection

---

### aps2024_articles

Main content table for news articles.

```prisma
model aps2024_articles {
  id_article            BigInt    @id @default(autoincrement())
  
  // Content
  title                 String
  alias                 String    @unique  // URL-friendly slug
  supTitle              String?   // Surtitle
  introtext             String    // Summary/lead
  fulltext              String?   // Full article content
  lien_vedio            String?   // Optional video URL
  
  // Categorization
  id_categorie          Int
  id_subCategorie       Int?
  id_block              Int?      // Homepage block
  
  // Media
  id_image              BigInt?   // Main image
  id_gallery            BigInt?   // Photo gallery
  
  // Workflow state
  is_publish            Boolean   @default(false)
  is_validated          Boolean   @default(false)
  is_programmed         Boolean   @default(false)
  is_pinned             Boolean   @default(false)
  is_protected          Boolean   @default(false)
  is_trash              Boolean   @default(false)
  is_locked             Boolean   @default(false)
  is_souverainete       Boolean   @default(false)
  
  // Timestamps
  created_date          DateTime  @default(now()) @db.Timestamptz(3)
  modified_date         DateTime? @db.Timestamptz(3)
  validate_date         DateTime? @db.Timestamptz(3)
  publish_date          DateTime? @db.Timestamptz(3)
  publish_down          DateTime? @db.Timestamptz(3)
  locked_date           DateTime? @db.Timestamptz(3)
  
  // Audit
  created_by            String
  modified_by           String?
  publish_by            String?
  unpublish_by          String?
  trash_by              String?
  locked_by             String?
  
  // Ownership
  id_user               Int
  id_session            BigInt
  
  // Analytics
  views                 Int       @default(0)
  
  // Relations
  aps2024_categories    aps2024_categories  @relation(...)
  aps2024_subCategories aps2024_subCategories? @relation(...)
  aps2024_images        aps2024_images? @relation(...)
  aps2024_gallery       aps2024_gallery? @relation(...)
  aps2024_users         aps2024_users @relation(...)
  aps2024_blocks        aps2024_blocks? @relation(...)
  aps2024_article_tag   aps2024_article_tag[]
  aps2024_article_dossier aps2024_article_dossier[]
  
  // Indexes
  @@index([is_publish, publish_date(sort: Desc)])
  @@index([id_categorie, id_subCategorie, is_publish, is_pinned, publish_date(sort: Desc)])
  @@index([is_publish, id_block, publish_date(sort: Desc)])
  @@index([id_block, is_pinned, is_publish])
}
```

**Key Points:**
- `alias` must be unique (URL slug)
- Multiple boolean flags for article state
- `publish_date` can be future for scheduled publishing
- `publish_down` for auto-unpublish
- `views` counter for analytics
- Complex indexes for query optimization

---

### aps2024_categories & aps2024_subCategories

Hierarchical content categorization.

```prisma
model aps2024_categories {
  id_categorie          Int       @id @default(autoincrement())
  name                  String    @unique
  alias                 String    @unique
  state                 Boolean   @default(false)  // active/inactive
  
  // Audit
  id_session            BigInt
  id_user               Int
  created_by            String
  created_date          DateTime  @default(now()) @db.Timestamptz(3)
  modified_by           String?
  modified_date         DateTime? @db.Timestamptz(3)
  change_state_by       String?
  change_state_date     DateTime? @db.Timestamptz(3)
  
  // Relations
  aps2024_articles      aps2024_articles[]
  aps2024_subCategories aps2024_subCategories[]
  aps2024_users         aps2024_users @relation(...)
  
  @@index([state])
}

model aps2024_subCategories {
  id_subCategorie       Int       @id @default(autoincrement())
  id_categorie          Int       // Parent category
  name                  String    @unique
  alias                 String    @unique
  state                 Boolean   @default(false)
  
  // Similar audit fields...
  
  // Relations
  aps2024_categories    aps2024_categories @relation(...)
  aps2024_articles      aps2024_articles[]
  
  @@index([state, id_categorie])
}
```

**Category Examples:**
- Politique, Économie, Sport, Culture, International, etc.

**Subcategory Examples:**
- Économie → Finance, Commerce, Industrie
- Sport → Football, Basketball, Athlétisme

---

### aps2024_images

Image asset management with metadata.

```prisma
model aps2024_images {
  id_image              BigInt    @id @default(autoincrement())
  name                  String
  url                   String    // File path
  description           String
  credit                String?   // Photo credit
  source                Int       // Image source type
  
  // Ownership
  id_user               Int
  id_session            BigInt
  created_by            String
  created_date          DateTime  @default(now()) @db.Timestamptz(3)
  modified_by           String?
  modified_date         DateTime? @db.Timestamptz(3)
  
  // Gallery relationships (optional)
  id_home_gallery       BigInt?
  id_cahier             BigInt?
  
  // Relations
  aps2024_users         aps2024_users @relation(...)
  aps2024_articles      aps2024_articles[]  // Articles using this image
  aps2024_banners       aps2024_banners[]
  aps2024_dossiers      aps2024_dossiers[]
  aps2024_home_gallery  aps2024_home_gallery? @relation(...)
  aps2024_gallery_image aps2024_gallery_image[]
  
  @@unique([id_home_gallery, id_image])
}
```

**Image Processing:**
- Original uploaded image
- Watermarked version (if enabled)
- Multiple sizes generated (thumbnail, medium, full)
- Stored in filesystem, metadata in database

---

### aps2024_blocks & aps2024_block_position

Homepage layout management.

```prisma
model aps2024_blocks {
  id_block              Int       @id @default(autoincrement())
  name                  String    // "Block 1", "Block 2", etc.
  max_positions         Int       // Number of positions (3-4)
  
  // Relations
  aps2024_articles      aps2024_articles[]
  aps2024_block_position aps2024_block_position[]
}

model aps2024_block_position {
  id_blocPosition       Int       @id @default(autoincrement())
  id_block              Int
  position              Int       // 1, 2, 3, 4...
  id_article            BigInt?   @unique  // Pinned article
  
  // Relations
  aps2024_blocks        aps2024_blocks @relation(...)
  aps2024_articles      aps2024_articles? @relation(...)
  
  @@unique([id_block, position])
  @@index([id_block, position])
}
```

**Homepage Layout:**
- Homepage divided into content blocks
- Each block has multiple positions
- Editors pin articles to specific positions
- Ensures consistent, curated homepage layout

---

### aps2024_roles & aps2024_privileges

Role-Based Access Control (RBAC) schema.

```prisma
model aps2024_roles {
  id_role               Int       @id @default(autoincrement())
  name                  String    @unique @db.VarChar(30)
  description           String?
  unchangeable          Boolean   @default(false)  // System roles
  
  // Audit
  created_by            String
  created_date          DateTime  @default(now()) @db.Timestamptz(3)
  modified_by           String?
  modified_date         DateTime? @db.Timestamptz(3)
  
  // Relations
  aps2024_roles_privileges aps2024_roles_privileges[]
  aps2024_user_role     aps2024_user_role[]
}

model aps2024_privileges {
  id_privileges         Int       @id @default(autoincrement())
  name                  String    @unique @db.VarChar(30)
  description           String?
  
  // Relations
  aps2024_roles_privileges aps2024_roles_privileges[]
}

model aps2024_roles_privileges {
  id_role               Int
  id_privileges         Int
  
  aps2024_roles         aps2024_roles @relation(...)
  aps2024_privileges    aps2024_privileges @relation(...)
  
  @@id([id_privileges, id_role])
}

model aps2024_user_role {
  id_user               Int
  id_role               Int
  assigned_date         DateTime  @default(now()) @db.Timestamptz(3)
  assigned_by           String
  isInterim             Boolean   @default(false)  // Temporary role
  endDate               DateTime? @db.Timestamptz(3)
  
  aps2024_users         aps2024_users @relation(...)
  aps2024_roles         aps2024_roles @relation(...)
  
  @@id([id_user, id_role])
}
```

**RBAC Flow:**
```
User → User_Role → Role → Roles_Privileges → Privilege
```

---

## Relationships

### One-to-Many Relationships

```
User → Articles (one user creates many articles)
User → Sessions (one user has many sessions)
Category → Articles (one category contains many articles)
Category → SubCategories (one category has many subcategories)
Gallery → Gallery_Images (one gallery contains many images)
```

### Many-to-Many Relationships

```
Article ←→ Tag (via article_tag)
Article ←→ Dossier (via article_dossier)
Role ←→ Privilege (via roles_privileges)
User ←→ Role (via user_role)
Banner ←→ Category (via banner_categories)
```

### Optional Relationships

```
Article → Image (optional main image)
Article → Gallery (optional photo gallery)
Article → SubCategory (optional subcategory)
Article → Block (optional block pinning)
```

---

## Indexes

### Performance-Critical Indexes

```sql
-- Article queries
CREATE INDEX idx_articles_publish_date 
  ON aps2024_articles (is_publish, publish_date DESC);

CREATE INDEX idx_articles_category_publish 
  ON aps2024_articles (id_categorie, id_subCategorie, is_publish, is_pinned, publish_date DESC);

CREATE INDEX idx_articles_block 
  ON aps2024_articles (is_publish, id_block, publish_date DESC);

-- Category state
CREATE INDEX idx_categories_state 
  ON aps2024_categories (state);

CREATE INDEX idx_subcategories_state_category 
  ON aps2024_subCategories (state, id_categorie);

-- Block positions
CREATE INDEX idx_block_position 
  ON aps2024_block_position (id_block, position);

-- Sessions (for quick lookups)
CREATE INDEX idx_sessions_active 
  ON aps2024_sessions (id_session, id_user, is_active);

-- Homepage galleries
CREATE INDEX idx_home_gallery_publish 
  ON aps2024_home_gallery (is_publish, position);

-- Videos
CREATE INDEX idx_videos_main 
  ON aps2024_videos (is_publish, is_main, position);
```

---

## Constraints

### Unique Constraints

- `username` - Must be unique across all users
- `email` - Must be unique across all users
- `alias` - Must be unique for articles, categories, tags, etc.
- `[id_block, position]` - Each position in a block is unique
- `id_article` in `block_position` - Article can only be pinned once

### Foreign Key Constraints

All foreign keys enforce referential integrity:
- `ON DELETE Cascade` - For junction tables (article_tag, article_dossier)
- `ON DELETE Restrict` - For critical references (article → image)
- `ON DELETE NoAction` - For audit references (article → user)

### Check Constraints (Application Level)

- `state` in users: 0, 1, or 2
- `password` length: minimum 60 characters (bcrypt hash)
- `publish_date` can be NULL or future date
- `publish_down` must be after `publish_date` if both set

---

## ERD Diagrams

### Core Content ERD

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │ creates
       ▼
┌─────────────┐      ┌──────────────┐
│   Article   │─────▶│   Category   │
└──────┬──────┘      └──────────────┘
       │
       ├──────▶ Image (main)
       ├──────▶ Gallery
       ├──────▶ SubCategory
       ├──────▶ Block
       │
       │ many-to-many
       ├──────▶ Tag
       └──────▶ Dossier
```

### RBAC ERD

```
┌──────────────┐
│     User     │
└──────┬───────┘
       │
       │ many-to-many
       ▼
┌──────────────┐      ┌───────────────┐
│  User_Role   │─────▶│     Role      │
└──────────────┘      └───────┬───────┘
                              │
                              │ many-to-many
                              ▼
                     ┌──────────────────┐      ┌──────────────┐
                     │ Roles_Privileges │─────▶│  Privilege   │
                     └──────────────────┘      └──────────────┘
```

### Homepage Layout ERD

```
┌──────────────┐
│    Block     │
└──────┬───────┘
       │ has many
       ▼
┌─────────────────┐
│ Block_Position  │
└──────┬──────────┘
       │ references
       ▼
┌─────────────────┐
│    Article      │
└─────────────────┘
```

---

## Database Migrations

### Using Prisma Migrate

```bash
# Create new migration
npx prisma migrate dev --name add_new_field

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

### Migration Best Practices

1. **Always backup** before running migrations in production
2. **Test migrations** in staging environment first
3. **Review SQL** generated by Prisma
4. **Use transactions** for complex migrations
5. **Document breaking changes** in migration comments

---

## Database Maintenance

### Regular Maintenance Tasks

```sql
-- Analyze tables for query optimization
ANALYZE aps2024_articles;

-- Vacuum to reclaim storage
VACUUM ANALYZE aps2024_articles;

-- Reindex for performance
REINDEX TABLE aps2024_articles;

-- Check database size
SELECT pg_size_pretty(pg_database_size('aps_dashboard'));

-- Check largest tables
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

### Backup Strategy

```bash
# Full database backup
pg_dump -U postgres aps_dashboard > backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -U postgres aps_dashboard | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore from backup
psql -U postgres aps_dashboard < backup_20251026.sql
```

---

## Query Examples

### Get Published Articles with Category

```sql
SELECT 
  a.id_article,
  a.title,
  a.alias,
  a.publish_date,
  c.name as category_name,
  sc.name as subcategory_name,
  u.username as author
FROM aps2024_articles a
INNER JOIN aps2024_categories c ON a.id_categorie = c.id_categorie
LEFT JOIN aps2024_subCategories sc ON a.id_subCategorie = sc.id_subCategorie
INNER JOIN aps2024_users u ON a.id_user = u.id_user
WHERE a.is_publish = true 
  AND a.is_trash = false
ORDER BY a.publish_date DESC
LIMIT 10;
```

### Get User with Roles and Privileges

```sql
SELECT 
  u.id_user,
  u.username,
  array_agg(DISTINCT r.name) as roles,
  array_agg(DISTINCT p.name) as privileges
FROM aps2024_users u
INNER JOIN aps2024_user_role ur ON u.id_user = ur.id_user
INNER JOIN aps2024_roles r ON ur.id_role = r.id_role
INNER JOIN aps2024_roles_privileges rp ON r.id_role = rp.id_role
INNER JOIN aps2024_privileges p ON rp.id_privileges = p.id_privileges
WHERE u.username = 'john.doe'
GROUP BY u.id_user, u.username;
```

### Get Homepage Block Layout

```sql
SELECT 
  b.name as block_name,
  bp.position,
  a.title as article_title,
  a.publish_date
FROM aps2024_blocks b
INNER JOIN aps2024_block_position bp ON b.id_block = bp.id_block
LEFT JOIN aps2024_articles a ON bp.id_article = a.id_article
WHERE a.is_publish = true
ORDER BY b.id_block, bp.position;
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-26  
**Schema Version**: See `prisma/migrations` directory
