// Sample JS for Teacher Results Page

const API = 'https://academia-2-xgdr.onrender.com/api';
const token = localStorage.getItem('token');

async function loadQuizResults(quizId) {
    const res = await fetch(`${API}/quizzes/${quizId}/results`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) {
        const table = document.getElementById('resultsTable');
        table.innerHTML = data.attempts.map(a => `
            <tr>
                <td>${a.student.full_name}</td>
                <td>${a.score}%</td>
                <td>${new Date(a.submitted_at).toLocaleString()}</td>
            </tr>
        `).join('');
    }
}

