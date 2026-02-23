// Admin Dashboard JavaScript
const API_URL = 'http://localhost:5000/api';
let authToken = localStorage.getItem('token');
let currentUser = null;
let allUsers = [];
let allCourses = [];
let allEnrollments = [];

// Check authentication on load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadDashboardStats();
    loadRecentActivity();
});

// Authentication Check
async function checkAuth() {
    if (!authToken) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            throw new Error('Invalid token');
        }

        const data = await response.json();
        currentUser = data.user;

        if (currentUser.role !== 'admin') {
            alert('Access denied. Admin only.');
            window.location.href = 'dashboard.html';
            return;
        }

        document.getElementById('adminName').textContent = currentUser.full_name || 'Admin';
    } catch (err) {
        console.error('Auth error:', err);
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    }
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Panel Navigation
function showPanel(panelName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.nav-item').classList.add('active');

    // Hide all panels
    document.querySelectorAll('.content-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    // Show selected panel
    document.getElementById(`${panelName}Panel`).classList.add('active');

    // Update page title
    const titles = {
        dashboard: 'Dashboard Overview',
        users: 'User Management',
        courses: 'Course Management',
        enrollments: 'Enrollment Management',
        attendance: 'Attendance Reports',
        reports: 'System Reports'
    };
    document.getElementById('pageTitle').textContent = titles[panelName];

    // Load panel data
    switch(panelName) {
        case 'users':
            loadUsers();
            break;
        case 'courses':
            loadCourses();
            break;
        case 'enrollments':
            loadEnrollments();
            break;
        case 'attendance':
            loadAttendanceFilters();
            break;
        case 'reports':
            loadReports();
            break;
    }
}

// ============================================
// DASHBOARD STATS
// ============================================

async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load stats');

        const data = await response.json();

        document.getElementById('totalUsers').textContent = data.users.total_users;
        document.getElementById('totalTeachers').textContent = data.users.teachers;
        document.getElementById('totalStudents').textContent = data.users.students;
        document.getElementById('totalParents').textContent = data.users.parents;
        document.getElementById('totalCourses').textContent = data.courses;
        document.getElementById('totalEnrollments').textContent = data.enrollments;

    } catch (err) {
        console.error('Error loading stats:', err);
    }
}

// ============================================
// RECENT ACTIVITY
// ============================================

async function loadRecentActivity() {
    try {
        const response = await fetch(`${API_URL}/admin/activity?limit=10`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load activity');

        const data = await response.json();
        const activityList = document.getElementById('activityList');

        let html = '';

        // Recent enrollments
        if (data.recent_enrollments && data.recent_enrollments.length > 0) {
            data.recent_enrollments.forEach(enrollment => {
                const time = new Date(enrollment.enrolled_at).toLocaleString();
                html += `
                    <div class="activity-item">
                        <div class="activity-icon" style="background: #dbeafe; color: #2563eb;">📝</div>
                        <div class="activity-content">
                            <p><strong>${enrollment.student?.full_name || 'Unknown'}</strong> enrolled in <strong>${enrollment.course?.title || 'Unknown Course'}</strong></p>
                            <span>${time}</span>
                        </div>
                    </div>
                `;
            });
        }

        // Recent attendance
        if (data.recent_attendance && data.recent_attendance.length > 0) {
            data.recent_attendance.slice(0, 5).forEach(attendance => {
                const time = new Date(attendance.marked_at).toLocaleString();
                html += `
                    <div class="activity-item">
                        <div class="activity-icon" style="background: #d1fae5; color: #059669;">✅</div>
                        <div class="activity-content">
                            <p><strong>${attendance.student?.full_name || 'Unknown'}</strong> marked attendance for <strong>${attendance.session?.course?.title || 'Unknown'}</strong></p>
                            <span>${time}</span>
                        </div>
                    </div>
                `;
            });
        }

        // Recent sessions
        if (data.recent_sessions && data.recent_sessions.length > 0) {
            data.recent_sessions.slice(0, 5).forEach(session => {
                const time = new Date(session.created_at).toLocaleString();
                const status = session.status === 'active' ? 'started' : 'ended';
                html += `
                    <div class="activity-item">
                        <div class="activity-icon" style="background: #ffedd5; color: #ea580c;">📅</div>
                        <div class="activity-content">
                            <p>Session ${status} for <strong>${session.course?.title || 'Unknown'}</strong> by ${session.teacher?.full_name || 'Unknown'}</p>
                            <span>${time}</span>
                        </div>
                    </div>
                `;
            });
        }

        if (html === '') {
            html = '<div class="empty-state"><p>No recent activity</p></div>';
        }

        activityList.innerHTML = html;

    } catch (err) {
        console.error('Error loading activity:', err);
        document.getElementById('activityList').innerHTML = '<div class="empty-state"><p>Failed to load activity</p></div>';
    }
}

// ============================================
// USER MANAGEMENT
// ============================================

async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load users');

        const data = await response.json();
        allUsers = data.users || [];
        renderUsers(allUsers);

    } catch (err) {
        console.error('Error loading users:', err);
        document.getElementById('usersTableBody').innerHTML = `
            <tr><td colspan="6" class="empty-state"><p>Failed to load users</p></td></tr>
        `;
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><p>No users found</p></td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const roleBadges = {
            admin: 'badge-danger',
            teacher: 'badge-info',
            student: 'badge-success',
            parent: 'badge-purple'
        };

        const statusBadges = {
            active: 'badge-success',
            inactive: 'badge-warning'
        };

        const created = new Date(user.created_at).toLocaleDateString();

        return `
            <tr>
                <td><strong>${user.full_name}</strong></td>
                <td>${user.email}</td>
                <td><span class="badge ${roleBadges[user.role] || 'badge-info'}">${user.role}</span></td>
                <td><span class="badge ${statusBadges[user.status] || 'badge-warning'}">${user.status || 'active'}</span></td>
                <td>${created}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn view" onclick="viewUser('${user.id}')">View</button>
                        <button class="action-btn edit" onclick="editUser('${user.id}')">Edit</button>
                        <button class="action-btn delete" onclick="deleteUser('${user.id}')">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterUsers() {
    const search = document.getElementById('userSearch').value.toLowerCase();
    const role = document.getElementById('userRoleFilter').value;
    const status = document.getElementById('userStatusFilter').value;

    let filtered = allUsers;

    if (search) {
        filtered = filtered.filter(u => 
            u.full_name.toLowerCase().includes(search) || 
            u.email.toLowerCase().includes(search)
        );
    }

    if (role) {
        filtered = filtered.filter(u => u.role === role);
    }

    if (status) {
        filtered = filtered.filter(u => (u.status || 'active') === status);
    }

    renderUsers(filtered);
}

// User Modal
function openUserModal() {
    document.getElementById('userModalTitle').textContent = 'Add New User';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
}

function toggleParentFields() {
    const role = document.getElementById('userRole').value;
    const parentField = document.getElementById('parentStudentField');
    parentField.style.display = role === 'parent' ? 'block' : 'none';
}

async function saveUser() {
    const userId = document.getElementById('userId').value;
    const fullName = document.getElementById('userFullName').value;
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;
    const phone = document.getElementById('userPhone').value;
    const dob = document.getElementById('userDOB').value;
    const parentOf = document.getElementById('parentOfStudent').value;

    if (!fullName || !email || !password || !role) {
        alert('Please fill in all required fields');
        return;
    }

    const userData = {
        full_name: fullName,
        email,
        password,
        role,
        phone,
        date_of_birth: dob
    };

    if (role === 'parent' && parentOf) {
        userData.parent_of = parentOf;
    }

    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create user');
        }

        alert('User created successfully!');
        closeUserModal();
        loadUsers();

    } catch (err) {
        alert(err.message);
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to delete user');

        alert('User deleted successfully');
        loadUsers();

    } catch (err) {
        alert(err.message);
    }
}

function viewUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    alert(`User Details:\n\nName: ${user.full_name}\nEmail: ${user.email}\nRole: ${user.role}\nStatus: ${user.status || 'active'}\nPhone: ${user.phone || 'N/A'}\nCreated: ${new Date(user.created_at).toLocaleString()}`);
}

function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('userModalTitle').textContent = 'Edit User';
    document.getElementById('userId').value = user.id;
    document.getElementById('userFullName').value = user.full_name;
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userRole').value = user.role;
    document.getElementById('userPhone').value = user.phone || '';
    document.getElementById('userDOB').value = user.date_of_birth || '';
    document.getElementById('userPassword').required = false;
    
    document.getElementById('userModal').classList.add('active');
}

// ============================================
// COURSE MANAGEMENT
// ============================================

async function loadCourses() {
    try {
        const response = await fetch(`${API_URL}/admin/courses`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load courses');

        const data = await response.json();
        allCourses = data.courses || [];
        renderCourses(allCourses);

    } catch (err) {
        console.error('Error loading courses:', err);
        document.getElementById('coursesTableBody').innerHTML = `
            <tr><td colspan="5" class="empty-state"><p>Failed to load courses</p></td></tr>
        `;
    }
}

function renderCourses(courses) {
    const tbody = document.getElementById('coursesTableBody');
    
    if (courses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><p>No courses found</p></td></tr>';
        return;
    }

    tbody.innerHTML = courses.map(course => {
        const created = new Date(course.created_at).toLocaleDateString();
        return `
            <tr>
                <td>
                    <strong>${course.title}</strong>
                    <br><small style="color: #64748b;">${course.course_code || 'No code'}</small>
                </td>
                <td>${course.teacher?.full_name || 'Unknown'}</td>
                <td>${course.enrollment_count || 0} students</td>
                <td>${created}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn view" onclick="viewCourse('${course.id}')">View</button>
                        <button class="action-btn delete" onclick="deleteCourse('${course.id}')">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function viewCourse(courseId) {
    try {
        const response = await fetch(`${API_URL}/admin/courses/${courseId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load course details');

        const data = await response.json();
        
        const modalBody = document.getElementById('courseModalBody');
        modalBody.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h4>${data.course.title}</h4>
                <p style="color: #64748b;">${data.course.description || 'No description'}</p>
                <p><strong>Teacher:</strong> ${data.course.teacher?.full_name || 'Unknown'}</p>
                <p><strong>Course Code:</strong> ${data.course.course_code || 'N/A'}</p>
            </div>
            
            <h5 style="margin-bottom: 15px;">Enrolled Students (${data.stats.total_students})</h5>
            <div class="table-container" style="margin-bottom: 20px;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Enrolled Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.enrollments.length > 0 ? data.enrollments.map(e => `
                            <tr>
                                <td>${e.student?.full_name || 'Unknown'}</td>
                                <td>${e.student?.email || 'N/A'}</td>
                                <td>${new Date(e.enrolled_at).toLocaleDateString()}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="3" class="empty-state">No students enrolled</td></tr>'}
                    </tbody>
                </table>
            </div>

            <h5 style="margin-bottom: 15px;">Sessions (${data.stats.total_sessions})</h5>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Topic</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.sessions.length > 0 ? data.sessions.map(s => `
                            <tr>
                                <td>${new Date(s.date).toLocaleString()}</td>
                                <td><span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-warning'}">${s.status}</span></td>
                                <td>${s.topic || 'N/A'}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="3" class="empty-state">No sessions yet</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('courseModal').classList.add('active');

    } catch (err) {
        alert(err.message);
    }
}

function closeCourseModal() {
    document.getElementById('courseModal').classList.remove('active');
}

async function deleteCourse(courseId) {
    if (!confirm('Are you sure you want to delete this course? All associated data will be lost.')) return;

    try {
        const response = await fetch(`${API_URL}/admin/courses/${courseId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to delete course');

        alert('Course deleted successfully');
        loadCourses();

    } catch (err) {
        alert(err.message);
    }
}

// ============================================
// ENROLLMENT MANAGEMENT
// ============================================

async function loadEnrollments() {
    try {
        // Load enrollments
        const response = await fetch(`${API_URL}/admin/enrollments`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load enrollments');

        const data = await response.json();
        allEnrollments = data.enrollments || [];
        renderEnrollments(allEnrollments);

        // Load filter options
        await loadEnrollmentFilters();

    } catch (err) {
        console.error('Error loading enrollments:', err);
        document.getElementById('enrollmentsTableBody').innerHTML = `
            <tr><td colspan="5" class="empty-state"><p>Failed to load enrollments</p></td></tr>
        `;
    }
}

async function loadEnrollmentFilters() {
    // Load courses for filter
    const courseSelect = document.getElementById('enrollmentCourseFilter');
    const enrollCourseSelect = document.getElementById('enrollCourse');
    
    try {
        const response = await fetch(`${API_URL}/admin/courses`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const courses = data.courses || [];
            
            let options = '<option value="">All Courses</option>';
            let enrollOptions = '<option value="">Select Course</option>';
            
            courses.forEach(course => {
                options += `<option value="${course.id}">${course.title}</option>`;
                enrollOptions += `<option value="${course.id}">${course.title}</option>`;
            });
            
            courseSelect.innerHTML = options;
            enrollCourseSelect.innerHTML = enrollOptions;
        }
    } catch (err) {
        console.error('Error loading courses for filter:', err);
    }

    // Load students for enrollment modal
    const studentSelect = document.getElementById('enrollStudent');
    try {
        const response = await fetch(`${API_URL}/admin/users?role=student`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const students = data.users || [];
            
            let options = '<option value="">Select Student</option>';
            students.forEach(student => {
                options += `<option value="${student.id}">${student.full_name} (${student.email})</option>`;
            });
            
            studentSelect.innerHTML = options;
        }
    } catch (err) {
        console.error('Error loading students:', err);
    }
}

function renderEnrollments(enrollments) {
    const tbody = document.getElementById('enrollmentsTableBody');
    
    if (enrollments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><p>No enrollments found</p></td></tr>';
        return;
    }

    tbody.innerHTML = enrollments.map(e => {
        const enrolled = new Date(e.enrolled_at).toLocaleDateString();
        return `
            <tr>
                <td><strong>${e.student?.full_name || 'Unknown'}</strong></td>
                <td>${e.course?.title || 'Unknown'}</td>
                <td>${e.course?.teacher_id ? 'Teacher' : 'N/A'}</td>
                <td>${enrolled}</td>
                <td>
                    <button class="action-btn delete" onclick="deleteEnrollment('${e.id}')">Remove</button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterEnrollments() {
    const courseId = document.getElementById('enrollmentCourseFilter').value;
    const search = document.getElementById('enrollmentSearch').value.toLowerCase();

    let filtered = allEnrollments;

    if (courseId) {
        filtered = filtered.filter(e => e.course?.id === courseId);
    }

    if (search) {
        filtered = filtered.filter(e => 
            e.student?.full_name?.toLowerCase().includes(search) ||
            e.student?.email?.toLowerCase().includes(search)
        );
    }

    renderEnrollments(filtered);
}

function openEnrollmentModal() {
    document.getElementById('enrollmentForm').reset();
    document.getElementById('enrollmentModal').classList.add('active');
}

function closeEnrollmentModal() {
    document.getElementById('enrollmentModal').classList.remove('active');
}

async function saveEnrollment() {
    const studentId = document.getElementById('enrollStudent').value;
    const courseId = document.getElementById('enrollCourse').value;

    if (!studentId || !courseId) {
        alert('Please select both student and course');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/enrollments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ student_id: studentId, course_id: courseId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to enroll student');
        }

        alert('Student enrolled successfully!');
        closeEnrollmentModal();
        loadEnrollments();

    } catch (err) {
        alert(err.message);
    }
}

async function deleteEnrollment(enrollmentId) {
    if (!confirm('Are you sure you want to remove this enrollment?')) return;

    try {
        const response = await fetch(`${API_URL}/admin/enrollments/${enrollmentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to remove enrollment');

        alert('Enrollment removed successfully');
        loadEnrollments();

    } catch (err) {
        alert(err.message);
    }
}

// ============================================
// ATTENDANCE REPORTS
// ============================================

async function loadAttendanceFilters() {
    // Load courses
    const courseSelect = document.getElementById('attendanceCourseFilter');
    
    try {
        const response = await fetch(`${API_URL}/admin/courses`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const courses = data.courses || [];
            
            let options = '<option value="">Select Course</option>';
            courses.forEach(course => {
                options += `<option value="${course.id}">${course.title}</option>`;
            });
            
            courseSelect.innerHTML = options;
        }
    } catch (err) {
        console.error('Error loading courses:', err);
    }
}

async function loadAttendanceReport() {
    const courseId = document.getElementById('attendanceCourseFilter').value;
    
    if (!courseId) {
        document.getElementById('attendanceTableBody').innerHTML = `
            <tr><td colspan="5" class="empty-state"><p>Select a course to view attendance</p></td></tr>
        `;
        return;
    }

    // Load sessions for this course
    const sessionSelect = document.getElementById('attendanceSessionFilter');
    try {
        const response = await fetch(`${API_URL}/admin/courses/${courseId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const sessions = data.sessions || [];
            
            let options = '<option value="">All Sessions</option>';
            sessions.forEach(session => {
                const date = new Date(session.date).toLocaleString();
                options += `<option value="${session.id}">${date} (${session.status})</option>`;
            });
            
            sessionSelect.innerHTML = options;
        }
    } catch (err) {
        console.error('Error loading sessions:', err);
    }

    // Load attendance for course
    try {
        const response = await fetch(`${API_URL}/admin/attendance/course/${courseId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load attendance');

        const data = await response.json();
        renderAttendance(data.attendance || []);

    } catch (err) {
        console.error('Error loading attendance:', err);
        document.getElementById('attendanceTableBody').innerHTML = `
            <tr><td colspan="5" class="empty-state"><p>Failed to load attendance</p></td></tr>
        `;
    }
}

async function loadAttendanceBySession() {
    const sessionId = document.getElementById('attendanceSessionFilter').value;
    
    if (!sessionId) {
        loadAttendanceReport();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/attendance/session/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load attendance');

        const data = await response.json();
        renderAttendance(data.attendance || []);

    } catch (err) {
        console.error('Error loading attendance:', err);
    }
}

function renderAttendance(attendance) {
    const tbody = document.getElementById('attendanceTableBody');
    
    if (attendance.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><p>No attendance records found</p></td></tr>';
        return;
    }

    tbody.innerHTML = attendance.map(a => {
        const marked = new Date(a.marked_at).toLocaleString();
        const sessionDate = a.session?.date ? new Date(a.session.date).toLocaleString() : 'N/A';
        
        return `
            <tr>
                <td><strong>${a.student?.full_name || 'Unknown'}</strong></td>
                <td>${a.session?.course?.title || 'Unknown'}</td>
                <td>${sessionDate}</td>
                <td>${marked}</td>
                <td><span class="badge badge-success">Present</span></td>
            </tr>
        `;
    }).join('');
}

// ============================================
// REPORTS
// ============================================

async function loadReports() {
    try {
        const response = await fetch(`${API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load stats');

        const data = await response.json();
        
        document.getElementById('reportTotalSessions').textContent = data.sessions;
        document.getElementById('reportTotalAttendance').textContent = data.attendance_records;
        
        // Calculate average attendance rate
        const avgRate = data.sessions > 0 
            ? Math.round((data.attendance_records / (data.sessions * data.users.students)) * 100) 
            : 0;
        document.getElementById('reportAvgAttendance').textContent = avgRate + '%';

    } catch (err) {
        console.error('Error loading reports:', err);
    }
}
