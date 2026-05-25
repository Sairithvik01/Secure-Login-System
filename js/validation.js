/* ================================================================
   Input Validation & Sanitization Module
   Provides client-side validation, XSS protection, and
   SQL injection pattern detection (defense-in-depth)
   ================================================================ */

const Validator = {

  /* ---------- Email Validation ---------- */
  isValidEmail(email) {
    // RFC 5322 compliant email regex
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return re.test(String(email).trim());
  },

  /* ---------- Name Validation ---------- */
  isValidName(name) {
    const trimmed = name.trim();
    return /^[a-zA-Z\s'-]{2,50}$/.test(trimmed);
  },

  /* ---------- Password Strength Analysis ---------- */
  getPasswordStrength(password) {
    let score = 0;
    const checks = {
      length8: password.length >= 8,
      length12: password.length >= 12,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^a-zA-Z0-9]/.test(password),
      noRepeating: !/(.)\1{2,}/.test(password),
      noSequential: !/(012|123|234|345|456|567|678|789|abc|bcd|cde|def)/i.test(password)
    };

    if (checks.length8) score++;
    if (checks.length12) score++;
    if (checks.lowercase) score++;
    if (checks.uppercase) score++;
    if (checks.number) score++;
    if (checks.special) score++;
    if (checks.noRepeating) score += 0.5;
    if (checks.noSequential) score += 0.5;

    if (score <= 2) return { level: 'weak', score, label: 'Weak', color: 'var(--error)' };
    if (score <= 4) return { level: 'medium', score, label: 'Medium', color: 'var(--warning)' };
    return { level: 'strong', score, label: 'Strong', color: 'var(--success)' };
  },

  /* ---------- Password Requirements Check ---------- */
  checkPasswordRequirements(password) {
    return {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[^a-zA-Z0-9]/.test(password)
    };
  },

  /* ---------- XSS Protection: HTML Entity Encoding ---------- */
  sanitizeHTML(str) {
    if (typeof str !== 'string') return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#96;'
    };
    return str.replace(/[&<>"'/`]/g, char => map[char]);
  },

  /* ---------- SQL Injection Pattern Detection ---------- */
  hasSQLInjection(input) {
    if (typeof input !== 'string') return false;
    const patterns = [
      // Common SQL keywords used in injection attacks
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FETCH|DECLARE|TRUNCATE)\b)/i,
      // Comment markers used to bypass filters
      /(--|#|\/\*|\*\/)/,
      // Boolean-based injection patterns
      /(\b(OR|AND)\b\s+[\d'"].*?=.*?[\d'"])/i,
      // Stacked query injection
      /(';\s*(DROP|DELETE|INSERT|UPDATE|SELECT))/i,
      // Time-based blind injection
      /(SLEEP\s*\(|BENCHMARK\s*\(|WAITFOR\s+DELAY)/i,
      // UNION-based injection
      /(UNION\s+(ALL\s+)?SELECT)/i
    ];
    return patterns.some(pattern => pattern.test(input));
  },

  /* ---------- General Input Sanitization ---------- */
  sanitizeInput(value) {
    if (typeof value !== 'string') return '';
    return value
      .trim()
      .replace(/\0/g, '')        // Remove null bytes
      .replace(/\\/g, '\\\\')    // Escape backslashes
      .substring(0, 500);         // Limit input length
  },

  /* ---------- Comprehensive Input Validation ---------- */
  validateInput(value, type) {
    const trimmed = String(value).trim();

    // Check for SQL injection patterns (defense-in-depth)
    if (type !== 'password' && this.hasSQLInjection(trimmed)) {
      return {
        valid: false,
        error: '⚠️ Potentially harmful input detected. Please remove special SQL characters.',
        sanitized: ''
      };
    }

    const sanitized = type === 'password' ? trimmed : this.sanitizeHTML(trimmed);

    switch (type) {
      case 'email': {
        const valid = this.isValidEmail(trimmed);
        return {
          valid,
          error: valid ? '' : 'Please enter a valid email address',
          sanitized: trimmed.toLowerCase()
        };
      }

      case 'name': {
        const valid = this.isValidName(trimmed);
        return {
          valid,
          error: valid ? '' : 'Name must be 2-50 characters (letters, spaces, hyphens, apostrophes)',
          sanitized
        };
      }

      case 'password': {
        const reqs = this.checkPasswordRequirements(trimmed);
        const allMet = Object.values(reqs).every(Boolean);
        return {
          valid: allMet,
          error: allMet ? '' : 'Password does not meet all requirements',
          sanitized: trimmed  // Never HTML-encode passwords
        };
      }

      default:
        return {
          valid: trimmed.length > 0,
          error: trimmed.length > 0 ? '' : 'This field is required',
          sanitized
        };
    }
  },

  /* ---------- Rate Limiter (Anti-Brute-Force UX) ---------- */
  _rateLimits: {},

  checkRateLimit(action, maxAttempts = 5, windowMs = 60000) {
    const now = Date.now();
    if (!this._rateLimits[action]) {
      this._rateLimits[action] = [];
    }

    // Clean old entries outside the window
    this._rateLimits[action] = this._rateLimits[action].filter(
      timestamp => now - timestamp < windowMs
    );

    if (this._rateLimits[action].length >= maxAttempts) {
      const oldestAttempt = this._rateLimits[action][0];
      const waitTime = Math.ceil((windowMs - (now - oldestAttempt)) / 1000);
      return {
        allowed: false,
        waitTime,
        message: `Too many attempts. Please wait ${waitTime} seconds.`
      };
    }

    this._rateLimits[action].push(now);
    return { allowed: true, waitTime: 0, message: '' };
  },

  resetRateLimit(action) {
    delete this._rateLimits[action];
  }
};

// Make globally available
window.Validator = Validator;
