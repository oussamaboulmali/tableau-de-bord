# Production Deployment Guide

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Server Setup](#server-setup)
- [Application Deployment](#application-deployment)
- [Database Setup](#database-setup)
- [Redis Configuration](#redis-configuration)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [SSL/TLS Configuration](#ssltls-configuration)
- [PM2 Process Manager](#pm2-process-manager)
- [Environment Configuration](#environment-configuration)
- [Monitoring & Logging](#monitoring--logging)
- [Backup Strategy](#backup-strategy)
- [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers deploying the APS Dashboard to a production environment. The deployment uses:

- **Ubuntu 20.04+ LTS** server
- **Node.js 18+** runtime
- **PM2** for process management
- **Apache2** as reverse proxy
- **PostgreSQL 14+** database
- **Redis** for sessions and caching
- **Let's Encrypt** for SSL certificates

---

## Prerequisites

### Hardware Requirements

**Minimum Specifications:**
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 50GB SSD
- **Network**: 1 Gbps

**Recommended Specifications:**
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 100GB+ SSD
- **Network**: 1 Gbps+

### Software Requirements

- Ubuntu Server 20.04 LTS or later
- Root or sudo access
- Domain name with DNS configured
- SSL certificate (or ability to use Let's Encrypt)

---

## Server Setup

### 1. Update System

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y build-essential curl git
```

### 2. Install Node.js

```bash
# Install Node.js 18.x via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version
```

### 3. Install PostgreSQL

```bash
# Install PostgreSQL 14
sudo apt install -y postgresql-14 postgresql-contrib-14

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
sudo -u postgres psql --version
```

### 4. Install Redis

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis to start on boot
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verify installation
redis-cli ping  # Should return "PONG"
```

### 5. Install Apache2

```bash
# Install Apache2
sudo apt install -y apache2

# Enable required modules
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod ssl
sudo a2enmod rewrite
sudo a2enmod headers

# Start and enable Apache
sudo systemctl start apache2
sudo systemctl enable apache2
```

### 6. Install PM2 Globally

```bash
sudo npm install -g pm2

# Verify installation
pm2 --version
```

---

## Application Deployment

### 1. Create Application User

```bash
# Create dedicated user for the application
sudo adduser --system --group --home /var/www apsapp

# Create application directory
sudo mkdir -p /var/www/aps-dashboard
sudo chown -R apsapp:apsapp /var/www/aps-dashboard
```

### 2. Clone Repository

```bash
# Switch to application user
sudo su - apsapp

# Clone repository
cd /var/www
git clone <repository-url> aps-dashboard
cd aps-dashboard

# Switch to production branch (if applicable)
git checkout production
```

### 3. Install Dependencies

```bash
# Install production dependencies only
npm install --production

# Or use npm ci for clean install
npm ci --production
```

### 4. Build Application (if needed)

```bash
# If you have build steps
npm run build
```

---

## Database Setup

### 1. Create Database and User

```bash
# Connect to PostgreSQL as postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE aps_dashboard;

# Create user with password
CREATE USER apsapp WITH ENCRYPTED PASSWORD 'strong_password_here';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE aps_dashboard TO apsapp;

# Exit psql
\q
```

### 2. Configure PostgreSQL for Remote Connections (if needed)

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf

# Find and modify:
listen_addresses = 'localhost'  # or '*' for all interfaces

# Edit pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Add line for application:
host    aps_dashboard    apsapp    127.0.0.1/32    md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### 3. Run Migrations

```bash
# As application user
cd /var/www/aps-dashboard

# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://apsapp:strong_password_here@localhost:5432/aps_dashboard"

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# (Optional) Seed database
npx prisma db seed
```

---

## Redis Configuration

### 1. Configure Redis

```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf
```

**Recommended settings for production:**

```conf
# Bind to localhost only (if on same server)
bind 127.0.0.1

# Set password
requirepass your_strong_redis_password

# Persistence
save 900 1
save 300 10
save 60 10000

# Memory management
maxmemory 256mb
maxmemory-policy allkeys-lru

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
```

### 2. Restart Redis

```bash
sudo systemctl restart redis-server

# Test connection with password
redis-cli -a your_strong_redis_password ping
```

---

## Environment Configuration

### Create Production .env File

```bash
cd /var/www/aps-dashboard
sudo nano .env
```

**Production .env template:**

```env
# Application
NODE_ENV=production
PORT=5000
PROJECT_NAME="APS Dashboard"
PROJECT_LANG="ar"

# Database
DATABASE_URL="postgresql://apsapp:strong_password_here@localhost:5432/aps_dashboard?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_strong_redis_password

# Session (IMPORTANT: Generate strong random secret)
SESSION_SECRET=your_very_strong_random_session_secret_min_32_chars
SESSION_NAME=aps_session
SESSION_TIME=120

# Email (SMTP)
ADMIN_MAIL=noreply@aps.dz
ADMIN_MAIL_PASSWORD=email_password
RECEPTION_MAIL=admin@aps.dz

# Security
ALLOWED_ORIGINS=https://dashboard.aps.dz,https://www.aps.dz
```

**Secure the .env file:**

```bash
sudo chown apsapp:apsapp .env
sudo chmod 600 .env
```

### Generate SESSION_SECRET

```bash
# Generate a strong random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Reverse Proxy Setup

### Apache Configuration

#### Create Virtual Host Configuration

```bash
sudo nano /etc/apache2/sites-available/aps-dashboard.conf
```

**Configuration:**

```apache
<VirtualHost *:80>
    ServerName dashboard.aps.dz
    ServerAlias www.dashboard.aps.dz
    
    # Redirect all HTTP to HTTPS
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName dashboard.aps.dz
    ServerAlias www.dashboard.aps.dz
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/dashboard.aps.dz/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/dashboard.aps.dz/privkey.pem
    
    # SSL Security
    SSLProtocol all -SSLv2 -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite HIGH:!aNULL:!MD5
    SSLHonorCipherOrder on
    
    # HSTS (optional but recommended)
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    
    # Proxy Configuration
    ProxyPreserveHost On
    ProxyPass / http://localhost:5000/
    ProxyPassReverse / http://localhost:5000/
    
    # WebSocket support (for Socket.io)
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*)           ws://localhost:5000/$1 [P,L]
    
    # Logging
    ErrorLog ${APACHE_LOG_DIR}/aps-dashboard-error.log
    CustomLog ${APACHE_LOG_DIR}/aps-dashboard-access.log combined
    
    # Security Headers
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set X-XSS-Protection "1; mode=block"
</VirtualHost>
```

#### Enable Site and Restart Apache

```bash
# Enable the site
sudo a2ensite aps-dashboard.conf

# Test configuration
sudo apache2ctl configtest

# Restart Apache
sudo systemctl restart apache2
```

---

## SSL/TLS Configuration

### Using Let's Encrypt (Certbot)

#### Install Certbot

```bash
sudo apt install -y certbot python3-certbot-apache
```

#### Obtain SSL Certificate

```bash
# Obtain certificate
sudo certbot --apache -d dashboard.aps.dz -d www.dashboard.aps.dz

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: yes)
```

#### Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically sets up cron job for renewal
# Check cron:
sudo systemctl status certbot.timer
```

---

## PM2 Process Manager

### 1. Create PM2 Ecosystem File

```bash
cd /var/www/aps-dashboard
nano ecosystem.config.js
```

**ecosystem.config.js:**

```javascript
module.exports = {
  apps: [{
    name: 'aps-dashboard',
    script: './index.js',
    instances: 'max',  // Or specify number (e.g., 2, 4)
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};
```

### 2. Start Application with PM2

```bash
# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup systemd
# Run the command that PM2 outputs

# Check application status
pm2 status
pm2 logs aps-dashboard
pm2 monit
```

### 3. PM2 Commands

```bash
# Restart application
pm2 restart aps-dashboard

# Stop application
pm2 stop aps-dashboard

# Reload (zero-downtime)
pm2 reload aps-dashboard

# Delete from PM2
pm2 delete aps-dashboard

# Monitor
pm2 monit

# Logs
pm2 logs aps-dashboard
pm2 logs aps-dashboard --lines 100
pm2 logs aps-dashboard --err

# Flush logs
pm2 flush
```

---

## Monitoring & Logging

### Application Logs

```bash
# PM2 logs
pm2 logs aps-dashboard

# Application logs (Winston)
tail -f /var/www/aps-dashboard/logs/app-*.log
tail -f /var/www/aps-dashboard/logs/error-*.log

# Apache logs
sudo tail -f /var/log/apache2/aps-dashboard-access.log
sudo tail -f /var/log/apache2/aps-dashboard-error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

### PM2 Monitoring

```bash
# Install PM2 web interface (optional)
pm2 install pm2-server-monit

# Or use PM2 Plus (cloud monitoring)
pm2 link <secret_key> <public_key>
```

### System Monitoring

```bash
# Install monitoring tools
sudo apt install -y htop iotop nethogs

# Check system resources
htop
free -h
df -h
netstat -tulpn | grep LISTEN
```

---

## Backup Strategy

### Database Backup

#### Automated Backup Script

```bash
sudo nano /usr/local/bin/backup-aps-db.sh
```

**Script content:**

```bash
#!/bin/bash

# Configuration
DB_NAME="aps_dashboard"
DB_USER="apsapp"
BACKUP_DIR="/var/backups/aps-dashboard"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/aps_db_$DATE.sql.gz"

# Create backup directory if not exists
mkdir -p $BACKUP_DIR

# Perform backup
PGPASSWORD='strong_password_here' pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_FILE

# Remove backups older than 30 days
find $BACKUP_DIR -name "aps_db_*.sql.gz" -mtime +30 -delete

# Log
echo "$(date): Backup completed: $BACKUP_FILE" >> /var/log/aps-backup.log
```

**Make executable and schedule:**

```bash
sudo chmod +x /usr/local/bin/backup-aps-db.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e

# Add line:
0 2 * * * /usr/local/bin/backup-aps-db.sh
```

### Application Files Backup

```bash
# Backup application files
sudo tar -czf /var/backups/aps-app-$(date +%Y%m%d).tar.gz \
  -C /var/www aps-dashboard \
  --exclude=node_modules \
  --exclude=.git

# Or use rsync for incremental backups
rsync -avz --exclude='node_modules' --exclude='.git' \
  /var/www/aps-dashboard/ \
  /var/backups/aps-app/
```

### Restore from Backup

```bash
# Restore database
gunzip < /var/backups/aps-dashboard/aps_db_20251026_020000.sql.gz | \
  sudo -u postgres psql aps_dashboard

# Restore application files
sudo tar -xzf /var/backups/aps-app-20251026.tar.gz -C /var/www/
```

---

## Deployment Workflow

### Initial Deployment

```bash
# 1. Server setup (one-time)
# 2. Clone repository
# 3. Install dependencies
# 4. Configure environment
# 5. Setup database
# 6. Start with PM2
# 7. Configure reverse proxy
# 8. Setup SSL
# 9. Setup monitoring & backups
```

### Updates & Deployment

```bash
# Stop application
pm2 stop aps-dashboard

# Pull latest code
cd /var/www/aps-dashboard
git pull origin production

# Install new dependencies
npm install --production

# Run migrations
npx prisma migrate deploy

# Restart application
pm2 restart aps-dashboard

# Check status
pm2 status
pm2 logs aps-dashboard --lines 50
```

### Zero-Downtime Deployment

```bash
# Using PM2 reload (cluster mode required)
git pull origin production
npm install --production
npx prisma migrate deploy
pm2 reload aps-dashboard
```

---

## Security Hardening

### Firewall Configuration (UFW)

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

### Fail2Ban (Brute-Force Protection)

```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Configure
sudo nano /etc/fail2ban/jail.local
```

**jail.local:**

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[apache-auth]
enabled = true
```

```bash
# Restart Fail2Ban
sudo systemctl restart fail2ban
```

### Disable Root Login

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Set:
PermitRootLogin no
PasswordAuthentication no  # Use SSH keys only

# Restart SSH
sudo systemctl restart sshd
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs aps-dashboard --err

# Check environment variables
pm2 env 0

# Check database connection
node -e "const prisma = require('./src/configs/database.js').default; prisma.\$connect().then(() => console.log('Connected')).catch(e => console.error(e));"

# Check Redis connection
redis-cli -a your_password ping

# Check port availability
sudo netstat -tulpn | grep 5000
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE datname='aps_dashboard';"

# Test connection
psql -h localhost -U apsapp -d aps_dashboard -c "SELECT 1;"
```

### Apache Not Proxying

```bash
# Check Apache status
sudo systemctl status apache2

# Check Apache error logs
sudo tail -f /var/log/apache2/error.log

# Test proxy modules
sudo apache2ctl -M | grep proxy

# Test configuration
sudo apache2ctl configtest
```

### High Memory Usage

```bash
# Check PM2 instances
pm2 list

# Reduce instances
pm2 scale aps-dashboard 2

# Set memory limit
pm2 start ecosystem.config.js --max-memory-restart 500M
```

### SSL Certificate Issues

```bash
# Check certificate
sudo certbot certificates

# Renew manually
sudo certbot renew

# Check certificate files
sudo ls -l /etc/letsencrypt/live/dashboard.aps.dz/
```

---

## Performance Optimization

### Node.js Optimization

```bash
# Increase Node.js memory limit (in ecosystem.config.js)
node_args: '--max-old-space-size=2048'
```

### PostgreSQL Optimization

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf
```

**Recommended settings:**

```conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
max_connections = 100
```

### Redis Optimization

Already covered in [Redis Configuration](#redis-configuration).

---

## Checklist

### Pre-Deployment

- [ ] Server meets hardware requirements
- [ ] All software installed and updated
- [ ] Domain DNS configured
- [ ] Firewall rules configured
- [ ] SSL certificate obtained

### Deployment

- [ ] Application code deployed
- [ ] Dependencies installed
- [ ] Environment variables configured
- [ ] Database created and migrated
- [ ] Redis configured
- [ ] PM2 running application
- [ ] Reverse proxy configured
- [ ] SSL working correctly

### Post-Deployment

- [ ] Application accessible via HTTPS
- [ ] Login functionality tested
- [ ] Database connections working
- [ ] Redis sessions working
- [ ] Logs being generated
- [ ] Backup scripts configured
- [ ] Monitoring setup
- [ ] Documentation updated

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-26  
**Maintained By**: APS DevOps Team
