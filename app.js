/* =========================================================
   AKKAADAAMII OROMIYAA
   app.js - Complete Version
   ========================================================= */

"use strict";

/* =========================================================
   1. STORAGE KEYS
   ========================================================= */

const STORAGE = {
    students: "ao_students",
    lessons: "ao_lessons",
    exams: "ao_exams",
    questions: "ao_questions",
    results: "ao_results",
    currentStudent: "ao_current_student",
    currentAdmin: "ao_current_admin",
    currentExam: "ao_current_exam"
};


/* =========================================================
   2. GLOBAL VARIABLES
   ========================================================= */

let currentExam = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let examAnswers = {};
let examTimer = null;
let examSecondsLeft = 0;

let currentStudent = null;
let currentAdmin = null;


/* =========================================================
   3. BASIC HELPERS
   ========================================================= */

function getData(key, fallback = []) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : fallback;
    } catch (error) {
        console.error("Storage error:", error);
        return fallback;
    }
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function generateId(prefix = "ID") {
    return (
        prefix +
        Date.now().toString(36).toUpperCase() +
        Math.random().toString(36).substring(2, 7).toUpperCase()
    );
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showMessage(elementId, message, type = "info") {
    const el = document.getElementById(elementId);

    if (!el) return;

    el.textContent = message;
    el.className = `message ${type}`;
    el.style.display = "block";
}

function hideMessage(elementId) {
    const el = document.getElementById(elementId);

    if (el) {
        el.style.display = "none";
    }
}

function formatDate(date) {
    if (!date) return "-";

    const d = new Date(date);

    if (isNaN(d.getTime())) return date;

    return d.toLocaleDateString("om-ET", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
}


/* =========================================================
   4. DEMO DATA
   ========================================================= */

function initializeAppData() {

    if (!localStorage.getItem(STORAGE.students)) {
        saveData(STORAGE.students, []);
    }

    if (!localStorage.getItem(STORAGE.lessons)) {

        saveData(STORAGE.lessons, [
            {
                id: generateId("LES"),
                title: "Seensa Artificial Intelligence",
                content:
                    "Artificial Intelligence jechuun teeknooloojii kompiitaraan hojii sammuu namaa fakkaatu akka raawwatu gochuudha. AI keessatti machine learning, neural network, computer vision fi natural language processing fa'i ni argamu.",
                createdAt: new Date().toISOString()
            },
            {
                id: generateId("LES"),
                title: "Python Bu'uuraa",
                content:
                    "Python afaan programming salphaa fi beekamaa dha. Variables, conditions, loops, functions fi libraries fayyadamuun application garaagaraa ijaaruun ni danda'ama.",
                createdAt: new Date().toISOString()
            }
        ]);
    }

    if (!localStorage.getItem(STORAGE.exams)) {
        saveData(STORAGE.exams, [
            {
                id: generateId("EX"),
                title: "Qormaata AI Bu'uuraa",
                description: "Qormaata Artificial Intelligence bu'uuraa.",
                questionLimit: 5,
                attemptLimit: 3,
                finalExam: false,
                duration: 10,
                startDate: "",
                endDate: "",
                startTime: "",
                endTime: "",
                createdAt: new Date().toISOString()
            }
        ]);
    }

    if (!localStorage.getItem(STORAGE.questions)) {

        const exams = getData(STORAGE.exams);

        if (exams.length > 0) {

            saveData(STORAGE.questions, [
                {
                    id: generateId("Q"),
                    examId: exams[0].id,
                    question:
                        "AI jechuun maal jechuudha?",
                    options: [
                        "Artificial Intelligence",
                        "Automatic Internet",
                        "Advanced Input",
                        "Application Interface"
                    ],
                    correctAnswer: 0
                },
                {
                    id: generateId("Q"),
                    examId: exams[0].id,
                    question:
                        "Python maalif beekama?",
                    options: [
                        "Afaan programming",
                        "Operating system",
                        "Browser",
                        "Database qofa"
                    ],
                    correctAnswer: 0
                },
                {
                    id: generateId("Q"),
                    examId: exams[0].id,
                    question:
                        "Machine Learning maal irratti xiyyeeffata?",
                    options: [
                        "Data irraa barachuu",
                        "Suuraa maxxansuu qofa",
                        "Internet cufuu",
                        "Keyboard qofa"
                    ],
                    correctAnswer: 0
                },
                {
                    id: generateId("Q"),
                    examId: exams[0].id,
                    question:
                        "CNN baay'inaan maal irratti fayyada?",
                    options: [
                        "Computer Vision",
                        "Email qofa",
                        "Audio qofa",
                        "Database qofa"
                    ],
                    correctAnswer: 0
                },
                {
                    id: generateId("Q"),
                    examId: exams[0].id,
                    question:
                        "Neural Network maal fakkaata?",
                    options: [
                        "Sirna neurons fakkaatu",
                        "Printer",
                        "Keyboard",
                        "File manager"
                    ],
                    correctAnswer: 0
                }
            ]);
        }
    }

    if (!localStorage.getItem(STORAGE.results)) {
        saveData(STORAGE.results, []);
    }
}


/* =========================================================
   5. PAGE NAVIGATION
   ========================================================= */

function showPage(pageId) {

    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
        page.style.display = "none";
    });

    const page = document.getElementById(pageId);

    if (!page) {
        console.warn("Page not found:", pageId);
        return;
    }

    page.classList.add("active");
    page.style.display = "block";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    updateNavigation(pageId);
}

window.showPage = showPage;


function updateNavigation(pageId) {

    document.querySelectorAll(".bottom-nav button").forEach(btn => {
        btn.classList.remove("active");
    });

    if (pageId === "studentHomePage") {
        const btn = document.querySelector(
            '.bottom-nav button[onclick*="studentHomePage"]'
        );
        if (btn) btn.classList.add("active");
    }

    if (pageId === "examListPage") {
        const btn = document.querySelector(
            '.bottom-nav button[onclick*="examListPage"]'
        );
        if (btn) btn.classList.add("active");
    }

    if (pageId === "scorePage") {
        const btn = document.querySelector(
            '.bottom-nav button[onclick*="scorePage"]'
        );
        if (btn) btn.classList.add("active");
    }

    if (pageId === "profilePage") {
        const btn = document.querySelector(
            '.bottom-nav button[onclick*="profilePage"]'
        );
        if (btn) btn.classList.add("active");
    }
}


/* =========================================================
   6. ROLE SELECTION
   ========================================================= */

function selectRole(role) {

    if (role === "student") {
        showPage("studentLoginPage");
        return;
    }

    if (role === "admin") {
        showPage("adminLoginPage");
        return;
    }
}

window.selectRole = selectRole;


/* =========================================================
   7. STUDENT REGISTRATION
   ========================================================= */

function studentRegister() {

    const nameInput = document.getElementById("nameInput");
    const name = nameInput ? nameInput.value.trim() : "";

    if (!name) {
        showMessage(
            "studentLoginMessage",
            "Maqaa kee galchi.",
            "error"
        );
        return;
    }

    let students = getData(STORAGE.students);

    const studentId =
        "AO-" +
        Math.floor(100000 + Math.random() * 900000);

    const activationCode =
        Math.random().toString(36)
            .substring(2, 8)
            .toUpperCase();

    const student = {
        id: generateId("ST"),
        name: name,
        studentId: studentId,
        activationCode: activationCode,
        status: "active",
        createdAt: new Date().toISOString()
    };

    students.push(student);

    saveData(STORAGE.students, students);

    const studentIdInput =
        document.getElementById("studentIdInput");

    const activationInput =
        document.getElementById("activationCodeInput");

    if (studentIdInput) {
        studentIdInput.value = studentId;
    }

    if (activationInput) {
        activationInput.value = activationCode;
    }

    showMessage(
        "studentLoginMessage",
        `Galmeen milkaa'eera! Student ID: ${studentId} | Activation Code: ${activationCode}`,
        "success"
    );
}

window.studentRegister = studentRegister;


/* =========================================================
   8. STUDENT LOGIN
   ========================================================= */

function studentLogin() {

    const name =
        document.getElementById("nameInput")?.value.trim();

    const studentId =
        document.getElementById("studentIdInput")?.value.trim();

    const activationCode =
        document.getElementById("activationCodeInput")?.value.trim();

    if (!name || !studentId || !activationCode) {

        showMessage(
            "studentLoginMessage",
            "Maqaa, Student ID fi Activation Code guuti.",
            "error"
        );

        return;
    }

    const students = getData(STORAGE.students);

    const student = students.find(s =>
        s.name.toLowerCase() === name.toLowerCase() &&
        s.studentId.toLowerCase() === studentId.toLowerCase() &&
        s.activationCode.toLowerCase() === activationCode.toLowerCase()
    );

    if (!student) {

        showMessage(
            "studentLoginMessage",
            "Odeeffannoon ati galchite sirrii miti.",
            "error"
        );

        return;
    }

    if (student.status !== "active") {

        showMessage(
            "studentLoginMessage",
            "Account kee adminiin cufameera.",
            "error"
        );

        return;
    }

    currentStudent = student;

    localStorage.setItem(
        STORAGE.currentStudent,
        JSON.stringify(student)
    );

    loadStudentHome();

    showPage("studentHomePage");
}

window.studentLogin = studentLogin;


/* =========================================================
   9. LOAD CURRENT STUDENT
   ========================================================= */

function loadCurrentStudent() {

    try {

        const data =
            localStorage.getItem(STORAGE.currentStudent);

        if (data) {
            currentStudent = JSON.parse(data);
        }

    } catch (error) {
        currentStudent = null;
    }
}


/* =========================================================
   10. STUDENT HOME
   ========================================================= */

function loadStudentHome() {

    if (!currentStudent) return;

    const welcome =
        document.getElementById("studentWelcomeName");

    if (welcome) {
        welcome.textContent =
            `Baga nagaan dhuftan, ${currentStudent.name}`;
    }

    const message =
        document.getElementById("studentHomeMessage");

    if (message) {
        message.textContent =
            "Barnoota fi qormaata kee as irraa hordofi.";
    }

    loadStudentLessons();
}

window.loadStudentHome = loadStudentHome;


/* =========================================================
   11. STUDENT LESSONS
   ========================================================= */

function loadStudentLessons() {

    const container =
        document.getElementById("studentLessons");

    if (!container) return;

    const lessons = getData(STORAGE.lessons);

    if (!lessons.length) {

        container.innerHTML =
            `<div class="empty-state">
                Barnoonni amma hin jiru.
            </div>`;

        return;
    }

    container.innerHTML = lessons.map(lesson => {

        return `
            <div class="lesson-card">
                <h3>${escapeHTML(lesson.title)}</h3>

                <p>
                    ${escapeHTML(
                        lesson.content.substring(0, 150)
                    )}${lesson.content.length > 150 ? "..." : ""}
                </p>

                <button
                    onclick="openLesson('${lesson.id}')">
                    Baradhu
                </button>
            </div>
        `;

    }).join("");
}

window.loadStudentLessons = loadStudentLessons;


/* =========================================================
   12. OPEN LESSON
   ========================================================= */

function openLesson(lessonId) {

    const lessons = getData(STORAGE.lessons);

    const lesson =
        lessons.find(l => l.id === lessonId);

    if (!lesson) return;

    const title =
        document.getElementById("lessonDetailTitle");

    const content =
        document.getElementById("lessonDetailContent");

    if (title) {
        title.textContent = lesson.title;
    }

    if (content) {
        content.innerHTML =
            escapeHTML(lesson.content)
                .replace(/\n/g, "<br>");
    }

    showPage("lessonDetailPage");
}

window.openLesson = openLesson;


/* =========================================================
   13. STUDENT EXAM LIST
   ========================================================= */

function loadExams() {

    const container =
        document.getElementById("studentExams");

    if (!container) return;

    const exams = getData(STORAGE.exams);

    if (!exams.length) {

        container.innerHTML =
            `<div class="empty-state">
                Qormaanni amma hin jiru.
            </div>`;

        return;
    }

    const now = new Date();

    container.innerHTML = exams.map(exam => {

        let status = "Available";
        let disabled = "";

        if (exam.startDate) {

            const start =
                new Date(
                    `${exam.startDate}T${exam.startTime || "00:00"}`
                );

            if (now < start) {
                status = "Hin jalqabne";
                disabled = "disabled";
            }
        }

        if (exam.endDate) {

            const end =
                new Date(
                    `${exam.endDate}T${exam.endTime || "23:59"}`
                );

            if (now > end) {
                status = "Yeroon darbeera";
                disabled = "disabled";
            }
        }

        return `
            <div class="exam-card">

                <h3>
                    ${escapeHTML(exam.title)}
                </h3>

                <p>
                    ${escapeHTML(exam.description || "")}
                </p>

                <div class="exam-info">
                    <span>
                        Gaaffii: ${exam.questionLimit || "Hunda"}
                    </span>

                    <span>
                        Yeroo: ${exam.duration} daqiiqa
                    </span>

                    <span>
                        ${status}
                    </span>
                </div>

                <button
                    ${disabled}
                    onclick="startExam('${exam.id}')">
                    Qormaata Jalqabi
                </button>

            </div>
        `;

    }).join("");
}

window.loadExams = loadExams;


/* =========================================================
   14. START EXAM
   ========================================================= */

function startExam(examId) {

    if (!currentStudent) {
        showPage("studentLoginPage");
        return;
    }

    const exams = getData(STORAGE.exams);

    const exam =
        exams.find(e => e.id === examId);

    if (!exam) {
        alert("Qormaanni hin argamne.");
        return;
    }

    const questions =
        getData(STORAGE.questions)
            .filter(q => q.examId === examId);

    if (!questions.length) {
        alert("Qormaata kana keessatti gaaffiin hin jiru.");
        return;
    }

    const results =
        getData(STORAGE.results)
            .filter(r =>
                r.studentId === currentStudent.id &&
                r.examId === examId
            );

    if (
        exam.attemptLimit &&
        results.length >= Number(exam.attemptLimit)
    ) {

        alert(
            "Ati yeroo qormaata kanaaf hayyamame fixxeetta."
        );

        return;
    }

    currentExam = exam;

    let shuffled =
        [...questions].sort(() => Math.random() - 0.5);

    if (
        exam.questionLimit &&
        Number(exam.questionLimit) > 0 &&
        shuffled.length > Number(exam.questionLimit)
    ) {
        shuffled =
            shuffled.slice(
                0,
                Number(exam.questionLimit)
            );
    }

    currentQuestions = shuffled;
    currentQuestionIndex = 0;
    examAnswers = {};

    localStorage.setItem(
        STORAGE.currentExam,
        JSON.stringify(exam)
    );

    const title =
        document.getElementById("examTitle");

    if (title) {
        title.textContent = exam.title;
    }

    examSecondsLeft =
        Number(exam.duration || 10) * 60;

    startExamTimer();

    showPage("examPage");

    renderCurrentQuestion();
}

window.startExam = startExam;


/* =========================================================
   15. EXAM TIMER
   ========================================================= */

function startExamTimer() {

    stopExamTimer();

    updateTimerDisplay();

    examTimer = setInterval(() => {

        examSecondsLeft--;

        updateTimerDisplay();

        if (examSecondsLeft <= 0) {

            stopExamTimer();

            alert(
                "Yeroon qormaataa xumurameera. Deebiin kee ni galmaa'a."
            );

            finishExam();

        }

    }, 1000);
}


function stopExamTimer() {

    if (examTimer) {
        clearInterval(examTimer);
        examTimer = null;
    }
}


function updateTimerDisplay() {

    const timer =
        document.getElementById("examTimerValue");

    if (!timer) return;

    const minutes =
        Math.floor(examSecondsLeft / 60);

    const seconds =
        examSecondsLeft % 60;

    timer.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}


/* =========================================================
   16. RENDER QUESTION
   ========================================================= */

function renderCurrentQuestion() {

    if (!currentQuestions.length) return;

    const question =
        currentQuestions[currentQuestionIndex];

    const number =
        document.getElementById("questionNumber");

    const text =
        document.getElementById("questionText");

    const answers =
        document.getElementById("answersContainer");

    if (number) {
        number.textContent =
            `Gaaffii ${currentQuestionIndex + 1} / ${currentQuestions.length}`;
    }

    if (text) {
        text.textContent =
            question.question;
    }

    if (answers) {

        answers.innerHTML =
            question.options.map((option, index) => {

                const selected =
                    examAnswers[question.id] === index;

                return `
                    <button
                        class="answer-option ${selected ? "selected" : ""}"
                        onclick="selectAnswer(${index})">

                        <span class="answer-letter">
                            ${String.fromCharCode(65 + index)}
                        </span>

                        <span>
                            ${escapeHTML(option)}
                        </span>

                    </button>
                `;

            }).join("");
    }

    const nextButton =
        document.getElementById("nextQuestionButton");

    const submitButton =
        document.getElementById("submitExamButton");

    if (nextButton) {

        nextButton.style.display =
            currentQuestionIndex <
            currentQuestions.length - 1
                ? "block"
                : "none";
    }

    if (submitButton) {

        submitButton.style.display =
            currentQuestionIndex ===
            currentQuestions.length - 1
                ? "block"
                : "none";
    }
}


/* =========================================================
   17. SELECT ANSWER
   ========================================================= */

function selectAnswer(index) {

    const question =
        currentQuestions[currentQuestionIndex];

    if (!question) return;

    examAnswers[question.id] = index;

    renderCurrentQuestion();
}

window.selectAnswer = selectAnswer;


/* =========================================================
   18. NEXT QUESTION
   ========================================================= */

function nextQuestion() {

    if (
        currentQuestionIndex <
        currentQuestions.length - 1
    ) {

        currentQuestionIndex++;

        renderCurrentQuestion();

    }
}

window.nextQuestion = nextQuestion;


/* =========================================================
   19. REQUEST SUBMIT
   ========================================================= */

function requestSubmitExam() {

    const unanswered =
        currentQuestions.filter(
            q => examAnswers[q.id] === undefined
        ).length;

    const warning =
        document.getElementById("submitWarningMessage");

    if (warning) {

        warning.textContent =
            unanswered > 0
                ? `Gaaffii ${unanswered} deebii hin qabne qabda. Dhugumaan xumuruuf barbaaddaa?`
                : "Qormaata xumuruuf mirkaneessi.";

        warning.style.display = "block";
    }

    const confirmation =
        document.getElementById("submitConfirmation");

    if (confirmation) {
        confirmation.style.display = "block";
    }
}

window.requestSubmitExam = requestSubmitExam;


/* =========================================================
   20. CONFIRM SUBMIT
   ========================================================= */

function confirmSubmitExam(confirm) {

    const confirmation =
        document.getElementById("submitConfirmation");

    if (!confirm) {

        if (confirmation) {
            confirmation.style.display = "none";
        }

        return;
    }

    if (confirmation) {
        confirmation.style.display = "none";
    }

    finishExam();
}

window.confirmSubmitExam = confirmSubmitExam;


/* =========================================================
   21. FINISH EXAM
   ========================================================= */

function finishExam() {

    stopExamTimer();

    if (!currentStudent || !currentExam) return;

    let correct = 0;

    currentQuestions.forEach(question => {

        if (
            Number(examAnswers[question.id]) ===
            Number(question.correctAnswer)
        ) {
            correct++;
        }

    });

    const total = currentQuestions.length;

    const percentage =
        total > 0
            ? Math.round((correct / total) * 100)
            : 0;

    const result = {

        id: generateId("RES"),

        studentId: currentStudent.id,

        studentName: currentStudent.name,

        studentCode: currentStudent.studentId,

        examId: currentExam.id,

        examTitle: currentExam.title,

        correct: correct,

        total: total,

        score: percentage,

        answers: examAnswers,

        date: new Date().toISOString()

    };

    const results =
        getData(STORAGE.results);

    results.push(result);

    saveData(
        STORAGE.results,
        results
    );

    showStudentScore();

    currentExam = null;
    currentQuestions = [];
    examAnswers = {};

    showPage("scorePage");
}

window.finishExam = finishExam;


/* =========================================================
   22. STUDENT SCORE
   ========================================================= */

function showStudentScore() {

    if (!currentStudent) return;

    const container =
        document.getElementById("studentScore");

    if (!container) return;

    const results =
        getData(STORAGE.results)
            .filter(
                r => r.studentId === currentStudent.id
            )
            .sort(
                (a, b) =>
                    new Date(b.date) -
                    new Date(a.date)
            );

    if (!results.length) {

        container.innerHTML =
            `<div class="empty-state">
                Qabxiin kee amma hin jiru.
            </div>`;

        return;
    }

    container.innerHTML = results.map(result => {

        return `
            <div class="score-card">

                <h3>
                    ${escapeHTML(result.examTitle)}
                </h3>

                <div class="score-number">
                    ${result.score}%
                </div>

                <p>
                    Sirrii:
                    ${result.correct}/${result.total}
                </p>

                <small>
                    ${formatDate(result.date)}
                </small>

            </div>
        `;

    }).join("");
}

window.showStudentScore = showStudentScore;


/* =========================================================
   23. STUDENT PROFILE
   ========================================================= */

function loadStudentProfile() {

    if (!currentStudent) return;

    const nameInput =
        document.getElementById("profileNameInput");

    const code =
        document.getElementById("profileCode");

    const activation =
        document.getElementById("profileActivationCode");

    const status =
        document.getElementById("profileStatus");

    if (nameInput) {
        nameInput.value =
            currentStudent.name || "";
    }

    if (code) {
        code.textContent =
            currentStudent.studentId || "-";
    }

    if (activation) {
        activation.textContent =
            currentStudent.activationCode || "-";
    }

    if (status) {
        status.textContent =
            currentStudent.status || "active";
    }
}

window.loadStudentProfile = loadStudentProfile;


/* =========================================================
   24. SAVE PROFILE
   ========================================================= */

function saveProfile() {

    if (!currentStudent) return;

    const nameInput =
        document.getElementById("profileNameInput");

    const newName =
        nameInput?.value.trim();

    if (!newName) {
        alert("Maqaa galchi.");
        return;
    }

    let students =
        getData(STORAGE.students);

    const index =
        students.findIndex(
            s => s.id === currentStudent.id
        );

    if (index === -1) return;

    students[index].name = newName;

    currentStudent =
        students[index];

    saveData(
        STORAGE.students,
        students
    );

    localStorage.setItem(
        STORAGE.currentStudent,
        JSON.stringify(currentStudent)
    );

    loadStudentHome();
    loadStudentProfile();

    alert("Maqaan kee sirnaan haaromfameera.");
}

window.saveProfile = saveProfile;


/* =========================================================
   25. STUDENT LOGOUT
   ========================================================= */

function studentLogout() {

    stopExamTimer();

    currentStudent = null;
    currentExam = null;
    currentQuestions = [];
    examAnswers = {};

    localStorage.removeItem(
        STORAGE.currentStudent
    );

    localStorage.removeItem(
        STORAGE.currentExam
    );

    showPage("rolePage");
}

window.studentLogout = studentLogout;


/* =========================================================
   26. ADMIN LOGIN
   ========================================================= */

/*
   DEMO ADMIN ACCOUNTS

   admin  / admin123
   admin2 / admin456

   For a real deployed app, do NOT rely on frontend
   username/password authentication.
*/

const ADMIN_ACCOUNTS = [
    {
        username: "admin",
        password: "admin123",
        name: "Main Admin"
    },
    {
        username: "admin2",
        password: "admin456",
        name: "Second Admin"
    }
];


function adminLogin() {

    const username =
        document.getElementById("adminUsername")
            ?.value.trim();

    const password =
        document.getElementById("adminPassword")
            ?.value;

    if (!username || !password) {

        showMessage(
            "adminLoginMessage",
            "Username fi Password guuti.",
            "error"
        );

        return;
    }

    const admin =
        ADMIN_ACCOUNTS.find(
            a =>
                a.username === username &&
                a.password === password
        );

    if (!admin) {

        showMessage(
            "adminLoginMessage",
            "Username ykn Password sirrii miti.",
            "error"
        );

        return;
    }

    currentAdmin = admin;

    localStorage.setItem(
        STORAGE.currentAdmin,
        JSON.stringify(admin)
    );

    showAdminDashboard();
}

window.adminLogin = adminLogin;


/* =========================================================
   27. ADMIN DASHBOARD
   ========================================================= */

function showAdminDashboard() {

    showPage("adminDashboardPage");

    openAdminPanel("students");

    loadAdminStudents();
    loadAdminResults();
    loadAdminLessons();
    loadAdminExams();
    updateExamSelects();
}

window.showAdminDashboard = showAdminDashboard;


/* =========================================================
   28. ADMIN PANEL
   ========================================================= */

function openAdminPanel(panel) {

    const panels =
        document.querySelectorAll(".admin-panel");

    panels.forEach(p => {
        p.style.display = "none";
    });

    const target =
        document.getElementById(
            `admin${capitalize(panel)}Panel`
        );

    if (target) {
        target.style.display = "block";
    }

    if (panel === "students") {
        loadAdminStudents();
    }

    if (panel === "results") {
        loadAdminResults();
    }

    if (panel === "lessons") {
        loadAdminLessons();
    }

    if (panel === "exams") {
        loadAdminExams();
        updateExamSelects();
    }
}

window.openAdminPanel = openAdminPanel;


function capitalize(text) {

    if (!text) return "";

    return text.charAt(0).toUpperCase() +
        text.slice(1);
}


/* =========================================================
   29. ADMIN STUDENTS
   ========================================================= */

function loadAdminStudents() {

    const container =
        document.getElementById("adminStudentsList");

    if (!container) return;

    const students =
        getData(STORAGE.students);

    if (!students.length) {

        container.innerHTML =
            `<div class="empty-state">
                Barataan galmaa'e hin jiru.
            </div>`;

        return;
    }

    container.innerHTML = students.map(student => {

        return `
            <div class="admin-student-card">

                <div>
                    <strong>
                        ${escapeHTML(student.name)}
                    </strong>

                    <p>
                        ID:
                        ${escapeHTML(student.studentId)}
                    </p>

                    <p>
                        Code:
                        ${escapeHTML(student.activationCode)}
                    </p>

                    <p>
                        Status:
                        ${escapeHTML(student.status)}
                    </p>
                </div>

                <div>

                    <button
                        onclick="toggleStudentStatus('${student.id}')">
                        ${student.status === "active"
                            ? "Cufi"
                            : "Bani"}
                    </button>

                    <button
                        class="danger"
                        onclick="deleteStudent('${student.id}')">
                        Haqi
                    </button>

                </div>

            </div>
        `;

    }).join("");
}

window.loadAdminStudents = loadAdminStudents;


/* =========================================================
   30. TOGGLE STUDENT STATUS
   ========================================================= */

function toggleStudentStatus(studentId) {

    const students =
        getData(STORAGE.students);

    const student =
        students.find(s => s.id === studentId);

    if (!student) return;

    student.status =
        student.status === "active"
            ? "blocked"
            : "active";

    saveData(
        STORAGE.students,
        students
    );

    loadAdminStudents();
}

window.toggleStudentStatus = toggleStudentStatus;


/* =========================================================
   31. DELETE STUDENT
   ========================================================= */

function deleteStudent(studentId) {

    if (
        !confirm(
            "Barataa kana haquu akka barbaaddu mirkaneessi."
        )
    ) return;

    let students =
        getData(STORAGE.students);

    students =
        students.filter(
            s => s.id !== studentId
        );

    saveData(
        STORAGE.students,
        students
    );

    loadAdminStudents();
}

window.deleteStudent = deleteStudent;


/* =========================================================
   32. ADMIN RESULTS
   ========================================================= */

function loadAdminResults() {

    const container =
        document.getElementById("adminResultsTable");

    if (!container) return;

    const results =
        getData(STORAGE.results)
            .sort(
                (a, b) =>
                    new Date(b.date) -
                    new Date(a.date)
            );

    if (!results.length) {

        container.innerHTML =
            `<div class="empty-state">
                Qabxiin barattootaa hin jiru.
            </div>`;

        return;
    }

    container.innerHTML = `
        <div class="table-wrapper">

            <table>

                <thead>

                    <tr>
                        <th>Barataa</th>
                        <th>Qormaata</th>
                        <th>Qabxii</th>
                        <th>Sirrii</th>
                        <th>Guyyaa</th>
                    </tr>

                </thead>

                <tbody>

                    ${results.map(result => `

                        <tr>

                            <td>
                                ${escapeHTML(result.studentName)}
                            </td>

                            <td>
                                ${escapeHTML(result.examTitle)}
                            </td>

                            <td>
                                <strong>
                                    ${result.score}%
                                </strong>
                            </td>

                            <td>
                                ${result.correct}/${result.total}
                            </td>

                            <td>
                                ${formatDate(result.date)}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        </div>
    `;
}

window.loadAdminResults = loadAdminResults;


/* =========================================================
   33. CREATE LESSON
   ========================================================= */

function createLesson() {

    const title =
        document.getElementById("lessonTitleInput")
            ?.value.trim();

    const content =
        document.getElementById("lessonContentInput")
            ?.value.trim();

    if (!title || !content) {

        alert(
            "Mata-duree fi qabiyyee guuti."
        );

        return;
    }

    const lessons =
        getData(STORAGE.lessons);

    lessons.push({

        id: generateId("LES"),

        title: title,

        content: content,

        createdAt:
            new Date().toISOString()

    });

    saveData(
        STORAGE.lessons,
        lessons
    );

    const titleInput =
        document.getElementById("lessonTitleInput");

    const contentInput =
        document.getElementById("lessonContentInput");

    if (titleInput) titleInput.value = "";
    if (contentInput) contentInput.value = "";

    loadAdminLessons();
    loadStudentLessons();

    alert("Barnoonni milkaa'inaan uumameera.");
}

window.createLesson = createLesson;


/* =========================================================
   34. ADMIN LESSONS
   ========================================================= */

function loadAdminLessons() {

    const container =
        document.getElementById("adminLessonsList");

    if (!container) return;

    const lessons =
        getData(STORAGE.lessons);

    if (!lessons.length) {

        container.innerHTML =
            `<div class="empty-state">
                Barnoonni hin jiru.
            </div>`;

        return;
    }

    container.innerHTML =
        lessons.map(lesson => `

            <div class="admin-content-card">

                <div>

                    <h3>
                        ${escapeHTML(lesson.title)}
                    </h3>

                    <p>
                        ${escapeHTML(
                            lesson.content.substring(0, 180)
                        )}...
                    </p>

                </div>

                <button
                    class="danger"
                    onclick="deleteLesson('${lesson.id}')">
                    Haqi
                </button>

            </div>

        `).join("");
}

window.loadAdminLessons = loadAdminLessons;


/* =========================================================
   35. DELETE LESSON
   ========================================================= */

function deleteLesson(lessonId) {

    if (!confirm("Barnoota kana haquu?")) return;

    let lessons =
        getData(STORAGE.lessons);

    lessons =
        lessons.filter(
            lesson => lesson.id !== lessonId
        );

    saveData(
        STORAGE.lessons,
        lessons
    );

    loadAdminLessons();
    loadStudentLessons();
}

window.deleteLesson = deleteLesson;


/* =========================================================
   36. CREATE EXAM
   ========================================================= */

function createExam() {

    const title =
        document.getElementById("examTitleInput")
            ?.value.trim();

    const description =
        document.getElementById("examDescriptionInput")
            ?.value.trim();

    const questionLimit =
        Number(
            document.getElementById(
                "examQuestionLimitInput"
            )?.value || 0
        );

    const attemptLimit =
        Number(
            document.getElementById(
                "examAttemptLimitInput"
            )?.value || 1
        );

    const finalExam =
        document.getElementById(
            "examFinalInput"
        )?.value === "true";

    const duration =
        Number(
            document.getElementById(
                "examDurationInput"
            )?.value || 30
        );

    const startDate =
        document.getElementById(
            "examStartDateInput"
        )?.value || "";

    const endDate =
        document.getElementById(
            "examEndDateInput"
        )?.value || "";

    const startTime =
        document.getElementById(
            "examStartTimeInput"
        )?.value || "";

    const endTime =
        document.getElementById(
            "examEndTimeInput"
        )?.value || "";

    if (!title) {
        alert("Mata-duree qormaataa galchi.");
        return;
    }

    const exams =
        getData(STORAGE.exams);

    exams.push({

        id: generateId("EX"),

        title: title,

        description: description,

        questionLimit: questionLimit,

        attemptLimit: attemptLimit,

        finalExam: finalExam,

        duration: duration,

        startDate: startDate,

        endDate: endDate,

        startTime: startTime,

        endTime: endTime,

        createdAt:
            new Date().toISOString()

    });

    saveData(
        STORAGE.exams,
        exams
    );

    clearExamForm();

    loadAdminExams();
    updateExamSelects();

    alert("Qormaanni uumameera.");
}

window.createExam = createExam;


/* =========================================================
   37. CLEAR EXAM FORM
   ========================================================= */

function clearExamForm() {

    const ids = [
        "examTitleInput",
        "examDescriptionInput",
        "examStartDateInput",
        "examEndDateInput",
        "examStartTimeInput",
        "examEndTimeInput"
    ];

    ids.forEach(id => {

        const el =
            document.getElementById(id);

        if (el) el.value = "";

    });
}


/* =========================================================
   38. ADMIN EXAMS
   ========================================================= */

function loadAdminExams() {

    const container =
        document.getElementById("adminExamsList");

    if (!container) return;

    const exams =
        getData(STORAGE.exams);

    if (!exams.length) {

        container.innerHTML =
            `<div class="empty-state">
                Qormaanni hin jiru.
            </div>`;

        return;
    }

    container.innerHTML =
        exams.map(exam => {

            const count =
                getData(STORAGE.questions)
                    .filter(
                        q => q.examId === exam.id
                    ).length;

            return `

                <div class="admin-content-card">

                    <div>

                        <h3>
                            ${escapeHTML(exam.title)}
                        </h3>

                        <p>
                            ${escapeHTML(
                                exam.description || ""
                            )}
                        </p>

                        <small>
                            Gaaffii:
                            ${count}
                        </small>

                    </div>

                    <button
                        class="danger"
                        onclick="deleteExam('${exam.id}')">
                        Haqi
                    </button>

                </div>

            `;

        }).join("");
}

window.loadAdminExams = loadAdminExams;


/* =========================================================
   39. DELETE EXAM
   ========================================================= */

function deleteExam(examId) {

    if (!confirm("Qormaata kana haquu?")) return;

    let exams =
        getData(STORAGE.exams);

    exams =
        exams.filter(
            exam => exam.id !== examId
        );

    saveData(
        STORAGE.exams,
        exams
    );

    let questions =
        getData(STORAGE.questions);

    questions =
        questions.filter(
            question =>
                question.examId !== examId
        );

    saveData(
        STORAGE.questions,
        questions
    );

    loadAdminExams();
    updateExamSelects();
}

window.deleteExam = deleteExam;


/* =========================================================
   40. UPDATE EXAM SELECTS
   ========================================================= */

function updateExamSelects() {

    const exams =
        getData(STORAGE.exams);

    const selectIds = [
        "aiQuestionExamSelect",
        "questionExamSelect"
    ];

    selectIds.forEach(id => {

        const select =
            document.getElementById(id);

        if (!select) return;

        select.innerHTML =
            `<option value="">
                -- Qormaata filadhu --
            </option>`;

        exams.forEach(exam => {

            const option =
                document.createElement("option");

            option.value = exam.id;
            option.textContent = exam.title;

            select.appendChild(option);

        });

    });

    loadAdminQuestions();
}


/* =========================================================
   41. CREATE MANUAL QUESTION
   ========================================================= */

function createQuestion() {

    const examId =
        document.getElementById(
            "questionExamSelect"
        )?.value;

    const question =
        document.getElementById(
            "questionTextInput"
        )?.value.trim();

    const optionA =
        document.getElementById(
            "optionAInput"
        )?.value.trim();

    const optionB =
        document.getElementById(
            "optionBInput"
        )?.value.trim();

    const optionC =
        document.getElementById(
            "optionCInput"
        )?.value.trim();

    const optionD =
        document.getElementById(
            "optionDInput"
        )?.value.trim();

    const correct =
        Number(
            document.getElementById(
                "correctAnswerInput"
            )?.value
        );

    if (
        !examId ||
        !question ||
        !optionA ||
        !optionB ||
        !optionC ||
        !optionD
    ) {

        alert(
            "Qormaata fi gaaffii fi filannoowwan guutuu guuti."
        );

        return;
    }

    const questions =
        getData(STORAGE.questions);

    questions.push({

        id: generateId("Q"),

        examId: examId,

        question: question,

        options: [
            optionA,
            optionB,
            optionC,
            optionD
        ],

        correctAnswer: correct

    });

    saveData(
        STORAGE.questions,
        questions
    );

    [
        "questionTextInput",
        "optionAInput",
        "optionBInput",
        "optionCInput",
        "optionDInput"
    ].forEach(id => {

        const el =
            document.getElementById(id);

        if (el) el.value = "";

    });

    loadAdminQuestions();
    loadAdminExams();

    alert("Gaaffiin uumameera.");
}

window.createQuestion = createQuestion;


/* =========================================================
   42. ADMIN QUESTIONS
   ========================================================= */

function loadAdminQuestions() {

    const container =
        document.getElementById(
            "adminQuestionsList"
        );

    if (!container) return;

    const questions =
        getData(STORAGE.questions);

    const exams =
        getData(STORAGE.exams);

    if (!questions.length) {

        container.innerHTML =
            `<div class="empty-state">
                Gaaffiin hin jiru.
            </div>`;

        return;
    }

    container.innerHTML =
        questions.map(q => {

            const exam =
                exams.find(
                    e => e.id === q.examId
                );

            return `

                <div class="admin-question-card">

                    <div>

                        <strong>
                            ${escapeHTML(q.question)}
                        </strong>

                        <p>
                            Qormaata:
                            ${escapeHTML(
                                exam?.title || "Unknown"
                            )}
                        </p>

                        <ol type="A">

                            ${q.options.map(
                                (option, index) => `

                                    <li>
                                        ${escapeHTML(option)}
                                        ${
                                            index ===
                                            Number(q.correctAnswer)
                                                ? " ✓"
                                                : ""
                                        }
                                    </li>

                                `
                            ).join("")}

                        </ol>

                    </div>

                    <button
                        class="danger"
                        onclick="deleteQuestion('${q.id}')">
                        Haqi
                    </button>

                </div>

            `;

        }).join("");
}

window.loadAdminQuestions = loadAdminQuestions;


/* =========================================================
   43. DELETE QUESTION
   ========================================================= */

function deleteQuestion(questionId) {

    if (!confirm("Gaaffii kana haquu?")) return;

    let questions =
        getData(STORAGE.questions);

    questions =
        questions.filter(
            q => q.id !== questionId
        );

    saveData(
        STORAGE.questions,
        questions
    );

    loadAdminQuestions();
    loadAdminExams();
}

window.deleteQuestion = deleteQuestion;


/* =========================================================
   44. AI QUESTION SOURCE
   ========================================================= */

function changeAIQuestionSource() {

    const source =
        document.getElementById(
            "aiQuestionSourceType"
        )?.value;

    const sections = {
        topic: "aiTopicSource",
        text: "aiTextSource",
        pdf: "aiPdfSource",
        image: "aiImageSource"
    };

    Object.values(sections).forEach(id => {

        const el =
            document.getElementById(id);

        if (el) {
            el.style.display = "none";
        }

    });

    if (sections[source]) {

        const selected =
            document.getElementById(
                sections[source]
            );

        if (selected) {
            selected.style.display = "block";
        }
    }
}

window.changeAIQuestionSource =
    changeAIQuestionSource;


/* =========================================================
   45. LOCAL AI QUESTION GENERATOR
   ========================================================= */

/*
   Hubachiisa:

   Kun "local/demo generator" dha.
   API key AI dhugaa frontend keessatti kaa'uun
   nageenyaaf sirrii miti.

   Yeroo backend/serverless AI qabaattu,
   generateAIQuestions() gara API keetti
   jijjiiruu dandeessa.
*/

function generateAIQuestions() {

    const examId =
        document.getElementById(
            "aiQuestionExamSelect"
        )?.value;

    const source =
        document.getElementById(
            "aiQuestionSourceType"
        )?.value || "topic";

    const count =
        Number(
            document.getElementById(
                "aiQuestionCount"
            )?.value || 5
        );

    if (!examId) {

        showMessage(
            "aiQuestionMessage",
            "Dura qormaata filadhu.",
            "error"
        );

        return;
    }

    let topic = "";

    if (source === "topic") {

        topic =
            document.getElementById(
                "aiTopicInput"
            )?.value.trim();

    } else if (source === "text") {

        topic =
            document.getElementById(
                "aiTextInput"
            )?.value.trim();

    } else if (source === "pdf") {

        const file =
            document.getElementById(
                "aiPdfInput"
            )?.files?.[0];

        topic =
            file ? file.name : "";

    } else if (source === "image") {

        const file =
            document.getElementById(
                "aiImageInput"
            )?.files?.[0];

        topic =
            file ? file.name : "";
    }

    if (!topic) {

        showMessage(
            "aiQuestionMessage",
            "Madda ykn topic galchi.",
            "error"
        );

        return;
    }

    const questions =
        getData(STORAGE.questions);

    const generated =
        createDemoAIQuestions(
            examId,
            topic,
            count
        );

    generated.forEach(q => {
        questions.push(q);
    });

    saveData(
        STORAGE.questions,
        questions
    );

    loadAdminQuestions();
    loadAdminExams();

    showMessage(
        "aiQuestionMessage",
        `${generated.length} gaaffii uumameera.`,
        "success"
    );
}

window.generateAIQuestions =
    generateAIQuestions;


/* =========================================================
   46. DEMO AI QUESTIONS
   ========================================================= */

function createDemoAIQuestions(
    examId,
    topic,
    count
) {

    const templates = [

        {
            q: `${topic} jechuun maal jechuudha?`,
            options: [
                `${topic} ilaalchisee ibsa sirrii`,
                "Waan internet waliin qofa wal qabatu",
                "Meeshaa elektirooniksii qofa",
                "Maqaa software tokko qofa"
            ]
        },

        {
            q: `${topic} keessatti wanti ijoo ta'e kam?`,
            options: [
                "Barachuu fi hubachuu",
                "Computer cufuu",
                "Internet balleessuu",
                "Faayila haqaa qofa"
            ]
        },

        {
            q: `Faayidaan ${topic} keessaa tokko kam?`,
            options: [
                "Rakkoo tokko furuuf gargaaruu",
                "Computer balleessuu",
                "Data hunda haqaa",
                "Internet cufuu"
            ]
        },

        {
            q: `${topic} barachuuf maal barbaachisa?`,
            options: [
                "Hubannoo fi shaakala",
                "Password qofa",
                "Mobile qofa",
                "Printer qofa"
            ]
        },

        {
            q: `${topic} yeroo barattu maal gochuun gaarii dha?`,
            options: [
                "Shaakala fi qorannoo",
                "Barnoota dhiisuu",
                "Data haqaa",
                "Application cufuu"
            ]
        }
    ];

    const generated = [];

    for (let i = 0; i < count; i++) {

        const template =
            templates[
                i % templates.length
            ];

        generated.push({

            id: generateId("Q"),

            examId: examId,

            question:
                `${i + 1}. ${template.q}`,

            options:
                [...template.options],

            correctAnswer: 0

        });
    }

    return generated;
}


/* =========================================================
   47. ADMIN LOGOUT
   ========================================================= */

function adminLogout() {

    currentAdmin = null;

    localStorage.removeItem(
        STORAGE.currentAdmin
    );

    showPage("rolePage");
}

window.adminLogout = adminLogout;


/* =========================================================
   48. ADMIN INITIALIZATION
   ========================================================= */

function loadCurrentAdmin() {

    try {

        const data =
            localStorage.getItem(
                STORAGE.currentAdmin
            );

        if (data) {
            currentAdmin = JSON.parse(data);
        }

    } catch (error) {
        currentAdmin = null;
    }
}


/* =========================================================
   49. PAGE EVENT HELPERS
   ========================================================= */

function setupPageEvents() {

    const studentHome =
        document.getElementById(
            "studentHomePage"
        );

    if (studentHome) {
        loadStudentHome();
    }

    const profilePage =
        document.getElementById(
            "profilePage"
        );

    if (profilePage) {
        loadStudentProfile();
    }

    const examList =
        document.getElementById(
            "examListPage"
        );

    if (examList) {
        loadExams();
    }
}


/* =========================================================
   50. STARTUP
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        initializeAppData();

        loadCurrentStudent();

        loadCurrentAdmin();

        setupPageEvents();

        /*
           Initial page
        */

        showPage("rolePage");

        /*
           Prepare AI source section
        */

        changeAIQuestionSource();

        /*
           If student is already logged in,
           update student information.
        */

        if (currentStudent) {
            loadStudentHome();
            loadStudentProfile();
        }

    }
);


/* =========================================================
   51. DEBUG / DEVELOPMENT
   ========================================================= */

window.AkkaadaamiiOromiyaa = {

    getStudents: () =>
        getData(STORAGE.students),

    getLessons: () =>
        getData(STORAGE.lessons),

    getExams: () =>
        getData(STORAGE.exams),

    getQuestions: () =>
        getData(STORAGE.questions),

    getResults: () =>
        getData(STORAGE.results),

    clearAllData: function () {

        if (
            confirm(
                "Datawwan app hunda haquu barbaaddaa?"
            )
        ) {

            Object.values(STORAGE).forEach(key => {
                localStorage.removeItem(key);
            });

            location.reload();
        }
    }

};


/* =========================================================
   END OF APP.JS
   ========================================================= */
