# Security Documentation

## Table of Contents

- [Overview](#overview)
- [Security Architecture](#security-architecture)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Input Validation](#input-validation)
- [Data Security](#data-security)
- [Session Management](#session-management)
- [API Security](#api-security)
- [Content Security](#content-security)
- [Infrastructure Security](#infrastructure-security)
- [Monitoring & Logging](#monitoring--logging)
- [Incident Response](#incident-response)
- [Security Best Practices](#security-best-practices)

---

## Overview

The APS Dashboard implements a **defense-in-depth security strategy** with multiple layers of protection. This document outlines all security measures implemented in the system.

### Security Principles

1. **Defense in Depth**: Multiple security layers
2. **Least Privilege**: Minimum necessary access
3. **Fail Secure**: Secure defaults
4. **Complete Mediation**: Check every access
5. **Separation of Duties**: Role-based access
6. **Audit Logging**: Comprehensive activity tracking

---

## Security Architecture

### Multi-Layered Security

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Network Security                              │
│  • Firewall (UFW)                                       │
│  • Fail2Ban (brute-force protection)                    │
│  • Rate limiting                                        │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Layer 2: Transport Security                            │
│  • HTTPS/TLS 1.2+                                       │
│  • SSL certificates (Let's Encrypt)                     │
│  • HSTS headers                                         │
│  • Secure cookie attributes                             │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Layer 3: Application Security                          │
│  • Helmet middleware (security headers)                 │
│  • CORS policy                                          │
│  • Method restrictions                                  │
│  • Request size limits                                  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Layer 4: Authentication                                │
│  • Two-Factor Authentication (OTP)                      │
│  • Password hashing (bcryptjs)                          │
│  • Session management                                   │
│  • Failed login tracking                                │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Layer 5: Authorization                                 │
│  • Role-Based Access Control (RBAC)                     │
│  • Privilege checking                                   │
│  • Resource ownership validation                        │
│  • Hierarchical permissions                             │
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
│  Layer 8: Monitoring & Audit                            │
│  • Comprehensive logging                                │
│  • Security event tracking                              │
│  • Failed authentication monitoring                     │
│  • Anomaly detection                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Authentication

### Two-Factor Authentication (2FA)

**Implementation**: OTP (One-Time Password) via email

**Flow:**
```
1. User enters username/password
   ↓
2. Credentials validated
   ↓
3. Generate 6-digit OTP
   ↓
4. Send OTP to user's email
   ↓
5. User enters OTP
   ↓
6. OTP validated (10-minute expiry)
   ↓
7. Session created
```

**Security Features:**
- OTP expires after 10 minutes
- OTP is single-use
- Failed OTP attempts tracked
- Rate limiting on OTP requests

**Code Implementation:**

```javascript
// authHelper.js
export const generateOTP = () => {
  const otpKey = Math.floor(100000 + Math.random() * 900000);
  const otpExpirationTime = new Date();
  otpExpirationTime.setMinutes(otpExpirationTime.getMinutes() + 10);
  
  return { otpKey, otpExpirationTime };
};
```

### Password Security

**Hashing**: bcryptjs with salt rounds

**Requirements:**
- Minimum 8 characters
- Must include uppercase letter
- Must include lowercase letter
- Must include number
- Special characters recommended

**Storage:**
```javascript
import bcrypt from 'bcryptjs';

// Hash password
const hashedPassword = await bcrypt.hash(password, 10);

// Verify password
const isValid = await bcrypt.compare(password, hashedPassword);
```

**Password Reset:**
- Admin-initiated reset only
- New password emailed securely
- User forced to change on first login
- Old sessions invalidated

### Failed Login Protection

**Account Lockout:**
- After 5 failed login attempts
- Account temporarily blocked
- Admin email alert sent
- Manual unlock required

**Implementation:**
```javascript
// Track failed attempts
user.login_attempts += 1;
if (user.login_attempts >= 5) {
  // Block account
  await blockUser(user.id_user, {
    blockCode: 1,
    blockedBy: 'system'
  });
  
  // Send alert
  await sendEmail(`User ${user.username} blocked due to failed login attempts`);
}
```

---

## Authorization

### Role-Based Access Control (RBAC)

**Hierarchy Levels:**
1. Level 1: Rédacteur, Infographe, Vidéaste, Photographe
2. Level 2: Chef de vacation
3. Level 3: Rédacteur en chef, Superviseur
4. Level 4: Admin
5. Level 5: SuperUser

**Privilege Checking:**

```javascript
// Middleware level
router.post('/articles/create', 
  isAuthenticated,
  hasPrivilege('articles.create'),
  CreateArticle
);

// Service level
if (!canManageRole(user.roles, targetRole)) {
  throw new ErrorHandler(403, 'Insufficient permissions');
}
```

**Hierarchical Authorization:**
- Users can only manage roles below their level
- Admin (Level 4) cannot manage SuperUser (Level 5)
- Prevents privilege escalation

### Resource Ownership

**Rules:**
- Users can edit their own draft articles
- Higher-level roles can edit any content
- Ownership validated at service layer

```javascript
const canEditArticle = (user, article) => {
  // Own draft
  if (article.created_by === user.username && !article.is_publish) {
    return true;
  }
  
  // Higher role required
  return user.roleLevel >= 2;
};
```

---

## Input Validation

### Joi Schema Validation

**All endpoints validate input:**

```javascript
const articleSchema = Joi.object({
  title: Joi.string().min(3).max(255).required(),
  introtext: Joi.string().min(10).max(1000).required(),
  fulltext: Joi.string().max(50000).optional(),
  id_image: Joi.number().integer().positive().required(),
  id_categorie: Joi.number().integer().positive().required(),
  // ... more fields
});
```

**Validation Errors:**
```javascript
const { error } = articleSchema.validate(req.body);
if (error) {
  throw new ValidationError(error.details[0].message);
}
```

### Sanitization

**HTML Content:**
- Strip dangerous tags
- Encode special characters
- Prevent XSS attacks

**File Uploads:**
- Whitelist file types
- Check file size
- Scan for malware (recommended)
- Generate random filenames

### Forbidden Words Filter

**Implementation:**
- Load forbidden words from database
- Check content on submission
- Block content containing forbidden words
- Log violations

```javascript
// forbiddenWordsMiddleware.js
export const forbiddenWordsMiddleware = (req, res, next) => {
  const textFields = ['title', 'introtext', 'fulltext'];
  
  for (const field of textFields) {
    if (req.body[field]) {
      const found = forbiddenWordsService.checkContent(req.body[field]);
      if (found.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Content contains forbidden words: ${found.join(', ')}`
        });
      }
    }
  }
  
  next();
};
```

---

## Data Security

### SQL Injection Prevention

**Using Prisma ORM:**
- All queries parameterized
- No string concatenation
- Type-safe queries

```javascript
// Safe query with Prisma
const article = await prisma.aps2024_articles.findUnique({
  where: { id_article: parseInt(id) }
});

// Prisma prevents SQL injection
```

### XSS Prevention

**Content Security Policy (CSP):**
```javascript
// Using Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  }
}));
```

**Output Encoding:**
- Encode HTML entities
- Sanitize user-generated content
- Use template engines with auto-escaping

### CSRF Protection

**Session-based tokens:**
- CSRF token in session
- Validate on state-changing requests
- SameSite cookie attribute

```javascript
// Cookie configuration
cookie: {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict'
}
```

---

## Session Management

### Session Security

**Configuration:**
```javascript
session({
  secret: process.env.SESSION_SECRET,  // Strong random secret
  name: process.env.SESSION_NAME,      // Custom name
  resave: false,
  saveUninitialized: false,
  store: redisStore,
  cookie: {
    secure: true,           // HTTPS only
    httpOnly: true,         // No JavaScript access
    sameSite: 'none',       // Cross-site restriction
    maxAge: 7200000         // 2 hours
  },
  rolling: true             // Refresh on activity
})
```

**Session Storage:**
- Redis for fast access
- Session data encrypted
- Automatic expiration

**Session Validation:**
```javascript
// On each request
if (!req.session.sessionId) {
  return res.status(401).json({ error: 'Unauthorized' });
}

// Verify session in database
const session = await prisma.aps2024_sessions.findFirst({
  where: {
    id_session: req.session.sessionId,
    is_active: true
  }
});

if (!session) {
  req.session.destroy();
  return res.status(401).json({ error: 'Session expired' });
}
```

### Concurrent Session Control

**Options:**
- Single session per user (default)
- Multiple sessions allowed (configurable)
- Force logout other sessions

```javascript
// On login, check for active sessions
const activeSession = await prisma.aps2024_sessions.findFirst({
  where: {
    id_user: user.id_user,
    is_active: true
  }
});

if (activeSession) {
  // Option 1: Reject new login
  // Option 2: Prompt to close old session
  // Option 3: Auto-close old session
}
```

---

## API Security

### HTTPS/TLS

**Requirements:**
- TLS 1.2 or higher
- Strong cipher suites
- Valid SSL certificate
- HSTS header

**Apache Configuration:**
```apache
SSLProtocol all -SSLv2 -SSLv3 -TLSv1 -TLSv1.1
SSLCipherSuite HIGH:!aNULL:!MD5
SSLHonorCipherOrder on
Header always set Strict-Transport-Security "max-age=31536000"
```

### Rate Limiting

**Implementation:**

```javascript
import rateLimit from 'express-rate-limit';

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests, please try again later.'
});

// Login rate limit (stricter)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.'
});
```

**Per-User Limits:**
- Track by session ID
- Track by IP address
- Different limits for authenticated vs unauthenticated

### CORS Policy

**Whitelist Origins:**
```javascript
const allowedOrigins = [
  'https://dashboard.aps.dz',
  'https://www.aps.dz'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT']
}));
```

### HTTP Method Restriction

**Only allow specific methods:**
```javascript
app.use((req, res, next) => {
  const allowedMethods = ['GET', 'POST', 'PUT'];
  
  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({
      error: `Method ${req.method} not allowed`
    });
  }
  
  next();
});
```

### Security Headers (Helmet)

```javascript
app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: true,
  xssFilter: true,
}));
```

---

## Content Security

### File Upload Security

**Validation:**
```javascript
// uploadMiddleware.js
const upload = multer({
  storage: multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
      // Random filename to prevent overwrite attacks
      const uniqueName = uuid.v4() + path.extname(file.originalname);
      cb(null, uniqueName);
    }
  }),
  fileFilter: (req, file, cb) => {
    // Whitelist file types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024  // 5MB max
  }
});
```

**Image Processing:**
```javascript
// imageHelper.js
import sharp from 'sharp';

// Resize and sanitize
const processImage = async (inputPath, outputPath) => {
  await sharp(inputPath)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(outputPath);
    
  // Delete original if needed
};
```

### Watermark Protection

**Apply watermark to images:**
```javascript
const addWatermark = async (imagePath) => {
  await sharp(imagePath)
    .composite([{
      input: './logo/watermark.png',
      gravity: 'southeast'
    }])
    .toFile(imagePath + '-watermarked.jpg');
};
```

### Content Moderation

**Forbidden Words:**
- Maintain blacklist in database
- Check on content submission
- Block inappropriate content
- Manual review queue

**Manual Moderation:**
- Validation workflow (Chef de vacation)
- Editorial review (Rédacteur en chef)
- Unpublish capability

---

## Infrastructure Security

### Server Hardening

**Firewall (UFW):**
```bash
sudo ufw enable
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw deny from <bad-ip>
```

**Fail2Ban:**
```ini
[sshd]
enabled = true
maxretry = 3
bantime = 3600

[apache-auth]
enabled = true
maxretry = 5
```

**SSH Security:**
```bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no  # Use SSH keys
PubkeyAuthentication yes
```

### Database Security

**PostgreSQL:**
```bash
# Listen on localhost only
listen_addresses = 'localhost'

# Strong password
ALTER USER apsapp WITH PASSWORD 'strong_password';

# Limited privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON DATABASE aps_dashboard TO apsapp;

# Connection limits
max_connections = 100
```

**Backup Encryption:**
```bash
# Encrypt backups
pg_dump aps_dashboard | gpg --encrypt > backup.sql.gpg
```

### Redis Security

```conf
# requirepass
requirepass strong_redis_password

# Bind to localhost
bind 127.0.0.1

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

---

## Monitoring & Logging

### Security Event Logging

**Log Categories:**
1. **Authentication Events**
   - Login attempts (success/failure)
   - Logout
   - OTP generation/verification
   - Password changes

2. **Authorization Events**
   - Permission denied
   - Role changes
   - Privilege escalation attempts

3. **Content Events**
   - Article creation/modification
   - Publication/unpublication
   - Content deletion

4. **System Events**
   - Configuration changes
   - User account changes
   - System errors

**Winston Logger:**
```javascript
// logger.js
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'security.log', level: 'warn' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Security Monitoring

**Failed Login Monitoring:**
```javascript
// Alert on excessive failed logins
if (failedLoginCount > 10) {
  await sendEmail(`Security Alert: ${failedLoginCount} failed logins from IP ${ip}`);
}
```

**Anomaly Detection:**
- Unusual login times
- Unexpected IP addresses
- Privilege escalation attempts
- Mass content modifications

**Real-time Alerts:**
- Email notifications
- SMS alerts (optional)
- Dashboard warnings

---

## Incident Response

### Security Incident Procedures

**1. Detection**
- Monitor logs for suspicious activity
- Automated alerts
- User reports

**2. Analysis**
- Determine scope of incident
- Identify affected systems/users
- Assess damage

**3. Containment**
- Block attacker IP
- Disable compromised accounts
- Isolate affected systems

**4. Eradication**
- Remove malicious code
- Patch vulnerabilities
- Reset compromised credentials

**5. Recovery**
- Restore from backups
- Verify system integrity
- Resume normal operations

**6. Post-Incident**
- Document incident
- Update security measures
- Train staff

### Emergency Procedures

**Account Compromise:**
```bash
# 1. Disable account
UPDATE aps2024_users SET state = 2 WHERE id_user = <user_id>;

# 2. Invalidate all sessions
UPDATE aps2024_sessions SET is_active = false WHERE id_user = <user_id>;

# 3. Clear Redis sessions
redis-cli KEYS "sess:*" | xargs redis-cli DEL

# 4. Review logs
grep "user_id:<user_id>" /var/log/aps/*.log

# 5. Reset password
# 6. Notify user
```

**Database Breach:**
```bash
# 1. Take database offline
sudo systemctl stop postgresql

# 2. Take backup
pg_dump aps_dashboard > emergency_backup.sql

# 3. Analyze breach
# 4. Patch vulnerabilities
# 5. Restore from clean backup
# 6. Change all passwords
# 7. Notify users
```

---

## Security Best Practices

### For Developers

1. **Never commit secrets** to version control
   - Use `.env` files (gitignored)
   - Use environment variables
   - Use secret management tools

2. **Validate all inputs**
   - Server-side validation always
   - Use Joi schemas
   - Sanitize user content

3. **Use parameterized queries**
   - Never concatenate SQL
   - Use Prisma ORM
   - Avoid raw queries

4. **Implement least privilege**
   - Minimal permissions
   - Check authorization at multiple layers
   - Validate resource ownership

5. **Log security events**
   - Authentication attempts
   - Authorization failures
   - Suspicious activity

6. **Keep dependencies updated**
   ```bash
   npm audit
   npm update
   ```

7. **Use HTTPS everywhere**
   - Enforce HTTPS in production
   - Secure cookies
   - HSTS headers

### For Administrators

1. **Strong passwords**
   - Minimum 12 characters
   - Mix of character types
   - Use password manager

2. **Regular backups**
   - Daily database backups
   - Test restore procedures
   - Offsite backup storage

3. **Monitor logs**
   - Review security logs daily
   - Set up alerts
   - Investigate anomalies

4. **Update regularly**
   - OS security patches
   - Application updates
   - Dependency updates

5. **Limit access**
   - Principle of least privilege
   - Regular access reviews
   - Remove unused accounts

6. **Security audits**
   - Periodic security assessments
   - Penetration testing
   - Code reviews

### For Users

1. **Choose strong passwords**
2. **Don't share accounts**
3. **Report suspicious activity**
4. **Logout when done**
5. **Verify OTP sender**
6. **Keep credentials confidential**

---

## Security Checklist

### Deployment Security

- [ ] HTTPS enabled and enforced
- [ ] SSL certificate valid
- [ ] Strong SESSION_SECRET configured
- [ ] Database passwords strong and unique
- [ ] Redis password configured
- [ ] Firewall rules configured
- [ ] Fail2Ban installed and configured
- [ ] SSH key-based authentication only
- [ ] Root login disabled
- [ ] Security headers enabled (Helmet)
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] File upload restrictions configured
- [ ] Logging enabled
- [ ] Backup system configured
- [ ] Monitoring alerts configured

### Ongoing Security

- [ ] Regular security updates
- [ ] Log monitoring
- [ ] Failed login monitoring
- [ ] User access reviews
- [ ] Backup testing
- [ ] Incident response plan updated
- [ ] Security training for staff
- [ ] Vulnerability scanning
- [ ] Penetration testing (annual)
- [ ] Compliance reviews

---

## Compliance & Standards

### Data Protection

- User data encrypted in transit (HTTPS)
- Passwords hashed (bcryptjs)
- Session data stored securely (Redis)
- Personal data minimization
- Data retention policies

### Audit Trail

- All user actions logged
- Log retention: 1 year
- Tamper-proof logging
- Regular log reviews

### Access Control

- Role-based access control (RBAC)
- Principle of least privilege
- Regular access reviews
- Audit trail for permission changes

---

## Security Resources

### Tools

- **OWASP ZAP**: Security testing
- **nmap**: Network scanning
- **Lynis**: Linux security audit
- **npm audit**: Dependency vulnerabilities

### References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-26  
**Security Contact**: security@aps.dz  
**Emergency Contact**: +213-XXX-XXXXXX
