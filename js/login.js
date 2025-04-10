document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');

    // Tab switching
    loginTab.addEventListener('click', function() {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        clearErrors();
    });

    registerTab.addEventListener('click', function() {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        clearErrors();
    });

    // Form submissions
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        
        if (!username || !password) {
            showError(loginError, 'Please enter both username and password');
            return;
        }

        // In a real app, you would make an API call here
        const users = JSON.parse(localStorage.getItem('weatherAppUsers')) || {};
        
        if (users[username] && users[username].password === password) {
            // Successful login - redirect to weather page
            sessionStorage.setItem('weatherAppLoggedIn', 'true');
            sessionStorage.setItem('weatherAppUsername', username);
            window.location.href = 'weather.html'; // Your main weather page
        } else {
            showError(loginError, 'Invalid username or password');
        }
    });

    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('new-username').value.trim();
        const password = document.getElementById('new-password').value.trim();
        const confirmPassword = document.getElementById('confirm-password').value.trim();
        
        if (!username || !password || !confirmPassword) {
            showError(registerError, 'Please fill all fields');
            return;
        }

        if (password !== confirmPassword) {
            showError(registerError, 'Passwords do not match');
            return;
        }

        if (password.length < 6) {
            showError(registerError, 'Password must be at least 6 characters');
            return;
        }

        const users = JSON.parse(localStorage.getItem('weatherAppUsers')) || {};
        
        if (users[username]) {
            showError(registerError, 'Username already exists');
            return;
        }

        // In a real app, you would hash the password before storing
        users[username] = { password };
        localStorage.setItem('weatherAppUsers', JSON.stringify(users));
        
        // Auto-login after registration
        sessionStorage.setItem('weatherAppLoggedIn', 'true');
        sessionStorage.setItem('weatherAppUsername', username);
        window.location.href = 'weather.html';
    });

    // Helper functions
    function showError(element, message) {
        element.textContent = message;
        setTimeout(() => {
            element.textContent = '';
        }, 5000);
    }

    function clearErrors() {
        loginError.textContent = '';
        registerError.textContent = '';
    }

    // Check if already logged in
    if (sessionStorage.getItem('weatherAppLoggedIn') === 'true') {
        window.location.href = 'weather.html';
    }
});