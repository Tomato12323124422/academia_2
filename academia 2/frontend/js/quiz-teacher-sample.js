// Sample Frontend JS for Teacher Quiz Creation
// Plug into your dashboard: create quiz, then add multiple questions dynamically

const API = 'https://academia-2-xgdr.onrender.com/api'; // Your Render URL
const token = localStorage.getItem('token');

// Create Quiz
async function createQuiz(courseId, title, description, duration) {
    const res = await fetch(`${API}/quizzes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ course_id: courseId, title, description, duration: parseInt(duration) })
    });
    const data = await res.json();
    if (res.ok) {
        alert('Quiz created! ID: ' + data.quiz.id);
        return data.quiz.id;
    } else {
        alert('Error: ' + data.error);
    }
}

// Add Question to Quiz
async function addQuestion(quizId, question, options, correct_answer) {
    const res = await fetch(`${API}/quizzes/${quizId}/questions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question, options: options.split(','), correct_answer })
    });
    const data = await res.json();
    if (res.ok) {
        console.log('Question added:', data.question.id);
    } else {
        alert('Error: ' + data.error);
    }
}

// Example Usage: Dynamic form submit
document.getElementById('createQuizForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const courseId = formData.get('course_id');
    const title = formData.get('title');
    const description = formData.get('description');
    const duration = formData.get('duration');
    
    const quizId = await createQuiz(courseId, title, description, duration);
    
    // Add all questions from form
    const questions = document.querySelectorAll('.question-row');
    for (let q of questions) {
        const qText = q.querySelector('[name=question]').value;
        const optionsStr = q.querySelector('[name=options]').value;
        const correct = q.querySelector('[name=correct_answer]').value;
        await addQuestion(quizId, qText, optionsStr, correct);
    }
    alert('Quiz + questions created!');
});

// Dynamically add question row
function addQuestionRow() {
    const container = document.getElementById('questionsContainer');
    const index = container.children.length;
    container.innerHTML += `
        <div class="question-row">
            <input name="question" placeholder="Question ${index + 1}">
            <input name="options" placeholder="A,B,C,D">
            <input name="correct_answer" placeholder="0 for A">
        </div>
    `;
}

