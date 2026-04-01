// Teacher Quizzes Management - academia 2/frontend/js/teacher-quizzes.js

const API = "https://academia-2-xgdr.onrender.com/api";
const user = JSON.parse(localStorage.getItem("user"));
const token = localStorage.getItem("token");

if (!user || user.role !== 'teacher') {
    window.location.href = 'login.html';
}

document.getElementById("welcome").innerText = "Manage Quizzes - " + user.full_name;

function logout() {
    localStorage.clear();
    window.location.href = "login.html";
}

async function loadCourses() {
    try {
        const res = await fetch(`${API}/courses`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.courses) {
            const select = document.getElementById("courseSelect");
            select.innerHTML = '<option value="">Select Course</option>' + data.courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
        }
    } catch (err) {
        console.error("Error loading courses", err);
    }
}

async function loadTeacherQuizzes(courseId) {
    if (!courseId) return;
    try {
        const res = await fetch(`${API}/quizzes/course/${courseId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        const container = document.getElementById("teacherQuizzesList");
        if (res.ok && data.quizzes && data.quizzes.length > 0) {
            container.innerHTML = data.quizzes.map(quiz => `
                <div class="quiz-card">
                    <h3>${quiz.title}</h3>
                    <p>${quiz.description || 'No description'}</p>
                    <div class="quiz-meta">
                        <span>Due: ${quiz.due_date ? new Date(quiz.due_date).toLocaleString() : 'No deadline'}</span>
                        <span>Time: ${quiz.time_limit_minutes} min</span>
                        <span>Max Points: ${quiz.max_points}</span>
                    </div>
                    <div>
                        <button class="btn-edit" onclick="editQuiz('${quiz.id}')">Edit</button>
                        <button class="btn-view" onclick="viewQuizAttempts('${quiz.id}', '${quiz.title}')">View Attempts</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = "<p>No quizzes for this course. Create one!</p>";
        }
    } catch (err) {
        console.error("Error loading quizzes", err);
        document.getElementById("teacherQuizzesList").innerHTML = "<p>Error loading quizzes.</p>";
    }
}

function openCreateQuizModal() {
    document.getElementById("editingQuizId").value = '';
    document.getElementById("quizTitle").value = '';
    document.getElementById("quizDescription").value = '';
    document.getElementById("quizDueDate").value = '';
    document.getElementById("quizTimeLimit").value = 60;
    document.getElementById("quizMaxPoints").value = 100;
    document.getElementById("questionsForm").innerHTML = `
        <h4>Questions</h4>
        <div class="question-form" data-index="0">
            <h5>Question 1</h5>
            <input type="text" name="questionText_0" placeholder="Question text" required>
            <select name="type_0">
                <option value="mcq">MCQ</option>
                <option value="text">Text</option>
            </select>
            <input type="text" name="options_0" placeholder="Options A,B,C,D">
            <input type="text" name="correctAnswer_0" placeholder="Correct answer (0 for A, text for text)" required>
            <input type="number" name="points_0" value="10" min="1">
            <button type="button" onclick="removeQuestion(0)">Remove</button>
        </div>
    `;
    document.getElementById("createQuizModal").style.display = "block";
}

function addQuestion() {
    const forms = document.querySelectorAll(".question-form");
    const index = forms.length;
    const newForm = document.createElement('div');
    newForm.className = "question-form";
    newForm.dataset.index = index;
    newForm.innerHTML = `
        <h5>Question ${index + 1}</h5>
        <input type="text" name="questionText_${index}" placeholder="Question text" required>
        <select name="type_${index}">
            <option value="mcq">MCQ</option>
            <option value="text">Text</option>
        </select>
        <input type="text" name="options_${index}" placeholder="Options A,B,C,D">
        <input type="text" name="correctAnswer_${index}" placeholder="Correct answer" required>
        <input type="number" name="points_${index}" value="10" min="1">
        <button type="button" onclick="removeQuestion(${index})">Remove</button>
    `;
    document.getElementById("questionsForm").appendChild(newForm);
}

function removeQuestion(index) {
    const form = document.querySelector(`.question-form[data-index="${index}"]`);
    if (form) form.remove();
}

async function saveQuiz(e) {
    e.preventDefault();
    const courseId = document.getElementById("courseSelect").value;
    if (!courseId) {
        alert("Select a course");
        return;
    }
    const isEditing = document.getElementById("editingQuizId").value;
    const title = document.getElementById("quizTitle").value;
    const description = document.getElementById("quizDescription").value;
    const dueDate = document.getElementById("quizDueDate").value;
    const timeLimit = document.getElementById("quizTimeLimit").value;
    const maxPoints = document.getElementById("quizMaxPoints").value;

    const questions = [];
    document.querySelectorAll('.question-form').forEach(form => {
        const index = form.dataset.index;
        questions.push({
            text: form.querySelector(`[name="questionText_${index}"]`).value,
            type: form.querySelector(`[name="type_${index}"]`).value,
            options: form.querySelector(`[name="options_${index}"]`).value ? form.querySelector(`[name="options_${index}"]`).value.split(',') : null,
            correct_answer: form.querySelector(`[name="correctAnswer_${index}"]`).value,
            points: parseInt(form.querySelector(`[name="points_${index}"]`).value)
        });
    });

    if (questions.length === 0) {
        alert("Add at least one question");
        return;
    }

    const body = {
        course_id: courseId,
        title,
        description,
        due_date: dueDate,
        time_limit_minutes: parseInt(timeLimit),
        max_points: parseInt(maxPoints),
        questions
    };

    try {
        const url = isEditing ? `${API}/quizzes/${isEditing}` : `${API}/quizzes`;
        const method = isEditing ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            alert(isEditing ? 'Quiz updated!' : 'Quiz created!');
            closeCreateQuizModal();
            loadTeacherQuizzes(courseId);
        } else {
            const err = await res.json();
            alert(err.message);
        }
    } catch (err) {
        alert("Error saving quiz");
    }
}

function closeCreateQuizModal() {
    document.getElementById("createQuizModal").style.display = "none";
}

async function editQuiz(quizId) {
    // Fetch quiz details to populate form (simplified - fetch full quiz)
    alert("Edit feature: Fetch quiz and populate modal. Implement full.");
    openCreateQuizModal();
    document.getElementById("editingQuizId").value = quizId;
}

async function viewQuizAttempts(quizId, title) {
    try {
        const res = await fetch(`${API}/quizzes/${quizId}/attempts`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById("attemptsTitle").innerText = title + " - Attempts";
            const list = document.getElementById("attemptsList");
            if (data.attempts && data.attempts.length > 0) {
                list.innerHTML = '<table class="attempt-table"><thead><tr><th>Student</th><th>Score</th><th>Completed</th><th>Action</th></tr></thead><tbody>' + 
                    data.attempts.map(a => `<tr>
                        <td>${a.student.full_name} (${a.student.email})</td>
                        <td>${a.score !== null ? a.score : 'Pending'}</td>
                        <td>${a.completed_at ? new Date(a.completed_at).toLocaleString() : 'N/A'}</td>
                        <td><button class="btn-grade" onclick="gradeAttempt('${quizId}', '${a.id}', ${a.score || 0})">Grade</button></td>
                    </tr>`).join('') + '</tbody></table>';
            } else {
                list.innerHTML = '<p>No attempts yet.</p>';
            }
            document.getElementById("attemptsModal").style.display = "block";
        }
    } catch (err) {
        alert("Error loading attempts");
    }
}

function closeAttemptsModal() {
    document.getElementById("attemptsModal").style.display = "none";
}

async function gradeAttempt(quizId, attemptId, currentScore) {
    const score = prompt("Enter score:", currentScore);
    if (score === null) return;
    const feedback = prompt("Feedback (optional):");
    try {
        const res = await fetch(`${API}/quizzes/${quizId}/attempt/${attemptId}/grade`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ score: parseInt(score), feedback })
        });
        if (res.ok) {
            alert("Grade updated!");
            viewQuizAttempts(quizId, ''); // Reload
        } else {
            alert("Error updating grade");
        }
    } catch (err) {
        alert("Network error");
    }
}

// Init
loadCourses();
document.getElementById("quizForm").addEventListener("submit", saveQuiz);


