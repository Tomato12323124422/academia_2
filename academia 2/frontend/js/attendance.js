// Use local server for development, or production URL
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5000' 
    : 'https://academia-2-xgdr.onrender.com';

const API = `${API_BASE}/api`;

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));

// Check if user is logged in and is a student
if (!user || !token) {
    alert("Please login first");
    window.location.href = "login.html";
}

if (user.role !== "student") {
    alert("Only students can mark attendance via QR code");
    window.location.href = "dashboard.html";
}

let html5QrCode = null;
let isScanning = false;

// Initialize QR scanner when page loads
document.addEventListener('DOMContentLoaded', function() {
    initScanner();
});

function initScanner() {
    const readerElement = document.getElementById("reader");
    
    // Check if browser supports camera
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showResult("Your browser doesn't support camera access. Please use a modern browser.", "error");
        return;
    }
    
    html5QrCode = new Html5Qrcode("reader");
    
    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };
    
    // Start scanning
    html5QrCode.start(
        { facingMode: "environment" }, // Use back camera on mobile
        config,
        onScanSuccess,
        onScanFailure
    ).then(() => {
        isScanning = true;
        console.log("QR Scanner started");
    }).catch((err) => {
        console.error("Error starting scanner:", err);
        showResult("Error accessing camera. Please allow camera permissions and refresh.", "error");
    });
}

// Handle successful QR scan
async function onScanSuccess(decodedText, decodedResult) {
    console.log("QR Code detected:", decodedText);
    
    // Stop scanning temporarily to prevent multiple scans
    if (isScanning && html5QrCode) {
        await html5QrCode.stop();
        isScanning = false;
    }
    
    // Parse QR code data
    // New format: https://academia-2-xgdr.onrender.com/attendance?session=SESSION_ID&token=TOKEN

    let sessionId = null;
    let qrToken = null;
    
    try {
        const url = new URL(decodedText);
        const params = new URLSearchParams(url.search);
        sessionId = params.get('session');
        qrToken = params.get('token');
        
        if (!sessionId || !qrToken) {
            throw new Error("Invalid QR format");
        }
    } catch (e) {
        // Try old format as fallback: academia://attendance/SESSION_ID
        const qrPattern = /^academia:\/\/attendance\/(\d+)$/;
        const match = decodedText.match(qrPattern);
        
        if (match) {
            sessionId = match[1];
            qrToken = null; // Old format doesn't have token
        } else {
            showResult("Invalid QR code. Please scan a valid attendance QR code.", "error");
            setTimeout(() => initScanner(), 3000);
            return;
        }
    }
    
    // Show loading
    document.getElementById("loading").style.display = "block";
    document.getElementById("scanResult").innerHTML = "";
    
    // Mark attendance with token validation
    try {
        const res = await fetch(`${API}/attendance/attendance`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ 
                session_id: sessionId,
                token: qrToken
            })
        });
        
        const data = await res.json();
        
        // Hide loading
        document.getElementById("loading").style.display = "none";
        
        if (res.ok) {
            showResult("✅ Attendance marked successfully! You are present.", "success");
            playBeep();
        } else {
            if (data.expired) {
                showResult("⏱️ " + data.message + "<br><br>Please ask your teacher to refresh the QR code and scan again.", "error");
            } else if (data.message.includes("already marked")) {
                showResult("ℹ️ " + data.message, "info");
            } else if (data.message.includes("not active")) {
                showResult("❌ " + data.message, "error");
            } else {
                showResult("❌ " + (data.message || "Failed to mark attendance"), "error");
            }
        }
        
    } catch (err) {
        console.error("Error marking attendance:", err);
        document.getElementById("loading").style.display = "none";
        showResult("❌ Network error. Please check your connection and try again.", "error");
    }
    
    // Restart scanner after 5 seconds
    setTimeout(() => {
        document.getElementById("scanResult").innerHTML = "";
        initScanner();
    }, 5000);
}

// Handle scan failure (no QR code found)
function onScanFailure(error) {
    // This fires frequently when no QR code is in view
    // We don't need to show errors for this
    // console.warn(`QR scan error: ${error}`);
}

// Show scan result message
function showResult(message, type) {
    const resultDiv = document.getElementById("scanResult");
    resultDiv.className = "scan-result scan-" + type;
    resultDiv.innerHTML = message;
}

// Play beep sound for success
function playBeep() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = "sine";
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.log("Audio not supported");
    }
}

// Go back to dashboard
function goBack() {
    // Stop scanner before leaving
    if (html5QrCode && isScanning) {
        html5QrCode.stop().then(() => {
            window.location.href = "dashboard.html";
        }).catch(() => {
            window.location.href = "dashboard.html";
        });
    } else {
        window.location.href = "dashboard.html";
    }
}

// Handle page unload
window.addEventListener('beforeunload', function() {
    if (html5QrCode && isScanning) {
        html5QrCode.stop();
    }
});
