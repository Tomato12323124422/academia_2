const user = JSON.parse(localStorage.getItem("user"));
const token = localStorage.getItem("token");

if(!token){
    window.location.href = "login.html";
}

document.getElementById("welcome").innerText =
    "Welcome " + user.full_name + " (" + user.role + ")";

const menu = document.getElementById("menu");
const content = document.getElementById("dashboardContent");

/* ================= ROLE MENUS ================= */

if(user.role === "student"){
    menu.innerHTML = `
        <li onclick="loadPage('courses')">My Courses</li>
        <li onclick="loadPage('attendance')">QR Attendance</li>
        <li onclick="loadPage('gamification')">Achievements</li>
    `;
}

if(user.role === "instructor"){
    menu.innerHTML = `
        <li onclick="loadPage('createCourse')">Create Course</li>
        <li onclick="loadPage('zoom')">Live Classes</li>
        <li onclick="loadPage('qr')">Generate QR</li>
    `;
}

if(user.role === "guardian"){
    menu.innerHTML = `
        <li onclick="loadPage('progress')">Student Progress</li>
        <li onclick="loadPage('reports')">Reports</li>
    `;
}

/* ================= PAGE LOADER ================= */

function loadPage(page){

    if(page === "courses"){
        content.innerHTML = `
            <h2>My Courses</h2>
            <p>Courses will load here...</p>
        `;
    }

    if(page === "attendance"){
        content.innerHTML = `
            <h2>Scan QR to Sign Attendance</h2>
            <p>QR Scanner coming next step.</p>
        `;
    }

    if(page === "gamification"){
        content.innerHTML = `
            <h2>Achievements</h2>
            <p>Points and badges will show here.</p>
        `;
    }

    if(page === "createCourse"){
        content.innerHTML = `
            <h2>Create Course</h2>
            <input id="courseTitle" placeholder="Course Title">
            <button onclick="createCourse()">Create</button>
        `;
    }

    if(page === "zoom"){
        content.innerHTML = `
            <h2>Zoom Live Classes</h2>
            <input id="zoomLink" placeholder="Paste Zoom Link">
            <button>Add Class</button>
        `;
    }

    if(page === "qr"){
        content.innerHTML = `
            <h2>Generate QR Attendance</h2>
            <button>Generate QR</button>
        `;
    }

    if(page === "progress"){
        content.innerHTML = `<h2>Student Progress</h2>`;
    }

    if(page === "reports"){
        content.innerHTML = `<h2>Reports</h2>`;
    }
}

/* ================= CREATE COURSE (Placeholder) ================= */

async function createCourse(){
    const title = document.getElementById("courseTitle").value;
    alert("Course Created: " + title);
}
