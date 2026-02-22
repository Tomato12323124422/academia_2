const API = "https://academia-2-xgdr.onrender.com/api";

const user = JSON.parse(localStorage.getItem("user"));
const token = localStorage.getItem("token");

if(!user){
    window.location.href = "login.html";
}

document.getElementById("welcome").innerText =
    "Welcome, " + user.full_name;

const menu = document.getElementById("menu");

/* ===== ROLE BASED MENU ===== */

if(user.role === "student"){
    menu.innerHTML = `
        <li onclick="showMyCourses()">My Courses</li>
        <li>Assignments</li>
        <li onclick="showStudentAttendance()">QR Attendance</li>
        <li>Badges</li>
    `;
    // Show student attendance panel
    document.getElementById("studentAttendancePanel").style.display = "block";
}

if(user.role === "teacher"){
    menu.innerHTML = `
        <li onclick="showCreateCourseForm()">Create Course</li>
        <li onclick="showMyCourses()">My Courses</li>
        <li>Live Classes</li>
        <li onclick="showTeacherSessionPanel()">Attendance QR</li>
        <li onclick="window.location.href='students.html'">Students</li>
    `;

    // Show teacher session panel
    document.getElementById("teacherSessionPanel").style.display = "block";
    document.getElementById("attendanceListPanel").style.display = "block";
    // Load teacher's courses on page load
    loadMyCourses();
    checkActiveSession();
}

if(user.role === "parent"){
    menu.innerHTML = `
        <li>Child Progress</li>
        <li>Attendance</li>
        <li>Reports</li>
    `;
}


/* ===== GAMIFICATION DEMO VALUES ===== */
document.getElementById("xp").innerText = 120;
document.getElementById("badges").innerText = 3;
document.getElementById("courseCount").innerText = 5;
document.getElementById("attendance").innerText = "92%";

function logout(){
    localStorage.clear();
    window.location.href = "login.html";
}

/* ===== TEACHER COURSE FUNCTIONS ===== */

function showCreateCourseForm() {
    document.getElementById("createCoursePanel").style.display = "block";
    document.getElementById("myCoursesPanel").style.display = "none";
    document.getElementById("teacherSessionPanel").style.display = "none";
    document.getElementById("attendanceListPanel").style.display = "none";
    document.getElementById("courseSessionsPanel").style.display = "none";
}

function hideCreateCourseForm() {
    document.getElementById("createCoursePanel").style.display = "none";
    document.getElementById("myCoursesPanel").style.display = "block";
    document.getElementById("teacherSessionPanel").style.display = "block";
    document.getElementById("attendanceListPanel").style.display = "block";
    loadMyCourses();
}

function showMyCourses() {
    document.getElementById("createCoursePanel").style.display = "none";
    document.getElementById("myCoursesPanel").style.display = "block";
    document.getElementById("teacherSessionPanel").style.display = user.role === "teacher" ? "block" : "none";
    document.getElementById("attendanceListPanel").style.display = user.role === "teacher" ? "block" : "none";
    document.getElementById("courseSessionsPanel").style.display = "none";
    loadMyCourses();
}

function showTeacherSessionPanel() {
    document.getElementById("createCoursePanel").style.display = "none";
    document.getElementById("myCoursesPanel").style.display = "none";
    document.getElementById("teacherSessionPanel").style.display = "block";
    document.getElementById("attendanceListPanel").style.display = "block";
    document.getElementById("courseSessionsPanel").style.display = "none";
    checkActiveSession();
}

function showStudentAttendance() {
    // For students, open the scanner page
    window.location.href = "attendance-scan.html";
}

// Handle Create Course Form Submission
const createCourseForm = document.getElementById("createCourseForm");
if (createCourseForm) {
    createCourseForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const title = document.getElementById("courseTitle").value;
        const description = document.getElementById("courseDescription").value;
        const category = document.getElementById("courseCategory").value;
        const duration = document.getElementById("courseDuration").value;

        try {
            const res = await fetch(`${API}/courses`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ title, description, category, duration })
            });

            const data = await res.json();

            if (res.ok) {
                alert("Course created successfully!");
                createCourseForm.reset();
                hideCreateCourseForm();
                loadMyCourses();
            } else {
                alert(data.message || "Failed to create course");
            }

        } catch (err) {
            console.error(err);
            alert("Network error - could not create course");
        }
    });
}

// Load Teacher's Courses
async function loadMyCourses() {
    if (user.role !== "teacher") return;

    try {
        const res = await fetch(`${API}/courses/my-courses`, {
            headers: { 
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await res.json();

        if (res.ok) {
            const coursesList = document.getElementById("myCoursesList");
            const courseCount = document.getElementById("courseCount");
            
            if (data.courses && data.courses.length > 0) {
                courseCount.innerText = data.courses.length;
                coursesList.innerHTML = data.courses.map(course => `
                    <div class="course-card">
                        <h4>${course.title}</h4>
                        <p>${course.description}</p>
                        <span class="category-tag">${course.category}</span>
                        <span class="duration-tag">${course.duration || 'Not specified'}</span>
                        <div style="margin-top: 15px;">
                            <button class="primary-btn" onclick="startClass('${course.id}')" style="font-size: 12px; padding: 8px 16px;">Start Class</button>
                            <button class="secondary-btn" onclick="viewCourseSessions('${course.id}')" style="font-size: 12px; padding: 8px 16px; margin-left: 5px;">View Sessions</button>
                        </div>
                    </div>
                `).join('');
            } else {
                courseCount.innerText = "0";
                coursesList.innerHTML = "<p>No courses created yet. Click 'Create Course' to get started!</p>";
            }
        } else {
            console.error("Failed to load courses:", data.message);
        }

    } catch (err) {
        console.error("Error loading courses:", err);
    }
}

/* ===== SESSION & ATTENDANCE FUNCTIONS ===== */

let currentSessionId = null;
let qrRefreshInterval = null;
let attendanceRefreshInterval = null;

// Token rotation interval: 40 seconds
const TOKEN_INTERVAL = 40000;


// Start a new class session
async function startClass(courseId) {
    try {
        const res = await fetch(`${API}/attendance/sessions`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ course_id: courseId })
        });

        const data = await res.json();

        if (res.ok) {
            currentSessionId = data.session.id;
            alert("Class session started! QR code is now available.");
            showActiveSession(currentSessionId);
        } else {
            alert(data.message || "Failed to start session");
        }

    } catch (err) {
        console.error(err);
        alert("Network error - could not start session");
    }
}

// Check for active session on page load
async function checkActiveSession() {
    if (user.role !== "teacher") return;
    
    // Get all sessions for teacher's courses and find active one
    try {
        const res = await fetch(`${API}/courses/my-courses`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        if (data.courses && data.courses.length > 0) {
            // Check each course for active sessions
            for (const course of data.courses) {
                const sessionsRes = await fetch(`${API}/attendance/courses/${course.id}/sessions`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const sessionsData = await sessionsRes.json();
                
                const activeSession = sessionsData.sessions?.find(s => s.status === 'active');
                if (activeSession) {
                    currentSessionId = activeSession.id;
                    showActiveSession(currentSessionId);
                    return;
                }
            }
        }
    } catch (err) {
        console.error("Error checking active session:", err);
    }
}

// Show active session with dynamic QR code
async function showActiveSession(sessionId) {
    document.getElementById("noActiveSession").style.display = "none";
    document.getElementById("activeSessionInfo").style.display = "block";
    
    // Clear any existing intervals
    if (qrRefreshInterval) clearInterval(qrRefreshInterval);
    if (attendanceRefreshInterval) clearInterval(attendanceRefreshInterval);
    
    // Load initial QR code
    await updateQRCode(sessionId);
    
    // Set up auto-refresh for QR code every 40 seconds

    qrRefreshInterval = setInterval(() => updateQRCode(sessionId), TOKEN_INTERVAL);
    
    // Load attendance immediately
    await refreshAttendance();
    
    // Set up auto-refresh for attendance list every 5 seconds
    attendanceRefreshInterval = setInterval(() => refreshAttendance(), 5000);
}

// Update QR code with new token
async function updateQRCode(sessionId) {
    try {
        // Get current QR data from backend (points to frontend page)
        const tokenRes = await fetch(`${API}/attendance/sessions/${sessionId}/qr`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const tokenData = await tokenRes.json();
        
        if (tokenRes.ok) {
            // Generate QR code using external API - points to attendance-scan-result.html
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(tokenData.qrData)}`;
            document.getElementById("qrCodeImage").src = qrImageUrl;
            
            // Show countdown timer
            updateCountdown(tokenData.expiresIn);
        } else {
            console.error("Failed to get token:", tokenData.message);
        }
        
    } catch (err) {
        console.error("Error updating QR code:", err);
    }
}

// Update countdown display
function updateCountdown(expiresIn) {
    const countdownElement = document.getElementById("qrCountdown");
    if (!countdownElement) {
        // Create countdown element if it doesn't exist
        const qrDisplay = document.getElementById("qrCodeDisplay");
        const countdownDiv = document.createElement("div");
        countdownDiv.id = "qrCountdown";
        countdownDiv.style.cssText = "margin-top: 10px; font-size: 14px; color: #666;";
        qrDisplay.appendChild(countdownDiv);
    }
    
    const seconds = Math.ceil(expiresIn / 1000);
    const countdownDiv = document.getElementById("qrCountdown");
    countdownDiv.innerHTML = `⏱️ QR refreshes in <strong>${seconds}s</strong>`;
    
    // Update every second
    let remaining = expiresIn;
    const countdownInterval = setInterval(() => {
        remaining -= 1000;
        if (remaining <= 0) {
            clearInterval(countdownInterval);
        } else {
            const secs = Math.ceil(remaining / 1000);
            countdownDiv.innerHTML = `⏱️ QR refreshes in <strong>${secs}s</strong>`;
        }
    }, 1000);
}

// Refresh attendance list
async function refreshAttendance() {
    if (!currentSessionId) return;
    
    try {
        const res = await fetch(`${API}/attendance/sessions/${currentSessionId}/attendance`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        
        if (res.ok) {
            document.getElementById("presentCount").innerText = data.count || 0;
            
            const attendanceList = document.getElementById("attendanceList");
            if (data.attendance && data.attendance.length > 0) {
                attendanceList.innerHTML = data.attendance.map(record => `
                    <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                        <span>${record.student?.full_name || record.name || 'Unknown'}</span>
                        <span style="color: #28a745; font-weight: bold;">✓ Present</span>
                    </div>
                `).join('');
            } else {
                attendanceList.innerHTML = "<p>No students have marked attendance yet.</p>";
            }
        }
    } catch (err) {
        console.error("Error refreshing attendance:", err);
    }
}

// End current session
async function endSession() {
    if (!currentSessionId) return;
    
    if (!confirm("Are you sure you want to end this session?")) return;
    
    try {
        const res = await fetch(`${API}/attendance/sessions/${currentSessionId}/end`, {
            method: "PATCH",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });
        
        const data = await res.json();
        
        if (res.ok) {
            alert("Session ended successfully!");
            
            // Clear intervals
            if (qrRefreshInterval) clearInterval(qrRefreshInterval);
            if (attendanceRefreshInterval) clearInterval(attendanceRefreshInterval);
            
            currentSessionId = null;
            document.getElementById("noActiveSession").style.display = "block";
            document.getElementById("activeSessionInfo").style.display = "none";
            document.getElementById("attendanceList").innerHTML = "<p>No attendance records yet.</p>";
        } else {
            alert(data.message || "Failed to end session");
        }
    } catch (err) {
        console.error(err);
        alert("Network error - could not end session");
    }
}

// View course sessions history
async function viewCourseSessions(courseId) {
    document.getElementById("createCoursePanel").style.display = "none";
    document.getElementById("myCoursesPanel").style.display = "none";
    document.getElementById("teacherSessionPanel").style.display = "none";
    document.getElementById("attendanceListPanel").style.display = "none";
    document.getElementById("courseSessionsPanel").style.display = "block";
    
    try {
        const res = await fetch(`${API}/attendance/courses/${courseId}/sessions`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        const sessionsList = document.getElementById("sessionsList");
        
        if (data.sessions && data.sessions.length > 0) {
            sessionsList.innerHTML = data.sessions.map(session => `
                <div style="padding: 15px; border: 1px solid #ddd; margin-bottom: 10px; border-radius: 8px;">
                    <p><strong>Date:</strong> ${new Date(session.date).toLocaleString()}</p>
                    <p><strong>Status:</strong> <span style="color: ${session.status === 'active' ? '#28a745' : '#6c757d'}">${session.status}</span></p>
                    ${session.zoom_link ? `<p><strong>Zoom:</strong> <a href="${session.zoom_link}" target="_blank">Join Meeting</a></p>` : ''}
                </div>
            `).join('');
        } else {
            sessionsList.innerHTML = "<p>No sessions found for this course.</p>";
        }
    } catch (err) {
        console.error("Error loading sessions:", err);
        document.getElementById("sessionsList").innerHTML = "<p>Error loading sessions.</p>";
    }
}

// Open attendance scanner (for students)
function openAttendanceScanner() {
    window.location.href = "attendance-scan.html";
}
