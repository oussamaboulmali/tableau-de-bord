import { securityLogger } from "../utils/logger.js";

// Helper function to get real client IP
function getClientIP(req) {
  return (
    req.headers["x-client-ip"] ||
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress
  );
}

class SecurityLoggerValidator {
  constructor() {
    // Enhanced SQL Injection patterns
    this.sqlInjectionPatterns = [
      // SQL keywords with suspicious context (require multiple indicators)
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b.*\b(FROM|TABLE|DATABASE|INTO|VALUES|WHERE)\b.*['";\-\-#])/i,

      // SQL comments with actual SQL context
      /--[\s]*\b(SELECT|DROP|DELETE|INSERT|UPDATE|UNION|ALTER|CREATE)\b/i,
      /\/\*[\s\S]*\b(SELECT|DROP|DELETE|INSERT|UPDATE|UNION|ALTER|CREATE)\b[\s\S]*\*\//i,
      /#[\s]*\b(SELECT|DROP|DELETE|INSERT|UPDATE|UNION|ALTER|CREATE)\b/i,

      // Classic SQL injection patterns (multiple conditions)
      /(\b(OR|AND)\b\s*['"]\s*[^'"]*['"]\s*=\s*['"]\s*[^'"]*['"].*(\b(SELECT|DROP|DELETE|INSERT|UPDATE)\b|--|#|\/\*))/i,
      /(1\s*=\s*1|'1'='1'|"1"="1").*(\b(SELECT|DROP|DELETE|INSERT|UPDATE)\b|--|#|\/\*)/i,

      // UNION attacks (must contain SELECT)
      /(\bUNION\b.*\bSELECT\b)/i,

      // SQL functions with suspicious context
      /(\b(CONCAT|CHAR|ASCII|SUBSTRING|LENGTH|CAST|CONVERT|EXEC|EXECUTE|WAITFOR|DELAY)\s*\().*(\b(FROM|WHERE|SELECT|INSERT|UPDATE|DELETE)\b|['";\-\-#])/i,

      // System tables/schemas
      /(\bINFORMATION_SCHEMA\b|\bSYSOBJECTS\b|\bSYSTABLES\b|\bMSYSACCESSSTORAGE\b)/i,

      // Hex encoding with SQL context
      /(0x[0-9A-Fa-f]+).*(\b(SELECT|INSERT|UPDATE|DELETE|DROP|FROM|WHERE)\b)/i,

      // SQL injection with encoded characters
      /%27.*(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR|AND)\b)/i,
      /%22.*(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR|AND)\b)/i,

      // Stacked queries (semicolon followed by SQL)
      /;[\s]*\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b/i,
    ];

    // Enhanced XSS patterns - More specific
    this.xssPatterns = [
      // Script tags
      /<script[\s\S]*?>[\s\S]*?<\/script>/i,
      /<script[\s\S]*?>/i,

      // Event handlers with JavaScript context
      /\bon(load|click|mouse|key|focus|blur|change|submit|error|resize)\s*=\s*['"]\s*[^'"]*javascript/i,
      /\bon(load|click|mouse|key|focus|blur|change|submit|error|resize)\s*=\s*['"]\s*[^'"]*alert\s*\(/i,
      /\bon(load|click|mouse|key|focus|blur|change|submit|error|resize)\s*=\s*['"]\s*[^'"]*eval\s*\(/i,

      // JavaScript protocol
      /javascript\s*:\s*(alert|eval|confirm|prompt|document\.|window\.|location\.|top\.)/i,

      // Data URIs with script content
      /data\s*:\s*text\/html[\s\S]*<script/i,
      /data\s*:\s*text\/html[\s\S]*javascript/i,

      // Dangerous functions with HTML context
      /(<[^>]*>.*)?(\b(eval|alert|confirm|prompt|document\.write|innerHTML|outerHTML)\s*\()/i,

      // SVG with script content
      /<svg[\s\S]*?<script/i,
      /<svg[\s\S]*?on\w+\s*=.*?javascript/i,

      // Meta refresh with JavaScript
      /<meta[\s\S]*?http-equiv\s*=\s*['"]\s*refresh[\s\S]*?javascript/i,

      // Style with expression (IE)
      /style\s*=.*expression\s*\(.*javascript/i,

      // Base64 encoded scripts
      /data:\s*[\w\/]+;base64.*?(PHNjcmlwdA|PGltZyBzcmM|PGlmcmFtZQ)/i, // <script, <img src, <iframe

      // HTML entities with script context
      /&#x?[0-9a-f]+;.*?<script/i,
    ];

    // Enhanced Path Traversal patterns - More specific
    this.pathTraversalPatterns = [
      // Multiple directory traversals
      /\.{2,}[\/\\]{2,}/,
      /(\.\.[\/\\]){3,}/,

      // Windows drive paths in web context
      /[A-Za-z]:[\/\\].*\.(exe|bat|cmd|com|scr|vbs|js|jar)/i,

      // System directories with file access
      /^[\/\\]+(etc|proc|sys|var|usr|bin|sbin|home|root)[\/\\]+.*\.(conf|cfg|ini|log|passwd|shadow|hosts)/i,

      // Null byte injection
      /%00.*\.(exe|bat|cmd|com|scr|vbs|js|jar|php|asp|jsp)/i,

      // URL encoded traversal
      /(%2e%2e[\/\\]|%2f|%5c){2,}/i,

      // UNC paths
      /^\\\\[^\\]+\\.*\.(exe|bat|cmd|com|scr|vbs|js|jar)/i,

      // Home directory with sensitive files
      /~[\/\\].*\.(ssh|bash|profile|bashrc|history)/i,

      // Config files access
      /\.(htaccess|htpasswd|web\.config|application\.properties|database\.yml)$/i,
    ];

    // Enhanced Command Injection patterns - Context-aware
    this.commandInjectionPatterns = [
      // Command separators with actual commands
      /[;&|][\s]*\b(cat|ls|pwd|whoami|id|uname|wget|curl|nc|netcat|rm|cp|mv|chmod|chown|su|sudo|passwd|ps|kill|mount|umount|ifconfig|netstat|iptables)\b/i,

      // Backticks with commands
      /`[\s]*\b(cat|ls|pwd|whoami|id|uname|wget|curl|nc|netcat|rm|cp|mv|chmod|chown|su|sudo|passwd|ps|kill|mount|umount|ifconfig|netstat|iptables)\b[^`]*`/i,

      // Command substitution
      /\$\([\s]*\b(cat|ls|pwd|whoami|id|uname|wget|curl|nc|netcat|rm|cp|mv|chmod|chown|su|sudo|passwd|ps|kill|mount|umount|ifconfig|netstat|iptables)\b[^)]*\)/i,

      // Windows commands with separators
      /[;&|][\s]*\b(dir|type|copy|del|net|tasklist|systeminfo|ipconfig|ping|telnet|ftp|powershell|cmd|wmic|reg|sc|schtasks)\b/i,

      // Pipe to dangerous commands
      /\|[\s]*\b(sh|bash|cmd|powershell|perl|python|ruby|php|node|nc|netcat|telnet|ftp)\b/i,

      // Redirection with system files
      /[><][\s]*\b(\/etc\/|\/proc\/|\/sys\/|\/var\/|\/tmp\/|\/dev\/|C:\\Windows\\|C:\\System32\\)/i,

      // Environment variable injection
      /\$[A-Z_]+[\s]*[;&|]/,
      /%[A-Z_]+%[\s]*[;&|]/,

      // Line terminators with commands
      /[\r\n]+[\s]*\b(cat|ls|pwd|whoami|id|uname|wget|curl|nc|netcat|rm|cp|mv|chmod|chown|su|sudo|passwd|ps|kill|mount|umount|ifconfig|netstat|iptables|dir|type|copy|del|net|tasklist|systeminfo|ipconfig|ping|telnet|ftp|powershell|cmd)\b/i,
    ];

    // LDAP Injection patterns
    this.ldapInjectionPatterns = [
      // LDAP filter injection with wildcards and operators
      /(\*\)|\)\*).*(\||&|\!)\s*\(/,

      // LDAP logical operators in suspicious context
      /(\|\(|\&\(|\!\().*[=<>~]\s*\*/,

      // LDAP objectClass injection
      /(objectClass=\*).*(\||&|\!)/i,

      // LDAP filter bypass attempts
      /(\)(\||&|\!)\().*[=<>~]/,

      // LDAP uid/cn injection patterns
      /(\|\(|\&\()(uid|cn|ou|dc)\s*=\s*\*/i,

      // LDAP null byte with filter context
      /\x00.*(\(|\)|=|\||&)/,

      // LDAP search filter manipulation
      /\(\|\(\w+=[^)]*\)\(\w+=[^)]*\)\)/,

      // LDAP wildcard abuse in specific context
      /\(\w+\s*=\s*\*\)\s*(\||&)\s*\(/,

      // LDAP distinguished name injection
      /(dc|ou|cn)\s*=.*(\)(\||&)|\x00)/i,
    ];

    // NoSQL Injection patterns
    this.nosqlInjectionPatterns = [
      // MongoDB operators with injection context
      /\$where[\s]*:[\s]*["'].*[\w\s]*\(/i,
      /\$regex[\s]*:[\s]*["'].*(\$|\.|\(|\)|;)/i,
      /\$ne[\s]*:[\s]*null/i,
      /\$gt[\s]*:[\s]*(["'][\s]*["']|0)/i,
      /\$lt[\s]*:[\s]*(["'][\s]*["']|999999)/i,
      /\$or[\s]*:[\s]*\[.*\$ne/i,
      /\$and[\s]*:[\s]*\[.*\$ne/i,
      /\$in[\s]*:[\s]*\[.*\$ne/i,
      /\$exists[\s]*:[\s]*false/i,

      // JavaScript injection in NoSQL
      /this\.[\w]+[\s]*==[\s]*["'].*["'][\s]*\|\|/i,
      /return[\s]+true/i,
      /sleep\s*\(\s*\d+\s*\)/i,
    ];

    // Input limits
    this.INPUT_LIMITS = {
      default: 500,
      email: 100,
      password: 20,
      username: 50,
      search: 500,
      url: 500,
      phone: 20,
    };

    // Fields to exclude from INPUT_LIMITS check
    this.INPUT_LIMITS_EXCLUSIONS = [
      "title",
      "introtext",
      "fulltext",
      "name",
      "description",
    ];

    // Threat severity levels
    this.THREAT_SEVERITY = {
      LOW: "low",
      MEDIUM: "medium",
      HIGH: "high",
      CRITICAL: "critical",
    };
  }

  calculateThreatSeverity(threats) {
    if (
      threats.sqlInjection.length > 0 ||
      threats.commandInjection.length > 0
    ) {
      return this.THREAT_SEVERITY.CRITICAL;
    }
    if (threats.xss.length > 0 || threats.pathTraversal.length > 0) {
      return this.THREAT_SEVERITY.HIGH;
    }
    if (threats.ldapInjection.length > 0 || threats.nosqlInjection.length > 0) {
      return this.THREAT_SEVERITY.MEDIUM;
    }
    if (threats.overflow.length > 0) {
      return this.THREAT_SEVERITY.LOW;
    }
    return this.THREAT_SEVERITY.LOW;
  }

  testPatterns(value, patterns) {
    const matchedPatterns = [];
    patterns.forEach((pattern, index) => {
      if (pattern.test(value)) {
        matchedPatterns.push({
          patternIndex: index,
          pattern: pattern.toString(),
          match: value.match(pattern)?.[0] || "unknown",
        });
      }
    });
    return matchedPatterns;
  }

  getInputLimit(fieldName, inputType = "default") {
    const fieldLimits = {
      email: this.INPUT_LIMITS.email,
      password: this.INPUT_LIMITS.password,
      username: this.INPUT_LIMITS.username,
      search: this.INPUT_LIMITS.search,
      searchText: this.INPUT_LIMITS.search,
      url: this.INPUT_LIMITS.url,
      phone: this.INPUT_LIMITS.phone,
    };

    return (
      fieldLimits[fieldName] ||
      fieldLimits[inputType] ||
      this.INPUT_LIMITS.default
    );
  }

  isFieldExcludedFromInputLimits(fieldName) {
    return this.INPUT_LIMITS_EXCLUSIONS.some((exclusion) =>
      fieldName.toLowerCase().includes(exclusion.toLowerCase())
    );
  }

  normalizeInputData(inputData) {
    if (typeof inputData === "string") {
      return { input: inputData };
    }

    if (Array.isArray(inputData)) {
      const result = {};
      inputData.forEach((item, index) => {
        if (typeof item === "string") {
          result[`item_${index}`] = item;
        } else if (typeof item === "object") {
          Object.entries(item).forEach(([key, value]) => {
            result[`${index}_${key}`] = value;
          });
        }
      });
      return result;
    }

    return inputData;
  }

  decodeInput(value) {
    try {
      let decoded = decodeURIComponent(value);
      decoded = decoded
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#x27;/gi, "'")
        .replace(/&amp;/gi, "&");
      return decoded;
    } catch (e) {
      return value;
    }
  }

  async validateInput(
    inputData,
    ip = "unknown",
    endpoint = "default",
    userAgent = ""
  ) {
    const threats = {
      sqlInjection: [],
      xss: [],
      pathTraversal: [],
      commandInjection: [],
      ldapInjection: [],
      nosqlInjection: [],
      overflow: [],
    };

    if (
      !inputData ||
      (typeof inputData === "object" && Object.keys(inputData).length === 0)
    ) {
      return { threats, severity: this.THREAT_SEVERITY.LOW, hasThreats: false };
    }

    const dataToProcess = this.normalizeInputData(inputData);

    for (const [field, value] of Object.entries(dataToProcess)) {
      if (typeof value !== "string" || !value) continue;

      // Check if field should be excluded from input limits
      if (!this.isFieldExcludedFromInputLimits(field)) {
        const maxLength = this.getInputLimit(field);
        if (value.length > maxLength) {
          threats.overflow.push({
            field,
            length: value.length,
            maxAllowed: maxLength,
            value: value.substring(0, 100) + (value.length > 100 ? "..." : ""),
          });
          continue;
        }
      }

      const isRichTextField = ["fulltext"].includes(field.toLowerCase());

      if (isRichTextField) {
        // Skip certain security checks or use more lenient patterns
        continue;
      }

      const decodedValue = this.decodeInput(value);

      // Test SQL Injection patterns
      const sqlMatches = this.testPatterns(
        decodedValue,
        this.sqlInjectionPatterns
      );
      if (sqlMatches.length > 0) {
        threats.sqlInjection.push({
          field,
          value: value.substring(0, 200),
          matchedPatterns: sqlMatches,
        });
      }

      // Test XSS patterns
      const xssMatches = this.testPatterns(decodedValue, this.xssPatterns);
      if (xssMatches.length > 0) {
        threats.xss.push({
          field,
          value: value.substring(0, 200),
          matchedPatterns: xssMatches,
        });
      }

      // Test Path Traversal patterns
      const pathMatches = this.testPatterns(
        decodedValue,
        this.pathTraversalPatterns
      );
      if (pathMatches.length > 0) {
        threats.pathTraversal.push({
          field,
          value: value.substring(0, 200),
          matchedPatterns: pathMatches,
        });
      }

      // Test Command Injection patterns
      const cmdMatches = this.testPatterns(
        decodedValue,
        this.commandInjectionPatterns
      );
      if (cmdMatches.length > 0) {
        threats.commandInjection.push({
          field,
          value: value.substring(0, 200),
          matchedPatterns: cmdMatches,
        });
      }

      // Test LDAP Injection patterns
      const ldapMatches = this.testPatterns(
        decodedValue,
        this.ldapInjectionPatterns
      );
      if (ldapMatches.length > 0) {
        threats.ldapInjection.push({
          field,
          value: value.substring(0, 200),
          matchedPatterns: ldapMatches,
        });
      }

      // Test NoSQL Injection patterns
      const nosqlMatches = this.testPatterns(
        decodedValue,
        this.nosqlInjectionPatterns
      );
      if (nosqlMatches.length > 0) {
        threats.nosqlInjection.push({
          field,
          value: value.substring(0, 200),
          matchedPatterns: nosqlMatches,
        });
      }
    }

    const severity = this.calculateThreatSeverity(threats);
    const hasThreats = Object.values(threats).some((arr) => arr.length > 0);

    return { threats, severity, hasThreats };
  }
}

// Security logging middleware (non-blocking)
export const securityLoggingMiddleware = async (req, res, next) => {
  const validator = new SecurityLoggerValidator();
  const ipAddress = getClientIP(req);
  const userAgent = req.headers["user-agent"] || "";

  try {
    const allInputData = {
      ...req.body,
      ...req.query,
      ...req.params,
    };

    const { threats, severity, hasThreats } = await validator.validateInput(
      allInputData,
      ipAddress,
      req.originalUrl,
      userAgent
    );

    if (hasThreats) {
      // Log detailed security event for analysis
      securityLogger.warn(`[SECURITY_ANALYSIS] Potential threat detected`, {
        timestamp: new Date().toISOString(),
        ip: ipAddress,
        endpoint: req.originalUrl,
        method: req.method,
        userAgent,
        severity,
        threats: {
          sqlInjection: threats.sqlInjection.map((t) => ({
            field: t.field,
            value: t.value,
            patterns: t.matchedPatterns.map((p) => ({
              index: p.patternIndex,
              pattern: p.pattern,
              match: p.match,
            })),
          })),
          xss: threats.xss.map((t) => ({
            field: t.field,
            value: t.value,
            patterns: t.matchedPatterns.map((p) => ({
              index: p.patternIndex,
              pattern: p.pattern,
              match: p.match,
            })),
          })),
          pathTraversal: threats.pathTraversal.map((t) => ({
            field: t.field,
            value: t.value,
            patterns: t.matchedPatterns.map((p) => ({
              index: p.patternIndex,
              pattern: p.pattern,
              match: p.match,
            })),
          })),
          commandInjection: threats.commandInjection.map((t) => ({
            field: t.field,
            value: t.value,
            patterns: t.matchedPatterns.map((p) => ({
              index: p.patternIndex,
              pattern: p.pattern,
              match: p.match,
            })),
          })),
          ldapInjection: threats.ldapInjection.map((t) => ({
            field: t.field,
            value: t.value,
            patterns: t.matchedPatterns.map((p) => ({
              index: p.patternIndex,
              pattern: p.pattern,
              match: p.match,
            })),
          })),
          nosqlInjection: threats.nosqlInjection.map((t) => ({
            field: t.field,
            value: t.value,
            patterns: t.matchedPatterns.map((p) => ({
              index: p.patternIndex,
              pattern: p.pattern,
              match: p.match,
            })),
          })),
          overflow: threats.overflow,
        },
        threatCount: Object.values(threats).reduce(
          (sum, arr) => sum + arr.length,
          0
        ),
        requestData: {
          body: req.body,
          query: req.query,
          params: req.params,
        },
      });

      // Log a summary for quick overview
      const threatTypes = Object.keys(threats).filter(
        (k) => threats[k].length > 0
      );
      securityLogger.info(
        `[SECURITY_SUMMARY] ${threatTypes.join(
          ", "
        )} detected from ${ipAddress} on ${req.originalUrl}`
      );
    }

    // Add security analysis info to request for potential use by other middleware
    req.securityAnalysis = {
      validated: true,
      ipAddress,
      hasThreats,
      severity,
      threatTypes: Object.keys(threats).filter((k) => threats[k].length > 0),
      threatCount: Object.values(threats).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
    };

    next();
  } catch (error) {
    securityLogger.error("Security logging middleware error:", error);
    // Continue processing - this is logging only
    next();
  }
};

function getAlgeriaTime() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  })
    .format(new Date())
    .replace(", ", "T");
}

export { SecurityLoggerValidator };
