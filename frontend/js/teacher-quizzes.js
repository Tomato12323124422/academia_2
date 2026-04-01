// Teacher Quizzes Management (load in dashboard-teacher or integrate)

async function loadTeacherQuizzes(courseId) {
    try {
        const res = await fetch(`${API}/quizzes/course/${courseId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        const container = document.getElementById("teacherQuizzesList") || createTeacherQuizzesPanel();
        if (res.ok && data.quizzes.length) {
            container.innerHTML = data.quizzes.map(quiz => `
                <div class="quiz-card">
                    <h3>${quiz.title}</h3>
                    <p>${quiz.description}</p>
                    <p>Points: ${quiz.max_points} | Time: ${quiz.time_limit_minutes}min</p>
                    <div>
                        <button onclick="viewQuizAttempts('${quiz.id}')" class="btn-view">View Attempts</button>
                        <button onclick="editQuiz('${quiz.id}')" class="secondary-btn">Edit</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = "<p>No quizzes. Create one!</p>";
        }
    } catch (err) {
        console.error(err);
    }
}

async function createQuiz(courseId) {
    const title = prompt("Quiz Title:");
    if (!title) return;
    const description = prompt("Description:");
    const dueDate = prompt("Due Date (YYYY-MM-DDTHH:mm):");
    const timeLimit = parseInt(prompt("Time Limit (minutes):") || "60");
    const maxPoints = parseInt(prompt("Max Points:") || "100");

    // Simple question input (extend for full editor)
    const numQuestions = parseInt(prompt("Number of Questions:") || "1");
    const questions = [];
    for (let i = 0; i < numQuestions; i++) {
        const type = prompt("Type (mcq/text):") || 'mcq';
        const text = prompt(`Question ${i+1} text:`);
        const options = type === 'mcq' ? prompt("Options (JSON array e.g. [\"A\",\"B\",\"C\",\"D\"]):").replace(/'/g,'"') : null;
        const correct = prompt("Correct Answer (index for mcq or text):");
        questions.push({ type, text, options: options ? JSON.parse(options) : null, correct_answer: correct });
    }

    try {
        const res = await fetch(`${API}/quizzes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                course_id: courseId,
                title, description, due_date: dueDate, max_points: maxPoints,
                time_limit_minutes: timeLimit, questions
            })
        });
        if (res.ok) {
            alert("Quiz created!");
            loadTeacherQuizzes(courseId);
        } else {
            const err = await res.json();
            alert("Error: " + err.message);
        }
    } catch (err) {
        alert("Network error");
    }
}

async function viewQuizAttempts(quizId) {
    try {
        const res = await fetch(`${API}/quizzes/${quizId}/attempts`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            console.log("Attempts:", data.attempts); // Open modal/table view
            alert(`Found ${data.attempts.length} attempts`);
            // TODO: Show grading interface
        }
    } catch (err) {
        console.error(err);
    }
}

function editQuiz(quizId) {
    alert("Edit quiz coming soon - reload questions and update");
}

// Integrate with teacher dashboard
function showTeacherQuizzes() {
    // Assume called from course select
    const courseId = getCurrentCourseId(); // Implement
    loadTeacherQuizzes(courseId);
    document.getElementById("createQuizBtn")?.addEventListener('click', () => createQuiz(courseId));
}

function createTeacherQuizzesPanel() {
    const panel = document.createElement('div');
    panel.id = "teacherQuizzesPanel";
    panel.innerHTML = `<h3>Quizzes</h3><div id="teacherQuizzesList"></div><button id="createQuizBtn">+ New Quiz</button>`;
    document.querySelector('.teacher-panels')?.appendChild(panel); // Adjust selector
    return document.getElementById("teacherQuizzesList");
}
