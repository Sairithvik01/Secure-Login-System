/* ================================================================
   Authentication Module
   Handles user registration, login, logout, password reset,
   email verification, session management, and login history
   ================================================================ */

const Auth = {
  _twoFactorIssuer: 'SecureAuth',
  _twoFactorPendingKey: 'secureauth-2fa-pending-login',
  _twoFactorVerifiedPrefix: 'secureauth-2fa-verified:',

  _getTwoFactorVerifiedKey(uid) {
    return `${this._twoFactorVerifiedPrefix}${uid}`;
  },

  _setTwoFactorPendingLogin(data) {
    sessionStorage.setItem(this._twoFactorPendingKey, JSON.stringify(data));
  },

  _getTwoFactorPendingLogin() {
    try {
      return JSON.parse(sessionStorage.getItem(this._twoFactorPendingKey) || 'null');
    } catch (error) {
      return null;
    }
  },

  _clearTwoFactorPendingLogin() {
    sessionStorage.removeItem(this._twoFactorPendingKey);
  },

  _markTwoFactorVerified(uid) {
    sessionStorage.setItem(this._getTwoFactorVerifiedKey(uid), 'true');
    this._clearTwoFactorPendingLogin();
  },

  _clearTwoFactorVerified(uid) {
    if (uid) {
      sessionStorage.removeItem(this._getTwoFactorVerifiedKey(uid));
    }
  },

  isTwoFactorVerified(uid = auth.currentUser?.uid) {
    if (!uid) return false;
    return sessionStorage.getItem(this._getTwoFactorVerifiedKey(uid)) === 'true';
  },

  _generateRandomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  },

  _bytesToBase32(bytes) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of bytes) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }

    return output;
  },

  _base32ToBytes(base32String) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const normalized = base32String.replace(/=+$/g, '').toUpperCase().replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const bytes = [];

    for (const character of normalized) {
      const index = alphabet.indexOf(character);
      if (index === -1) continue;

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return new Uint8Array(bytes);
  },

  _buildOtpAuthUrl(email, secret) {
    const label = encodeURIComponent(`${this._twoFactorIssuer}:${email || 'SecureAuth User'}`);
    const issuer = encodeURIComponent(this._twoFactorIssuer);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  },

  async _generateTotpCode(secret, time = Date.now()) {
    const keyBytes = this._base32ToBytes(secret);
    const counter = Math.floor(time / 30000);
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setUint32(4, counter, false);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer));
    const offset = signature[signature.length - 1] & 0x0f;
    const binary = ((signature[offset] & 0x7f) << 24)
      | (signature[offset + 1] << 16)
      | (signature[offset + 2] << 8)
      | signature[offset + 3];

    return String(binary % 1000000).padStart(6, '0');
  },

  async verifyTwoFactorCode(secret, code, allowedDrift = 1) {
    const cleanCode = String(code || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanCode)) {
      return false;
    }

    for (let drift = -allowedDrift; drift <= allowedDrift; drift += 1) {
      const candidate = await this._generateTotpCode(secret, Date.now() + drift * 30000);
      if (candidate === cleanCode) {
        return true;
      }
    }

    return false;
  },

  async generateTwoFactorSecret(email = '') {
    const secret = this._bytesToBase32(this._generateRandomBytes(20));
    return {
      secret,
      otpauthUrl: this._buildOtpAuthUrl(email, secret)
    };
  },

  async completeTwoFactorLogin(code) {
    const user = auth.currentUser;
    if (!user) throw new Error('No user is currently signed in.');

    const pendingLogin = this._getTwoFactorPendingLogin();
    if (!pendingLogin || pendingLogin.uid !== user.uid) {
      throw new Error('No pending two-factor login challenge found.');
    }

    const rateCheck = Validator.checkRateLimit('two-factor-login', 5, 60000);
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.message);
    }

    const profile = await this.getUserProfile();
    if (!profile?.twoFactorEnabled || !profile.twoFactorSecret) {
      throw new Error('Two-factor authentication is not enabled for this account.');
    }

    const isValid = await this.verifyTwoFactorCode(profile.twoFactorSecret, code);
    if (!isValid) {
      throw new Error('Invalid two-factor code. Please try again.');
    }

    try {
      await db.collection('users').doc(user.uid).update({
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        loginCount: firebase.firestore.FieldValue.increment(1),
        emailVerified: user.emailVerified,
        email: user.email,
        displayName: user.displayName || profile.displayName || 'User',
        twoFactorLastVerifiedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (updateError) {
      // If document doesn't exist, create it with merge
      if (updateError.code === 'not-found' || updateError.message.includes('No document')) {
        await db.collection('users').doc(user.uid).set({
          lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
          loginCount: 1,
          emailVerified: user.emailVerified,
          email: user.email,
          displayName: user.displayName || profile.displayName || 'User',
          twoFactorLastVerifiedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } else {
        throw updateError;
      }
    }

    await this._logLoginActivity(user.uid, 'login');

    this._markTwoFactorVerified(user.uid);
    Validator.resetRateLimit('login');
    Validator.resetRateLimit('two-factor-login');

    return {
      success: true,
      user,
      message: 'Two-factor verification successful!'
    };
  },

  async enableTwoFactorForCurrentUser(secret, code) {
    const user = auth.currentUser;
    if (!user) throw new Error('No user is currently signed in.');

    const normalizedSecret = String(secret || '').trim().replace(/\s+/g, '').toUpperCase();
    if (!normalizedSecret) {
      throw new Error('Two-factor secret is required.');
    }

    const rateCheck = Validator.checkRateLimit('two-factor-enable', 5, 300000);
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.message);
    }

    const isValid = await this.verifyTwoFactorCode(normalizedSecret, code);
    if (!isValid) {
      throw new Error('Invalid verification code. Please try again.');
    }

    try {
      await db.collection('users').doc(user.uid).update({
        twoFactorEnabled: true,
        twoFactorSecret: normalizedSecret,
        twoFactorEnabledAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (updateError) {
      if (updateError.code === 'not-found' || updateError.message.includes('No document')) {
        await db.collection('users').doc(user.uid).set({
          twoFactorEnabled: true,
          twoFactorSecret: normalizedSecret,
          twoFactorEnabledAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } else {
        throw updateError;
      }
    }

    this._markTwoFactorVerified(user.uid);
    Validator.resetRateLimit('two-factor-enable');

    return {
      success: true,
      message: 'Two-factor authentication has been enabled.'
    };
  },

  async disableTwoFactorForCurrentUser() {
    const user = auth.currentUser;
    if (!user) throw new Error('No user is currently signed in.');

    try {
      await db.collection('users').doc(user.uid).update({
        twoFactorEnabled: false,
        twoFactorSecret: ''
      });
    } catch (updateError) {
      if (updateError.code === 'not-found' || updateError.message.includes('No document')) {
        await db.collection('users').doc(user.uid).set({
          twoFactorEnabled: false,
          twoFactorSecret: ''
        }, { merge: true });
      } else {
        throw updateError;
      }
    }

    this._clearTwoFactorVerified(user.uid);
    this._clearTwoFactorPendingLogin();

    return {
      success: true,
      message: 'Two-factor authentication has been disabled.'
    };
  },

  /* ========== REGISTER NEW USER ========== */
  async register(fullName, email, password) {
    // Rate limit check
    const rateCheck = Validator.checkRateLimit('register', 5, 300000); // 5 attempts per 5 min
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.message);
    }

    // Validate inputs
    const nameResult = Validator.validateInput(fullName, 'name');
    if (!nameResult.valid) throw new Error(nameResult.error);

    const emailResult = Validator.validateInput(email, 'email');
    if (!emailResult.valid) throw new Error(emailResult.error);

    const passResult = Validator.validateInput(password, 'password');
    if (!passResult.valid) throw new Error(passResult.error);

    try {
      // Create user with Firebase Auth
      // Firebase automatically hashes the password using scrypt (comparable to bcrypt)
      const userCredential = await auth.createUserWithEmailAndPassword(
        emailResult.sanitized,
        password
      );
      const user = userCredential.user;

      // Update display name
      await user.updateProfile({
        displayName: nameResult.sanitized
      });

      // Send email verification
      await user.sendEmailVerification();

      // Create user profile document in Firestore
      await db.collection('users').doc(user.uid).set({
        displayName: nameResult.sanitized,
        email: emailResult.sanitized,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        loginCount: 1,
        emailVerified: false,
        twoFactorEnabled: false,
        twoFactorSecret: ''
      });

      // Log the registration as first login
      await this._logLoginActivity(user.uid, 'registration');

      return {
        success: true,
        user,
        message: 'Account created successfully! Please check your email for verification.'
      };
    } catch (error) {
      throw new Error(this._getErrorMessage(error.code));
    }
  },

  /* ========== LOGIN ========== */
  async login(email, password, rememberMe = false) {
    // Rate limit check
    const rateCheck = Validator.checkRateLimit('login', 5, 60000); // 5 attempts per minute
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.message);
    }

    // Validate inputs
    const emailResult = Validator.validateInput(email, 'email');
    if (!emailResult.valid) throw new Error(emailResult.error);

    // Set persistence based on "Remember Me"
    const persistence = rememberMe
      ? firebase.auth.Auth.Persistence.LOCAL      // Survives browser close
      : firebase.auth.Auth.Persistence.SESSION;   // Cleared on tab close

    try {
      await auth.setPersistence(persistence);

      // Sign in with Firebase Auth
      const userCredential = await auth.signInWithEmailAndPassword(
        emailResult.sanitized,
        password
      );
      const user = userCredential.user;

      // Get or initialize user profile
      const userDoc = await db.collection('users').doc(user.uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      const requiresTwoFactor = Boolean(userData.twoFactorEnabled && userData.twoFactorSecret);

      if (!userDoc.exists) {
        // First time: create full profile document (create rule allows createdAt)
        await db.collection('users').doc(user.uid).set({
          displayName: userData.displayName || user.displayName || 'User',
          email: emailResult.sanitized,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
          loginCount: 1,
          emailVerified: user.emailVerified,
          twoFactorEnabled: false,
          twoFactorSecret: ''
        });
      } else if (!requiresTwoFactor) {
        // Subsequent logins: NEVER include createdAt — the Firestore update rule
        // rejects any write that touches createdAt (even with the same value),
        // which would silently block loginCount and lastLoginAt from updating.
        try {
          await db.collection('users').doc(user.uid).update({
            lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
            loginCount: firebase.firestore.FieldValue.increment(1),
            emailVerified: user.emailVerified,
            email: emailResult.sanitized,
            displayName: userData.displayName || user.displayName || 'User'
          });
        } catch (updateError) {
          // If update fails (document might not exist), try creating it
          if (updateError.code === 'not-found' || updateError.message.includes('No document')) {
            await db.collection('users').doc(user.uid).set({
              displayName: userData.displayName || user.displayName || 'User',
              email: emailResult.sanitized,
              lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
              loginCount: 1,
              emailVerified: user.emailVerified,
              twoFactorEnabled: false,
              twoFactorSecret: ''
            }, { merge: true });
          } else {
            throw updateError;
          }
        }
      } else {
        this._setTwoFactorPendingLogin({
          uid: user.uid,
          email: user.email,
          rememberMe: Boolean(rememberMe)
        });
      }

      if (requiresTwoFactor) {
        return {
          success: true,
          user,
          twoFactorRequired: true,
          message: 'Two-factor authentication is required. Enter the 6-digit code from your authenticator app.'
        };
      }

      // Log login activity
      await this._logLoginActivity(user.uid, 'login');

      // Reset rate limiter on successful login
      Validator.resetRateLimit('login');

      return {
        success: true,
        user,
        message: 'Login successful!'
      };
    } catch (error) {
      throw new Error(this._getErrorMessage(error.code));
    }
  },

  /* ========== LOGOUT ========== */
  async logout() {
    try {
      const user = auth.currentUser;

      // Log the logout activity before signing out
      if (user) {
        await this._logLoginActivity(user.uid, 'logout');
        this._clearTwoFactorVerified(user.uid);
      }

      this._clearTwoFactorPendingLogin();

      await auth.signOut();

      return { success: true, message: 'Logged out successfully.' };
    } catch (error) {
      throw new Error('Failed to log out. Please try again.');
    }
  },

  /* ========== FORGOT PASSWORD ========== */
  async resetPassword(email) {
    // Rate limit check
    const rateCheck = Validator.checkRateLimit('reset', 3, 300000); // 3 per 5 min
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.message);
    }

    const emailResult = Validator.validateInput(email, 'email');
    if (!emailResult.valid) throw new Error(emailResult.error);

    try {
      await auth.sendPasswordResetEmail(emailResult.sanitized);

      return {
        success: true,
        message: 'Password reset email sent. Please check your inbox.'
      };
    } catch (error) {
      // Don't reveal if email exists or not (security best practice)
      return {
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      };
    }
  },

  /* ========== RESEND EMAIL VERIFICATION ========== */
  async resendVerificationEmail() {
    const user = auth.currentUser;
    if (!user) throw new Error('No user is currently signed in.');

    const rateCheck = Validator.checkRateLimit('verify-email', 3, 300000);
    if (!rateCheck.allowed) throw new Error(rateCheck.message);

    try {
      await user.sendEmailVerification();
      return { success: true, message: 'Verification email sent!' };
    } catch (error) {
      throw new Error('Failed to send verification email. Please try again later.');
    }
  },

  /* ========== CHANGE PASSWORD ========== */
  async changePassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error('No user is currently signed in.');

    const passResult = Validator.validateInput(newPassword, 'password');
    if (!passResult.valid) throw new Error(passResult.error);

    try {
      // Re-authenticate the user first (required by Firebase for sensitive operations)
      const credential = firebase.auth.EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await user.reauthenticateWithCredential(credential);

      // Update the password
      await user.updatePassword(newPassword);

      // Log the activity
      await this._logLoginActivity(user.uid, 'password_change');

      return { success: true, message: 'Password changed successfully!' };
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        throw new Error('Current password is incorrect.');
      }
      throw new Error(this._getErrorMessage(error.code));
    }
  },

  /* ========== AUTH STATE OBSERVER ========== */
  onAuthStateChanged(callback) {
    return auth.onAuthStateChanged((user) => {
      callback(user);
    });
  },

  /* ========== ROUTE GUARD ========== */
  requireAuth(redirectUrl = 'login.html') {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (!user) {
          unsubscribe();
          window.location.href = redirectUrl;
          return;
        }

        const profile = await this.getUserProfile();
        const pendingLogin = this._getTwoFactorPendingLogin();
        if (profile?.twoFactorEnabled && !this.isTwoFactorVerified(user.uid)) {
          if (!pendingLogin || pendingLogin.uid !== user.uid) {
            this._setTwoFactorPendingLogin({
              uid: user.uid,
              email: user.email,
              rememberMe: false
            });
          }
          unsubscribe();
          window.location.href = redirectUrl;
          return;
        }

        unsubscribe();
        resolve(user);
      });
    });
  },

  /* ========== REDIRECT IF ALREADY LOGGED IN ========== */
  redirectIfAuthenticated(redirectUrl = 'dashboard.html') {
    auth.onAuthStateChanged((user) => {
      if (user) {
        window.location.href = redirectUrl;
      }
    });
  },

  /* ========== GET CURRENT USER PROFILE ========== */
  async getUserProfile() {
    const user = auth.currentUser;
    if (!user) return null;

    // Firebase Auth metadata provides reliable creation/last-sign-in times
    // even when Firestore server timestamps are still pending after login
    const authCreatedAt = user.metadata?.creationTime
      ? new Date(user.metadata.creationTime)
      : null;
    const authLastLoginAt = user.metadata?.lastSignInTime
      ? new Date(user.metadata.lastSignInTime)
      : null;

    try {
      const doc = await db.collection('users').doc(user.uid).get();
      if (doc.exists) {
        const data = doc.data();

        // Resolve timestamps: prefer Firestore (if not pending/null), fallback to Auth metadata
        const resolvedCreatedAt = data.createdAt || authCreatedAt;
        const resolvedLastLoginAt = data.lastLoginAt || authLastLoginAt;

        return {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || data.displayName,
          emailVerified: user.emailVerified,
          ...data,
          createdAt: resolvedCreatedAt,
          lastLoginAt: resolvedLastLoginAt
        };
      }
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        createdAt: authCreatedAt,
        lastLoginAt: authLastLoginAt
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        createdAt: authCreatedAt,
        lastLoginAt: authLastLoginAt
      };
    }
  },

  /* ========== GET LOGIN COUNT FROM HISTORY ========== */
  async getLoginCount() {
    const user = auth.currentUser;
    if (!user) return 0;

    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      const storedLoginCount = userDoc.exists ? userDoc.data().loginCount : null;

      // Prefer the persisted counter when it is available, but do not return
      // a stale zero if the history collection already has activity records.
      if (typeof storedLoginCount === 'number' && storedLoginCount > 0) {
        return storedLoginCount;
      }

      // Fetch all history entries without a where clause (avoids Firestore index issues).
      // Count 'login' AND 'registration' as login events; if older records use a
      // different action label, fall back to the total history length instead of 0.
      const snapshot = await db
        .collection('users')
        .doc(user.uid)
        .collection('loginHistory')
        .get();

      const loginEvents = snapshot.docs.filter(doc => {
        const action = doc.data().action;
        return action === 'login' || action === 'registration';
      }).length;

      if (loginEvents > 0) {
        return loginEvents;
      }

      if (snapshot.size > 0) {
        return snapshot.size;
      }

      return typeof storedLoginCount === 'number' ? storedLoginCount : 0;
    } catch (error) {
      console.error('Error counting logins:', error);
      return 0;
    }
  },

  /* ========== GET LOGIN HISTORY ========== */
  async getLoginHistory(limit = 10) {
    const user = auth.currentUser;
    if (!user) return [];

    try {
      const snapshot = await db
        .collection('users')
        .doc(user.uid)
        .collection('loginHistory')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
    } catch (error) {
      console.error('Error fetching login history:', error);
      return [];
    }
  },

  /* ========== PRIVATE: LOG LOGIN ACTIVITY ========== */
  async _logLoginActivity(uid, action) {
    try {
      await db
        .collection('users')
        .doc(uid)
        .collection('loginHistory')
        .add({
          action,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
          screenResolution: `${screen.width}x${screen.height}`
        });
    } catch (error) {
      // Non-critical error — don't break the flow
      console.warn('Failed to log activity:', error);
    }
  },

  /* ========== PRIVATE: FIREBASE ERROR MESSAGE MAPPING ========== */
  _getErrorMessage(errorCode) {
    const messages = {
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/email-already-in-use': 'An account already exists with this email.',
      'auth/weak-password': 'Password is too weak. Please use a stronger password.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/user-disabled': 'This account has been disabled. Contact support.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your internet connection.',
      'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
      'auth/requires-recent-login': 'Please log in again before making this change.',
      'auth/invalid-credential': 'Invalid email or password. Please try again.'
    };
    return messages[errorCode] || 'An unexpected error occurred. Please try again.';
  }
};

// Make globally available
window.Auth = Auth;
