/* ================================================================
   Dashboard Module
   Handles dashboard initialization, user profile display,
   login history, session timer, and security settings
   ================================================================ */

const Dashboard = {

  _sessionStartTime: null,
  _sessionTimerInterval: null,
  _currentProfile: null,
  _scoreBreakdown: null,
  _twoFactorSetupSecret: null,

  /* ========== INITIALIZE DASHBOARD ========== */
  async init() {
    try {
      // Route guard — redirect to login if not authenticated
      const user = await Auth.requireAuth('login.html');

      // Start session timer
      this._startSessionTimer();

      // Load all dashboard data
      await Promise.all([
        this._loadUserProfile(),
        this._loadLoginHistory(),
        this._updateStats()
      ]);

      // Setup event listeners
      this._setupEventListeners();

      // Hide loading and show content
      document.getElementById('dashboard-loading')?.classList.add('hidden');
      document.getElementById('dashboard-content')?.classList.remove('hidden');

    } catch (error) {
      console.error('Dashboard init error:', error);
      UI.error('Error', 'Failed to load dashboard. Please refresh the page.');
    }
  },

  /* ========== LOAD USER PROFILE ========== */
  async _loadUserProfile() {
    const profile = await Auth.getUserProfile();
    if (!profile) return;

    // Update navbar user info
    const avatarEl = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-display-name');
    const emailEl = document.getElementById('user-email');

    if (avatarEl) {
      const initials = (profile.displayName || 'U')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
      avatarEl.textContent = initials;
    }

    if (nameEl) nameEl.textContent = Validator.sanitizeHTML(profile.displayName || 'User');
    if (emailEl) emailEl.textContent = Validator.sanitizeHTML(profile.email || '');

    // Update welcome message
    const welcomeEl = document.getElementById('welcome-name');
    if (welcomeEl) {
      const firstName = (profile.displayName || 'User').split(' ')[0];
      welcomeEl.textContent = Validator.sanitizeHTML(firstName);
    }

    // Update profile section
    const profileData = {
      'profile-name': profile.displayName || 'Not set',
      'profile-email': profile.email || 'Not set',
      'profile-created': profile.createdAt
        ? this._formatDate(this._toDate(profile.createdAt))
        : 'Unknown',
      'profile-verified': profile.emailVerified ? '✓ Verified' : '✗ Not Verified'
    };

    Object.entries(profileData).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Validator.sanitizeHTML(String(value));
    });

    // Update verification badge color
    const verifiedEl = document.getElementById('profile-verified');
    if (verifiedEl) {
      verifiedEl.style.color = profile.emailVerified ? 'var(--success)' : 'var(--warning)';
    }

    this._refreshTwoFactorUi(profile);
  },

  /* ========== LOAD LOGIN HISTORY ========== */
  async _loadLoginHistory() {
    const history = await Auth.getLoginHistory(10);
    const tableBody = document.getElementById('history-table-body');
    const emptyState = document.getElementById('history-empty');

    if (!tableBody) return;

    if (history.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tableBody.innerHTML = history.map(entry => {
      const actionLabels = {
        'login': 'Login',
        'logout': 'Logout',
        'registration': 'Registration',
        'password_change': 'Password Changed'
      };

      const actionBadgeClass = {
        'login': 'success',
        'logout': 'error',
        'registration': 'success',
        'password_change': 'success'
      };

      const action = Validator.sanitizeHTML(actionLabels[entry.action] || entry.action);
      const badgeClass = actionBadgeClass[entry.action] || 'success';
      const date = this._formatDateTime(entry.timestamp);
      const platform = Validator.sanitizeHTML(this._parsePlatform(entry.userAgent || ''));

      return `
        <tr>
          <td>
            <span class="status-badge ${badgeClass}">${action}</span>
          </td>
          <td>${date}</td>
          <td>${platform}</td>
        </tr>
      `;
    }).join('');
  },

  /* ========== UPDATE STATS ========== */
  async _updateStats() {
    // Fetch profile and login count in parallel
    const [profile, loginCount] = await Promise.all([
      Auth.getUserProfile(),
      Auth.getLoginCount()
    ]);

    console.log('Profile data:', profile, 'Login count:', loginCount);
    this._currentProfile = profile;

    // Login count — sourced from actual loginHistory entries
    const loginCountEl = document.getElementById('stat-logins');
    if (loginCountEl) {
      loginCountEl.textContent = loginCount;
    }

    if (!profile) {
      return;
    }


    // Account age
    const accountAgeEl = document.getElementById('stat-account-age');
    if (accountAgeEl) {
      if (profile.createdAt) {
        try {
          const createdDate = this._toDate(profile.createdAt);
          accountAgeEl.textContent = this._getAccountAge(createdDate);
        } catch (e) {
          accountAgeEl.textContent = 'N/A';
          console.warn('Error calculating account age:', e);
        }
      } else {
        accountAgeEl.textContent = 'Not available';
      }
    }

    // Last login
    const lastLoginEl = document.getElementById('stat-last-login');
    if (lastLoginEl) {
      if (profile.lastLoginAt) {
        try {
          const lastDate = this._toDate(profile.lastLoginAt);
          lastLoginEl.textContent = this._getTimeAgo(lastDate);
        } catch (e) {
          lastLoginEl.textContent = 'N/A';
          console.warn('Error calculating last login:', e);
        }
      } else {
        lastLoginEl.textContent = 'Not available';
      }
    }

    // Security score
    const securityScoreEl = document.getElementById('stat-security');
    if (securityScoreEl) {
      const scoreData = this._calculateSecurityScore(profile);
      const score = scoreData.score;
      this._scoreBreakdown = scoreData;
      securityScoreEl.textContent = `${score}%`;
    }
  },

  /* ========== SESSION TIMER ========== */
  _startSessionTimer() {
    this._sessionStartTime = Date.now();
    const timerEl = document.getElementById('session-duration');

    if (!timerEl) return;

    this._sessionTimerInterval = setInterval(() => {
      const elapsed = Date.now() - this._sessionStartTime;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);

      if (hours > 0) {
        timerEl.textContent = `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        timerEl.textContent = `${minutes}m ${seconds}s`;
      } else {
        timerEl.textContent = `${seconds}s`;
      }
    }, 1000);
  },

  /* ========== EVENT LISTENERS ========== */
  _setupEventListeners() {
    const infoModal = document.getElementById('info-modal');
    const infoModalTitle = document.getElementById('info-modal-title');
    const infoModalBody = document.getElementById('info-modal-body');
    const closeInfoModalBtn = document.getElementById('close-info-modal');

    const openInfoModal = (title, bodyHtml) => {
      if (!infoModal || !infoModalTitle || !infoModalBody) return;
      infoModalTitle.textContent = title;
      infoModalBody.innerHTML = bodyHtml;
      infoModal.style.display = 'flex';
    };

    const closeInfoModal = () => {
      if (!infoModal) return;
      infoModal.style.display = 'none';
    };

    const aboutBtn = document.getElementById('about-btn');
    if (aboutBtn) {
      aboutBtn.addEventListener('click', () => {
        openInfoModal('About SecureAuth', this._buildAboutContent());
      });
    }

    const securityScoreCard = document.getElementById('security-score-card');
    if (securityScoreCard) {
      const showSecurityScore = () => {
        openInfoModal('Why your security score is what it is', this._buildSecurityScoreContent());
      };

      securityScoreCard.addEventListener('click', showSecurityScore);
      securityScoreCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showSecurityScore();
        }
      });
    }

    if (closeInfoModalBtn) {
      closeInfoModalBtn.addEventListener('click', closeInfoModal);
    }

    if (infoModal) {
      infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal || e.target.classList.contains('modal-backdrop')) {
          closeInfoModal();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeInfoModal();
      }
    });

    const twoFactorModal = document.getElementById('two-factor-modal');
    const twoFactorBtn = document.getElementById('two-factor-btn');
    const closeTwoFactorModalBtn = document.getElementById('close-two-factor-modal');
    const cancelTwoFactorSetupBtn = document.getElementById('cancel-two-factor-setup');
    const regenerateTwoFactorSecretBtn = document.getElementById('regenerate-two-factor-secret');
    const copyTwoFactorSecretBtn = document.getElementById('copy-two-factor-secret');
    const confirmTwoFactorSetupBtn = document.getElementById('confirm-two-factor-setup');
    const twoFactorSecretValue = document.getElementById('two-factor-secret-value');
    const twoFactorSetupCode = document.getElementById('two-factor-setup-code');

    const closeTwoFactorModal = () => {
      if (twoFactorModal) {
        twoFactorModal.style.display = 'none';
      }
      if (twoFactorSetupCode) {
        twoFactorSetupCode.value = '';
      }
    };

    const loadTwoFactorSecret = async () => {
      const profile = this._currentProfile || await Auth.getUserProfile();
      if (!profile) return;

      const secretData = await Auth.generateTwoFactorSecret(profile.email || '');
      this._twoFactorSetupSecret = secretData.secret;

      if (twoFactorSecretValue) {
        twoFactorSecretValue.textContent = secretData.secret;
      }

      // Generate and display QR code
      const qrContainer = document.getElementById('two-factor-qr-code');
      if (qrContainer) {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
          text: secretData.otpauthUrl,
          width: 200,
          height: 200,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      }
    };

    const openTwoFactorModal = async () => {
      if (!twoFactorModal) return;
      await loadTwoFactorSecret();
      twoFactorModal.style.display = 'flex';
      setTimeout(() => twoFactorSetupCode?.focus(), 0);
    };

    if (twoFactorBtn) {
      twoFactorBtn.addEventListener('click', async () => {
        if (this._currentProfile?.twoFactorEnabled) {
          const confirmed = window.confirm('Disable two-factor authentication for this account?');
          if (!confirmed) return;

          try {
            UI.showLoading('Disabling two-factor authentication...');
            await Auth.disableTwoFactorForCurrentUser();
            UI.hideLoading();
            UI.success('Updated', 'Two-factor authentication has been disabled.');
            await this._loadUserProfile();
            await this._updateStats();
          } catch (error) {
            UI.hideLoading();
            UI.error('Error', error.message);
          }
          return;
        }

        openTwoFactorModal();
      });
    }

    if (closeTwoFactorModalBtn) {
      closeTwoFactorModalBtn.addEventListener('click', closeTwoFactorModal);
    }

    if (cancelTwoFactorSetupBtn) {
      cancelTwoFactorSetupBtn.addEventListener('click', closeTwoFactorModal);
    }

    if (regenerateTwoFactorSecretBtn) {
      regenerateTwoFactorSecretBtn.addEventListener('click', async () => {
        await loadTwoFactorSecret();
      });
    }

    if (copyTwoFactorSecretBtn) {
      copyTwoFactorSecretBtn.addEventListener('click', async () => {
        if (!this._twoFactorSetupSecret) return;
        await navigator.clipboard.writeText(this._twoFactorSetupSecret);
        UI.info('Copied', 'Two-factor secret copied to clipboard.');
      });
    }

    if (confirmTwoFactorSetupBtn) {
      confirmTwoFactorSetupBtn.addEventListener('click', async () => {
        const code = (twoFactorSetupCode?.value || '').trim();

        if (!/^\d{6}$/.test(code)) {
          UI.error('Validation Error', 'Enter the 6-digit code from your authenticator app.');
          return;
        }

        if (!this._twoFactorSetupSecret) {
          UI.error('Error', 'Two-factor secret is missing. Please generate a new secret.');
          return;
        }

        try {
          UI.showLoading('Enabling two-factor authentication...');
          await Auth.enableTwoFactorForCurrentUser(this._twoFactorSetupSecret, code);
          UI.hideLoading();
          UI.success('Enabled', 'Two-factor authentication is now active.');
          closeTwoFactorModal();
          await this._loadUserProfile();
          await this._updateStats();
        } catch (error) {
          UI.hideLoading();
          UI.error('Error', error.message);
        }
      });
    }

    if (twoFactorModal) {
      twoFactorModal.addEventListener('click', (e) => {
        if (e.target === twoFactorModal || e.target.classList.contains('modal-backdrop')) {
          closeTwoFactorModal();
        }
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          UI.showLoading('Logging out...');
          await Auth.logout();
          window.location.href = 'login.html';
        } catch (error) {
          UI.hideLoading();
          UI.error('Error', error.message);
        }
      });
    }

    // Edit name button
    const editNameBtn = document.getElementById('edit-name-btn');
    if (editNameBtn) {
      editNameBtn.addEventListener('click', () => {
        const currentName = document.getElementById('profile-name').textContent;
        document.getElementById('edit-name-input').value = currentName;
        document.getElementById('edit-name-modal').style.display = 'flex';
      });
    }

    // Close edit modal
    const closeEditBtn = document.getElementById('close-edit-modal');
    if (closeEditBtn) {
      closeEditBtn.addEventListener('click', () => {
        document.getElementById('edit-name-modal').style.display = 'none';
      });
    }

    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => {
        document.getElementById('edit-name-modal').style.display = 'none';
      });
    }

    // Close modal on backdrop click
    const modal = document.getElementById('edit-name-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
          modal.style.display = 'none';
        }
      });
    }

    // Edit name form submission
    const editNameForm = document.getElementById('edit-name-form');
    if (editNameForm) {
      editNameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = document.getElementById('edit-name-input').value.trim();

        // Validate name
        const nameResult = Validator.validateInput(newName, 'name');
        if (!nameResult.valid) {
          UI.error('Validation Error', nameResult.error);
          return;
        }

        try {
          UI.showLoading('Updating name...');
          const user = auth.currentUser;
          if (!user) throw new Error('Not authenticated');

          // Update Firebase Auth profile
          await user.updateProfile({
            displayName: nameResult.sanitized
          });

          // Update Firestore
          try {
            await db.collection('users').doc(user.uid).update({
              displayName: nameResult.sanitized
            });
          } catch (updateError) {
            if (updateError.code === 'not-found' || updateError.message.includes('No document')) {
              await db.collection('users').doc(user.uid).set({
                displayName: nameResult.sanitized
              }, { merge: true });
            } else {
              throw updateError;
            }
          }

          UI.hideLoading();
          UI.success('Success', 'Name updated successfully!');

          // Close modal and refresh profile
          document.getElementById('edit-name-modal').style.display = 'none';
          await this._loadUserProfile();

        } catch (error) {
          UI.hideLoading();
          UI.error('Error', error.message || 'Failed to update name');
        }
      });
    }

    // Change password form
    const changePassForm = document.getElementById('change-password-form');
    if (changePassForm) {
      changePassForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPass = document.getElementById('current-password').value;
        const newPass = document.getElementById('new-password').value;
        const confirmPass = document.getElementById('confirm-new-password').value;

        if (newPass !== confirmPass) {
          UI.error('Error', 'New passwords do not match.');
          return;
        }

        try {
          UI.showLoading('Changing password...');
          await Auth.changePassword(currentPass, newPass);
          UI.hideLoading();
          UI.success('Success', 'Password changed successfully!');
          changePassForm.reset();
        } catch (error) {
          UI.hideLoading();
          UI.error('Error', error.message);
        }
      });
    }

    // Resend verification email
    const resendBtn = document.getElementById('resend-verification');
    if (resendBtn) {
      resendBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const result = await Auth.resendVerificationEmail();
          UI.success('Email Sent', result.message);
        } catch (error) {
          UI.error('Error', error.message);
        }
      });
    }

    // Refresh history
    const refreshBtn = document.getElementById('refresh-history');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await this._loadLoginHistory();
        UI.info('Refreshed', 'Login history updated.');
      });
    }
  },

  _calculateSecurityScore(profile) {
    const breakdown = [
      { label: 'Account exists', value: 60, active: true, note: 'Base score for having a protected account.' },
      { label: 'Email verified', value: 20, active: Boolean(profile?.emailVerified), note: profile?.emailVerified ? 'Verified email improves account trust.' : 'Verify your email to gain this boost.' },
      { label: 'Two-factor authentication', value: 20, active: Boolean(profile?.twoFactorEnabled), note: profile?.twoFactorEnabled ? '2FA is enabled.' : 'Enable 2FA when it becomes available for this account.' }
    ];

    const score = Math.min(100, breakdown.reduce((total, item) => total + (item.active ? item.value : 0), 0));

    return { score, breakdown };
  },

  _buildAboutContent() {
    return `
      <div class="info-modal-copy">
        <p>SecureAuth is a Firebase-powered authentication dashboard focused on safe sign-in, account visibility, and session control.</p>

        <div class="info-modal-grid">
          <section>
            <h4>Tools</h4>
            <ul>
              <li>Secure login and logout</li>
              <li>Account registration with email verification</li>
              <li>Password reset and password change</li>
              <li>Profile editing for your display name</li>
              <li>Login history with device and timestamp details</li>
              <li>Session timer and sign-out controls</li>
              <li>Refreshable activity history</li>
            </ul>
          </section>

          <section>
            <h4>Security features</h4>
            <ul>
              <li>Firebase Authentication with hashed passwords</li>
              <li>Client-side validation and sanitization</li>
              <li>Rate limiting for login, registration, and password reset</li>
              <li>Firestore security rules for user-owned data</li>
              <li>Activity logging for logins, logouts, and password changes</li>
              <li>Session persistence choices for remembered or temporary sign-in</li>
              <li>XSS-safe rendering and secure UI feedback</li>
            </ul>
          </section>
        </div>
      </div>
    `;
  },

  _buildSecurityScoreContent() {
    const profile = this._currentProfile || {};
    const scoreData = this._scoreBreakdown || this._calculateSecurityScore(profile);
    const rows = scoreData.breakdown.map(item => `
      <div class="score-row ${item.active ? 'active' : 'inactive'}">
        <div>
          <strong>${Validator.sanitizeHTML(item.label)}</strong>
          <p>${Validator.sanitizeHTML(item.note)}</p>
        </div>
        <span>${item.active ? `+${item.value}%` : '+0%'}</span>
      </div>
    `).join('');

    return `
      <div class="info-modal-copy">
        <p>Your current security score is ${scoreData.score}%. The score is built from the account checks below.</p>
        <div class="score-breakdown">${rows}</div>
        <p class="score-footnote">The score is capped at 100%.</p>
      </div>
    `;
  },

  _refreshTwoFactorUi(profile) {
    const statusText = document.getElementById('two-factor-status-text');
    const button = document.getElementById('two-factor-btn');
    if (!statusText || !button) return;

    if (profile?.twoFactorEnabled) {
      statusText.textContent = 'Two-factor authentication is active for this account.';
      button.textContent = 'Disable 2FA';
      button.classList.remove('btn-secondary');
      button.classList.add('btn-danger');
    } else {
      statusText.textContent = 'Add an authenticator app code for login protection';
      button.textContent = 'Set Up 2FA';
      button.classList.remove('btn-danger');
      button.classList.add('btn-secondary');
    }
  },

  /* ========== HELPER: Normalize timestamp to JS Date ========== */
  _toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value; // Already a JS Date (from Auth metadata)
    if (typeof value.toDate === 'function') return value.toDate(); // Firestore Timestamp
    return new Date(value); // Fallback: string or number
  },

  /* ========== HELPER: Format Date ========== */
  _formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  },

  _formatDateTime(date) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  },

  /* ========== HELPER: Account Age ========== */
  _getAccountAge(createdDate) {
    const now = new Date();
    const diff = now - createdDate;
    const days = Math.floor(diff / 86400000);

    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${Math.floor(days / 365)} years`;
  },

  /* ========== HELPER: Time Ago ========== */
  _getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  },

  /* ========== HELPER: Parse Platform from User Agent ========== */
  _parsePlatform(userAgent) {
    if (/Windows/i.test(userAgent)) return 'Windows';
    if (/Macintosh|Mac OS/i.test(userAgent)) return 'macOS';
    if (/Linux/i.test(userAgent)) return 'Linux';
    if (/Android/i.test(userAgent)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
    return 'Unknown';
  },

  /* ========== CLEANUP ========== */
  destroy() {
    if (this._sessionTimerInterval) {
      clearInterval(this._sessionTimerInterval);
    }
  }
};

// Make globally available
window.Dashboard = Dashboard;
