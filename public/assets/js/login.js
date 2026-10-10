// Login, Signup, and Forgot Password handlers for the auth pages
document.addEventListener('DOMContentLoaded', () => {
    const loginPanel = document.getElementById('login-panel');
    const signupPanel = document.getElementById('signup-panel');
    const forgotPanel = document.getElementById('forgot-panel');

    const showSignupBtn = document.getElementById('show-signup-btn');
    const showLoginBtnFromSignup = document.getElementById('show-login-btn-from-signup');
    const showForgotBtn = document.getElementById('show-forgot-btn');
    const showLoginBtnFromForgot = document.getElementById('show-login-btn-from-forgot');

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const forgotForm = document.getElementById('forgot-form');

    // Panel switching helper
    const switchPanel = (panelToShow) => {
        const panels = [loginPanel, signupPanel, forgotPanel].filter(Boolean);
        panels.forEach(panel => {
            panel.classList.add('transition-transform', 'duration-500', 'ease-in-out');
            if (panel !== panelToShow) {
                panel.classList.add(panel === loginPanel ? '-translate-x-full' : 'translate-x-full');
                panel.classList.remove('translate-x-0');
            }
        });
        if (panelToShow) {
            panelToShow.classList.remove('-translate-x-full', 'translate-x-full');
            panelToShow.classList.add('translate-x-0');
        }
    };

    // Attach navigation button listeners
    showSignupBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        switchPanel(signupPanel);
    });

    showLoginBtnFromSignup?.addEventListener('click', (e) => {
        e.preventDefault();
        switchPanel(loginPanel);
    });

    showForgotBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        switchPanel(forgotPanel);
    });

    showLoginBtnFromForgot?.addEventListener('click', (e) => {
        e.preventDefault();
        switchPanel(loginPanel);
    });

    // Login form handler
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email')?.value?.trim();
            const password = document.getElementById('login-password')?.value;
            const loginMessage = document.getElementById('login-message');
            
            if (!email || !password) {
                if (loginMessage) {
                    loginMessage.textContent = 'Please enter both email and password.';
                    loginMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-red-500';
                }
                return;
            }

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    if (loginMessage) {
                        loginMessage.textContent = 'Login Successful! Redirecting...';
                        loginMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-green-500';
                    }
                    setTimeout(() => {
                        window.location.href = '/home';
                    }, 1200);
                } else {
                    if (loginMessage) {
                        loginMessage.textContent = data.message || 'Invalid credentials';
                        loginMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-red-500';
                    }
                }
            } catch (error) {
                if (loginMessage) {
                    loginMessage.textContent = 'Server error. Please try again later.';
                    loginMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-red-500';
                }
            }
        });
    }
    
    // Signup form handler
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fullName = (document.getElementById('signup-fullname') || document.getElementById('signup-name'))?.value?.trim();
            const email = document.getElementById('signup-email')?.value?.trim();
            const password = document.getElementById('signup-password')?.value;
            const confirmPassword = (document.getElementById('confirm-password') || document.getElementById('signup-confirm-password'))?.value;
            const signupMessage = document.getElementById('signup-message');
            
            if (password !== confirmPassword) {
                if (signupMessage) {
                    signupMessage.textContent = 'Passwords do not match!';
                    signupMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-red-500';
                }
                return;
            }
            
            try {
                const response = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fullName, email, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    if (signupMessage) {
                        signupMessage.textContent = 'Signup successful! Redirecting to login...';
                        signupMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-green-500';
                    }
                    setTimeout(() => {
                        switchPanel(loginPanel);
                    }, 1200);
                } else {
                    if (signupMessage) {
                        if (data.errors && Array.isArray(data.errors)) {
                            signupMessage.textContent = data.errors.map(err => `${err.field}: ${err.message}`).join('; ');
                        } else {
                            signupMessage.textContent = data.message || 'Signup failed';
                        }
                        signupMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-red-500';
                    }
                }
            } catch (error) {
                if (signupMessage) {
                    signupMessage.textContent = 'Server error. Please try again later.';
                    signupMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-red-500';
                }
            }
        });
    }

    // Forgot password form handler
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('forgot-email');
            const forgotMessage = document.getElementById('forgot-message');
            const submitBtn = forgotForm.querySelector('button[type="submit"]');
            const email = emailInput?.value?.trim();
            
            const showMessage = (content, isError = false) => {
                if (!forgotMessage) return;
                forgotMessage.innerHTML = content;
                forgotMessage.className = `text-center text-sm font-medium mb-4 min-h-[1.25rem] ${isError ? 'text-red-500' : 'text-green-600'}`;
            };

            if (!email) {
                showMessage('Please enter your email address', true);
                return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showMessage('Please enter a valid email address', true);
                return;
            }

            const originalBtnText = submitBtn ? submitBtn.innerText : 'Send Reset Link';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Sending...';
            }

            try {
                const response = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json().catch(() => ({}));
                
                if (response.ok) {
                    if (data.emailSent) {
                        let html = `
                            <div class="p-3 bg-green-50 border border-green-300 rounded-lg text-green-800 text-sm text-left">
                                <p class="font-semibold text-green-900">${data.message || 'Password reset link sent to your email!'}</p>
                                ${data.resetUrl ? `<p class="text-xs text-gray-600 mt-2">Dev quick link: <a href="${data.resetUrl}" class="underline font-bold text-accent-brown">Open Reset Page</a></p>` : ''}
                            </div>
                        `;
                        forgotMessage.innerHTML = html;
                        forgotMessage.className = 'text-center text-sm font-medium mb-4 min-h-[1.25rem]';
                    } else if (data.resetUrl) {
                        forgotMessage.innerHTML = `
                            <div class="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-left">
                                <p class="text-xs text-amber-900 font-semibold mb-2">${data.message || 'Your reset link is ready:'}</p>
                                <a href="${data.resetUrl}" class="block text-center py-2 px-4 bg-gradient-to-r from-[#8C6A5D] to-[#73564B] text-white font-bold rounded-lg text-sm shadow hover:opacity-95 transition">
                                    👉 Click Here to Reset Password
                                </a>
                                <p class="text-[11px] text-gray-500 text-center mt-2">Redirecting automatically in <span id="login-countdown">3</span>s...</p>
                            </div>
                        `;
                        forgotMessage.className = 'text-center text-sm font-medium mb-4 min-h-[1.25rem]';
                        let count = 3;
                        const timer = setInterval(() => {
                            count--;
                            const el = document.getElementById('login-countdown');
                            if (el) el.textContent = count;
                            if (count <= 0) {
                                clearInterval(timer);
                                window.location.href = data.resetUrl;
                            }
                        }, 1000);
                    } else {
                        showMessage(data.message || 'Password reset link sent to your email!', false);
                    }
                    if (emailInput) emailInput.value = '';
                } else {
                    showMessage(data.message || 'Failed to send reset link', true);
                }
            } catch (error) {
                console.error('Forgot password error:', error);
                showMessage('An error occurred. Please try again later.', true);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = originalBtnText;
                }
            }
        });
    }
});