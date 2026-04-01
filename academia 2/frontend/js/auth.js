// PWA SW Registration (fixed path)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(reg => console.log('PWA SW registered'))
    .catch(err => console.log('SW failed:', err));
}

// Use local server for development, or production URL
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5000' 
    : 'https://academia-2-xgdr.onrender.com';

const API = `${API_BASE}/api/auth`;

/* ================= REGISTER ================= */
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const full_name = document.getElementById("full_name").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const role = document.getElementById("role").value;

        try {
            const res = await fetch(`${API}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ full_name, email, password, role })
            });

            const data = await res.json();
            console.log(data); // 👈 debug output

            if(res.ok){
                window.location.href = "login.html";
            } else {
                alert(data.message || "Registration failed");
            }

        } catch(err){
            console.error(err);
            alert("Network error");
        }
    });
}

/* ================= LOGIN ================= */
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        try {

            const res = await fetch(`${API}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            console.log("LOGIN RESPONSE:", data);

            if(res.ok){

                // ✅ SAVE TOKEN + USER
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data.user));

                // ✅ REDIRECT BASED ON ROLE
                if (data.user.role === 'admin') {
                    window.location.href = "admin-dashboard.html";
                } else {
                    window.location.href = "dashboard.html";
                }

            } else {
                alert(data.message || "Login failed");
            }

        } catch(err){
            console.error(err);
            alert("Server error");
        }
    });
}
