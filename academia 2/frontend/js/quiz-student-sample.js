// Sample Frontend JS for Student Quiz Taking
// Fetch quiz, display questions, collect answers, submit & show score

const API = 'https://academia-2-xgdr.onrender.com/api';
const token = localStorage.getItem('token');
let answers = {};

// Load & Display Quiz
async function loadQuiz(quizId) {
    const res = await fetch(`${API}/quizzes/${quizId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) {
        document.getElementById('quizTitle').textContent = data.quiz.title;
        const container = document.getElementById('questions');
        container.innerHTML = data.questions.map(q => {
            if (q.options) {
                return `
                    <div class="question">
                        <p>${q.question}</p>
                        ${q.options.map((opt, i) => 
                            `<label><input type="radio" name="${q.id}" value="${i}" onchange="answers['${q.id}'] = '${i}'"> ${opt}</label>`
                        ).join('')}
                    </div>
                `;
            } else {
                return `
                    <div class="question">
                        <p>${q.question}</p>
                        <textarea onchange="answers['${q.id}'] = this.value"></textarea>
                    </div>
                `;
            }
        }).join('');
    }
}

// Submit Answers
async function submitQuiz(quizId) {
    const res = await fetch(`${API}/quizzes/${quizId}/submit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ answers })
    });
    const data = await res.json();
    if (res.ok) {
        alert(`Score: ${data.score}% (${data.correct}/${data.total_questions})`);
    } else {
        alert('Error: ' + data.error);
    }
}

// Load course quizzes
async function loadCourseQuizzes(courseId) {
    const res = await fetch(`${API}/quizzes/course/${courseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    // Render list, onclick loadQuiz(quiz.id)
}

