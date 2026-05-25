/* ================================================================
   UI Utilities Module
   Toast notifications, loading overlay, password toggle,
   strength meter, particles background, and animation helpers
   ================================================================ */

const UI = {

  /* ========== TOAST NOTIFICATION SYSTEM ========== */
  _toastContainer: null,

  _ensureToastContainer() {
    if (!this._toastContainer) {
      this._toastContainer = document.createElement('div');
      this._toastContainer.className = 'toast-container';
      this._toastContainer.id = 'toast-container';
      document.body.appendChild(this._toastContainer);
    }
    return this._toastContainer;
  },

  _getToastIcon(type) {
    const icons = {
      success: '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    return icons[type] || icons.info;
  },

  toast(type, title, message, duration = 4000) {
    const container = this._ensureToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.setProperty('--toast-duration', `${duration}ms`);

    toast.innerHTML = `
      <span class="toast-icon">${this._getToastIcon(type)}</span>
      <div class="toast-content">
        <div class="toast-title">${Validator ? Validator.sanitizeHTML(title) : title}</div>
        ${message ? `<div class="toast-message">${Validator ? Validator.sanitizeHTML(message) : message}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Close notification">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this._removeToast(toast));

    container.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => this._removeToast(toast), duration);

    return toast;
  },

  _removeToast(toast) {
    if (!toast || toast.classList.contains('removing')) return;
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  },

  // Convenience methods
  success(title, message) { return this.toast('success', title, message); },
  error(title, message) { return this.toast('error', title, message); },
  warning(title, message) { return this.toast('warning', title, message); },
  info(title, message) { return this.toast('info', title, message); },

  /* ========== LOADING OVERLAY ========== */
  _loadingOverlay: null,

  _ensureLoadingOverlay() {
    if (!this._loadingOverlay) {
      this._loadingOverlay = document.createElement('div');
      this._loadingOverlay.className = 'loading-overlay';
      this._loadingOverlay.id = 'loading-overlay';
      this._loadingOverlay.innerHTML = `
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p class="loading-text">Please wait...</p>
        </div>
      `;
      document.body.appendChild(this._loadingOverlay);
    }
    return this._loadingOverlay;
  },

  showLoading(text = 'Please wait...') {
    const overlay = this._ensureLoadingOverlay();
    overlay.querySelector('.loading-text').textContent = text;
    // Force reflow before adding class for animation
    overlay.offsetHeight;
    overlay.classList.add('visible');
  },

  hideLoading() {
    const overlay = this._ensureLoadingOverlay();
    overlay.classList.remove('visible');
  },

  /* ========== BUTTON LOADING STATE ========== */
  setButtonLoading(btn, loading, originalText = '') {
    if (loading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Processing...';
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.originalText || originalText;
      btn.disabled = false;
    }
  },

  /* ========== PASSWORD VISIBILITY TOGGLE ========== */
  initPasswordToggles() {
    document.querySelectorAll('.password-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const input = toggle.parentElement.querySelector('input');
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        // Update icon
        toggle.innerHTML = isPassword
          ? '<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
          : '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      });
    });
  },

  /* ========== PASSWORD STRENGTH METER ========== */
  initPasswordStrengthMeter(inputSelector, meterSelector, requirementsSelector) {
    const input = document.querySelector(inputSelector);
    const meter = document.querySelector(meterSelector);
    const requirements = document.querySelector(requirementsSelector);

    if (!input) return;

    input.addEventListener('input', () => {
      const password = input.value;

      // Update strength meter
      if (meter) {
        const strength = Validator.getPasswordStrength(password);
        const fill = meter.querySelector('.strength-fill');
        const labelValue = meter.querySelector('.label-value');

        if (password.length === 0) {
          fill.className = 'strength-fill';
          fill.style.width = '0%';
          if (labelValue) {
            labelValue.textContent = '';
            labelValue.className = 'label-value';
          }
        } else {
          fill.className = `strength-fill ${strength.level}`;
          if (labelValue) {
            labelValue.textContent = strength.label;
            labelValue.className = `label-value ${strength.level}`;
          }
        }
      }

      // Update requirements checklist
      if (requirements) {
        const reqs = Validator.checkPasswordRequirements(password);
        const reqMap = {
          'req-length': reqs.minLength,
          'req-uppercase': reqs.hasUppercase,
          'req-lowercase': reqs.hasLowercase,
          'req-number': reqs.hasNumber,
          'req-special': reqs.hasSpecial
        };

        Object.entries(reqMap).forEach(([id, met]) => {
          const el = requirements.querySelector(`#${id}`);
          if (el) {
            el.classList.toggle('met', met);
          }
        });
      }
    });
  },

  /* ========== FORM VALIDATION FEEDBACK ========== */
  setFieldState(input, state, errorMessage = '') {
    // state: 'valid', 'invalid', 'default'
    const group = input.closest('.form-group');
    const errorEl = group ? group.querySelector('.form-error') : null;

    input.classList.remove('is-valid', 'is-invalid');

    if (state === 'valid') {
      input.classList.add('is-valid');
      if (errorEl) errorEl.classList.remove('visible');
    } else if (state === 'invalid') {
      input.classList.add('is-invalid');
      if (errorEl) {
        errorEl.querySelector('span').textContent = errorMessage;
        errorEl.classList.add('visible');
      }
    } else {
      if (errorEl) errorEl.classList.remove('visible');
    }
  },

  /* ========== FORM INPUT VALIDATION BINDING ========== */
  initFormValidation(formSelector) {
    const form = document.querySelector(formSelector);
    if (!form) return;

    form.querySelectorAll('.form-input[data-validate]').forEach(input => {
      const type = input.dataset.validate;
      let debounceTimer;

      input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (input.value.trim() === '') {
            this.setFieldState(input, 'default');
            return;
          }
          const result = Validator.validateInput(input.value, type);
          this.setFieldState(input, result.valid ? 'valid' : 'invalid', result.error);
        }, 300);
      });

      input.addEventListener('blur', () => {
        clearTimeout(debounceTimer);
        if (input.value.trim() === '') return;
        const result = Validator.validateInput(input.value, type);
        this.setFieldState(input, result.valid ? 'valid' : 'invalid', result.error);
      });
    });
  },

  /* ========== ANIMATED PARTICLES BACKGROUND ========== */
  initParticles(canvasId = 'particles-canvas') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticle = () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.3 + 0.1
    });

    const init = () => {
      resize();
      const count = Math.min(Math.floor((canvas.width * canvas.height) / 15000), 80);
      particles = Array.from({ length: count }, createParticle);
    };

    const drawParticle = (p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(var(--accent-primary-rgb), ${p.opacity})`;
      // Fallback since CSS variables don't work in canvas
      ctx.fillStyle = `rgba(99, 102, 241, ${p.opacity})`;
      ctx.fill();
    };

    const drawConnections = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            const opacity = (1 - dist / 120) * 0.08;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        drawParticle(p);
      });

      drawConnections();
      animationId = requestAnimationFrame(animate);
    };

    init();
    animate();

    window.addEventListener('resize', () => {
      resize();
      // Re-adjust particle count on significant resize
      const targetCount = Math.min(Math.floor((canvas.width * canvas.height) / 15000), 80);
      while (particles.length < targetCount) particles.push(createParticle());
      while (particles.length > targetCount) particles.pop();
    });

    // Return cleanup function
    return () => cancelAnimationFrame(animationId);
  },

  /* ========== SCROLL ANIMATIONS ========== */
  initScrollAnimations() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fadeInUp');
            entry.target.classList.remove('will-animate');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.will-animate').forEach(el => observer.observe(el));
  },

  /* ========== NAVBAR SCROLL EFFECT ========== */
  initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const handleScroll = () => {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state
  },

  /* ========== MOBILE MENU TOGGLE ========== */
  initMobileMenu() {
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      // Animate hamburger to X
      toggle.classList.toggle('active');
    });

    // Close menu when a link is clicked
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.classList.remove('active');
      });
    });
  },

  /* ========== AUTOFILL STYLING FIX ========== */
  fixAutofillStyling() {
    document.querySelectorAll('.form-input').forEach(input => {
      const fixStyling = () => {
        const isAutofilled = input.matches(':-webkit-autofill');
        if (isAutofilled) {
          input.style.boxShadow = '0 0 0 1000px rgba(255, 255, 255, 0.05) inset';
          input.style.WebkitBoxShadow = '0 0 0 1000px rgba(255, 255, 255, 0.05) inset';
          input.style.WebkitTextFillColor = 'rgba(255, 255, 255, 0.95)';
          input.style.caretColor = 'rgba(255, 255, 255, 0.95)';
        }
      };

      // Monitor autofill on various events
      input.addEventListener('change', fixStyling);
      input.addEventListener('animationstart', fixStyling);
      input.addEventListener('focus', fixStyling);
    });

    // Also monitor form changes
    const observer = new MutationObserver(fixStyling);
    document.querySelectorAll('.form-input').forEach(input => {
      observer.observe(input, { attributes: true, attributeFilter: ['style'] });
    });
  },

  /* ========== INITIALIZATION ========== */
  init(options = {}) {
    document.addEventListener('DOMContentLoaded', () => {
      // Always initialize
      this._ensureToastContainer();
      this.initPasswordToggles();
      this.fixAutofillStyling();

      // Optional initializations
      if (options.particles !== false) {
        this.initParticles();
      }
      if (options.scrollAnimations !== false) {
        this.initScrollAnimations();
      }
      if (options.navbar !== false) {
        this.initNavbarScroll();
      }
      if (options.mobileMenu !== false) {
        this.initMobileMenu();
      }
      if (options.formValidation) {
        this.initFormValidation(options.formValidation);
      }
      if (options.passwordMeter) {
        this.initPasswordStrengthMeter(
          options.passwordMeter.input,
          options.passwordMeter.meter,
          options.passwordMeter.requirements
        );
      }
    });
  }
};

// Make globally available
window.UI = UI;
