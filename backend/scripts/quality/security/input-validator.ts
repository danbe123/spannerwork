/**
 * Input Validation Test Suite
 *
 * Tests input validation and sanitization to prevent:
 * - XSS attacks
 * - SQL injection
 * - Invalid data formats
 * - Boundary violations
 */

import { QualityTestRunner, TestCase, TestResult, assert } from '../core/test-runner.js';

// ============================================================================
// VALIDATION RULES
// ============================================================================

const VALIDATION_RULES = {
  email: {
    maxLength: 255,
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  },
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: false, // Made optional for user experience
  },
  username: {
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  phone: {
    pattern: /^(\+44|0)[1-9]\d{8,10}$/, // UK phone numbers
  },
  postcode: {
    pattern: /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i, // UK postcodes
  },
  title: {
    minLength: 5,
    maxLength: 100,
  },
  description: {
    minLength: 20,
    maxLength: 5000,
  },
  price: {
    min: 100,       // £1 minimum
    max: 1000000,   // £10,000 maximum
  },
  deposit: {
    min: 0,
    maxMultiplier: 5, // Deposit cannot exceed 5x the price
  },
  rating: {
    min: 1,
    max: 5,
  },
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.length === 0) {
    return { valid: false, error: 'Email is required' };
  }
  if (email.length > VALIDATION_RULES.email.maxLength) {
    return { valid: false, error: 'Email too long' };
  }
  if (!VALIDATION_RULES.email.pattern.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

function validatePassword(password: string): { valid: boolean; error?: string } {
  const rules = VALIDATION_RULES.password;
  if (!password || password.length < rules.minLength) {
    return { valid: false, error: `Password must be at least ${rules.minLength} characters` };
  }
  if (password.length > rules.maxLength) {
    return { valid: false, error: 'Password too long' };
  }
  if (rules.requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain uppercase letter' };
  }
  if (rules.requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain lowercase letter' };
  }
  if (rules.requireNumber && !/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain a number' };
  }
  return { valid: true };
}

function validatePrice(price: number): { valid: boolean; error?: string } {
  if (typeof price !== 'number' || isNaN(price)) {
    return { valid: false, error: 'Price must be a number' };
  }
  if (price < VALIDATION_RULES.price.min) {
    return { valid: false, error: `Minimum price is £${VALIDATION_RULES.price.min / 100}` };
  }
  if (price > VALIDATION_RULES.price.max) {
    return { valid: false, error: `Maximum price is £${VALIDATION_RULES.price.max / 100}` };
  }
  return { valid: true };
}

function validateDeposit(deposit: number, price: number): { valid: boolean; error?: string } {
  if (typeof deposit !== 'number' || isNaN(deposit)) {
    return { valid: false, error: 'Deposit must be a number' };
  }
  if (deposit < VALIDATION_RULES.deposit.min) {
    return { valid: false, error: 'Deposit cannot be negative' };
  }
  const maxDeposit = price * VALIDATION_RULES.deposit.maxMultiplier;
  if (deposit > maxDeposit) {
    return { valid: false, error: `Deposit cannot exceed ${VALIDATION_RULES.deposit.maxMultiplier}x the price` };
  }
  return { valid: true };
}

function validateRating(rating: number): { valid: boolean; error?: string } {
  if (typeof rating !== 'number' || isNaN(rating)) {
    return { valid: false, error: 'Rating must be a number' };
  }
  if (rating < VALIDATION_RULES.rating.min || rating > VALIDATION_RULES.rating.max) {
    return { valid: false, error: `Rating must be between ${VALIDATION_RULES.rating.min} and ${VALIDATION_RULES.rating.max}` };
  }
  return { valid: true };
}

function validateUKPhone(phone: string): { valid: boolean; error?: string } {
  if (!phone) {
    return { valid: false, error: 'Phone number is required' };
  }
  const cleaned = phone.replace(/\s/g, '');
  if (!VALIDATION_RULES.phone.pattern.test(cleaned)) {
    return { valid: false, error: 'Invalid UK phone number' };
  }
  return { valid: true };
}

function validateUKPostcode(postcode: string): { valid: boolean; error?: string } {
  if (!postcode) {
    return { valid: false, error: 'Postcode is required' };
  }
  if (!VALIDATION_RULES.postcode.pattern.test(postcode)) {
    return { valid: false, error: 'Invalid UK postcode' };
  }
  return { valid: true };
}

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

function containsXSS(input: string): boolean {
  const xssPatterns = [
    /<script\b[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /document\./i,
    /window\./i,
    /eval\(/i,
  ];
  return xssPatterns.some(pattern => pattern.test(input));
}

function containsSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /'\s*OR\s+'1'\s*=\s*'1/i,
    /'\s*OR\s+1\s*=\s*1/i,
    /;\s*DROP\s+TABLE/i,
    /;\s*DELETE\s+FROM/i,
    /UNION\s+SELECT/i,
    /--\s*$/,
    /\/\*.*\*\//,
  ];
  return sqlPatterns.some(pattern => pattern.test(input));
}

function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// ============================================================================
// TEST CASES
// ============================================================================

const inputTests: TestCase[] = [
  // -------------------------------------------------------------------------
  // EMAIL VALIDATION
  // -------------------------------------------------------------------------
  {
    name: 'Email: Valid format',
    description: 'Standard email should pass',
    category: 'Email Validation',
    run: async (): Promise<TestResult> => {
      const result = validateEmail('user@example.com');
      return assert.true(result.valid, 'user@example.com should be valid');
    },
  },
  {
    name: 'Email: With subdomain',
    description: 'Subdomain email should pass',
    category: 'Email Validation',
    run: async (): Promise<TestResult> => {
      const result = validateEmail('user@mail.example.co.uk');
      return assert.true(result.valid, 'Subdomain emails should be valid');
    },
  },
  {
    name: 'Email: Invalid - no @',
    description: 'Missing @ should fail',
    category: 'Email Validation',
    run: async (): Promise<TestResult> => {
      const result = validateEmail('userexample.com');
      return assert.false(result.valid, 'Missing @ should be invalid');
    },
  },
  {
    name: 'Email: Invalid - no domain',
    description: 'Missing domain should fail',
    category: 'Email Validation',
    run: async (): Promise<TestResult> => {
      const result = validateEmail('user@');
      return assert.false(result.valid, 'Missing domain should be invalid');
    },
  },
  {
    name: 'Email: Too long',
    description: 'Email exceeding max length should fail',
    category: 'Email Validation',
    run: async (): Promise<TestResult> => {
      const longEmail = 'a'.repeat(250) + '@test.com';
      const result = validateEmail(longEmail);
      return assert.false(result.valid, 'Email > 255 chars should be invalid');
    },
  },

  // -------------------------------------------------------------------------
  // PASSWORD VALIDATION
  // -------------------------------------------------------------------------
  {
    name: 'Password: Valid strong password',
    description: 'Password meeting all requirements',
    category: 'Password Validation',
    run: async (): Promise<TestResult> => {
      const result = validatePassword('SecurePass123');
      return assert.true(result.valid, 'Strong password should be valid');
    },
  },
  {
    name: 'Password: Too short',
    description: 'Password under minimum length',
    category: 'Password Validation',
    run: async (): Promise<TestResult> => {
      const result = validatePassword('Short1');
      return assert.false(result.valid, 'Short password should be invalid');
    },
  },
  {
    name: 'Password: No uppercase',
    description: 'Missing uppercase letter',
    category: 'Password Validation',
    run: async (): Promise<TestResult> => {
      const result = validatePassword('lowercasepass1');
      return assert.false(result.valid, 'Missing uppercase should be invalid');
    },
  },
  {
    name: 'Password: No lowercase',
    description: 'Missing lowercase letter',
    category: 'Password Validation',
    run: async (): Promise<TestResult> => {
      const result = validatePassword('UPPERCASEPASS1');
      return assert.false(result.valid, 'Missing lowercase should be invalid');
    },
  },
  {
    name: 'Password: No number',
    description: 'Missing number',
    category: 'Password Validation',
    run: async (): Promise<TestResult> => {
      const result = validatePassword('NoNumberHere');
      return assert.false(result.valid, 'Missing number should be invalid');
    },
  },

  // -------------------------------------------------------------------------
  // PRICE VALIDATION
  // -------------------------------------------------------------------------
  {
    name: 'Price: Valid (£10)',
    description: 'Normal price should pass',
    category: 'Price Validation',
    run: async (): Promise<TestResult> => {
      const result = validatePrice(1000); // £10
      return assert.true(result.valid, '£10 should be valid');
    },
  },
  {
    name: 'Price: Minimum (£1)',
    description: 'Minimum allowed price',
    category: 'Price Validation',
    run: async (): Promise<TestResult> => {
      const result = validatePrice(100); // £1
      return assert.true(result.valid, '£1 minimum should be valid');
    },
  },
  {
    name: 'Price: Below minimum',
    description: 'Price under £1 should fail',
    category: 'Price Validation',
    run: async (): Promise<TestResult> => {
      const result = validatePrice(50); // £0.50
      return assert.false(result.valid, '£0.50 should be invalid');
    },
  },
  {
    name: 'Price: Maximum (£10,000)',
    description: 'Maximum allowed price',
    category: 'Price Validation',
    run: async (): Promise<TestResult> => {
      const result = validatePrice(1000000); // £10,000
      return assert.true(result.valid, '£10,000 should be valid');
    },
  },
  {
    name: 'Price: Above maximum',
    description: 'Price over £10,000 should fail',
    category: 'Price Validation',
    run: async (): Promise<TestResult> => {
      const result = validatePrice(1500000); // £15,000
      return assert.false(result.valid, '£15,000 should be invalid');
    },
  },
  {
    name: 'Price: NaN should fail',
    description: 'Non-number should be rejected',
    category: 'Price Validation',
    run: async (): Promise<TestResult> => {
      const result = validatePrice(NaN);
      return assert.false(result.valid, 'NaN should be invalid');
    },
  },

  // -------------------------------------------------------------------------
  // DEPOSIT VALIDATION
  // -------------------------------------------------------------------------
  {
    name: 'Deposit: Valid (equal to price)',
    description: 'Deposit equal to price is OK',
    category: 'Deposit Validation',
    run: async (): Promise<TestResult> => {
      const result = validateDeposit(1000, 1000); // £10 deposit for £10 rental
      return assert.true(result.valid, 'Deposit = price should be valid');
    },
  },
  {
    name: 'Deposit: Maximum (5x price)',
    description: 'Deposit at 5x price limit',
    category: 'Deposit Validation',
    run: async (): Promise<TestResult> => {
      const result = validateDeposit(5000, 1000); // £50 deposit for £10 rental
      return assert.true(result.valid, '5x deposit should be valid');
    },
  },
  {
    name: 'Deposit: Over maximum',
    description: 'Deposit exceeding 5x should fail',
    category: 'Deposit Validation',
    run: async (): Promise<TestResult> => {
      const result = validateDeposit(6000, 1000); // £60 deposit for £10 rental
      return assert.false(result.valid, '6x deposit should be invalid');
    },
  },
  {
    name: 'Deposit: Negative',
    description: 'Negative deposit should fail',
    category: 'Deposit Validation',
    run: async (): Promise<TestResult> => {
      const result = validateDeposit(-100, 1000);
      return assert.false(result.valid, 'Negative deposit should be invalid');
    },
  },

  // -------------------------------------------------------------------------
  // RATING VALIDATION
  // -------------------------------------------------------------------------
  {
    name: 'Rating: Valid (1-5)',
    description: 'Ratings 1-5 should pass',
    category: 'Rating Validation',
    run: async (): Promise<TestResult> => {
      for (const rating of [1, 2, 3, 4, 5]) {
        const result = validateRating(rating);
        if (!result.valid) {
          return {
            passed: false,
            score: 0,
            details: `Rating ${rating} should be valid`,
            error: result.error,
          };
        }
      }
      return {
        passed: true,
        score: 100,
        details: 'All ratings 1-5 valid',
      };
    },
  },
  {
    name: 'Rating: Below minimum',
    description: 'Rating 0 should fail',
    category: 'Rating Validation',
    run: async (): Promise<TestResult> => {
      const result = validateRating(0);
      return assert.false(result.valid, 'Rating 0 should be invalid');
    },
  },
  {
    name: 'Rating: Above maximum',
    description: 'Rating 6 should fail',
    category: 'Rating Validation',
    run: async (): Promise<TestResult> => {
      const result = validateRating(6);
      return assert.false(result.valid, 'Rating 6 should be invalid');
    },
  },

  // -------------------------------------------------------------------------
  // UK PHONE VALIDATION
  // -------------------------------------------------------------------------
  {
    name: 'Phone: Valid UK mobile',
    description: 'UK mobile number formats',
    category: 'Phone Validation',
    run: async (): Promise<TestResult> => {
      const validNumbers = ['07123456789', '+447123456789', '07123 456789'];
      for (const phone of validNumbers) {
        const result = validateUKPhone(phone);
        if (!result.valid) {
          return {
            passed: false,
            score: 0,
            details: `${phone} should be valid`,
            error: result.error,
          };
        }
      }
      return {
        passed: true,
        score: 100,
        details: 'All UK mobile formats valid',
      };
    },
  },
  {
    name: 'Phone: Valid UK landline',
    description: 'UK landline number',
    category: 'Phone Validation',
    run: async (): Promise<TestResult> => {
      const result = validateUKPhone('02012345678');
      return assert.true(result.valid, 'UK landline should be valid');
    },
  },
  {
    name: 'Phone: Invalid (too short)',
    description: 'Short number should fail',
    category: 'Phone Validation',
    run: async (): Promise<TestResult> => {
      const result = validateUKPhone('0712345');
      return assert.false(result.valid, 'Short phone should be invalid');
    },
  },

  // -------------------------------------------------------------------------
  // UK POSTCODE VALIDATION
  // -------------------------------------------------------------------------
  {
    name: 'Postcode: Valid formats',
    description: 'Various UK postcode formats',
    category: 'Postcode Validation',
    run: async (): Promise<TestResult> => {
      const validPostcodes = ['SW1A 1AA', 'M1 1AE', 'B33 8TH', 'EC1A 1BB', 'W1A 0AX'];
      for (const pc of validPostcodes) {
        const result = validateUKPostcode(pc);
        if (!result.valid) {
          return {
            passed: false,
            score: 0,
            details: `${pc} should be valid`,
            error: result.error,
          };
        }
      }
      return {
        passed: true,
        score: 100,
        details: 'All UK postcode formats valid',
      };
    },
  },
  {
    name: 'Postcode: Invalid format',
    description: 'Invalid postcode should fail',
    category: 'Postcode Validation',
    run: async (): Promise<TestResult> => {
      const result = validateUKPostcode('12345');
      return assert.false(result.valid, 'US zip code format should be invalid');
    },
  },

  // -------------------------------------------------------------------------
  // XSS DETECTION
  // -------------------------------------------------------------------------
  {
    name: 'XSS: Script tag detected',
    description: 'Basic XSS script tag',
    category: 'XSS Detection',
    run: async (): Promise<TestResult> => {
      const result = containsXSS('<script>alert("xss")</script>');
      return assert.true(result, 'Script tag should be detected');
    },
  },
  {
    name: 'XSS: Event handler detected',
    description: 'onclick attribute XSS',
    category: 'XSS Detection',
    run: async (): Promise<TestResult> => {
      const result = containsXSS('<img src="x" onerror="alert(1)">');
      return assert.true(result, 'Event handler should be detected');
    },
  },
  {
    name: 'XSS: javascript: protocol',
    description: 'javascript: URL scheme',
    category: 'XSS Detection',
    run: async (): Promise<TestResult> => {
      const result = containsXSS('<a href="javascript:alert(1)">');
      return assert.true(result, 'javascript: should be detected');
    },
  },
  {
    name: 'XSS: Clean text passes',
    description: 'Normal text should not be flagged',
    category: 'XSS Detection',
    run: async (): Promise<TestResult> => {
      const result = containsXSS('This is a normal description for a drill.');
      return assert.false(result, 'Normal text should not be flagged');
    },
  },

  // -------------------------------------------------------------------------
  // SQL INJECTION DETECTION
  // -------------------------------------------------------------------------
  {
    name: 'SQL: OR 1=1 detected',
    description: 'Classic SQL injection',
    category: 'SQL Injection',
    run: async (): Promise<TestResult> => {
      const result = containsSQLInjection("' OR '1'='1");
      return assert.true(result, 'OR 1=1 should be detected');
    },
  },
  {
    name: 'SQL: DROP TABLE detected',
    description: 'Destructive SQL injection',
    category: 'SQL Injection',
    run: async (): Promise<TestResult> => {
      const result = containsSQLInjection('; DROP TABLE users;--');
      return assert.true(result, 'DROP TABLE should be detected');
    },
  },
  {
    name: 'SQL: UNION SELECT detected',
    description: 'Data extraction SQL injection',
    category: 'SQL Injection',
    run: async (): Promise<TestResult> => {
      const result = containsSQLInjection("1 UNION SELECT password FROM users");
      return assert.true(result, 'UNION SELECT should be detected');
    },
  },
  {
    name: 'SQL: Clean text passes',
    description: 'Normal text should not be flagged',
    category: 'SQL Injection',
    run: async (): Promise<TestResult> => {
      const result = containsSQLInjection("O'Brien's Tool Hire - Best tools in town!");
      return assert.false(result, "Normal apostrophes shouldn't trigger");
    },
  },

  // -------------------------------------------------------------------------
  // SANITIZATION
  // -------------------------------------------------------------------------
  {
    name: 'Sanitize: HTML brackets',
    description: 'Angle brackets should be escaped',
    category: 'Sanitization',
    run: async (): Promise<TestResult> => {
      const result = sanitizeString('<script>');
      const containsRaw = result.includes('<') || result.includes('>');
      return assert.false(containsRaw, 'Brackets should be escaped');
    },
  },
  {
    name: 'Sanitize: Quotes escaped',
    description: 'Quotes should be escaped',
    category: 'Sanitization',
    run: async (): Promise<TestResult> => {
      const result = sanitizeString('Test "with" quotes');
      const containsRaw = result.includes('"');
      return assert.false(containsRaw, 'Double quotes should be escaped');
    },
  },
];

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runInputValidation(): Promise<void> {
  const runner = new QualityTestRunner('Input Validation & Security');
  runner.addTests(inputTests);
  await runner.runAll();
}

export { inputTests, runInputValidation };

if (process.argv[1]?.includes('input-validator')) {
  runInputValidation().catch(console.error);
}
