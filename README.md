# APS Dashboard - Content Management System

![APS Logo](./logo/watermark.png)

## 📋 Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Folder Structure](#folder-structure)
- [API Documentation](#api-documentation)
- [User Roles & Workflow](#user-roles--workflow)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

---

## 🌟 Introduction

**APS Dashboard** is a comprehensive Content Management System (CMS) designed for the **Algerian Press Service (APS)**. It provides a robust editorial platform for managing news articles, multimedia content, and publications with a sophisticated role-based access control system.

### Mission

To deliver a secure, scalable, and user-friendly platform that enables efficient news content creation, editorial workflow management, and multi-channel content distribution for the Algerian Press Service.

---

## ✨ Features

### Content Management
- **Article Management**: Full CRUD operations with rich text editing
- **Multimedia Support**: Images, videos, infographics, and photo galleries
- **Category & Tag System**: Hierarchical categorization with tags
- **Dossiers**: Thematic article collections
- **Multi-language Support**: Article translation management
- **Archive System**: Historical content preservation

### Editorial Workflow
- **Draft → Validation → Publication** pipeline
- **Article Locking**: Prevents concurrent editing conflicts
- **Scheduled Publishing**: Program articles for future publication
- **Article Pinning**: Feature important articles in specific blocks
- **Version Control**: Track modifications and editorial history

### User Management & Security
- **Role-Based Access Control (RBAC)**: 5-tier role hierarchy
- **Two-Factor Authentication (2FA)**: OTP-based email verification
- **Session Management**: Redis-backed session store
- **User Activity Logging**: Comprehensive audit trails
- **Security Middleware**: Rate limiting, forbidden words filtering, helmet security headers

### Homepage Layout Management
- **Dynamic Blocks**: Configurable content blocks (7 positions)
- **Banner Management**: Multiple banner positions (homepage, categories, mega menu)
- **Emergency Band**: Breaking news alert system
- **Category-Specific Blocks**: Dedicated sections for different news categories

### Analytics & Reporting
- **View Tracking**: Article, video, gallery, banner view counts
- **Dashboard Statistics**: Real-time content metrics
- **Activity Logs**: Detailed action logging with Winston

### Additional Features
- **Subscriber Management**: Newsletter and notification subscribers
- **Forbidden Words Filter**: Content moderation
- **Image Processing**: Watermarking, resizing with Sharp
- **Cache Layer**: Redis caching for improved performance

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
└────────┬────────┘
         │ HTTPS
         ↓
┌─────────────────┐
│ Apache Reverse  │
│    Proxy        │
└────────┬────────┘
         │
         ↓
┌─────────────────┐      ┌──────────────┐
│  Express.js     │◄────►│    Redis     │
│  Backend API    │      │   (Sessions) │
└────────┬────────┘      └──────────────┘
         │
         ↓
┌─────────────────┐
│   PostgreSQL    │
│   (Prisma ORM)  │
└─────────────────┘
```

### Architecture Components

1. **Backend API (Node.js + Express)**
   - RESTful API endpoints
   - Session-based authentication
   - Middleware pipeline (security, validation, logging)

2. **Database (PostgreSQL)**
   - Master-slave replication (production)
   - Prisma ORM for database operations
   - Complex relationships and indexes

3. **Cache & Session Store (Redis)**
   - Session persistence
   - Optional caching layer

4. **File Storage**
   - Image uploads with watermarking
   - Multiple image versions (thumbnail, medium, full)

5. **Email Service**
   - OTP delivery
   - Account alerts
   - SMTP via Nodemailer

For detailed architecture documentation, see [docs/architecture.md](./docs/architecture.md).

---

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js v5
- **Database ORM**: Prisma v6
- **Database**: PostgreSQL 14+
- **Session Store**: Redis v5
- **Authentication**: Express-session + OTP

### Security
- **Helmet**: HTTP security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Express-rate-limit
- **Password Hashing**: bcryptjs
- **Input Validation**: Joi

### File Processing
- **Image Processing**: Sharp
- **File Upload**: Multer v2

### Logging & Monitoring
- **Winston**: Application logging
- **Morgan**: HTTP request logging
- **Winston-daily-rotate-file**: Log rotation

### Utilities
- **Compression**: Response compression
- **Dotenv**: Environment configuration
- **UUID**: Unique identifier generation
- **Nodemailer**: Email sending

### Development Tools
- **Nodemon**: Auto-restart during development
- **Prisma Studio**: Database GUI

---

## 📦 Prerequisites

Before installation, ensure you have:

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **PostgreSQL** >= 14.0
- **Redis** >= 5.0
- **Git**

### System Requirements

- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: 10GB+ for application and media files
- **OS**: Linux (Ubuntu 20.04+), macOS, or Windows with WSL

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd aps-dashboard
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Database

Create a PostgreSQL database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE aps_dashboard;
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see [Configuration](#configuration) section).

### 5. Run Database Migrations

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# (Optional) Seed database
npx prisma db seed
```

### 6. Start Redis

```bash
# Ubuntu/Debian
sudo systemctl start redis-server

# macOS (Homebrew)
brew services start redis

# Or run manually
redis-server
```

### 7. Start the Application

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

The server will start on `http://localhost:5000` (or your configured PORT).

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Application
NODE_ENV=development
PORT=5000
PROJECT_NAME="APS Dashboard"
PROJECT_LANG="ar"

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/aps_dashboard?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Session
SESSION_SECRET=your-super-secret-session-key-change-this
SESSION_NAME=aps_session
SESSION_TIME=120  # Minutes

# Email (SMTP)
ADMIN_MAIL=noreply@aps.dz
ADMIN_MAIL_PASSWORD=your-email-password
RECEPTION_MAIL=admin@aps.dz

# Security
ALLOWED_ORIGINS=http://localhost:5173,https://dashboard.aps.dz
```

### Configuration Notes

- **SESSION_SECRET**: Use a strong, random string (32+ characters)
- **DATABASE_URL**: Update with your PostgreSQL credentials
- **SESSION_TIME**: Session expiration time in minutes
- **PROJECT_LANG**: Default language code (e.g., 'ar', 'fr', 'en')

---

## 📁 Folder Structure

```
aps-dashboard/
├── docs/                       # Documentation
│   ├── architecture.md
│   ├── api.md
│   ├── workflow.md
│   ├── permissions.md
│   ├── database-schema.md
│   ├── deployment.md
│   └── security.md
├── logo/                       # Project assets
│   └── watermark.png
├── prisma/                     # Database schema & migrations
│   └── schema.prisma
├── src/
│   ├── configs/               # Configuration files
│   │   ├── database.js        # Prisma client instance
│   │   ├── cache.js           # Redis cache configuration
│   │   └── redisSessionStore.js # Redis session store
│   ├── controllers/           # Request handlers
│   │   ├── authController.js
│   │   ├── articleController.js
│   │   ├── userController.js
│   │   └── ...
│   ├── services/              # Business logic layer
│   │   ├── authService.js
│   │   ├── articleService.js
│   │   ├── userService.js
│   │   └── ...
│   ├── middlewares/           # Express middleware
│   │   ├── authMiddleware.js  # Authentication & authorization
│   │   ├── errorMiddleware.js # Global error handling
│   │   ├── rateLimitMiddleware.js # Rate limiting
│   │   ├── securityMiddleware.js # Security checks
│   │   ├── forbiddenWordsMiddleware.js # Content filtering
│   │   └── uploadMiddleware.js # File upload handling
│   ├── routes/                # API route definitions
│   │   ├── auth.js
│   │   ├── article.js
│   │   ├── user.js
│   │   └── ...
│   ├── validations/           # Joi validation schemas
│   │   ├── authValidation.js
│   │   ├── articleValidation.js
│   │   └── ...
│   ├── helpers/               # Helper functions
│   │   ├── authHelper.js      # OTP generation, email
│   │   ├── imageHelper.js     # Image processing
│   │   ├── forbiddenWordsHelper.js # Content moderation
│   │   └── analyticsHelper.js # Analytics utilities
│   └── utils/                 # Utility functions
│       ├── logger.js          # Winston logger setup
│       ├── createAlias.js     # URL-friendly alias generation
│       ├── rolesHierarchy.js  # RBAC role hierarchy
│       ├── enum.js            # Enums & constants
│       ├── tryCatch.js        # Async error wrapper
│       └── blockMessage.js    # User blocking messages
├── index.js                   # Application entry point
├── package.json               # Dependencies & scripts
└── .env                       # Environment configuration (not in repo)
```

---

## 📡 API Documentation

### Base URL

```
http://localhost:5000/api/v1
```

### Authentication

All protected endpoints require session authentication:

1. POST `/api/v1/auth/login` - Get OTP
2. POST `/api/v1/auth/verify-otp` - Verify OTP and login
3. Session cookie is set - Use for subsequent requests

### Key Endpoints

#### Authentication
- `POST /auth/login` - User login (sends OTP)
- `POST /auth/verify-otp` - Verify OTP and create session
- `POST /auth/resend-otp` - Resend OTP
- `POST /auth/close-session` - Close active session
- `POST /auth/logout` - User logout

#### Articles
- `POST /articles/get-all` - Get articles with filters & pagination
- `POST /articles/get-one` - Get single article by ID
- `POST /articles/create` - Create new article
- `PUT /articles/update` - Update article
- `PUT /articles/publish` - Publish article
- `PUT /articles/unpublish` - Unpublish article
- `PUT /articles/pin` - Pin/unpin article to block
- `PUT /articles/lock` - Lock/unlock article for editing
- `POST /articles/search` - Search articles

#### Users
- `POST /users/get-all` - Get all users
- `POST /users/create` - Create new user
- `PUT /users/update` - Update user
- `PUT /users/reset-password` - Reset user password
- `PUT /users/block` - Block user
- `PUT /users/unblock` - Unblock user
- `PUT /users/activate` - Activate/deactivate user
- `PUT /users/add-role` - Add role to user
- `PUT /users/remove-role` - Remove role from user

#### Categories
- `POST /categories/get-all` - Get all categories
- `POST /categories/create` - Create category
- `PUT /categories/update` - Update category
- `PUT /categories/change-state` - Enable/disable category

#### Images, Videos, Galleries, Banners, Dossiers, etc.
- Similar CRUD patterns for all content types

For complete API documentation with request/response examples, see [docs/api.md](./docs/api.md).

---

## 👥 User Roles & Workflow

### Role Hierarchy (Level 1-5)

1. **Level 1** - Content Creators
   - **Rédacteur** (Writer): Creates and edits articles
   - **Infographe** (Infographer): Creates infographics
   - **Vidéaste** (Videographer): Creates videos
   - **Photographe** (Photographer): Manages photo galleries

2. **Level 2** - Section Manager
   - **Chef de vacation** (Shift Manager): Validates articles, manages daily operations

3. **Level 3** - Editorial Leaders
   - **Rédacteur en chef** (Editor-in-Chief): Publishes articles, manages editorial line
   - **Superviseur** (Supervisor): Oversees operations

4. **Level 4** - System Administrator
   - **Admin**: Manages users, roles, system configuration

5. **Level 5** - Super Administrator
   - **SuperUser**: Full system access, can manage admins

### Article Editorial Workflow

```mermaid
graph LR
    A[Draft] -->|Created by Rédacteur| B[Awaiting Validation]
    B -->|Validated by Chef de vacation| C[Validated]
    C -->|Published by Rédacteur en chef| D[Published]
    D -->|Can be Unpublished| C
    C -->|Can be sent to Trash| E[Trash]
    D -->|Can be sent to Trash| E
```

**Workflow Steps:**

1. **Draft**: Rédacteur creates article
2. **Validation**: Chef de vacation reviews and validates
3. **Publication**: Rédacteur en chef publishes to website
4. **Modification**: Can be edited (with locking mechanism)
5. **Unpublish**: Can be unpublished or sent to trash

For detailed workflow documentation, see [docs/workflow.md](./docs/workflow.md).

---

## 💻 Development

### Running in Development Mode

```bash
npm run dev
```

This uses `nodemon` for auto-restart on file changes.

### Database Management

```bash
# Open Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma Client after schema changes
npx prisma generate

# Create and apply migrations
npx prisma migrate dev --name migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Logging

Logs are stored in:
- Application logs: Console + rotating files
- HTTP logs: Morgan middleware
- Action logs: Stored in database (`aps2024_logs` table)

### Code Style

- Use ES6+ modules
- Follow async/await pattern
- Comprehensive error handling with try-catch
- Input validation with Joi schemas

---

## 🚀 Production Deployment

### Prerequisites

- Ubuntu 20.04+ server
- Node.js v18+ installed
- PostgreSQL and Redis installed
- Apache2 or Nginx as reverse proxy
- PM2 for process management
- SSL certificate (Let's Encrypt recommended)

### Deployment Steps

1. **Clone and Install**

```bash
cd /var/www
git clone <repository-url> aps-dashboard
cd aps-dashboard
npm install --production
```

2. **Configure Environment**

```bash
# Create production .env file
nano .env

# Set NODE_ENV=production
# Configure production database URL
# Set secure SESSION_SECRET
```

3. **Set Up Database**

```bash
npx prisma generate
npx prisma migrate deploy
```

4. **Install PM2**

```bash
sudo npm install -g pm2
```

5. **Start Application with PM2**

```bash
pm2 start index.js --name aps-dashboard
pm2 save
pm2 startup
```

6. **Configure Apache Reverse Proxy**

```apache
<VirtualHost *:443>
    ServerName dashboard.aps.dz
    
    SSLEngine on
    SSLCertificateFile /path/to/cert.crt
    SSLCertificateKeyFile /path/to/private.key
    
    ProxyPreserveHost On
    ProxyPass / http://localhost:5000/
    ProxyPassReverse / http://localhost:5000/
    
    <Location />
        Order allow,deny
        Allow from all
    </Location>
</VirtualHost>
```

7. **Enable and Restart Apache**

```bash
sudo a2enmod proxy proxy_http ssl
sudo systemctl restart apache2
```

For complete deployment documentation, see [docs/deployment.md](./docs/deployment.md).

---

## 🔒 Security

### Security Features

- **Two-Factor Authentication (2FA)**: OTP-based email verification
- **Password Security**: bcryptjs hashing with salt rounds
- **Session Security**: Secure, httpOnly cookies with Redis storage
- **Rate Limiting**: Prevents brute-force attacks
- **Helmet Security Headers**: XSS, clickjacking protection
- **CORS Configuration**: Whitelist allowed origins
- **Input Validation**: Joi schema validation on all endpoints
- **SQL Injection Prevention**: Prisma ORM parameterized queries
- **Content Security**: Forbidden words filtering
- **Audit Logging**: Comprehensive action logging
- **Account Protection**: Auto-block after failed login attempts
- **IP Blocking**: Manual and automatic IP blocking capability

### Security Best Practices

1. **Never commit `.env` file to version control**
2. **Use strong SESSION_SECRET** (32+ random characters)
3. **Enable rate limiting** in production
4. **Regular security updates**: `npm audit` and update dependencies
5. **Monitor logs** for suspicious activity
6. **Database backups**: Regular automated backups
7. **SSL/TLS**: Always use HTTPS in production

For complete security documentation, see [docs/security.md](./docs/security.md).

---

## 🤝 Contributing

### Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes with clear, descriptive commits
3. Write/update tests if applicable
4. Update documentation
5. Submit a pull request

### Code Review Checklist

- [ ] Code follows project structure
- [ ] All functions have JSDoc documentation
- [ ] Input validation added for new endpoints
- [ ] Error handling implemented
- [ ] Logging added for important actions
- [ ] No sensitive data in logs or responses
- [ ] Database queries optimized
- [ ] API endpoints documented

---

## 📄 License

[Specify License Here - e.g., MIT, Proprietary, etc.]

---

## 📞 Support

For issues, questions, or contributions:

- **Email**: support@aps.dz
- **Documentation**: [docs/](./docs/)
- **Issue Tracker**: [GitHub Issues]

---

## 📚 Additional Documentation

- [Architecture Overview](./docs/architecture.md)
- [Complete API Reference](./docs/api.md)
- [Editorial Workflow](./docs/workflow.md)
- [RBAC & Permissions](./docs/permissions.md)
- [Database Schema](./docs/database-schema.md)
- [Deployment Guide](./docs/deployment.md)
- [Security Documentation](./docs/security.md)

---

**Built with ❤️ for Algerian Press Service (APS)**
