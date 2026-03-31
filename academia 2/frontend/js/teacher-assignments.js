// Teacher Assignments Management

async function showTeacherAssignments() {
    hideAllPanels();
    document.getElementById("teacherAssignmentsPanel").style.display = "block";
    // Load will be triggered from course selection
}

async function loadTeacherAssignments(courseId) {
    try {
        const res = await fetch(`${API}/assignments/course/${courseId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();
        const container = document.getElementById("teacherAssignmentsList");

        if (res.ok) {
            if (data.assignments && data.assignments.length > 0) {
                container.innerHTML = data.assignments.map(assignment => `
                    <div class="assignment-card">
                        <h3>${assignment.title}</h3>
                        <p>${assignment.description}</p>
                        <p><strong>Due:</strong> ${assignment.due_date ? new Date(assignment.due_date).toLocaleString() : 'No deadline'}</p>
                        <p><strong>Points:</strong> ${assignment.points}</p>
                        <div>
                            <button onclick="viewSubmissions('${assignment.id}')" class="btn-view">View Submissions</button>
                            <button onclick="editAssignment('${assignment.id}')" class="secondary-btn">Edit</button>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = "<p>No assignments created yet. Create one below!</p>";
            }
        }
    } catch (err) {
        console.error("Error loading assignments:", err);
    }
}

async function createAssignment(courseId) {
    const title = prompt("Assignment Title:");
    if (!title) return;

    const description = prompt("Description:");
    if (!description) return;

    const dueDate = prompt("Due Date (YYYY-MM-DD HH:MM):");
    const points = prompt("Points (default 100):") || 100;

    try {
        const res = await fetch(`${API}/assignments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                course_id: courseId,
                title,
                description,
                due_date: due_date,
                points: parseInt(points)
            })
        });

        if (res.ok) {
            alert("Assignment created!");
            loadTeacherAssignments(courseId);
        } else {
            const error = await res.json();
            alert("Error: " + error.message);
        }
    } catch (err) {
        alert("Network error");
    }
}

function viewSubmissions(assignmentId) {
    window.open(`assignments.html?view_submissions=${assignmentId}`, '_blank');
}

function editAssignment(assignmentId) {
    alert("Edit functionality coming soon");
}
