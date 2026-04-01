// Fixed - no redeclare API, full functions defined before use
// Load after auth.js if needed

const API_BASE = window.location.hostname.includes('localhost') ? 'http://localhost:5000' : 'https://academia-2-xgdr.onrender.com';
const API = API_BASE + '/api';
const token = localStorage.getItem('token') || '';
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!user.id || user.role !== 'teacher') {
    window.location.href = 'login.html';
    throw new Error('Teacher only');
}

let currentCourseId = '';
let editingQuizId = '';

if (document.getElementById('welcome')) {
    document.getElementById('welcome').textContent = 'Manage Quizzes - ' + (user.full_name || 'Teacher');
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// Load courses into select
async function loadCourses() {
    const select = document.getElementById('courseSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Loading...</option>';
    try {
        const res = await fetch(`${API}/courses`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        select.innerHTML = '<option value="">Select Course</option>' + 
            (data.courses || []).map(c => `<option value="${c.id}">${c.title}</option>`).join('');
    } catch (e) {
        select.innerHTML = '<option value="">Error loading</option>';
    }
}

// Course select change
if (document.getElementById('courseSelect')) {
    document.getElementById('courseSelect').addEventListener('change', (e) => {
        currentCourseId = e.target.value;
        if (currentCourseId) loadQuizzes(currentCourseId);
    });
}

async function loadQuizzes(courseId) {
    const container = document.getElementById('teacherQuizzesList');
    container.innerHTML = 'Loading...';
    try {
        const res = await fetch(`${API}/quizzes/course/${courseId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.quizzes) {
            container.innerHTML = data.quizzes.map(q => `
                <div class="quiz-card">
                    <h3>${q.title}</h3>
                    <p>${q.description || ''}</p>
                    <p>Duration: ${q.duration || 60} min</p>
                    <button onclick="openCreateQuizModal('${q.id}')" style="background:#2196f3">Edit</button>
                    <button onclick="viewResults('${q.id}')" style="background:#ff9800">Results</button>
                </div>
            `).join('') || '<p>No quizzes. Create one!</p>';
        }
    } catch (e) {
        container.innerHTML = '<p>Error loading quizzes</p>';
    }
}

function openCreateQuizModal(quizId = '') {
    editingQuizId = quizId;
    const modal = document.getElementById('createQuizModal');
    if (modal) modal.style.display = 'block';
    // Populate if editing (fetch quiz)
    if (quizId) alert('Edit mode: populate form from quiz ID ' + quizId);
    // Clear form fields
    const form = document.getElementById('quizForm');
    if (form) form.reset();
    const questionsForm = document.getElementById('questionsForm');
    if (questionsForm) questionsForm.innerHTML = '<button onclick="addQuestion()">+ Add Question</button>';
}

function closeCreateQuizModal() {
    const modal = document.getElementById('createQuizModal');
    if (modal) modal.style.display = 'none';
}

function addQuestion() {
    const questionsForm = document.getElementById('questionsForm');
    const index = questionsForm.querySelectorAll('.q-row').length;
    questionsForm.innerHTML += `
        <div class="q-row">
            <input placeholder="Question text" id="qtext${index}">
            <input placeholder="Options A,B,C,D" id="qopts${index}">
            <input placeholder="Correct 0" id="qcorr${index}">
            <button onclick="this.parentElement.remove()">Remove</button>
        </div>
    `;
}

async function saveQuiz(e) {
    e.preventDefault();
    if (!currentCourseId) return alert('Select course');
    const title = document.getElementById('quizTitle')?.value;
    const description = document.getElementById('quizDescription')?.value;
    const duration = document.getElementById('quizDuration')?.value || 60;
    try {
        const res = await fetch(`${API}/quizzes`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({course_id: currentCourseId, title, description, duration: parseInt(duration)})
        });
        const data = await res.json();
        if (res.ok) {
            const quizId = data.quiz.id;
            // Add questions
            const qRows = document.querySelectorAll('.q-row');
            for (let row of qRows) {
                const text = row.querySelector('[placeholder="Question text"]').value;
                const opts = row.querySelector('[placeholder="Options A,B,C,D"]').value.split(',');
                const corr = row.querySelector('[placeholder="Correct 0"]').value;
                await fetch(`${API}/quizzes/${quizId}/questions`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({question: text, options: opts, correct_answer: corr})
                });
            }
            alert('Quiz created with questions!');
            loadQuizzes(currentCourseId);
            closeCreateQuizModal();
        } else {
            alert(data.error);
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function viewResults(quizId) {
    const res = await fetch(`${API}/quizzes/${quizId}/results`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.attempts) {
        alert('Results: ' + data.attempts.length + ' attempts');
        console.table(data.attempts);
    }
}

// Init
if (document.getElementById('quizForm')) document.getElementById('quizForm').onsubmit = saveQuiz;
loadCourses();

