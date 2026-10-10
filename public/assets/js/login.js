// Fallback login and signup handlers for the login page
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the login page with the login forms
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    // Login form handler (fallback)
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const loginMessage = document.getElementById('login-message');
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Login successful
                    loginMessage.textContent = 'Login Successful! Redirecting...';
                    loginMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-green-500';
                    setTimeout(() => {
                        window.location.href = '/home';
                    }, 1500);
                } else {
                    // Login failed - show error
                    loginMessage.textContent = data.message || 'Invalid credentials';
                    loginMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-red-500';
                }
            } catch (error) {
                // Network error
                loginMessage.textContent = 'Server error. Please try again later.';
                loginMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-red-500';
            }
        });
    }
    
    // Signup form handler (fallback)
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fullName = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;
            const signupMessage = document.getElementById('signup-message');
            
            // Check if passwords match
            if (password !== confirmPassword) {
                signupMessage.textContent = 'Passwords do not match!';
                signupMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-red-500';
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
                    // Signup successful
                    signupMessage.textContent = 'Signup successful! Redirecting to login...';
                    signupMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-green-500';
                    setTimeout(() => {
                        // Switch to login panel
                        const loginPanel = document.getElementById('login-panel');
                        const signupPanel = document.getElementById('signup-panel');
                        if (signupPanel) { 
                            signupPanel.classList.add('translate-x-full'); 
                            signupPanel.classList.remove('translate-x-0'); 
                        }
                        if (loginPanel) { 
                            loginPanel.classList.remove('-translate-x-full'); 
                            loginPanel.classList.add('translate-x-0'); 
                        }
                    }, 1500);
                } else {
                    // Signup failed - show detailed error
                    if (data.errors && Array.isArray(data.errors)) {
                        // Show detailed validation errors
                        const errorMessages = data.errors.map(err => `${err.field}: ${err.message}`).join('; ');
                        signupMessage.textContent = errorMessages;
                    } else {
                        signupMessage.textContent = data.message || 'Signup failed';
                    }
                    signupMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-red-500';
                }
            } catch (error) {
                // Network error
                signupMessage.textContent = 'Server error. Please try again later.';
                signupMessage.className = 'text-center text-sm font-medium mb-4 h-5 text-red-500';
            }
        });
    }
});