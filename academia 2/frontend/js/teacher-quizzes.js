// Fixed teacher-quizzes.js - full functions for new spec
const API = 'https://academia-2-xgdr.onrender.com/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!user || user.role !== 'teacher') window.location.href = 'login.html';

let currentCourseId = '';
let editingQuizId = '';

document.getElementById('welcome').textContent = 'Manage Quizzes - ' + user.full_name;

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

async function loadCourses() {
    const select = document.getElementById('courseSelect');
    select.innerHTML = '<option value="">Loading...</option>';
    const res = await fetch(`${API}/courses`, {
        headers: {'Authorization': `Bearer ${token}`}
    });
    const data = await res.json();
    select.innerHTML = '<option value="">Select Course</option>' + (data.courses || []).map(c => `<option value="${c.id}">${c.title}</option>`).join('');
}

document.getElementById('courseSelect').addEventListener('change', (e) => {
    currentCourseId = e.target.value;
    if (currentCourseId) loadQuizzes(currentCourseId);
});

async function loadQuizzes(courseId) {
    const res = await fetch(`${API}/quizzes/course/${courseId}`, {
        headers: {'Authorization': `Bearer ${token}`}
    });
    const data = await res.json();
    const container = document.getElementById('teacherQuizzesList');
    if (data.quizzes) {
        container.innerHTML = data.quizzes.map(q => `
            <div class="quiz-card">
                <h3>${q.title}</h3>
                <p>${q.description}</p>
                <p>Duration: ${q.duration} min</p>
                <button onclick="editQuiz('${q.id}')" class="btn-edit">Edit</button>
                <button onclick="viewResults('${q.id}')" class="btn-view">Results</button>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p>No quizzes. Create one!</p>';
    }
}

function openCreateQuizModal() {
    document.getElementById('editingQuizId').value = '';
    document.getElementById('quizTitle').value = '';
    // ... clear form
    document.getElementById('questionsForm').innerHTML = '<button class="add-question" onclick="addQuestion()">Add First Question</button>';
    document.getElementById('createQuizModal').style.display = 'block';
}

async function createQuiz() {
    const title = document.getElementById('quizTitle').value;
    const description = document.getElementById('quizDescription').value;
    const duration = document.getElementById('quizDuration').value;
    const res = await fetch(`${API}/quizzes`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({course_id: currentCourseId, title, description, duration: parseInt(duration)})
    });
    const data = await res.json();
    if (res.ok) {
        alert('Quiz created ID: ' + data.quiz.id);
        loadQuizzes(currentCourseId);
    } else {
        alert(data.error);
    }
    closeCreateQuizModal();
}

function closeCreateQuizModal() {
    document.getElementById('createQuizModal').style.display = 'none';
}

loadCourses();

