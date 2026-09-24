/* =========================================================
   AKKAADAAMII OROMIYAA - app.js
   Supabase version
   ========================================================= */

"use strict";

/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL = "https://xhkkaevhcqvkwabcsljm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8nBE4n2bQ1jRnEr_83FrdA_vSqqIpSz";
const AI_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/generate-ai-questions`;

const ADMIN_GOOGLE_EMAILS = [
  "suufiyaanjeeylaanofficial@gmail.com",
  "seyfudin67@gmail.com"
].map((email) => email.toLowerCase());

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* =========================================================
   APP STATE
========================================================= */

let currentStudent = null;
let currentAdmin = null;
let currentExam = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let currentAnswers = {};
let currentAttempt = null;
let examTimer = null;
let examSecondsLeft = 0;
let pendingSubmit = false;
let authListenerReady = false;

/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function truncate(value, length = 120) {
  const text = String(value ?? "");
  return text.length > length ? text.slice(0, length) + "..." : text;
}

function formatText(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function getErrorMessage(error) {
  return (
    error?.message ||
    error?.error_description ||
    error?.details ||
    "Dogoggorri hin beekamne."
  );
}

function showStudentMessage(message, type = "info") {
  const el = document.getElementById("studentLoginMessage");
  if (!el) return;
  el.textContent = message;
  el.className = `message ${type}`.trim();
}

function showAdminMessage(message, type = "info") {
  const el = document.getElementById("adminLoginMessage");
  if (!el) return;
  el.textContent = message;
  el.className = `message ${type}`.trim();
}

function showAIMessage(message, type = "info") {
  const el = document.getElementById("aiQuestionMessage");
  if (!el) return;
  el.innerHTML = message;
  el.className = `message ${type}`.trim();
}

function generateStudentCode() {
  const chars = "0123456789";
  let result = "ST-";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function generateActivationCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function normalizeQuestion(row) {
  return {
    ...row,
    id: row.id,
    examId: row.exam_id ?? row.examId,
    text: row.question ?? row.question_text ?? row.text ?? "",
    optionA: row.option_a ?? row.optionA ?? "",
    optionB: row.option_b ?? row.optionB ?? "",
    optionC: row.option_c ?? row.optionC ?? "",
    optionD: row.option_d ?? row.optionD ?? "",
    correctAnswer: String(
      row.correct_answer ?? row.correctAnswer ?? ""
    ).toUpperCase().charAt(0)
  };
}

function normalizeExam(row) {
  return {
    ...row,
    questionLimit: Number(row.question_limit ?? row.questionLimit ?? 0),
    attemptLimit: Number(row.attempt_limit ?? row.attemptLimit ?? 1),
    isFinal: Boolean(row.is_final ?? row.isFinal ?? false),
    duration: Number(row.duration_minutes ?? row.duration ?? 30),
    startDate: row.start_date ?? row.startDate ?? "",
    endDate: row.end_date ?? row.endDate ?? "",
    startTime: row.start_time ?? row.startTime ?? "",
    endTime: row.end_time ?? row.endTime ?? ""
  };
}

/* =========================================================
   PAGE NAVIGATION
========================================================= */

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  const page = document.getElementById(pageId);
  if (page) {
    page.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function openStudentLogin() {
  document.getElementById("postLoginRoleNav")?.remove();
  showPage("studentLoginPage");
  const input = document.getElementById("nameInput");
  if (input) setTimeout(() => input.focus(), 100);
}

function openAdminLogin() {
  document.getElementById("postLoginRoleNav")?.remove();
  showPage("adminLoginPage");
  const input = document.getElementById("adminUsername");
  if (input) setTimeout(() => input.focus(), 100);
}

/* =========================================================
   POST-LOGIN ROLE NAVIGATION
========================================================= */

function setupPostLoginRoleNav(authenticated = false) {
  const rolePage = document.getElementById("rolePage");
  if (!rolePage) return;

  const oldNav = document.getElementById("postLoginRoleNav");
  if (oldNav) oldNav.remove();

  rolePage.querySelectorAll(
    '[onclick*="openStudentLogin"], [onclick*="openAdminLogin"]'
  ).forEach((el) => {
    el.style.display = "none";
  });

  if (!authenticated) return;

  const nav = document.createElement("div");
  nav.id = "postLoginRoleNav";
  nav.className = "bottom-nav";
  nav.innerHTML = `
    <button type="button" class="nav-item" onclick="openStudentLogin()">
      <span>👨‍🎓</span>
      <small>Barataa</small>
    </button>
    <button type="button" class="nav-item" onclick="openAdminLogin()">
      <span>⚙️</span>
      <small>Admin</small>
    </button>
  `;
  document.body.appendChild(nav);
}

function showPublicLoginPage() {
  setupPostLoginRoleNav(false);
  showPage("rolePage");
}

function showPostLoginRoles() {
  setupPostLoginRoleNav(true);
  showPage("rolePage");
}

/* =========================================================
   STUDENT REGISTRATION / LOGIN
========================================================= */

async function studentRegister() {
  const name = document.getElementById("nameInput")?.value.trim() || "";

  if (name.length < 2) {
    showStudentMessage("Maqaa kee guutuu sirriitti galchi.", "error");
    return;
  }

  try {
    const { data: existing, error: existingError } = await db
      .from("students")
      .select("id,student_code,activation_code,name,status")
      .ilike("name", name)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      throw existingError;
    }

    if (existing) {
      showStudentMessage(
        `Maqaan kun duraan galmaa'eera. Student ID: ${existing.student_code}`,
        "error"
      );
      return;
    }

    let studentCode = generateStudentCode();
    let activationCode = generateActivationCode();

    for (let i = 0; i < 20; i++) {
      const { data: duplicate, error: duplicateError } = await db
        .from("students")
        .select("id")
        .or(
          `student_code.eq.${studentCode},activation_code.eq.${activationCode}`
        )
        .limit(1);

      if (duplicateError) throw duplicateError;
      if (!duplicate?.length) break;

      studentCode = generateStudentCode();
      activationCode = generateActivationCode();
    }

    const { data: student, error } = await db
      .from("students")
      .insert({
        student_code: studentCode,
        activation_code: activationCode,
        name,
        status: "pending"
      })
      .select()
      .single();

    if (error) throw error;

    alert(
      `Galmeen milkaa'e!\n\nMaqaa: ${student.name}\nStudent ID: ${student.student_code}\nActivation Code: ${student.activation_code}\n\nAdminiin erga si mirkaneessee booda seenuu dandeessa.`
    );

    document.getElementById("nameInput").value = "";
    showStudentMessage("Galmeen kee milkaa'eera. Admin eegi.", "success");
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    showStudentMessage(getErrorMessage(error), "error");
  }
}

async function studentLogin() {
  const studentId =
    document.getElementById("studentIdInput")?.value.trim() || "";

  const activationCode =
    document.getElementById("activationCodeInput")?.value.trim() || "";

  if (!studentId || !activationCode) {
    showStudentMessage(
      "Student ID fi Activation Code lamaan isaanii galchi.",
      "error"
    );
    return;
  }

  try {
    const { data: student, error } = await db
      .from("students")
      .select("*")
      .eq("student_code", studentId)
      .eq("activation_code", activationCode)
      .maybeSingle();

    if (error) throw error;

    if (!student) {
      showStudentMessage(
        "Student ID ykn Activation Code sirrii miti.",
        "error"
      );
      return;
    }

    if (student.status !== "active") {
      showStudentMessage(
        student.status === "pending"
          ? "Account kee ammallee adminiin hin mirkanoofne."
          : "Account kee adminiin cufameera.",
        "error"
      );
      return;
    }

    currentStudent = student;
    localStorage.setItem("ao_student_id", String(student.id));

    document.getElementById("studentIdInput").value = "";
    document.getElementById("activationCodeInput").value = "";

    showPage("studentHomePage");
    await loadStudentHome();
  } catch (error) {
    console.error("STUDENT LOGIN ERROR:", error);
    showStudentMessage(getErrorMessage(error), "error");
  }
}

async function restoreStudent() {
  const id = localStorage.getItem("ao_student_id");
  if (!id) return null;

  try {
    const { data, error } = await db
      .from("students")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    if (!data || data.status !== "active") {
      localStorage.removeItem("ao_student_id");
      currentStudent = null;
      return null;
    }

    currentStudent = data;
    return data;
  } catch (error) {
    console.error("RESTORE STUDENT ERROR:", error);
    return null;
  }
}

function requireStudent() {
  if (!currentStudent) {
    showPage("studentLoginPage");
    return null;
  }
  return currentStudent;
}

/* =========================================================
   STUDENT HOME / LESSONS
========================================================= */

async function loadStudentHome() {
  const student = requireStudent();
  if (!student) return;

  const nameEl = document.getElementById("studentWelcomeName");
  const messageEl = document.getElementById("studentHomeMessage");

  if (nameEl) nameEl.textContent = student.name;

  if (messageEl) {
    messageEl.textContent =
      "Barnoota dubbisi, qormaata fudhadhu, qabxii kees ilaali.";
  }

  await loadStudentLessons();
}

async function loadStudentLessons() {
  const container = document.getElementById("studentLessons");
  if (!container) return;

  const { data, error } = await db
    .from("lessons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML =
      `<div class="empty-state">❌ Barnoota fe'uu hin dandeenye.</div>`;
    console.error(error);
    return;
  }

  if (!data?.length) {
    container.innerHTML =
      `<div class="empty-state">📚 Ammaaf barnoonni hin fe'amne.</div>`;
    return;
  }

  container.innerHTML = data
    .map(
      (lesson) => `
    <article class="item-card">
      <div class="item-icon">📚</div>
      <div class="item-main">
        <h4>${escapeHtml(lesson.title)}</h4>
        <p>${escapeHtml(truncate(lesson.content, 120))}</p>
        <button type="button" class="small-btn" onclick="openLesson('${lesson.id}')">
          Baradhu →
        </button>
      </div>
    </article>
  `
    )
    .join("");
}

async function openLesson(lessonId) {
  const { data, error } = await db
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .maybeSingle();

  if (error || !data) return;

  const title = document.getElementById("lessonDetailTitle");
  const content = document.getElementById("lessonDetailContent");

  if (title) title.textContent = data.title;

  if (content) {
    content.innerHTML =
      `<div class="lesson-content">${formatText(data.content)}</div>`;
  }

  showPage("lessonDetailPage");
}

/* =========================================================
   STUDENT EXAMS
========================================================= */

function getExamWindowStatus(exam) {
  const now = new Date();

  if (exam.startDate) {
    const start = new Date(
      `${exam.startDate}T${exam.startTime || "00:00"}`
    );

    if (!Number.isNaN(start.getTime()) && now < start) {
      return {
        available: false,
        reason: "not_started",
        date: start
      };
    }
  }

  if (exam.endDate) {
    const end = new Date(
      `${exam.endDate}T${exam.endTime || "23:59:59"}`
    );

    if (!Number.isNaN(end.getTime()) && now > end) {
      return {
        available: false,
        reason: "ended",
        date: end
      };
    }
  }

  if (exam.status === "disabled") {
    return {
      available: false,
      reason: "disabled"
    };
  }

  return {
    available: true,
    reason: "available"
  };
}

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("om-ET");
}

async function getCompletedAttempts(examId, studentId) {
  const { data, error } = await db
    .from("exam_attempts")
    .select("*")
    .eq("exam_id", examId)
    .eq("student_id", studentId)
    .eq("completed", true)
    .order("attempt_number", { ascending: false });

  if (error) {
    console.error("ATTEMPTS ERROR:", error);
    return [];
  }

  return data || [];
}

async function loadExams() {
  const student = requireStudent();
  if (!student) return;

  const container = document.getElementById("studentExams");
  if (!container) return;

  const { data, error } = await db
    .from("exams")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML =
      `<div class="empty-state">❌ Qormaata fe'uu hin dandeenye.</div>`;
    console.error(error);
    return;
  }

  if (!data?.length) {
    container.innerHTML =
      `<div class="empty-state">📝 Ammaaf qormaanni hin jiru.</div>`;
    return;
  }

  const exams = data.map(normalizeExam);
  const cards = [];

  for (const exam of exams) {
    const attempts = await getCompletedAttempts(exam.id, student.id);
    const limit = Number(exam.attemptLimit || 1);
    const window = getExamWindowStatus(exam);

    let action = "";

    if (!window.available) {
      const text =
        window.reason === "not_started"
          ? `⏳ Hin jalqabne: ${formatDateTime(window.date)}`
          : window.reason === "ended"
          ? "⛔ Yeroon qormaataa darbeera."
          : "⛔ Qormaanni cufameera.";

      action =
        `<span class="status blocked">${escapeHtml(text)}</span>`;
    } else if (attempts.length >= limit) {
      action =
        `<span class="status blocked">Attempt xumurame</span>`;
    } else {
      action = `
        <button
          type="button"
          class="small-btn"
          onclick="startExam(${exam.id})"
        >
          Qormaata Jalqabi →
        </button>
      `;
    }

    cards.push(`
      <article class="exam-card">
        <div class="exam-badge">
          ${exam.isFinal ? "🏆 FINAL" : "📝 EXAM"}
        </div>

        <h3>${escapeHtml(exam.title)}</h3>

        <p>${escapeHtml(exam.description || "")}</p>

        <div class="exam-meta">
          <span>
            ❓ ${exam.questionLimit > 0 ? exam.questionLimit : "Hunda"}
          </span>

          <span>
            ⏱️ ${exam.duration} daqiiqaa
          </span>

          <span>
            🔢 ${attempts.length}/${limit}
          </span>
        </div>

        <div class="exam-action">
          ${action}
        </div>
      </article>
    `);
  }

  container.innerHTML = cards.join("");
}

/* =========================================================
   START EXAM / QUESTIONS
========================================================= */

async function startExam(examId) {
  const student = requireStudent();
  if (!student) return;

  const { data: examRow, error: examError } = await db
    .from("exams")
    .select("*")
    .eq("id", examId)
    .maybeSingle();

  if (examError || !examRow) {
    alert("Qormaanni hin argamne.");
    return;
  }

  const exam = normalizeExam(examRow);
  const window = getExamWindowStatus(exam);

  if (!window.available) {
    alert(
      window.reason === "not_started"
        ? "Qormaanni yeroo isaa hin geenye."
        : window.reason === "ended"
        ? "Yeroon qormaataa darbeera."
        : "Qormaanni cufameera."
    );
    return;
  }

  const completedAttempts =
    await getCompletedAttempts(exam.id, student.id);

  const attemptLimit = Number(exam.attemptLimit || 1);

  if (completedAttempts.length >= attemptLimit) {
    alert("Attempt kee xumurameera.");
    return;
  }

  const { data: questionRows, error: questionError } = await db
    .from("questions")
    .select("*")
    .eq("exam_id", exam.id);

  if (questionError) {
    alert(getErrorMessage(questionError));
    return;
  }

  let questions = (questionRows || []).map(normalizeQuestion);

  if (!questions.length) {
    alert("Qormaata kana keessatti gaaffiin hin jiru.");
    return;
  }

  questions = questions.sort(() => Math.random() - 0.5);

  /*
    IMPORTANT:
    Admin yoo 50 filate -> barataan hanga 50 argata.
    Yoo 30 filate -> 30.
    Yoo 40 filate -> 40.
    Yoo 0/empty ta'e -> gaaffii hunda.
  */
  if (exam.questionLimit > 0) {
    questions = questions.slice(0, exam.questionLimit);
  }

  const attemptNumber = completedAttempts.length + 1;

  const { data: attempt, error: attemptError } = await db
    .from("exam_attempts")
    .insert({
      student_id: student.id,
      exam_id: exam.id,
      attempt_number: attemptNumber,
      score: 0,
      total: questions.length,
      percentage: 0,
      completed: false
    })
    .select()
    .single();

  if (attemptError) {
    console.error(attemptError);
    alert(
      "Qormaata jalqabuun hin danda'amne: " +
        getErrorMessage(attemptError)
    );
    return;
  }

  currentExam = exam;
  currentQuestions = questions;
  currentQuestionIndex = 0;
  currentAnswers = {};
  currentAttempt = attempt;
  pendingSubmit = false;

  const title = document.getElementById("examTitle");
  if (title) title.textContent = exam.title;

  examSecondsLeft = Math.max(1, exam.duration * 60);

  startExamTimer();
  renderCurrentQuestion();
  showPage("examPage");
}

function renderCurrentQuestion() {
  if (!currentExam || !currentQuestions.length) return;

  const question = currentQuestions[currentQuestionIndex];
  const total = currentQuestions.length;

  const number =
    document.getElementById("questionNumber");

  const text =
    document.getElementById("questionText");

  const container =
    document.getElementById("answersContainer");

  if (number) {
    number.textContent =
      ` ${currentQuestionIndex + 1}/${total}`;
  }

  if (text) {
    text.textContent = question.text;
  }

  if (!container) return;

  const selected =
    currentAnswers[question.id];

  const options = [
    ["A", question.optionA],
    ["B", question.optionB],
    ["C", question.optionC],
    ["D", question.optionD]
  ];

  container.innerHTML = options
    .map(
      ([letter, value]) => `
    <label class="answer-option">
      <input
        type="radio"
        name="currentAnswer"
        value="${letter}"
        ${selected === letter ? "checked" : ""}
        onchange="selectAnswer('${letter}')"
      >

      <span>
        <strong>${letter}.</strong>
        ${escapeHtml(value)}
      </span>
    </label>
  `
    )
    .join("");

  const nextButton =
    document.getElementById("nextQuestionButton");

  const submitButton =
    document.getElementById("submitExamButton");

  const answered =
    Boolean(currentAnswers[question.id]);

  if (nextButton) {
    nextButton.disabled = !answered;

    nextButton.style.display =
      currentQuestionIndex === total - 1
        ? "none"
        : "block";
  }

  if (submitButton) {
    submitButton.disabled = !answered;

    submitButton.style.display =
      currentQuestionIndex === total - 1
        ? "block"
        : "none";
  }
}

function selectAnswer(letter) {
  const question =
    currentQuestions[currentQuestionIndex];

  if (!question) return;

  currentAnswers[question.id] = letter;

  const nextButton =
    document.getElementById("nextQuestionButton");

  const submitButton =
    document.getElementById("submitExamButton");

  if (nextButton) {
    nextButton.disabled = false;
  }

  if (submitButton) {
    submitButton.disabled = false;
  }
}

function nextQuestion() {
  if (
    currentQuestionIndex >=
    currentQuestions.length - 1
  ) {
    return;
  }

  currentQuestionIndex++;

  renderCurrentQuestion();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function requestSubmitExam() {
  if (!currentExam) return;

  const unanswered =
    currentQuestions.filter(
      (question) =>
        !currentAnswers[question.id]
    ).length;

  const message =
    document.getElementById(
      "submitWarningMessage"
    );

  if (message) {
    message.textContent =
      unanswered > 0
        ? `Gaaffii ${unanswered} hin deebifne. Qormaata submit gochuu barbaaddaa?`
        : "Gaaffii hunda xumurteettaa? Qormaata submit gochuu barbaaddaa?";
  }

  pendingSubmit = true;

  showPage("submitConfirmPage");
}

function confirmSubmitExam(confirmSubmit) {
  if (!confirmSubmit) {
    pendingSubmit = false;
    showPage("examPage");
    return;
  }

  if (!pendingSubmit || !currentExam) return;

  finishExam();
}

/* =========================================================
   FINISH EXAM
========================================================= */

async function finishExam() {
  const student = requireStudent();

  if (
    !student ||
    !currentExam ||
    !currentAttempt
  ) {
    return;
  }

  stopExamTimer();

  let correct = 0;

  currentQuestions.forEach((question) => {
    if (
      currentAnswers[question.id] ===
      question.correctAnswer
    ) {
      correct++;
    }
  });

  const total = currentQuestions.length;

  const percentage =
    total
      ? Math.round((correct / total) * 100)
      : 0;

  try {
    const {
      error: attemptError
    } = await db
      .from("exam_attempts")
      .update({
        score: correct,
        total,
        percentage,
        completed: true,
        submitted_at:
          new Date().toISOString()
      })
      .eq("id", currentAttempt.id);

    if (attemptError) {
      throw attemptError;
    }

    const resultPayload = {
      student_id: student.id,
      exam_id: currentExam.id,
      exam_title: currentExam.title,
      correct,
      total,
      percentage,
      answers: currentAnswers,
      submitted_at:
        new Date().toISOString()
    };

    const { data: oldResult } =
      await db
        .from("results")
        .select("id")
        .eq("student_id", student.id)
        .eq("exam_id", currentExam.id)
        .maybeSingle();

    if (oldResult?.id) {
      const { error } =
        await db
          .from("results")
          .update(resultPayload)
          .eq("id", oldResult.id);

      if (error) throw error;
    } else {
      const { error } =
        await db
          .from("results")
          .insert(resultPayload);

      if (error) throw error;
    }

    alert(
      `Qormaanni xumurameera!\n\nQabxii: ${correct}/${total}\nDhibbeentaa: ${percentage}%`
    );

    currentExam = null;
    currentQuestions = [];
    currentQuestionIndex = 0;
    currentAnswers = {};
    currentAttempt = null;
    pendingSubmit = false;

    showPage("scorePage");

    await showScore();
  } catch (error) {
    console.error(
      "FINISH EXAM ERROR:",
      error
    );

    alert(
      "Qormaata submit gochuun hin milkoofne: " +
        getErrorMessage(error)
    );
  }
}

/* =========================================================
   TIMER
========================================================= */

function startExamTimer() {
  stopExamTimer();

  updateExamTimer();

  examTimer = setInterval(() => {
    examSecondsLeft--;

    updateExamTimer();

    if (examSecondsLeft <= 0) {
      stopExamTimer();

      alert(
        "Yeroon qormaataa xumurameera. Qormaanni kee submit ta'a."
      );

      finishExam();
    }
  }, 1000);
}

function updateExamTimer() {
  const el =
    document.getElementById(
      "examTimerValue"
    );

  if (el) {
    const minutes =
      Math.floor(
        Math.max(0, examSecondsLeft) / 60
      );

    const seconds =
      Math.max(0, examSecondsLeft) % 60;

    el.textContent =
      `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
}

function stopExamTimer() {
  if (examTimer) {
    clearInterval(examTimer);
    examTimer = null;
  }
}

/* =========================================================
   SCORE / PROFILE
========================================================= */

async function showScore() {
  const student = requireStudent();
  if (!student) return;

  const container =
    document.getElementById(
      "studentScore"
    );

  if (!container) return;

  const { data, error } =
    await db
      .from("results")
      .select("*")
      .eq("student_id", student.id)
      .order("submitted_at", {
        ascending: false
      });

  if (error) {
    container.innerHTML =
      `<div class="empty-state">❌ Qabxii fe'uu hin dandeenye.</div>`;

    console.error(error);
    return;
  }

  if (!data?.length) {
    container.innerHTML =
      `<div class="empty-state">📊 Ammaaf qormaata tokko illee hin xumurre.</div>`;

    return;
  }

  container.innerHTML = data
    .map(
      (result) => `
    <div class="result-card">
      <div>
        <h3>
          ${escapeHtml(
            result.exam_title ||
              "Qormaata"
          )}
        </h3>

        <p>
          ${formatDateTime(
            result.submitted_at
          )}
        </p>
      </div>

      <div class="result-score">
        <strong>
          ${Number(
            result.percentage || 0
          )}%
        </strong>

        <span>
          ${Number(
            result.correct || 0
          )}/${Number(
            result.total || 0
          )}
        </span>
      </div>
    </div>
  `
    )
    .join("");
}

async function loadProfile() {
  const student = requireStudent();
  if (!student) return;

  const nameInput =
    document.getElementById(
      "profileNameInput"
    );

  const code =
    document.getElementById(
      "profileCode"
    );

  const activation =
    document.getElementById(
      "profileActivationCode"
    );

  const status =
    document.getElementById(
      "profileStatus"
    );

  if (nameInput) {
    nameInput.value =
      student.name || "";
  }

  if (code) {
    code.textContent =
      student.student_code || "";
  }

  if (activation) {
    activation.textContent =
      student.activation_code || "";
  }

  if (status) {
    status.innerHTML =
      student.status === "active"
        ? '<span class="status active">● Active</span>'
        : '<span class="status blocked">● Cufame</span>';
  }
}

async function saveProfile() {
  const student = requireStudent();
  if (!student) return;

  const name =
    document.getElementById(
      "profileNameInput"
    )?.value.trim() || "";

  if (name.length < 2) {
    alert("Maqaa sirrii galchi.");
    return;
  }

  const { data, error } =
    await db
      .from("students")
      .update({ name })
      .eq("id", student.id)
      .select()
      .single();

  if (error) {
    alert(getErrorMessage(error));
    return;
  }

  currentStudent = data;

  await loadProfile();
  await loadStudentHome();

  alert("Maqaan kee olkaa'ameera.");
}

async function studentLogout() {
  try {
    await db.auth.signOut();
  } catch (error) {
    console.error(error);
  }

  localStorage.removeItem(
    "ao_student_id"
  );

  currentStudent = null;

  stopExamTimer();

  currentExam = null;
  currentQuestions = [];
  currentAnswers = {};
  currentAttempt = null;

  showPublicLoginPage();
}

/* =========================================================
   ADMIN LOGIN
========================================================= */

async function adminLogin() {
  const username =
    document.getElementById(
      "adminUsername"
    )?.value.trim() || "";

  const password =
    document.getElementById(
      "adminPassword"
    )?.value || "";

  if (!username || !password) {
    showAdminMessage(
      "Username fi Password galchi.",
      "error"
    );
    return;
  }

  try {
    const { data, error } =
      await db
        .from("admins")
        .select("*")
        .eq("username", username)
        .eq("password", password)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
      showAdminMessage(
        "Username ykn Password sirrii miti.",
        "error"
      );
      return;
    }

    currentAdmin = data;

    localStorage.setItem(
      "ao_admin_id",
      String(data.id)
    );

    showPage("adminPage");

    await initializeAdmin();
  } catch (error) {
    console.error(
      "ADMIN LOGIN ERROR:",
      error
    );

    showAdminMessage(
      getErrorMessage(error),
      "error"
    );
  }
}

async function adminLogout() {
  try {
    await db.auth.signOut();
  } catch (error) {
    console.error(error);
  }

  localStorage.removeItem(
    "ao_admin_id"
  );

  localStorage.removeItem(
    "ao_admin_google_id"
  );

  localStorage.removeItem(
    "ao_admin_google_email"
  );

  currentAdmin = null;

  showPublicLoginPage();
}

async function restoreAdmin() {
  const id =
    localStorage.getItem(
      "ao_admin_id"
    );

  if (!id) return null;

  try {
    const { data, error } =
      await db
        .from("admins")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
      localStorage.removeItem(
        "ao_admin_id"
      );

      return null;
    }

    currentAdmin = data;

    return data;
  } catch (error) {
    console.error(
      "RESTORE ADMIN ERROR:",
      error
    );

    return null;
  }
}

function requireAdmin() {
  if (!currentAdmin) {
    showPage("adminLoginPage");
    return null;
  }

  return currentAdmin;
}

async function initializeAdmin() {
  if (!requireAdmin()) return;

  await openAdminPanel(
    "students"
  );

  await refreshAllAdminLists();
}

async function openAdminPanel(panel) {
  if (!requireAdmin()) return;

  const panels = {
    students: "adminStudentsPanel",
    results: "adminResultsPanel",
    lessons: "adminLessonsPanel",
    exams: "adminExamsPanel"
  };

  Object.values(panels).forEach(
    (id) => {
      const el =
        document.getElementById(id);

      if (el) {
        el.classList.remove(
          "active"
        );

        el.style.display = "none";
      }
    }
  );

  const selected =
    document.getElementById(
      panels[panel]
    );

  if (selected) {
    selected.classList.add(
      "active"
    );

    selected.style.display =
      "block";
  }

  if (panel === "students") {
    await loadAdminStudents();
  }

  if (panel === "results") {
    await loadAdminResults();
  }

  if (panel === "lessons") {
    await loadAdminLessons();
  }

  if (panel === "exams") {
    await loadAdminExams();
  }
}

/* =========================================================
   ADMIN - STUDENTS
========================================================= */

async function loadAdminStudents() {
  if (!requireAdmin()) return;

  const container =
    document.getElementById(
      "adminStudentsList"
    );

  if (!container) return;

  const { data, error } =
    await db
      .from("students")
      .select("*")
      .order("created_at", {
        ascending: false
      });

  if (error) {
    container.innerHTML =
      `<div class="empty-state">❌ Barattoota fe'uu hin dandeenye.</div>`;

    console.error(error);
    return;
  }

  if (!data?.length) {
    container.innerHTML =
      `<div class="empty-state">👨‍🎓 Barataan hin galmoofne.</div>`;

    return;
  }

  container.innerHTML = data
    .map(
      (student) => `
    <div class="admin-list-item">
      <div class="item-main">

        <h3>
          ${escapeHtml(
            student.name
          )}
        </h3>

        <p>
          ID:
          <strong>
            ${escapeHtml(
              student.student_code ||
                ""
            )}
          </strong>
          <br>

          Code:
          <strong>
            ${escapeHtml(
              student.activation_code ||
                ""
            )}
          </strong>
          <br>

          Galmaa'e:
          ${formatDateTime(
            student.created_at
          )}
        </p>

        <span class="status ${
          student.status === "active"
            ? "active"
            : "blocked"
        }">
          ● ${
            student.status === "active"
              ? "Active"
              : student.status ===
                "pending"
              ? "Pending"
              : "Cufame"
          }
        </span>

      </div>

      <div class="admin-actions">

        <button
          type="button"
          class="small-btn"
          onclick="toggleStudentStatus('${student.id}')"
        >
          ${
            student.status === "active"
              ? "🔒 Cufi"
              : "🔓 Bani"
          }
        </button>

        <button
          type="button"
          class="danger-small-btn"
          onclick="deleteStudent('${student.id}')"
        >
          🗑️ Haqi
        </button>

      </div>
    </div>
  `
    )
    .join("");
}

async function toggleStudentStatus(
  studentId
) {
  if (!requireAdmin()) return;

  const {
    data: student,
    error: findError
  } = await db
    .from("students")
    .select("id,status")
    .eq("id", studentId)
    .maybeSingle();

  if (findError || !student) return;

  const newStatus =
    student.status === "active"
      ? "blocked"
      : "active";

  const { error } =
    await db
      .from("students")
      .update({
        status: newStatus
      })
      .eq("id", studentId);

  if (error) {
    alert(
      getErrorMessage(error)
    );
    return;
  }

  await loadAdminStudents();
}

async function deleteStudent(
  studentId
) {
  if (!requireAdmin()) return;

  if (
    !confirm(
      "Barataa kana haquuf mirkaneessi."
    )
  ) {
    return;
  }

  await db
    .from("results")
    .delete()
    .eq(
      "student_id",
      studentId
    );

  await db
    .from("exam_attempts")
    .delete()
    .eq(
      "student_id",
      studentId
    );

  const { error } =
    await db
      .from("students")
      .delete()
      .eq("id", studentId);

  if (error) {
    alert(
      getErrorMessage(error)
    );
    return;
  }

  await loadAdminStudents();
  await loadAdminResults();
}

/* =========================================================
   ADMIN - RESULTS
========================================================= */

async function loadAdminResults() {
  if (!requireAdmin()) return;

  const table =
    document.getElementById(
      "adminResultsTable"
    );

  if (!table) return;

  const thead =
    table.querySelector("thead");

  const tbody =
    table.querySelector("tbody");

  const { data, error } =
    await db
      .from("results")
      .select(
        "*, students(name,student_code), exams(title)"
      )
      .order("submitted_at", {
        ascending: false
      });

  if (error) {
    console.error(error);

    if (tbody) {
      tbody.innerHTML =
        `<tr><td colspan="8">❌ Qabxii fe'uu hin dandeenye.</td></tr>`;
    }

    return;
  }

  if (thead) {
    thead.innerHTML = `
      <tr>
        <th>Rank</th>
        <th>Barataa</th>
        <th>Qormaata</th>
        <th>Qabxii</th>
        <th>%</th>
        <th>Average</th>
        <th>Gaaffii</th>
        <th>Guyyaa</th>
      </tr>
    `;
  }

  if (!data?.length) {
    if (tbody) {
      tbody.innerHTML =
        `<tr><td colspan="8" class="empty-cell">Hanga ammaatti bu'aan qormaataa hin jiru.</td></tr>`;
    }

    return;
  }

  const studentTotals = {};

  data.forEach(
    (result) => {
      const id =
        String(result.student_id);

      if (!studentTotals[id]) {
        studentTotals[id] = {
          sum: 0,
          count: 0
        };
      }

      studentTotals[id].sum +=
        Number(
          result.percentage || 0
        );

      studentTotals[id].count += 1;
    }
  );

  const ranked =
    Object.entries(studentTotals)
      .map(
        ([studentId, value]) => ({
          studentId,
          average:
            value.count
              ? value.sum /
                value.count
              : 0
        })
      )
      .sort(
        (a, b) =>
          b.average - a.average
      );

  const rankMap = {};

  ranked.forEach(
    (item, index) => {
      rankMap[item.studentId] =
        index + 1;
    }
  );

  if (tbody) {
    tbody.innerHTML =
      data
        .map((result) => {
          const studentId =
            String(
              result.student_id
            );

          const average =
            studentTotals[
              studentId
            ]?.count
              ? Math.round(
                  studentTotals[
                    studentId
                  ].sum /
                    studentTotals[
                      studentId
                    ].count
                )
              : 0;

          const answers =
            result.answers &&
            typeof result.answers ===
              "object"
              ? result.answers
              : {};

          const answeredCount =
            Object.keys(
              answers
            ).filter(
              (key) =>
                answers[key]
            ).length;

          const total =
            Number(
              result.total || 0
            );

          const missed =
            Math.max(
              0,
              total -
                answeredCount
            );

          return `
            <tr>

              <td>
                <strong>
                  #${
                    rankMap[
                      studentId
                    ] || "-"
                  }
                </strong>
              </td>

              <td>
                ${escapeHtml(
                  result.students
                    ?.name ||
                    "Barataa"
                )}
                <br>
                <small>
                  ${escapeHtml(
                    result.students
                      ?.student_code ||
                      ""
                  )}
                </small>
              </td>

              <td>
                ${escapeHtml(
                  result.exams
                    ?.title ||
                    result.exam_title ||
                    "Qormaata"
                )}
              </td>

              <td>
                ${Number(
                  result.correct ||
                    0
                )}/${total}
              </td>

              <td>
                <strong>
                  ${Number(
                    result.percentage ||
                      0
                  )}%
                </strong>
              </td>

              <td>
                <strong>
                  ${average}%
                </strong>
              </td>

              <td>
                ${answeredCount}/${total}

                ${
                  missed > 0
                    ? `<br><small style="color:#b42318">${missed} hafee</small>`
                    : ""
                }

                <br>

                <button
                  type="button"
                  class="small-btn"
                  onclick="showResultDetails(${result.id})"
                >
                  👁️ Ilaali
                </button>
              </td>

              <td>
                ${formatDateTime(
                  result.submitted_at
                )}
              </td>

            </tr>

            <tr
              id="resultDetailsRow-${result.id}"
              style="display:none"
            >
              <td
                colspan="8"
                id="resultDetailsCell-${result.id}"
              ></td>
            </tr>
          `;
        })
        .join("");
  }
}

async function showResultDetails(
  resultId
) {
  if (!requireAdmin()) return;

  const row =
    document.getElementById(
      `resultDetailsRow-${resultId}`
    );

  const cell =
    document.getElementById(
      `resultDetailsCell-${resultId}`
    );

  if (!row || !cell) return;

  if (row.style.display !== "none") {
    row.style.display = "none";
    return;
  }

  cell.innerHTML =
    "⏳ Gaaffilee qormaataa fe'aa jira...";

  row.style.display = "table-row";

  const {
    data: result,
    error: resultError
  } = await db
    .from("results")
    .select(
      "*, students(name,student_code), exams(title)"
    )
    .eq("id", resultId)
    .maybeSingle();

  if (resultError || !result) {
    cell.innerHTML =
      `<div class="empty-state">❌ Bu'aa kana bal'inaan ilaaluun hin danda'amne.</div>`;
    return;
  }

  const {
    data: questions,
    error: questionError
  } = await db
    .from("questions")
    .select("*")
    .eq(
      "exam_id",
      result.exam_id
    )
    .order("id", {
      ascending: true
    });

  if (questionError) {
    cell.innerHTML =
      `<div class="empty-state">❌ Gaaffilee fe'uu hin dandeenye.</div>`;
    return;
  }

  const answers =
    result.answers &&
    typeof result.answers ===
      "object"
      ? result.answers
      : {};

  cell.innerHTML = `
    <div
      style="padding:12px;text-align:left"
    >

      <h4>
        ${escapeHtml(
          result.students
            ?.name ||
            "Barataa"
        )}
        —
        ${escapeHtml(
          result.exams
            ?.title ||
            result.exam_title ||
            "Qormaata"
        )}
      </h4>

      <p>
        <strong>Qabxii:</strong>
        ${Number(
          result.correct || 0
        )}/${Number(
          result.total || 0
        )}
        (${Number(
          result.percentage || 0
        )}%)
      </p>

      <div>

        ${(questions || [])
          .map(
            (row, index) => {
              const q =
                normalizeQuestion(
                  row
                );

              const answer =
                String(
                  answers[
                    q.id
                  ] || ""
                ).toUpperCase();

              const isCorrect =
                answer &&
                answer ===
                  q.correctAnswer;

              const state =
                !answer
                  ? "⚪ Hin deebifne"
                  : isCorrect
                  ? "✅ Sirrii"
                  : "❌ Dogoggora";

              const chosenText =
                answer
                  ? row[
                      `option_${answer.toLowerCase()}`
                    ]
                  : "";

              const correctText =
                row[
                  `option_${q.correctAnswer.toLowerCase()}`
                ] || "";

              return `
                <div
                  style="padding:10px 0;border-bottom:1px solid rgba(0,0,0,.08)"
                >

                  <strong>
                    ${index + 1}.
                    ${escapeHtml(
                      q.text
                    )}
                  </strong>

                  <br>

                  <span>
                    ${state}
                  </span>

                  <br>

                  <small>
                    Deebii barataa:
                    ${
                      answer
                        ? `${escapeHtml(
                            answer
                          )}. ${escapeHtml(
                            chosenText ||
                              ""
                          )}`
                        : "Hin deebifne"
                    }
                  </small>

                  <br>

                  <small>
                    Deebii sirrii:
                    ${escapeHtml(
                      q.correctAnswer
                    )}.
                    ${escapeHtml(
                      correctText
                    )}
                  </small>

                </div>
              `;
            }
          )
          .join("")}

      </div>
    </div>
  `;
}

/* =========================================================
   ADMIN - LESSONS
========================================================= */

async function loadAdminLessons() {
  if (!requireAdmin()) return;

  const container =
    document.getElementById(
      "adminLessonsList"
    );

  if (!container) return;

  const { data, error } =
    await db
      .from("lessons")
      .select("*")
      .order("created_at", {
        ascending: false
      });

  if (error) {
    container.innerHTML =
      `<div class="empty-state">❌ Barnoota fe'uu hin dandeenye.</div>`;
    return;
  }

  if (!data?.length) {
    container.innerHTML =
      `<div class="empty-state">📚 Barnoonni hin jiru.</div>`;
    return;
  }

  container.innerHTML = data
    .map(
      (lesson) => `
    <div class="admin-list-item">

      <div class="item-main">

        <h3>
          ${escapeHtml(
            lesson.title
          )}
        </h3>

        <p>
          ${escapeHtml(
            truncate(
              lesson.content,
              180
            )
          )}
        </p>

      </div>

      <div class="admin-actions">

        <button
          type="button"
          class="small-btn"
          onclick="editLesson('${lesson.id}')"
        >
          ✏️ Sirreessi
        </button>

        <button
          type="button"
          class="danger-small-btn"
          onclick="deleteLesson('${lesson.id}')"
        >
          🗑️ Haqi
        </button>

      </div>

    </div>
  `
    )
    .join("");
}

async function createLesson() {
  if (!requireAdmin()) return;

  const title =
    document.getElementById(
      "lessonTitleInput"
    )?.value.trim() || "";

  const content =
    document.getElementById(
      "lessonContentInput"
    )?.value.trim() || "";

  if (!title || !content) {
    alert(
      "Mata-duree fi qabiyyee barnootaa lamaan galchi."
    );
    return;
  }

  const { error } =
    await db
      .from("lessons")
      .insert({
        title,
        content
      });

  if (error) {
    alert(
      getErrorMessage(error)
    );
    return;
  }

  document.getElementById(
    "lessonTitleInput"
  ).value = "";

  document.getElementById(
    "lessonContentInput"
  ).value = "";

  await loadAdminLessons();
  await loadStudentLessons();

  alert(
    "Barnoonni dabalameera."
  );
}

async function editLesson(
  lessonId
) {
  if (!requireAdmin()) return;

  const {
    data: lesson,
    error
  } = await db
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .maybeSingle();

  if (error || !lesson) return;

  const title =
    prompt(
      "Mata-duree haaraa:",
      lesson.title
    );

  if (title === null) return;

  const content =
    prompt(
      "Qabiyyee haaraa:",
      lesson.content
    );

  if (content === null) return;

  const {
    error: updateError
  } = await db
    .from("lessons")
    .update({
      title:
        title.trim() ||
        lesson.title,

      content:
        content.trim() ||
        lesson.content
    })
    .eq("id", lessonId);

  if (updateError) {
    alert(
      getErrorMessage(
        updateError
      )
    );
    return;
  }

  await loadAdminLessons();
  await loadStudentLessons();
}

async function deleteLesson(
  lessonId
) {
  if (!requireAdmin()) return;

  if (
    !confirm(
      "Barnoota kana haquuf mirkaneessi."
    )
  ) {
    return;
  }

  const { error } =
    await db
      .from("lessons")
      .delete()
      .eq("id", lessonId);

  if (error) {
    alert(
      getErrorMessage(error)
    );
    return;
  }

  await loadAdminLessons();
  await loadStudentLessons();
}

/* =========================================================
   ADMIN - EXAMS
========================================================= */

async function loadAdminExams() {
  if (!requireAdmin()) return;

  const container =
    document.getElementById(
      "adminExamsList"
    );

  if (!container) return;

  const { data, error } =
    await db
      .from("exams")
      .select("*")
      .order("created_at", {
        ascending: false
      });

  if (error) {
    container.innerHTML =
      `<div class="empty-state">❌ Qormaata fe'uu hin dandeenye.</div>`;
    return;
  }

  if (!data?.length) {
    container.innerHTML =
      `<div class="empty-state">📝 Qormaanni hin jiru.</div>`;

    await populateExamSelects([]);

    return;
  }

  const exams =
    data.map(normalizeExam);

  const counts = {};

  const {
    data: questionRows
  } = await db
    .from("questions")
    .select(
      "id,exam_id"
    );

  (questionRows || [])
    .forEach((q) => {
      counts[q.exam_id] =
        (counts[q.exam_id] ||
          0) + 1;
    });

  container.innerHTML =
    exams
      .map(
        (exam) => `
    <div class="admin-list-item exam-admin-item">

      <div class="item-main">

        <h3>
          ${escapeHtml(
            exam.title
          )}
          ${
            exam.isFinal
              ? " 🏆"
              : ""
          }
        </h3>

        <p>
          ${escapeHtml(
            exam.description ||
              ""
          )}
        </p>

        <div class="exam-meta">

          <span>
            ❓ Gaaffii:
            ${counts[exam.id] || 0}
          </span>

          <span>
            🔢 Attempt:
            ${exam.attemptLimit}
          </span>

          <span>
            ⏱️
            ${exam.duration}
            min
          </span>

        </div>

        <span class="status ${
          exam.status === "active"
            ? "active"
            : "blocked"
        }">

          ● ${
            exam.status === "active"
              ? "Active"
              : "Disabled"
          }

        </span>

      </div>

      <div class="admin-actions">

        <button
          type="button"
          class="small-btn"
          onclick="toggleExamStatus(${exam.id})"
        >
          ${
            exam.status ===
            "active"
              ? "⏸️ Cufi"
              : "▶️ Bani"
          }
        </button>

        <button
          type="button"
          class="small-btn"
          onclick="editExam(${exam.id})"
        >
          ✏️ Sirreessi
        </button>

        <button
          type="button"
          class="danger-small-btn"
          onclick="deleteExam(${exam.id})"
        >
          🗑️ Haqi
        </button>

      </div>

    </div>
  `
      )
      .join("");

  await populateExamSelects(
    exams
  );

  await loadAdminQuestions();
}

async function populateExamSelects(
  exams = null
) {
  let list = exams;

  if (!list) {
    const { data } =
      await db
        .from("exams")
        .select("id,title")
        .order("created_at", {
          ascending: false
        });

    list = data || [];
  }

  [
    "questionExamSelect",
    "aiQuestionExamSelect"
  ].forEach((id) => {
    const select =
      document.getElementById(id);

    if (!select) return;

    const current =
      select.value;

    select.innerHTML = `
      <option value="">
        Qormaata filadhu
      </option>

      ${list
        .map(
          (exam) =>
            `<option value="${exam.id}">
              ${escapeHtml(
                exam.title
              )}
            </option>`
        )
        .join("")}
    `;

    if (
      list.some(
        (exam) =>
          String(exam.id) ===
          String(current)
      )
    ) {
      select.value =
        current;
    }
  });
}

async function createExam() {
  if (!requireAdmin()) return;

  const title =
    document.getElementById(
      "examTitleInput"
    )?.value.trim() || "";

  const description =
    document.getElementById(
      "examDescriptionInput"
    )?.value.trim() || "";

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

  const isFinal =
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
    )?.value || null;

  const endDate =
    document.getElementById(
      "examEndDateInput"
    )?.value || null;

  const startTime =
    document.getElementById(
      "examStartTimeInput"
    )?.value || null;

  const endTime =
    document.getElementById(
      "examEndTimeInput"
    )?.value || null;

  if (!title) {
    alert(
      "Mata-duree qormaataa galchi."
    );
    return;
  }

  if (
    startDate &&
    endDate &&
    startDate > endDate
  ) {
    alert(
      "Guyyaan jalqabaa guyyaa xumuraa caaluu hin qabu."
    );
    return;
  }

  const { error } =
    await db
      .from("exams")
      .insert({
        title,
        description,
        question_limit:
          questionLimit,
        attempt_limit:
          attemptLimit,
        is_final:
          isFinal,
        duration_minutes:
          duration,
        start_date:
          startDate,
        end_date:
          endDate,
        start_time:
          startTime,
        end_time:
          endTime,
        status: "active"
      });

  if (error) {
    alert(
      getErrorMessage(error)
    );
    return;
  }

  [
    "examTitleInput",
    "examDescriptionInput",
    "examStartDateInput",
    "examEndDateInput",
    "examStartTimeInput",
    "examEndTimeInput"
  ].forEach((id) => {
    const el =
      document.getElementById(id);

    if (el) el.value = "";
  });

  await loadAdminExams();

  alert(
    "Qormaanni uumameera. Amma gaaffii itti dabali."
  );
}

async function toggleExamStatus(
  examId
) {
  if (!requireAdmin()) return;

  const {
    data: exam,
    error: findError
  } = await db
    .from("exams")
    .select("id,status")
    .eq("id", examId)
    .maybeSingle();

  if (findError || !exam)
    return;

  const { error } =
    await db
      .from("exams")
      .update({
        status:
          exam.status ===
          "active"
            ? "disabled"
            : "active"
      })
      .eq("id", examId);

  if (error) {
    alert(
      getErrorMessage(error)
    );
    return;
  }

  await loadAdminExams();
}

async function editExam(
  examId
) {
  if (!requireAdmin()) return;

  const {
    data: exam,
    error
  } = await db
    .from("exams")
    .select("*")
    .eq("id", examId)
    .maybeSingle();

  if (error || !exam) return;

  const title =
    prompt(
      "Mata-duree:",
      exam.title
    );

  if (title === null) return;

  const description =
    prompt(
      "Ibsa:",
      exam.description || ""
    );

  if (description === null)
    return;

  const {
    error: updateError
  } = await db
    .from("exams")
    .update({
      title:
        title.trim() ||
        exam.title,

      description:
        description.trim()
    })
    .eq("id", examId);

  if (updateError) {
    alert(
      getErrorMessage(
        updateError
      )
    );
    return;
  }

  await loadAdminExams();
}

async function deleteExam(
  examId
) {
  if (!requireAdmin()) return;

  const { data: exam } =
    await db
      .from("exams")
      .select(
        "id,title"
      )
      .eq("id", examId)
      .maybeSingle();

  if (!exam) return;

  if (
    !confirm(
      `Qormaata "${exam.title}" fi gaaffilee isaa haquuf mirkaneessi.`
    )
  ) {
    return;
  }

  await db
    .from("results")
    .delete()
    .eq(
      "exam_id",
      examId
    );

  await db
    .from("exam_attempts")
    .delete()
    .eq(
      "exam_id",
      examId
    );

  await db
    .from("questions")
    .delete()
    .eq(
      "exam_id",
      examId
    );

  const { error } =
    await db
      .from("exams")
      .delete()
      .eq("id", examId);

  if (error) {
    alert(
      getErrorMessage(error)
    );
    return;
  }

  await loadAdminExams();
  await loadAdminResults();
}

/* =========================================================
   ADMIN - MANUAL QUESTIONS
========================================================= */

async function createQuestion() {
  if (!requireAdmin()) return;

  const examId =
    document.getElementById(
      "questionExamSelect"
    )?.value || "";

  const question =
    document.getElementById(
      "questionTextInput"
    )?.value.trim() || "";

  const optionA =
    document.getElementById(
      "optionAInput"
    )?.value.trim() || "";

  const optionB =
    document.getElementById(
      "optionBInput"
    )?.value.trim() || "";

  const optionC =
    document.getElementById(
      "optionCInput"
    )?.value.trim() || "";

  const optionD =
    document.getElementById(
      "optionDInput"
    )?.value.trim() || "";

  const correctAnswer =
    document.getElementById(
      "correctAnswerInput"
    )?.value || "";

  if (
    !examId ||
    !question ||
    !optionA ||
    !optionB ||
    !optionC ||
    !optionD ||
    !correctAnswer
  ) {
    alert(
      "Qormaata, gaaffii, A-D fi deebii sirrii hunda guuti."
    );
    return;
  }

  const { error } =
    await db
      .from("questions")
      .insert({
        exam_id: examId,
        question,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        correct_answer:
          correctAnswer,
        source_type:
          "admin",
        source_text:
          null
      });

  if (error) {
    alert(
      getErrorMessage(error)
    );
    return;
  }

  [
    "questionTextInput",
    "optionAInput",
    "optionBInput",
    "optionCInput",
    "optionDInput"
  ].forEach((id) => {
    const el =
      document.getElementById(id);

    if (el) el.value = "";
  });

  document.getElementById(
    "correctAnswerInput"
  ).value = "";

  await loadAdminQuestions();
  await loadAdminExams();

  alert(
    "Gaaffiin dabalameera."
  );
}

async function loadAdminQuestions() {
  if (!requireAdmin()) return;

  const container =
    document.getElementById(
      "adminQuestionsList"
    );

  if (!container) return;

  const { data, error } =
    await db
      .from("questions")
      .select(
        "*, exams(title)"
      )
      .order("id", {
        ascending: false
      });

  if (error) {
    container.innerHTML =
      `<div class="empty-state">❌ Gaaffilee fe'uu hin dandeenye.</div>`;

    console.error(error);
    return;
  }

  if (!data?.length) {
    container.innerHTML =
      `<div class="empty-state">❓ Gaaffiin hin jiru.</div>`;

    return;
  }

  container.innerHTML =
    data
      .map(
        (row, index) => {
          const question =
            normalizeQuestion(
              row
            );

          return `
            <div class="question-admin-item">

              <div class="question-number">
                ${index + 1}
              </div>

              <div class="item-main">

                <small>
                  ${escapeHtml(
                    row.exams?.title ||
                      "Qormaata"
                  )}
                </small>

                <h3>
                  ${escapeHtml(
                    question.text
                  )}
                </h3>

                <div class="options-preview">

                  <span>
                    A.
                    ${escapeHtml(
                      question.optionA
                    )}
                  </span>

                  <span>
                    B.
                    ${escapeHtml(
                      question.optionB
                    )}
                  </span>

                  <span>
                    C.
                    ${escapeHtml(
                      question.optionC
                    )}
                  </span>

                  <span>
                    D.
                    ${escapeHtml(
                      question.optionD
                    )}
                  </span>

                </div>

                <p class="correct-answer">
                  Deebii sirrii:
                  ${escapeHtml(
                    question.correctAnswer
                  )}
                </p>

              </div>

              <button
                type="button"
                class="danger-small-btn"
                onclick="deleteQuestion(${question.id})"
              >
                🗑️
              </button>

            </div>
          `;
        }
      )
      .join("");
}

async function deleteQuestion(
  questionId
) {
  if (!requireAdmin()) return;

  if (
    !confirm(
      "Gaaffii kana haquuf mirkaneessi."
    )
  ) {
    return;
  }

  const { error } =
    await db
      .from("questions")
      .delete()
      .eq(
        "id",
        questionId
      );

  if (error) {
    alert(
      getErrorMessage(error)
    );
    return;
  }

  await loadAdminQuestions();
  await loadAdminExams();
}

/* =========================================================
   AI QUESTION GENERATOR
========================================================= */

function changeAIQuestionSource() {
  const type =
    document.getElementById(
      "aiQuestionSourceType"
    )?.value || "topic";

  const map = {
    topic: "aiTopicSource",
    text: "aiTextSource",
    pdf: "aiPdfSource",
    image: "aiImageSource"
  };

  Object.values(map).forEach(
    (id) => {
      const el =
        document.getElementById(id);

      if (el) {
        el.style.display =
          "none";
      }
    }
  );

  const selected =
    document.getElementById(
      map[type]
    );

  if (selected) {
    selected.style.display =
      "block";
  }
}

function fileToBase64(
  file
) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        const result =
          String(
            reader.result || ""
          );

        const comma =
          result.indexOf(",");

        resolve(
          comma >= 0
            ? result.slice(
                comma + 1
              )
            : result
        );
      };

      reader.onerror =
        reject;

      reader.readAsDataURL(
        file
      );
    }
  );
}

async function generateAIQuestions() {
  if (!requireAdmin()) return;

  const examId =
    document.getElementById(
      "aiQuestionExamSelect"
    )?.value || "";

  const sourceType =
    document.getElementById(
      "aiQuestionSourceType"
    )?.value || "topic";

  const count =
    Number(
      document.getElementById(
        "aiQuestionCount"
      )?.value || 5
    );

  const button =
    document.getElementById(
      "generateAIQuestionsButton"
    );

  if (!examId) {
    showAIMessage(
      "❌ Qormaata filadhu.",
      "error"
    );
    return;
  }

  if (
    ![
      5,
      10,
      20,
      30,
      40,
      50,
      75,
      100
    ].includes(count)
  ) {
    showAIMessage(
      "❌ Lakkoofsa gaaffii sirrii filadhu.",
      "error"
    );
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent =
      "⏳ AI qopheessaa jira...";
  }

  try {
    const body = {
      exam_id: Number(examId),
      source_type: sourceType,
      count
    };

    if (sourceType === "topic") {
      const topic =
        document.getElementById(
          "aiTopicInput"
        )?.value.trim() || "";

      if (!topic) {
        throw new Error(
          "Mata-duree galchi."
        );
      }

      body.topic = topic;
    }

    if (sourceType === "text") {
      const sourceText =
        document.getElementById(
          "aiTextInput"
        )?.value.trim() || "";

      if (!sourceText) {
        throw new Error(
          "Barreeffama galchi."
        );
      }

      body.source_text =
        sourceText;
    }

    if (sourceType === "pdf") {
      const file =
        document.getElementById(
          "aiPdfInput"
        )?.files?.[0];

      if (!file) {
        throw new Error(
          "PDF filadhu."
        );
      }

      if (
        file.size >
        50 * 1024 * 1024
      ) {
        throw new Error(
          "PDF'n 50 MB ol ta'uu hin qabu."
        );
      }

      body.file_name =
        file.name;

      body.file_mime_type =
        file.type ||
        "application/pdf";

      body.file_base64 =
        await fileToBase64(
          file
        );
    }

    if (sourceType === "image") {
      const file =
        document.getElementById(
          "aiImageInput"
        )?.files?.[0];

      if (!file) {
        throw new Error(
          "Suuraa filadhu."
        );
      }

      if (
        file.size >
        15 * 1024 * 1024
      ) {
        throw new Error(
          "Suuraan 15 MB ol ta'uu hin qabu."
        );
      }

      body.file_name =
        file.name;

      body.file_mime_type =
        file.type ||
        "image/jpeg";

      body.file_base64 =
        await fileToBase64(
          file
        );
    }

    showAIMessage(
      "⏳ Gaaffilee AI irraa qopheessaa jira...",
      "info"
    );

    const response =
      await fetch(
        AI_FUNCTION_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            apikey:
              SUPABASE_ANON_KEY
          },

          body:
            JSON.stringify(body)
        }
      );

    let result = null;

    try {
      result =
        await response.json();
    } catch (_) {
      result = null;
    }

    if (!response.ok) {
      throw new Error(
        result?.error ||
          result?.message ||
          `AI server error: ${response.status}`
      );
    }

    const inserted =
      Number(
        result?.count ||
          result?.questions
            ?.length ||
          0
      );

    if (!inserted) {
      throw new Error(
        "AI gaaffii tokko illee hin galchine."
      );
    }

    showAIMessage(
      `<div class="success-box">✅ ${inserted} gaaffii AI irraa qormaata keessa galchame.</div>`,
      "success"
    );

    await loadAdminQuestions();
    await loadAdminExams();

  } catch (error) {
    console.error(
      "AI ERROR:",
      error
    );

    showAIMessage(
      `❌ ${escapeHtml(
        getErrorMessage(error)
      )}`,
      "error"
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        "🤖 Gaaffii AI Uumi";
    }
  }
}

/* =========================================================
   GOOGLE LOGIN
========================================================= */

async function googleLogin() {
  try {
    const { error } =
      await db.auth.signInWithOAuth({
        provider: "google",

        options: {
          redirectTo:
            window.location.origin +
            window.location.pathname,

          scopes:
            "email profile"
        }
      });

    if (error) {
      console.error(
        "GOOGLE LOGIN ERROR:",
        error
      );

      alert(
        "Google Login irratti dogoggorri uumame: " +
          getErrorMessage(error)
      );
    }

  } catch (error) {
    console.error(
      "GOOGLE LOGIN ERROR:",
      error
    );

    alert(
      "Google Login hin milkoofne: " +
        getErrorMessage(error)
    );
  }
}

async function findOrCreateGoogleStudent(
  user
) {
  const userId = user.id;

  const email =
    String(
      user.email || ""
    ).toLowerCase();

  const metadata =
    user.user_metadata ||
    {};

  const googleName =
    metadata.full_name ||
    metadata.name ||
    metadata.user_name ||
    email.split("@")[0] ||
    "Barataa Google";

  const {
    data: existing,
    error: findError
  } = await db
    .from("students")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (
    findError &&
    findError.code !==
      "PGRST116"
  ) {
    throw findError;
  }

  if (existing) {
    return existing;
  }

  let studentCode =
    generateStudentCode();

  let activationCode =
    generateActivationCode();

  for (
    let i = 0;
    i < 30;
    i++
  ) {
    const {
      data: duplicate,
      error: duplicateError
    } = await db
      .from("students")
      .select("id")
      .or(
        `student_code.eq.${studentCode},activation_code.eq.${activationCode}`
      )
      .limit(1);

    if (duplicateError) {
      throw duplicateError;
    }

    if (!duplicate?.length) {
      break;
    }

    studentCode =
      generateStudentCode();

    activationCode =
      generateActivationCode();
  }

  /*
    UPSERT + ignoreDuplicates:
    Google callback yeroo tokko ol yoo dhufe,
    students.id irratti duplicate key hin uumamu.
  */
  const {
    data: created,
    error: insertError
  } = await db
    .from("students")
    .upsert(
      {
        id: userId,
        student_code:
          studentCode,
        activation_code:
          activationCode,
        name:
          googleName,
        status:
          "pending"
      },
      {
        onConflict:
          "id",
        ignoreDuplicates:
          true
      }
    )
    .select()
    .maybeSingle();

  if (insertError) {
    console.error(
      "GOOGLE STUDENT UPSERT ERROR:",
      insertError
    );

    throw insertError;
  }

  if (created) {
    return created;
  }

  /*
    Callback lama wal fakkaataan yeroo tokko keessatti
    dhufnaan row inni jalqabaa uumame deebi'ee fudhatama.
  */
  const {
    data: racedStudent,
    error: racedError
  } = await db
    .from("students")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (racedError) {
    throw racedError;
  }

  if (racedStudent) {
    return racedStudent;
  }

  throw new Error(
    "Google student galmeessuu hin dandeenye."
  );
}

async function handleAuthSession(
  session
) {
  if (!session?.user) return;

  const user =
    session.user;

  const email =
    String(
      user.email || ""
    ).toLowerCase();

  /*
    ONLY these two Google accounts
    become admin.
  */
  if (
    ADMIN_GOOGLE_EMAILS.includes(
      email
    )
  ) {
    currentAdmin = {
      id: user.id,
      username: email,
      email,
      name:
        user.user_metadata
          ?.full_name ||
        email
    };

    localStorage.setItem(
      "ao_admin_google_id",
      user.id
    );

    localStorage.setItem(
      "ao_admin_google_email",
      email
    );

    localStorage.removeItem(
      "ao_student_id"
    );

    showPage("adminPage");

    await initializeAdmin();

    return;
  }

  try {
    const student =
      await findOrCreateGoogleStudent(
        user
      );

    currentStudent =
      student;

    if (
      student.status !==
      "active"
    ) {
      localStorage.removeItem(
        "ao_student_id"
      );

      showPublicLoginPage();

      alert(
        `Google Login milkaa'e. Garuu account kee adminiin mirkaneessuu qaba.\n\nStudent ID: ${student.student_code}`
      );

      return;
    }

    localStorage.setItem(
      "ao_student_id",
      String(student.id)
    );

    localStorage.removeItem(
      "ao_admin_google_id"
    );

    localStorage.removeItem(
      "ao_admin_google_email"
    );

    showPage(
      "studentHomePage"
    );

    await loadStudentHome();

  } catch (error) {
    console.error(
      "GOOGLE SESSION ERROR:",
      error
    );

    showPublicLoginPage();

    alert(
      "Google Login booda app keessatti dogoggorri uumame: " +
        getErrorMessage(error)
    );
  }
}

/* =========================================================
   TELEGRAM LOGIN
========================================================= */

async function telegramLogin() {
  alert(
    "Telegram Login ammallee qindaa'aa jira. Google Loginiin erga seentee booda Barataa ykn Admin filachuu dandeessa."
  );
}

/* =========================================================
   REFRESH
========================================================= */

async function refreshAllAdminLists() {
  await loadAdminStudents();
  await loadAdminResults();
  await loadAdminLessons();
  await loadAdminExams();
  await loadAdminQuestions();
}

/* =========================================================
   AUTH STATE
========================================================= */

function initializeAuthListener() {
  if (authListenerReady) return;

  authListenerReady = true;

  db.auth.onAuthStateChange(
    async (_event, session) => {
      await handleAuthSession(
        session
      );
    }
  );
}

/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeApp() {
  initializeAuthListener();
  changeAIQuestionSource();

  try {
    const {
      data: sessionData
    } = await db.auth.getSession();

    if (
      sessionData?.session
        ?.user
    ) {
      await handleAuthSession(
        sessionData.session
      );

      return;
    }

  } catch (error) {
    console.error(
      "AUTH SESSION ERROR:",
      error
    );
  }

  const student =
    await restoreStudent();

  if (student) {
    showPage(
      "studentHomePage"
    );

    await loadStudentHome();

    return;
  }

  const admin =
    await restoreAdmin();

  if (admin) {
    showPage("adminPage");

    await initializeAdmin();

    return;
  }

  showPublicLoginPage();
}

/* =========================================================
   INLINE HTML FUNCTIONS
========================================================= */

window.showPage =
  showPage;

window.openStudentLogin =
  openStudentLogin;

window.openAdminLogin =
  openAdminLogin;

window.setupPostLoginRoleNav =
  setupPostLoginRoleNav;

window.showPublicLoginPage =
  showPublicLoginPage;

window.showPostLoginRoles =
  showPostLoginRoles;

window.studentRegister =
  studentRegister;

window.studentLogin =
  studentLogin;

window.loadStudentHome =
  loadStudentHome;

window.loadExams =
  loadExams;

window.startExam =
  startExam;

window.selectAnswer =
  selectAnswer;

window.nextQuestion =
  nextQuestion;

window.requestSubmitExam =
  requestSubmitExam;

window.confirmSubmitExam =
  confirmSubmitExam;

window.showScore =
  showScore;

window.showResultDetails =
  showResultDetails;

window.loadProfile =
  loadProfile;

window.saveProfile =
  saveProfile;

window.studentLogout =
  studentLogout;

window.openLesson =
  openLesson;

window.adminLogin =
  adminLogin;

window.adminLogout =
  adminLogout;

window.openAdminPanel =
  openAdminPanel;

window.toggleStudentStatus =
  toggleStudentStatus;

window.deleteStudent =
  deleteStudent;

window.createLesson =
  createLesson;

window.editLesson =
  editLesson;

window.deleteLesson =
  deleteLesson;

window.createExam =
  createExam;

window.toggleExamStatus =
  toggleExamStatus;

window.editExam =
  editExam;

window.deleteExam =
  deleteExam;

window.createQuestion =
  createQuestion;

window.deleteQuestion =
  deleteQuestion;

window.changeAIQuestionSource =
  changeAIQuestionSource;

window.generateAIQuestions =
  generateAIQuestions;

window.googleLogin =
  googleLogin;

window.telegramLogin =
  telegramLogin;

/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);
