// Use local server for development, or production URL
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') 
    ? 'http://localhost:5000' 
    : window.location.origin;

const API = `${API_BASE}/api`;

const user = JSON.parse(localStorage.getItem("user"));
const token = localStorage.getItem("token");

function formatDate(dateString) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
}

if (!user) {
    window.location.href = "login.html";
}

document.getElementById("welcome").innerText =
    "Welcome, " + user.full_name;

const menu = document.getElementById("menu");

/* ===== ROLE BASED MENU ===== */

if (user.role === "student") {
    menu.innerHTML = `
        <li onclick="showStudentDashboard()">📊 Dashboard</li>
        <li onclick="showStudentCourses()">📚 My Courses</li>
        <li onclick="showBrowseCourses()">🔍 Browse Courses</li>
        <li onclick="showStudentDeadlines()">📝 Assignments</li>
        <li onclick="showStudentAttendance()">📋 Attendance</li>
        <li onclick="showStudentLiveClasses()">📹 Live Classes</li>
        <li onclick="showStudentQuizzes()">📝 Quizzes</li>
    `;
    loadStudentDashboard();
}

if (user.role === "teacher") {
    menu.innerHTML = `
        <li onclick="showInstructorDashboard()">📊 Dashboard</li>
        <li onclick="showCreateCourseForm()">➕ Create Course</li>
        <li onclick="showMyCourses()">📚 My Courses</li>
        <li onclick="showInstructorLiveClasses()">📹 Live Classes</li>
        <li onclick="showInstructorAnalytics()">📈 Analytics</li>
        <li onclick="showTeacherSessionPanel()">📱 Attendance QR</li>
        <li onclick="showInstructorQuizzes()">📝 Manage Quizzes</li>
        <li onclick="window.location.href='students.html'">👨‍🎓 Students</li>
    `;
    loadInstructorDashboard();
}

if (user.role === "parent") {
    menu.innerHTML = `
        <li onclick="showGuardianDashboard()">📊 Dashboard</li>
        <li onclick="showGuardianChildren()">👨‍👩‍👧 My Children</li>
    `;
    loadGuardianDashboard();
}

/* ===== STUDENT DASHBOARD FUNCTIONS ===== */

async function loadStudentDashboard() {
    hideAllPanels();
    document.getElementById("studentDeadlinesPanel").style.display = "block";
    document.getElementById("studentAttendanceHistoryPanel").style.display = "block";
    document.getElementById("studentLiveClassesPanel").style.display = "block";
    document.getElementById("studentCoursesPanel").style.display = "block";
    document.getElementById("studentAttendancePanel").style.display = "block";
    
    await Promise.all([
        loadStudentStats(),
        loadStudentCoursesList(),
        loadStudentDeadlines(),
        loadStudentAttendanceHistory(),
        loadStudentLiveClasses(),
        loadStudentQuizzes()
    ]);
}

async function loadStudentStats() {
    try {
        const coursesRes = await fetch(`${API}/courses/enrolled`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (coursesRes.ok) {
            const coursesData = await coursesRes.json();
            document.getElementById("courseCount").innerText = coursesData.courses?.length || 0;
        }
        
        const attendRes = await fetch(`${API}/attendance/my-attendance`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (attendRes.ok) {
            const attendData = await attendRes.json();
            const rate = attendData.summary?.rate || 0;
            document.getElementById("attendance").innerText = rate + "%";
        }
        
    } catch (err) {
        console.error("Error loading student stats:", err);
    }
}

async function loadStudentCoursesList() {
    try {
        const res = await fetch(`${API}/courses/enrolled`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        const container = document.getElementById("studentCoursesList");
        
        if (res.ok && data.courses && data.courses.length > 0) {
            container.innerHTML = data.courses.map(course => `
                <div class="course-card">
                    <h4>${course.title}</h4>
                    <p>${course.description || 'No description'}</p>
                    <span class="category-tag">${course.category || 'General'}</span>
                    ${course.duration ? `<span class="duration-tag">${course.duration}</span>` : ''}
                </div>
            `).join('');
        } else {
            container.innerHTML = "<p>No courses enrolled yet.</p>";
        }
        
    } catch (err) {
        console.error("Error loading courses:", err);
        document.getElementById("studentCoursesList").innerHTML = "<p>Error loading courses.</p>";
    }
}

async function loadStudentDeadlines() {
    try {
        const res = await fetch(`${API}/assignments/my-assignments`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        const container = document.getElementById("assignmentsList");
        
        if (res.ok && data.assignments && data.assignments.length > 0) {
            const sorted = data.assignments
                .filter(a => a.status !== 'submitted')
                .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
                .slice(0, 10);
            
            if (sorted.length > 0) {
                container.innerHTML = sorted.map(assignment => {
                    const dueDate = new Date(assignment.due_date);
                    const now = new Date();
                    const daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
                    
                    let urgencyClass = '';
                    if (daysLeft < 0) urgencyClass = 'urgent';
                    else if (daysLeft <= 2) urgencyClass = 'soon';
                    
                    return `
                        <div class="deadline-item ${urgencyClass}">
                            <div class="deadline-info">
                                <h4>${assignment.title}</h4>
                                <p>${assignment.course?.title || 'Unknown Course'}</p>
                            </div>
                            <div class="deadline-date">
                                <span class="days-left">${daysLeft < 0 ? 'OVERDUE' : daysLeft + ' days left'}</span>
                                <small>${dueDate.toLocaleDateString()}</small>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                container.innerHTML = "<p>No upcoming assignments!</p>";
            }
        } else {
            container.innerHTML = "<p>No assignments yet.</p>";
        }
        
    } catch (err) {
        console.error("Error loading assignments:", err);
        document.getElementById("assignmentsList").innerHTML = "<p>Error loading assignments.</p>";
    }
}

async function loadStudentAttendanceHistory() {
    try {
        const res = await fetch(`${API}/attendance/my-attendance`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        const container = document.getElementById("attendanceHistory");
        
        if (res.ok && data.attendance && data.attendance.length > 0) {
            const recent = data.attendance.slice(0, 10);
            container.innerHTML = recent.map(record => `
                <div class="deadline-item">
                    <div class="deadline-info">
                        <h4>${record.session?.course?.title || 'Unknown Course'}</h4>
                        <p>${new Date(record.marked_at).toLocaleDateString()}</p>
                    </div>
                    <div class="deadline-date">
                        <span class="days-left" style="color: ${record.status === 'present' ? '#28a745' : '#dc3545'}">
                            ${record.status === 'present' ? '✓ Present' : '✗ Absent'}
                        </span>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = "<p>No attendance records yet.</p>";
        }
        
    } catch (err) {
        console.error("Error loading attendance:", err);
        document.getElementById("attendanceHistory").innerHTML = "<p>Error loading attendance.</p>";
    }
}

async function loadStudentLiveClasses() {
    try {
        // 1. Get Live/Active Sessions
        const activeRes = await fetch(`${API}/attendance/active-sessions`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const activeData = await activeRes.json();
        
        // 2. Get Upcoming Scheduled Classes
        const upcomingRes = await fetch(`${API}/live-classes/upcoming`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const upcomingData = await upcomingRes.json();
        
        const container = document.getElementById("studentLiveClasses");
        container.innerHTML = "";

        // Render Active Sessions
        if (activeData.sessions && activeData.sessions.length > 0) {
            container.innerHTML += "<h4>🔴 Live Now</h4>";
            container.innerHTML += activeData.sessions.map(session => {
                const title = session.topic || session.title || session.course?.title || 'Active Session';
                return `
                <div class="live-class-item live-now">
                    <div class="live-class-info">
                        <h4>${title}</h4>
                        <p>Started: ${new Date(session.start_time || session.date).toLocaleString()}</p>
                        ${session.zoom_link ? `<a href="${session.zoom_link}" target="_blank" class="primary-btn" style="display:inline-block; margin-top:10px; padding: 5px 10px; font-size:12px;">Join Class</a>` : ''}
                    </div>
                    <div><span class="live-badge">LIVE NOW</span></div>
                </div>
            `}).join('');
        }

        // Render Scheduled Sessions
        if (upcomingData.sessions && upcomingData.sessions.length > 0) {
            container.innerHTML += "<h4 style='margin-top:20px;'>📅 Upcoming Classes</h4>";
            container.innerHTML += upcomingData.sessions.map(session => {
                const title = session.topic || session.title || 'Live Class';
                const courseName = session.course?.title || 'Course ID: ' + session.course_id;
                return `
                <div class="live-class-item">
                    <div class="live-class-info">
                        <h4>${title}</h4>
                        <p>Course: ${courseName}</p>
                        <p>Scheduled: ${new Date(session.date).toLocaleString()}</p>
                    </div>
                    <div class="live-badge" style="background: #00ea; color: white;">SCHEDULED</div>
                </div>
            `}).join('');
        }

        if (container.innerHTML === "") {
            container.innerHTML = "<p>No sessions yet.</p>";
        }
        
    } catch (err) {
        console.error("Error loading live classes:", err);
        document.getElementById("studentLiveClasses").innerHTML = "<p>Error loading live classes.</p>";
    }
}



function showStudentDashboard() {
    loadStudentDashboard();
}

function showStudentCourses() {
    hideAllPanels();
    document.getElementById("studentCoursesPanel").style.display = "block";
    loadStudentCoursesList();
}

function showStudentDeadlines() {
    hideAllPanels();
    document.getElementById("studentDeadlinesPanel").style.display = "block";
    loadStudentDeadlines();
}

function showStudentAttendance() {
    hideAllPanels();
    document.getElementById("studentAttendanceHistoryPanel").style.display = "block";
    loadStudentAttendanceHistory();
}

function showStudentLiveClasses() {
    hideAllPanels();
    document.getElementById("studentLiveClassesPanel").style.display = "block";
    loadStudentLiveClasses();
}

function showStudentLeaderboard() {
    hideAllPanels();
    document.getElementById("studentLeaderboardPanel").style.display = "block";
    loadStudentLeaderboard();
}

/* ===== BROWSE COURSES FUNCTIONS ===== */

let allAvailableCourses = [];
let enrolledCourseIds = new Set();

async function loadBrowseCourses() {
    try {
        const coursesRes = await fetch(`${API}/courses`);
        const coursesData = await coursesRes.json();
        allAvailableCourses = coursesData.courses || [];

        const enrolledRes = await fetch(`${API}/courses/enrolled`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const enrolledData = await enrolledRes.json();
        
        enrolledCourseIds.clear();
        if (enrolledData.courses) {
            enrolledData.courses.forEach(c => enrolledCourseIds.add(c.id));
        }

        renderBrowseCourses();

    } catch (err) {
        console.error("Error loading courses:", err);
        document.getElementById("browseCoursesList").innerHTML = "<p>Error loading courses. Please try again.</p>";
    }
}

function renderBrowseCourses() {
    const container = document.getElementById("browseCoursesList");

    if (allAvailableCourses.length === 0) {
        container.innerHTML = "<p>No courses available yet.</p>";
        return;
    }

    container.innerHTML = allAvailableCourses.map(course => {
        const isEnrolled = enrolledCourseIds.has(course.id);
        return `
            <div class="course-card">
                <h4>${course.title}</h4>
                <p>${course.description || 'No description'}</p>
                <span class="category-tag">${course.category || 'General'}</span>
                ${course.duration ? `<span class="duration-tag">${course.duration}</span>` : ''}
                <div style="margin-top: 15px;">
                    ${isEnrolled 
                        ? '<span style="color: #28a745; font-weight: bold;">✓ Already Enrolled</span>' 
                        : `<button class="primary-btn" onclick="enrollInCourse('${course.id}')">Enroll Now</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

async function enrollInCourse(courseId) {
    if (!confirm("Do you want to enroll in this course?")) return;

    try {
        const res = await fetch(`${API}/courses/${courseId}/enroll`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await res.json();

        if (res.ok) {
            alert("Successfully enrolled in the course!");
            enrolledCourseIds.add(courseId);
            renderBrowseCourses();
            if (document.getElementById("studentCoursesPanel").style.display === "block") {
                loadStudentCoursesList();
            }
        } else {
            alert(data.message || "Failed to enroll");
        }

    } catch (err) {
        console.error("Error enrolling:", err);
        alert("Network error - could not enroll");
    }
}

function showBrowseCourses() {
    hideAllPanels();
    document.getElementById("browseCoursesPanel").style.display = "block";
    loadBrowseCourses();
}


/* ===== INSTRUCTOR DASHBOARD FUNCTIONS ===== */

async function loadInstructorDashboard() {
    hideAllPanels();
    
    document.getElementById("instructorAnalyticsPanel").style.display = "block";
    document.getElementById("instructorLiveClassesPanel").style.display = "block";
    document.getElementById("teacherSessionPanel").style.display = "block";
    document.getElementById("attendanceListPanel").style.display = "block";
    document.getElementById("myCoursesPanel").style.display = "block";
    
    await Promise.all([
        loadInstructorStats(),
        loadMyCourses(),
        loadInstructorAnalytics(),
        loadInstructorLiveClasses(),
        updateScheduleCourseSelect(),
        loadTeacherQuizzes(),
        checkActiveSession()
    ]);
}

async function loadInstructorStats() {
    try {
        const res = await fetch(`${API}/courses/my-courses`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        
        if (res.ok) {
            document.getElementById("courseCount").innerText = data.courses?.length || 0;
        }
        
    } catch (err) {
        console.error("Error loading instructor stats:", err);
    }
}

async function loadInstructorAnalytics() {
    try {
        const res = await fetch(`${API}/courses/my-courses`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        const container = document.getElementById("attendanceAnalytics");
        
        if (res.ok && data.courses && data.courses.length > 0) {
            const analyticsCards = await Promise.all(data.courses.slice(0, 6).map(async (course) => {
                try {
                    const attendRes = await fetch(`${API}/attendance/courses/${course.id}/analytics`, {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    const attendData = await attendRes.json();
                    
                    return `
                        <div class="analytics-card">
                            <h4>${course.title}</h4>
                            <div class="analytics-stats">
                                <div class="stat">
                                    <span class="stat-value">${attendData.analytics?.total_sessions || 0}</span>
                                    <span class="stat-label">Sessions</span>
                                </div>
                                <div class="stat">
                                    <span class="stat-value">${attendData.analytics?.attendance_rate || 0}%</span>
                                    <span class="stat-label">Attendance</span>
                                </div>
                                <div class="stat">
                                    <span class="stat-value">${attendData.analytics?.total_students || 0}</span>
                                    <span class="stat-label">Students</span>
                                </div>
                            </div>
                        </div>
                    `;
                } catch (e) {
                    return `<div class="analytics-card"><h4>${course.title}</h4><p>No data available</p></div>`;
                }
            }));
            
            container.innerHTML = analyticsCards.join('');
        } else {
            container.innerHTML = "<p>No courses to analyze. Create a course first!</p>";
        }
        
    } catch (err) {
        console.error("Error loading analytics:", err);
        document.getElementById("attendanceAnalytics").innerHTML = "<p>Error loading analytics.</p>";
    }
}

async function loadInstructorLiveClasses() {
    try {
        const res = await fetch(`${API}/live-classes/upcoming`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        const container = document.getElementById("instructorLiveClasses");
        
        if (res.ok && data.sessions && data.sessions.length > 0) {
            container.innerHTML = data.sessions.map(session => {
                const date = new Date(session.date);
                const title = session.topic || session.title || 'Live Class';
                const courseName = session.course?.title || 'Course ID: ' + session.course_id;
                return `
                <div class="session-item" style="border-left: 4px solid #00ea;">
                    <div class="session-info">
                        <h4>${title}</h4>
                        <p>Course: ${courseName}</p>
                        <p>Scheduled: ${date.toLocaleString()}</p>
                        <p>Link: <a href="${session.zoom_link}" target="_blank">${session.zoom_link}</a></p>
                    </div>
                    <div>
                        <span class="status-badge" style="background: #00ea; color: white;">SCHEDULED</span>
                    </div>
                </div>
            `}).join('');
        } else {
            container.innerHTML = "<p>No upcoming scheduled classes.</p>";
        }
        
    } catch (err) {
        console.error("Error loading scheduled classes:", err);
        document.getElementById("instructorLiveClasses").innerHTML = "<p>Error loading scheduled classes.</p>";
    }
}


async function updateScheduleCourseSelect() {
    const select = document.getElementById("scheduleCourseSelect");
    if (!select) return;

    try {
        const res = await fetch(`${API}/courses/my-courses`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (res.ok && data.courses) {
            select.innerHTML = '<option value="">-- Select Course --</option>' + 
                data.courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
        }
    } catch (err) {
        console.error("Error loading courses for select:", err);
    }
}

async function createLiveClass(e) {
    e.preventDefault();
    
    const course_id = document.getElementById("scheduleCourseSelect").value;
    const title = document.getElementById("scheduleTitle").value;
    const zoom_link = document.getElementById("scheduleLink").value;
    const scheduled_at = document.getElementById("scheduleTime").value;

    if (!course_id || !title || !zoom_link || !scheduled_at) {
        alert("Please fill all fields");
        return;
    }

    try {
        const res = await fetch(`${API}/live-classes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ course_id, title, zoom_link, scheduled_at })
        });

        const data = await res.json();
        if (res.ok) {
            alert("Class scheduled successfully!");
            document.getElementById("scheduleClassForm").reset();
            loadInstructorLiveClasses();
        } else {
            alert(data.message || "Failed to schedule class");
        }
    } catch (err) {
        console.error("Error scheduling class:", err);
        alert("Network error - check your connection");
    }
}

function showInstructorDashboard() {
    loadInstructorDashboard();
}

function showInstructorAnalytics() {
    hideAllPanels();
    document.getElementById("instructorAnalyticsPanel").style.display = "block";
    loadInstructorAnalytics();
}

function showInstructorLiveClasses() {
    hideAllPanels();
    document.getElementById("instructorLiveClassesPanel").style.display = "block";
    updateScheduleCourseSelect();
    loadInstructorLiveClasses();
}

function showInstructorLeaderboard() {
    hideAllPanels();
    document.getElementById("instructorLeaderboardPanel").style.display = "block";
    loadInstructorLeaderboard();
}

/* ===== GUARDIAN/PARENT DASHBOARD FUNCTIONS ===== */

let selectedChildId = null;

async function loadGuardianDashboard() {
    hideAllPanels();
    
    document.getElementById("guardianChildrenPanel").style.display = "block";
    document.getElementById("guardianCoursesPanel").style.display = "block";
    document.getElementById("guardianGradesPanel").style.display = "block";
    document.getElementById("guardianAttendancePanel").style.display = "block";
    document.getElementById("guardianAssignmentsPanel").style.display = "block";
    
    await loadGuardianChildren();
}

// Search child by email
async function searchChildByEmail() {
    const email = document.getElementById("searchChildEmail").value.trim();
    const resultDiv = document.getElementById("searchChildResult");
    
    if (!email) {
        resultDiv.innerHTML = '<p style="color: #dc3545;">Please enter an email address</p>';
        return;
    }
    
    resultDiv.innerHTML = '<p>Searching...</p>';
    
    try {
        const res = await fetch(`${API}/guardian/search-student-by-email?email=${encodeURIComponent(email)}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        
        if (res.ok && data.students && data.students.length > 0) {
            resultDiv.innerHTML = data.students.map(student => `
                <div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${student.full_name}</strong>
                        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">${student.email}</p>
                    </div>
                    ${student.alreadyLinked 
                        ? '<span style="color: #28a745; font-weight: bold;">✓ Already Linked</span>' 
                        : `<button class="primary-btn" onclick="linkChildByEmail('${student.email}')">Connect</button>`
                    }
                </div>
            `).join('');
        } else {
            resultDiv.innerHTML = `<p style="color: #dc3545;">✗ ${data.message || 'No student found with this email'}</p>`;
        }
        
    } catch (err) {
        console.error("Error searching child:", err);
        resultDiv.innerHTML = '<p style="color: #dc3545;">Error searching for student. Please try again.</p>';
    }
}

// Link child by email
async function linkChildByEmail(email) {
    if (!confirm("Do you want to link with this student?")) return;
    
    try {
        const res = await fetch(`${API}/guardian/link-by-email`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ email: email })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            alert("Successfully linked with student!");
            document.getElementById("searchChildEmail").value = '';
            document.getElementById("searchChildResult").innerHTML = '';
            loadGuardianChildren();
        } else {
            alert(data.message || "Failed to link");
        }
        
    } catch (err) {
        console.error("Error linking child:", err);
        alert("Network error - could not link");
    }
}

async function loadGuardianChildren() {
    try {
        const res = await fetch(`${API}/guardian/children`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        const container = document.getElementById("childrenList");
        
        if (res.ok && data.children && data.children.length > 0) {
            container.innerHTML = data.children.map(child => `
                <div class="child-info-card" onclick="selectChild('${child.id}', '${child.full_name}')" style="cursor: pointer;">
                    <h4>👨‍🎓 ${child.full_name}</h4>
                    <p>${child.email}</p>
                    <p style="color: #666; font-size: 12px;">Relationship: ${child.relationship || 'Child'}</p>
                </div>
            `).join('');
            
            if (!selectedChildId) {
                selectChild(data.children[0].id, data.children[0].full_name);
            }
        } else {
            container.innerHTML = "<p>No children linked to your account. Search for a child above to link.</p>";
        }
        
    } catch (err) {
        console.error("Error loading children:", err);
        document.getElementById("childrenList").innerHTML = "<p>Error loading children.</p>";
    }
}

async function selectChild(childId, childName) {
    selectedChildId = childId;
    
    document.getElementById("welcome").innerText = `Dashboard - ${childName}`;
    
    await Promise.all([
        loadGuardianCourses(childId),
        loadGuardianGrades(childId),
        loadGuardianAttendance(childId),
        loadGuardianAssignments(childId)
    ]);
}

async function loadGuardianCourses(childId) {
    try {
        const res = await fetch(`${API}/guardian/child/${childId}/courses`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        const container = document.getElementById("guardianCourses");
        
        if (res.ok && data.courses && data.courses.length > 0) {
            container.innerHTML = data.courses.map(course => `
                <div class="course-card">
                    <h4>${course.title}</h4>
                    <p>${course.description || 'No description'}</p>
                    <p><strong>Teacher:</strong> ${course.teacher}</p>
                    <span class="category-tag">${course.category || 'General'}</span>
                    ${course.duration ? `<span class="duration-tag">${course.duration}</span>` : ''}
                </div>
            `).join('');
        } else {
            container.innerHTML = "<p>No courses enrolled yet.</p>";
        }
        
    } catch (err) {
        console.error("Error loading courses:", err);
        document.getElementById("guardianCourses").innerHTML = "<p>Error loading courses.</p>";
    }
}

async function loadGuardianGrades(childId) {
    try {
        const res = await fetch(`${API}/guardian/child/${childId}/grades`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        const container = document.getElementById("guardianGrades");
        
        if (res.ok && data.grades && data.grades.length > 0) {
            const overall = data.overall;
            
            container.innerHTML = `
                <div class="analytics-card" style="margin-bottom: 20px;">
                    <h4>Overall Grade: ${overall.letter_grade} (${overall.percentage}%)</h4>
                    <div class="analytics-stats">
                        <div class="stat">
                            <span class="stat-value">${overall.earned_points}</span>
                            <span class="stat-label">Points Earned</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${overall.total_points}</span>
                            <span class="stat-label">Total Points</span>
                        </div>
                    </div>
                </div>
                ${data.grades.slice(0, 10).map(grade => `
                    <div class="deadline-item">
                        <div class="deadline-info">
                            <h4>${grade.assignment_title}</h4>
                            <p>${grade.course_name}</p>
                        </div>
                        <div class="deadline-date">
                            <span class="days-left" style="color: ${grade.percentage >= 60 ? '#28a745' : '#dc3545'}">
                                ${grade.grade}/${grade.points} (${grade.percentage}%)
                            </span>
                        </div>
                    </div>
                `).join('')}
            `;
        } else {
            container.innerHTML = "<p>No grades available yet.</p>";
        }
        
    } catch (err) {
        console.error("Error loading grades:", err);
        document.getElementById("guardianGrades").innerHTML = "<p>Error loading grades.</p>";
    }
}

async function loadGuardianAttendance(childId) {
    try {
        const res = await fetch(`${API}/guardian/child/${childId}/attendance`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        const container = document.getElementById("guardianAttendance");
        
        if (res.ok) {
            const summary = data.summary;
            
            container.innerHTML = `
                <div class="analytics-card" style="margin-bottom: 20px;">
                    <h4>Attendance Rate: ${summary.rate}%</h4>
                    <div class="analytics-stats">
                        <div class="stat">
                            <span class="stat-value">${summary.present}</span>
                            <span class="stat-label">Present</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${summary.absent}</span>
                            <span class="stat-label">Absent</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${summary.total}</span>
                            <span class="stat-label">Total</span>
                        </div>
                    </div>
                </div>
                ${(data.attendance || []).slice(0, 10).map(record => `
                    <div class="deadline-item">
                        <div class="deadline-info">
                            <h4>${record.session?.course?.title || 'Unknown Course'}</h4>
                            <p>${new Date(record.marked_at).toLocaleDateString()}</p>
                        </div>
                        <div class="deadline-date">
                            <span class="days-left" style="color: ${record.status === 'present' ? '#28a745' : '#dc3545'}">
                                ${record.status === 'present' ? '✓ Present' : '✗ Absent'}
                            </span>
                        </div>
                    </div>
                `).join('')}
            `;
        } else {
            container.innerHTML = "<p>No attendance data available.</p>";
        }
        
    } catch (err) {
        console.error("Error loading attendance:", err);
        document.getElementById("guardianAttendance").innerHTML = "<p>Error loading attendance.</p>";
    }
}

async function loadGuardianAssignments(childId) {
    try {
        const res = await fetch(`${API}/guardian/child/${childId}/assignments`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        const container = document.getElementById("guardianAssignments");
        
        if (res.ok && data.assignments && data.assignments.length > 0) {
            container.innerHTML = data.assignments.slice(0, 10).map(assignment => {
                const statusColors = {
                    'submitted': '#28a745',
                    'pending': '#ffc107',
                    'late': '#dc3545',
                    'graded': '#17a2b8'
                };
                return `
                    <div class="deadline-item">
                        <div class="deadline-info">
                            <h4>${assignment.title}</h4>
                            <p>${assignment.course_name}</p>
                            <p style="font-size: 12px; color: #666;">Due: ${assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'N/A'}</p>
                        </div>
                        <div class="deadline-date">
                            <span class="days-left" style="color: ${statusColors[assignment.status] || '#666'}">
                                ${assignment.status || 'Unknown'}
                            </span>
                            ${assignment.grade !== null ? `<span style="display: block; font-size: 12px; margin-top: 5px;">Grade: ${assignment.grade}/${assignment.points}</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = "<p>No assignments submitted yet.</p>";
        }
        
    } catch (err) {
        console.error("Error loading assignments:", err);
        document.getElementById("guardianAssignments").innerHTML = "<p>Error loading assignments.</p>";
    }
}



function showGuardianDashboard() {
    document.getElementById("welcome").innerText = "Welcome, " + user.full_name;
    loadGuardianDashboard();
}

function showGuardianChildren() {
    loadGuardianChildren();
}

/* ===== HELPER FUNCTIONS ===== */

function hideAllPanels() {
    // Hide all elements with class 'panel'
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => {
        panel.style.display = "none";
    });

    // Also hide the quiz modal if it exists
    const quizModal = document.getElementById("quizModal");
    if (quizModal) quizModal.style.display = "none";
}

function logout() {
    localStorage.clear();
    window.location.href = "login.html";
}

/* ===== TEACHER COURSE FUNCTIONS ===== */

function showCreateCourseForm() {
    hideAllPanels();
    document.getElementById("createCoursePanel").style.display = "block";
}

function hideCreateCourseForm() {
    showMyCourses();
}

function showMyCourses() {
    hideAllPanels();
    document.getElementById("myCoursesPanel").style.display = "block";
    document.getElementById("teacherSessionPanel").style.display = "block";
    document.getElementById("attendanceListPanel").style.display = "block";
    loadMyCourses();
}

function showTeacherSessionPanel() {
    hideAllPanels();
    document.getElementById("teacherSessionPanel").style.display = "block";
    document.getElementById("attendanceListPanel").style.display = "block";
    checkActiveSession();
}

function showStudentAttendance() {
    window.location.href = "attendance-scan.html";
}

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

async function loadMyCourses() {
    if (user.role !== "teacher") return;

    try {
        const res = await fetch(`${API}/courses/my-courses`, {
            headers: { "Authorization": `Bearer ${token}` }
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
                            <button class="secondary-btn" onclick="viewCourseStudents('${course.id}')" style="font-size: 12px; padding: 8px 16px; margin-left: 5px;">View Students</button>
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

const TOKEN_INTERVAL = 40000;

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

async function checkActiveSession() {
    if (user.role !== "teacher") return;
    
    try {
        const res = await fetch(`${API}/attendance/active-sessions`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        if (data.sessions && data.sessions.length > 0) {
            // Use the most recent active session
            const activeSession = data.sessions[0];
            currentSessionId = activeSession.id;
            
            // Update UI to show which course is active
            const courseTitle = activeSession.courses?.title || "Class Session";
            const sessionTitleElement = document.querySelector("#activeSessionInfo p strong");
            if (sessionTitleElement) sessionTitleElement.innerText = `Active Session: ${courseTitle}`;
            
            showActiveSession(currentSessionId);
        }
    } catch (err) {
        console.error("Error checking active session:", err);
    }
}

async function showActiveSession(sessionId) {
    document.getElementById("noActiveSession").style.display = "none";
    document.getElementById("activeSessionInfo").style.display = "block";
    
    if (qrRefreshInterval) clearInterval(qrRefreshInterval);
    if (attendanceRefreshInterval) clearInterval(attendanceRefreshInterval);
    
    await updateQRCode(sessionId);
    qrRefreshInterval = setInterval(() => updateQRCode(sessionId), TOKEN_INTERVAL);
    await refreshAttendance();
    attendanceRefreshInterval = setInterval(() => refreshAttendance(), 5000);
}

async function updateQRCode(sessionId) {
    try {
        const tokenRes = await fetch(`${API}/attendance/sessions/${sessionId}/qr`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const tokenData = await tokenRes.json();
        
        if (tokenRes.ok) {
            let finalQrData = tokenData.qrData;
            const isRemoteMode = document.getElementById("remoteModeToggle")?.checked;
            
            if (isRemoteMode) {
                // Force use of Render URL if in remote mode
                const RENDER_BASE = "https://academia-2-xgdr.onrender.com";
                finalQrData = `${RENDER_BASE}/attendance-form.html?session=${sessionId}&token=${tokenData.token}`;
            }

            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(finalQrData)}`;
            document.getElementById("qrCodeImage").src = qrImageUrl;
            updateCountdown(tokenData.expiresIn);
        } else {
            console.error("Failed to get token:", tokenData.message);
        }
        
    } catch (err) {
        console.error("Error updating QR code:", err);
    }
}

function updateCountdown(expiresIn) {
    const countdownElement = document.getElementById("qrCountdown");
    if (!countdownElement) {
        const qrDisplay = document.getElementById("qrCodeDisplay");
        const countdownDiv = document.createElement("div");
        countdownDiv.id = "qrCountdown";
        countdownDiv.style.cssText = "margin-top: 10px; font-size: 14px; color: #666;";
        qrDisplay.appendChild(countdownDiv);
    }
    
    const seconds = Math.ceil(expiresIn / 1000);
    const countdownDiv = document.getElementById("qrCountdown");
    countdownDiv.innerHTML = `⏱️ QR refreshes in <strong>${seconds}s</strong>`;
    
    let remaining = expiresIn;
    
    // Clear any existing countdown interval on this element
    if (countdownElement.dataset.intervalId) {
        clearInterval(parseInt(countdownElement.dataset.intervalId));
    }
    
    const countdownInterval = setInterval(() => {
        remaining -= 1000;
        if (remaining <= 0) {
            clearInterval(countdownInterval);
        } else {
            const secs = Math.ceil(remaining / 1000);
            countdownDiv.innerHTML = `⏱️ QR refreshes in <strong>${secs}s</strong>`;
        }
    }, 1000);
    
    // Store interval ID on the element
    countdownDiv.dataset.intervalId = countdownInterval;
}

async function refreshAttendance() {
    if (!currentSessionId) {
        console.warn("No active session ID for attendance refresh");
        return;
    }
    
    try {
        const res = await fetch(`${API}/attendance/${currentSessionId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        
        if (res.ok) {
            const presentCount = document.getElementById("presentCount");
            if (presentCount) presentCount.innerText = data.present_count || 0;
            
            const attendanceList = document.getElementById("attendanceList");
            if (data.attendance && data.attendance.length > 0) {
                attendanceList.innerHTML = data.attendance.map(record => `
                    <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${record.student?.full_name || record.name || 'Unknown'}</strong>
                            ${record.reg_no ? `<br><small style="color: #666;">Reg No: ${record.reg_no}</small>` : ''}
                        </div>
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

async function endSession() {
    if (!currentSessionId) {
        alert("No active session found to end.");
        return;
    }
    
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

async function viewCourseStudents(courseId) {
    hideAllPanels();
    document.getElementById("courseStudentsPanel").style.display = "block";
    
    try {
        const res = await fetch(`${API}/courses/${courseId}/enrollments`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        const data = await res.json();
        const studentsList = document.getElementById("studentsList");
        
        if (res.ok && data.enrollments && data.enrollments.length > 0) {
            studentsList.innerHTML = `
                <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <strong>Total Enrolled: ${data.enrollments.length} students</strong>
                </div>
                ${data.enrollments.map((enrollment, index) => `
                    <div style="padding: 15px; border: 1px solid #ddd; margin-bottom: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>#${index + 1} ${enrollment.student?.full_name || 'Unknown'}</strong>
                            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">${enrollment.student?.email || 'No email'}</p>
                            <p style="margin: 5px 0 0 0; color: #888; font-size: 12px;">Enrolled: ${formatDate(enrollment.enrolled_at)}</p>
                        </div>
                        <span style="color: #28a745; font-size: 12px;">✓ Enrolled</span>
                    </div>
                `).join('')}`;
        } else {
            studentsList.innerHTML = "<p>No students enrolled in this course yet.</p>";
        }
    } catch (err) {
        console.error("Error loading students:", err);
        document.getElementById("studentsList").innerHTML = "<p>Error loading enrolled students.</p>";
    }
}

async function viewCourseSessions(courseId) {
    hideAllPanels();
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
                    <p><strong>Date:</strong> ${formatDate(session.date)}</p>
                    <p><strong>Status:</strong> <span style="color: ${session.status === 'active' ? '#28a745' : '#6c757d'}">${session.status}</span></p>
                    ${session.status === 'active' ? `<button class="secondary-btn" onclick="endSpecificSession('${session.id}', '${courseId}')" style="background: #dc3545; color: white; margin-top: 10px; font-size: 12px; padding: 5px 10px;">End This Session</button>` : ''}
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

async function endSpecificSession(sessionId, courseId) {
    if (!confirm("Are you sure you want to end this session?")) return;
    
    try {
        const res = await fetch(`${API}/attendance/sessions/${sessionId}/end`, {
            method: "PATCH",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });
        
        const data = await res.json();
        
        if (res.ok) {
            alert("Session ended successfully!");
            if (sessionId == currentSessionId) {
                if (qrRefreshInterval) clearInterval(qrRefreshInterval);
                if (attendanceRefreshInterval) clearInterval(attendanceRefreshInterval);
                currentSessionId = null;
                document.getElementById("noActiveSession").style.display = "block";
                document.getElementById("activeSessionInfo").style.display = "none";
            }
            viewCourseSessions(courseId); // Refresh history list
        } else {
            alert(data.message || "Failed to end session");
        }
    } catch (err) {
        console.error(err);
        alert("Network error - could not end session");
    }
}

function openAttendanceScanner() {
    window.location.href = "attendance-scan.html";
}

/* ========== QUIZ MODULE ========== */

// --- TEACHER FUNCTIONS ---

function showInstructorQuizzes() {
    hideAllPanels();
    document.getElementById("teacherQuizzesPanel").style.display = "block";
    loadTeacherQuizzes();
}

async function loadTeacherQuizzes() {
    try {
        // We need all teacher's courses to get their quizzes
        const coursesRes = await fetch(`${API}/courses/my-courses`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const coursesData = await coursesRes.json();
        
        if (!coursesRes.ok) return;

        const container = document.getElementById("teacherQuizzesList");
        let html = '';

        for (const course of coursesData.courses) {
            const quizRes = await fetch(`${API}/quizzes/course/${course.id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const quizData = await quizRes.json();
            
            if (quizData.quizzes && quizData.quizzes.length > 0) {
                html += `<h4>${course.title}</h4>`;
                html += quizData.quizzes.map(quiz => `
                    <div class="deadline-item">
                        <div class="deadline-info">
                            <strong>${quiz.title}</strong>
                            <p>${quiz.time_limit} mins | Created: ${new Date(quiz.created_at).toLocaleDateString()}</p>
                        </div>
                        <div class="action-btns">
                            <button class="primary-btn" style="padding: 5px 10px;" onclick="viewQuizResults('${quiz.id}', '${quiz.title}')">Results</button>
                        </div>
                    </div>
                `).join('');
            }
        }

        container.innerHTML = html || "<p>No quizzes created yet.</p>";

    } catch (err) {
        console.error("Error loading teacher quizzes:", err);
    }
}

function openQuizModal() {
    document.getElementById("quizModal").style.display = "block";
    loadCourseSelect();
    // Reset form and questions
    document.getElementById("quizForm").reset();
    document.getElementById("questionsContainer").innerHTML = '';
    addQuestion(); // Add first question by default
}

function closeQuizModal() {
    document.getElementById("quizModal").style.display = "none";
}

async function loadCourseSelect() {
    const res = await fetch(`${API}/courses/my-courses`, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await res.json();
    const select = document.getElementById("quizCourse");
    select.innerHTML = data.courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
}

let questionCount = 0;
function addQuestion() {
    questionCount++;
    const container = document.getElementById("questionsContainer");
    const div = document.createElement("div");
    div.className = "question-entry";
    div.id = `q-block-${questionCount}`;
    div.style = "background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid var(--primary);";
    
    div.innerHTML = `
        <div class="form-group">
            <label>Question ${questionCount}</label>
            <input type="text" class="q-text" placeholder="Enter question..." required>
        </div>
        <div class="form-group">
            <label>Options (Enter 4 options)</label>
            <input type="text" class="opt" placeholder="Option 1" required style="margin-bottom: 5px;">
            <input type="text" class="opt" placeholder="Option 2" required style="margin-bottom: 5px;">
            <input type="text" class="opt" placeholder="Option 3" required style="margin-bottom: 5px;">
            <input type="text" class="opt" placeholder="Option 4" required style="margin-bottom: 5px;">
        </div>
        <div class="form-group">
            <label>Correct Option (Index 1-4)</label>
            <input type="number" class="correct-opt" min="1" max="4" value="1" required>
        </div>
        <button type="button" class="logout" style="background: #dc3545; padding: 5px 10px;" onclick="removeQuestion(${questionCount})">Remove Question</button>
    `;
    container.appendChild(div);
}

function removeQuestion(id) {
    const el = document.getElementById(`q-block-${id}`);
    if (el) el.remove();
}

async function saveQuiz(e) {
    e.preventDefault();
    const questions = [];
    const qBlocks = document.querySelectorAll('.question-entry');
    
    qBlocks.forEach(block => {
        const text = block.querySelector('.q-text').value;
        const options = Array.from(block.querySelectorAll('.opt')).map(i => i.value);
        const correct = parseInt(block.querySelector('.correct-opt').value) - 1;
        questions.push({
            question_text: text,
            options: options,
            correct_option: correct,
            marks: 1
        });
    });

    const quizData = {
        course_id: document.getElementById("quizCourse").value,
        title: document.getElementById("quizTitle").value,
        description: document.getElementById("quizDescription").value,
        time_limit: document.getElementById("quizTimeLimit").value,
        questions: questions
    };

    try {
        const res = await fetch(`${API}/quizzes`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
             },
            body: JSON.stringify(quizData)
        });

        if (res.ok) {
            alert("Quiz created!");
            closeQuizModal();
            loadTeacherQuizzes();
        } else {
            const data = await res.json();
            alert(data.message || "Failed to create quiz");
        }
    } catch(err) {
        console.error(err);
    }
}

async function viewQuizResults(quizId, title) {
    hideAllPanels();
    document.getElementById("quizResultsPanel").style.display = "block";
    document.getElementById("resultsQuizTitle").innerText = `Results: ${title}`;
    
    try {
        const res = await fetch(`${API}/quizzes/${quizId}/results`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        
        const body = document.getElementById("quizResultsBody");
        if (data.results && data.results.length > 0) {
            body.innerHTML = data.results.map(r => `
                <tr>
                    <td>${r.users?.full_name}</td>
                    <td>${r.users?.email}</td>
                    <td>${r.score} / ${r.total_marks}</td>
                    <td><span class="status-active">Submitted</span></td>
                </tr>
            `).join('');
        } else {
            body.innerHTML = "<tr><td colspan='4'>No submissions yet</td></tr>";
        }
    } catch(err) {
        console.error(err);
    }
}

// --- STUDENT FUNCTIONS ---

function showStudentQuizzes() {
    hideAllPanels();
    document.getElementById("studentQuizzesPanel").style.display = "block";
    loadStudentQuizzes();
}

async function loadStudentQuizzes() {
    try {
        const res = await fetch(`${API}/courses/enrolled`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        
        const container = document.getElementById("studentQuizzesList");
        let html = '';

        for (const course of data.courses) {
            const quizRes = await fetch(`${API}/quizzes/course/${course.id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const quizData = await quizRes.json();
            
            if (quizData.quizzes && quizData.quizzes.length > 0) {
                html += `<h4>${course.title}</h4>`;
                html += quizData.quizzes.map(quiz => `
                    <div class="deadline-item">
                        <div class="deadline-info">
                            <strong>${quiz.title}</strong>
                            <p>${quiz.time_limit} mins | Questions: ...</p>
                        </div>
                        <div class="action-btns">
                            <button class="primary-btn" onclick="openQuiz('${quiz.id}')">View/Take Quiz</button>
                        </div>
                    </div>
                `).join('');
            }
        }

        container.innerHTML = html || "<p>No quizzes available for your courses.</p>";

    } catch (err) {
        console.error("Error loading student quizzes:", err);
    }
}

let activeQuizId = null;
let quizTimerInterval = null;
let currentQuestions = [];

async function openQuiz(id) {
    try {
        const res = await fetch(`${API}/quizzes/${id}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.alreadySubmitted) {
            alert("You have already submitted this quiz.");
            return;
        }

        if (!confirm(`Are you ready to start this quiz? You will have ${data.quiz.time_limit} minutes.`)) return;

        hideAllPanels();
        document.getElementById("quizViewPanel").style.display = "block";
        document.getElementById("viewQuizTitle").innerText = data.quiz.title;
        document.getElementById("viewQuizDesc").innerText = data.quiz.description || '';
        
        activeQuizId = id;
        currentQuestions = data.questions;
        
        // Render questions
        const container = document.getElementById("takingQuestionsContainer");
        container.innerHTML = data.questions.map((q, idx) => `
            <div class="q-take-block" style="margin-bottom: 25px;">
                <p><strong>Q${idx+1}: ${q.question_text}</strong></p>
                <div class="options" style="margin-top: 10px; display: grid; gap: 8px;">
                    ${q.options.map((opt, optIdx) => `
                        <label style="padding: 10px; background: #f0f2f5; border-radius: 6px; cursor: pointer;">
                            <input type="radio" name="q-${idx}" value="${optIdx}" required> ${opt}
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');

        startTimer(data.quiz.time_limit * 60);

    } catch(err) {
        console.error(err);
    }
}

function startTimer(duration) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById("quizTimer");
    
    if (quizTimerInterval) clearInterval(quizTimerInterval);
    
    quizTimerInterval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.textContent = "Time Left: " + minutes + ":" + seconds;

        if (--timer < 0) {
            clearInterval(quizTimerInterval);
            alert("Time is up! Submitting automatically.");
            submitQuiz();
        }
    }, 1000);
}

async function submitQuiz(e) {
    if (e) e.preventDefault();
    
    const answers = [];
    currentQuestions.forEach((_, idx) => {
        const selected = document.querySelector(`input[name="q-${idx}"]:checked`);
        answers.push(selected ? parseInt(selected.value) : -1);
    });

    try {
        const res = await fetch(`${API}/quizzes/${activeQuizId}/submit`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ answers })
        });

        const data = await res.json();
        if (res.ok) {
            clearInterval(quizTimerInterval);
            alert(`Quiz Submitted! Your score: ${data.score} / ${data.totalMarks}`);
            showStudentQuizzes();
        } else {
            alert(data.message || "Failed to submit quiz");
        }
    } catch(err) {
        console.error(err);
    }
}
