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
   Fuula jalqabaa irratti Google fi Telegram qofa.
   Erga login dhugaa booda Barataa/Admin bottom navigation
   keessatti mul'atu.
========================================================= */

function setupPostLoginRoleNav(authenticated = false) {
  const rolePage = document.getElementById("rolePage");
  if (!rolePage) return;

  const oldNav = document.getElementById("postLoginRoleNav");
  if (oldNav) oldNav.remove();

  rolePage.querySelectorAll('[onclick*="openStudentLogin"], [onclick*="openAdminLogin"]').forEach((el) => {
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
      .select("id,student_id,activation_code,name,status")
      .ilike("name", name)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      throw existingError;
    }

    if (existing) {
      showStudentMessage(
        `Maqaan kun duraan galmaa'eera. Student ID: ${existing.student_id}`,
        "error"
      );
      return;
    }

    let studentId = generateStudentCode();
    let activationCode = generateActivationCode();

    for (let i = 0; i < 10; i++) {
      const { data: duplicate } = await db
        .from("students")
        .select("id")
        .or(`student_id.eq.${studentId},activation_code.eq.${activationCode}`)
        .limit(1);

      if (!duplicate?.length) break;

      studentId = generateStudentCode();
      activationCode = generateActivationCode();
    }

    const { data: student, error } = await db
      .from("students")
      .insert({
        student_id: studentId,
        activation_code: activationCode,
        name,
        status: "pending"
      })
      .select()
      .single();

    if (error) throw error;

    alert(
      `Galmeen milkaa'e!\n\nMaqaa: ${student.name}\nStudent ID: ${student.student_id}\nActivation Code: ${student.activation_code}\n\nAdminiin erga si mirkaneessee booda seenuu dandeessa.`
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
      .eq("student_id", studentId)
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
    localStorage.setItem("ao_student_id", student.id);

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
    container.innerHTML = `<div class="empty-state">❌ Barnoota fe'uu hin dandeenye.</div>`;
    console.error(error);
    return;
  }

  if (!data?.length) {
    container.innerHTML = `<div class="empty-state">📚 Ammaaf barnoonni hin fe'amne.</div>`;
    return;
  }

  container.innerHTML = data.map((lesson) => `
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
  `).join("");
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
    content.innerHTML = `<div class="lesson-content">${formatText(data.content)}</div>`;
  }

  showPage("lessonDetailPage");
}

/* =========================================================
   STUDENT EXAMS
========================================================= */

function getExamWindowStatus(exam) {
  const now = new Date();

  if (exam.startDate) {
    const start = new Date(`${exam.startDate}T${exam.startTime || "00:00"}`);
    if (!Number.isNaN(start.getTime()) && now < start) {
      return { available: false, reason: "not_started", date: start };
    }
  }

  if (exam.endDate) {
    const end = new Date(`${exam.endDate}T${exam.endTime || "23:59:59"}`);
    if (!Number.isNaN(end.getTime()) && now > end) {
      return { available: false, reason: "ended", date: end };
    }
  }

  if (exam.status === "disabled") {
    return { available: false, reason: "disabled" };
  }

  return { available: true, reason: "available" };
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
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
    container.innerHTML = `<div class="empty-state">❌ Qormaata fe'uu hin dandeenye.</div>`;
    console.error(error);
    return;
  }

  if (!data?.length) {
    container.innerHTML = `<div class="empty-state">📝 Ammaaf qormaanni hin jiru.</div>`;
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
      action = `<span class="status blocked">${escapeHtml(text)}</span>`;
    } else if (attempts.length >= limit) {
      action = `<span class="status blocked">Attempt xumurame</span>`;
    } else {
      action = `
        <button type="button" class="small-btn" onclick="startExam(${exam.id})">
          Qormaata Jalqabi →
        </button>
      `;
    }

    cards.push(`
      <article class="exam-card">
        <div class="exam-badge">${exam.isFinal ? "🏆 FINAL" : "📝 EXAM"}</div>
        <h3>${escapeHtml(exam.title)}</h3>
        <p>${escapeHtml(exam.description || "")}</p>
        <div class="exam-meta">
          <span>❓ ${exam.questionLimit > 0 ? exam.questionLimit : "Hunda"}</span>
          <span>⏱️ ${exam.duration} daqiiqaa</span>
          <span>🔢 ${attempts.length}/${limit}</span>
        </div>
        <div class="exam-action">${action}</div>
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

  const completedAttempts = await getCompletedAttempts(exam.id, student.id);
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

  const questionLimit = Number(exam.questionLimit || 0);

  if (questionLimit > 0 && questions.length > questionLimit) {
    questions = questions.slice(0, questionLimit);
  }

  /* -------------------------------------------------------
     Attempt number
  ------------------------------------------------------- */

  const attemptNumber = completedAttempts.length + 1;

  /*
    Incomplete attempt duraan jiraachuu danda'a.
    Yoo jiraate, isa sana irra deebi'amee fayyadama.
    Kun duplicate key exam_attempts_unique_attempt
    akka hin uumamneef barbaachisaa dha.
  */

  const { data: existingAttempt, error: existingAttemptError } = await db
    .from("exam_attempts")
    .select("*")
    .eq("exam_id", exam.id)
    .eq("student_id", student.id)
    .eq("attempt_number", attemptNumber)
    .eq("completed", false)
    .maybeSingle();

  if (existingAttemptError) {
    console.error("EXISTING ATTEMPT ERROR:", existingAttemptError);
  }

  let attempt = existingAttempt;

  if (!attempt) {
    const { data: createdAttempt, error: attemptError } = await db
      .from("exam_attempts")
      .insert({
        student_id: student.id,
        exam_id: exam.id,
        attempt_number: attemptNumber,
        score: 0,
        total: questions.length,
        percentage: 0,
        started_at: new Date().toISOString(),
        completed: false
      })
      .select()
      .single();

    if (attemptError) {
      console.error("CREATE ATTEMPT ERROR:", attemptError);
      alert(
        "Qormaata jalqabuun hin danda'amne: " +
        getErrorMessage(attemptError)
      );
      return;
    }

    attempt = createdAttempt;
  }

  currentExam = exam;
  currentQuestions = questions;
  currentQuestionIndex = 0;
  currentAttempt = attempt;

  /*
    Deebii duraan qabame yoo jiraate deebisnee feena.
  */

  currentAnswers = {};

  try {
    const { data: savedAnswers, error: savedAnswersError } = await db
      .from("exam_attempt_answers")
      .select("*")
      .eq("attempt_id", attempt.id);

    if (!savedAnswersError && savedAnswers?.length) {
      savedAnswers.forEach((answer) => {
        if (answer.question_id != null) {
          currentAnswers[answer.question_id] =
            answer.selected_answer || "";
        }
      });
    }
  } catch (error) {
    /*
      exam_attempt_answers table yoo hin jirre,
      qormaanni akka hin cufamneef itti fufa.
    */
    console.warn("ANSWER RESTORE SKIPPED:", error);
  }

  showPage("examPage");

  renderCurrentQuestion();

  startExamTimer(exam.duration);

  await updateExamHeader();
}

/* =========================================================
   EXAM HEADER
========================================================= */

async function updateExamHeader() {
  if (!currentExam) return;

  const titleEl = document.getElementById("examTitle");
  const questionCountEl = document.getElementById("examQuestionCount");

  if (titleEl) {
    titleEl.textContent = currentExam.title;
  }

  if (questionCountEl) {
    questionCountEl.textContent =
      `${currentQuestionIndex + 1}/${currentQuestions.length}`;
  }
}

/* =========================================================
   TIMER
========================================================= */

function startExamTimer(durationMinutes) {
  stopExamTimer();

  examSecondsLeft = Math.max(
    1,
    Number(durationMinutes || 30) * 60
  );

  updateExamTimerDisplay();

  examTimer = setInterval(() => {
    examSecondsLeft--;

    updateExamTimerDisplay();

    if (examSecondsLeft <= 0) {
      stopExamTimer();

      alert(
        "⏰ Yeroon qormaataa xumurameera. Qormaanni ofumaan submit ta'a."
      );

      submitExam(true);
    }
  }, 1000);
}

function stopExamTimer() {
  if (examTimer) {
    clearInterval(examTimer);
    examTimer = null;
  }
}

function updateExamTimerDisplay() {
  const timerEl =
    document.getElementById("examTimer") ||
    document.getElementById("timer");

  if (!timerEl) return;

  const minutes = Math.floor(examSecondsLeft / 60);
  const seconds = examSecondsLeft % 60;

  timerEl.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  if (examSecondsLeft <= 60) {
    timerEl.classList.add("danger");
  } else {
    timerEl.classList.remove("danger");
  }
}

/* =========================================================
   RENDER CURRENT QUESTION
========================================================= */

function renderCurrentQuestion() {
  if (!currentExam || !currentQuestions.length) return;

  const question = currentQuestions[currentQuestionIndex];

  const questionNumberEl =
    document.getElementById("currentQuestionNumber");

  const questionTextEl =
    document.getElementById("currentQuestionText");

  const optionsContainer =
    document.getElementById("questionOptions");

  const nextButton =
    document.getElementById("nextQuestionButton");

  const submitButton =
    document.getElementById("submitExamButton");

  if (questionNumberEl) {
    questionNumberEl.textContent =
      `Gaaffii ${currentQuestionIndex + 1}`;
  }

  if (questionTextEl) {
    questionTextEl.textContent = question.text;
  }

  if (optionsContainer) {
    const selected =
      currentAnswers[question.id] || "";

    optionsContainer.innerHTML = `
      <label class="answer-option">
        <input
          type="radio"
          name="examAnswer"
          value="A"
          ${selected === "A" ? "checked" : ""}
          onchange="selectAnswer('A')"
        />
        <span>
          <strong>A.</strong>
          ${escapeHtml(question.optionA)}
        </span>
      </label>

      <label class="answer-option">
        <input
          type="radio"
          name="examAnswer"
          value="B"
          ${selected === "B" ? "checked" : ""}
          onchange="selectAnswer('B')"
        />
        <span>
          <strong>B.</strong>
          ${escapeHtml(question.optionB)}
        </span>
      </label>

      <label class="answer-option">
        <input
          type="radio"
          name="examAnswer"
          value="C"
          ${selected === "C" ? "checked" : ""}
          onchange="selectAnswer('C')"
        />
        <span>
          <strong>C.</strong>
          ${escapeHtml(question.optionC)}
        </span>
      </label>

      <label class="answer-option">
        <input
          type="radio"
          name="examAnswer"
          value="D"
          ${selected === "D" ? "checked" : ""}
          onchange="selectAnswer('D')"
        />
        <span>
          <strong>D.</strong>
          ${escapeHtml(question.optionD)}
        </span>
      </label>
    `;
  }

  if (nextButton) {
    nextButton.style.display =
      currentQuestionIndex < currentQuestions.length - 1
        ? "inline-flex"
        : "none";
  }

  if (submitButton) {
    submitButton.style.display =
      currentQuestionIndex === currentQuestions.length - 1
        ? "inline-flex"
        : "none";
  }

  updateExamHeader();
}

/* =========================================================
   SELECT ANSWER
========================================================= */

async function selectAnswer(answer) {
  if (!currentQuestions.length) return;

  const question = currentQuestions[currentQuestionIndex];

  currentAnswers[question.id] = String(answer || "").toUpperCase();

  /*
    Deebii battalum Supabase keessatti kaa'a.
    Table yoo hin jirre, local state qofa irratti itti fufa.
  */

  try {
    if (currentAttempt?.id) {
      const selectedAnswer = currentAnswers[question.id];
      const correctAnswer = question.correctAnswer;

      await db
        .from("exam_attempt_answers")
        .upsert(
          {
            attempt_id: currentAttempt.id,
            question_id: question.id,
            question_text: question.text,
            option_a: question.optionA,
            option_b: question.optionB,
            option_c: question.optionC,
            option_d: question.optionD,
            selected_answer: selectedAnswer,
            correct_answer: correctAnswer,
            is_correct: selectedAnswer === correctAnswer,
            answered_at: new Date().toISOString()
          },
          {
            onConflict: "attempt_id,question_id"
          }
        );
    }
  } catch (error) {
    console.warn("ANSWER SAVE ERROR:", error);
  }
}

/* =========================================================
   NEXT QUESTION
========================================================= */

function nextQuestion() {
  if (!currentQuestions.length) return;

  if (currentQuestionIndex >= currentQuestions.length - 1) {
    return;
  }

  currentQuestionIndex++;

  renderCurrentQuestion();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =========================================================
   SUBMIT WARNING
========================================================= */

function requestSubmitExam() {
  if (!currentExam || !currentQuestions.length) return;

  const unanswered = currentQuestions.filter(
    (question) => !currentAnswers[question.id]
  ).length;

  const message =
    unanswered > 0
      ? `⚠️ Gaaffii ${unanswered} hin deebifne.\n\nQormaata submit gochuu barbaaddaa?`
      : "⚠️ Gaaffii hunda xumurteettaa? Qormaata submit gochuu barbaaddaa?";

  /*
    Fuula confirmation yoo HTML keessatti jiraate fayyadama.
  */

  const confirmPage = document.getElementById("submitConfirmPage");

  if (confirmPage) {
    const textEl =
      document.getElementById("submitConfirmText");

    if (textEl) {
      textEl.textContent = message;
    }

    showPage("submitConfirmPage");
    return;
  }

  /*
    Fallback yoo confirmation page hin jirre.
  */

  if (confirm(message)) {
    submitExam(false);
  }
}

/* =========================================================
   CONFIRM SUBMIT
========================================================= */

function confirmSubmitExam() {
  submitExam(false);
}

/* =========================================================
   CANCEL SUBMIT
========================================================= */

function cancelSubmitExam() {
  showPage("examPage");
  renderCurrentQuestion();
}

/* =========================================================
   SUBMIT EXAM
========================================================= */

async function submitExam(autoSubmit = false) {
  if (!currentExam || !currentStudent || !currentAttempt) {
    return;
  }

  if (pendingSubmit) return;

  pendingSubmit = true;

  stopExamTimer();

  try {
    let correct = 0;

    currentQuestions.forEach((question) => {
      const selected =
        currentAnswers[question.id] || "";

      if (
        selected.toUpperCase() ===
        String(question.correctAnswer).toUpperCase()
      ) {
        correct++;
      }
    });

    const total = currentQuestions.length;

    const percentage =
      total > 0
        ? Math.round((correct / total) * 100)
        : 0;

    const submittedAt =
      new Date().toISOString();

    const { error: attemptUpdateError } = await db
      .from("exam_attempts")
      .update({
        score: correct,
        total,
        percentage,
        submitted_at: submittedAt,
        completed: true
      })
      .eq("id", currentAttempt.id);

    if (attemptUpdateError) {
      throw attemptUpdateError;
    }

    /*
      Old results table waliin compatibility eega.
    */

    const resultPayload = {
      student_id: currentStudent.id,
      exam_id: currentExam.id,
      correct,
      total,
      percentage,
      submitted_at: submittedAt,
      exam_title: currentExam.title
    };

    const { error: resultError } = await db
      .from("results")
      .insert(resultPayload);

    if (resultError) {
      console.warn("RESULT INSERT ERROR:", resultError);
    }

    /*
      Deebii hunda mirkaneeffanna.
      Yoo exam_attempt_answers table jiraate,
      selected answers hunda keessa kaa'ama.
    */

    try {
      const answerRows = currentQuestions.map((question) => {
        const selected =
          currentAnswers[question.id] || "";

        return {
          attempt_id: currentAttempt.id,
          question_id: question.id,
          question_text: question.text,
          option_a: question.optionA,
          option_b: question.optionB,
          option_c: question.optionC,
          option_d: question.optionD,
          selected_answer: selected,
          correct_answer: question.correctAnswer,
          is_correct:
            selected.toUpperCase() ===
            String(question.correctAnswer).toUpperCase(),
          answered_at: submittedAt
        };
      });

      if (answerRows.length) {
        await db
          .from("exam_attempt_answers")
          .upsert(answerRows, {
            onConflict: "attempt_id,question_id"
          });
      }
    } catch (error) {
      console.warn("ANSWER FINAL SAVE ERROR:", error);
    }

    pendingSubmit = false;

    currentAttempt = {
      ...currentAttempt,
      score: correct,
      total,
      percentage,
      completed: true,
      submitted_at: submittedAt
    };

    showPage("scorePage");

    await showScore({
      correct,
      total,
      percentage,
      autoSubmit
    });
  } catch (error) {
    console.error("SUBMIT EXAM ERROR:", error);

    pendingSubmit = false;

    alert(
      "Qormaata submit gochuun hin danda'amne: " +
      getErrorMessage(error)
    );

    showPage("examPage");
    renderCurrentQuestion();

    if (currentExam?.duration) {
      startExamTimer(
        Math.max(
          1,
          Math.ceil(examSecondsLeft / 60)
        )
      );
    }
  }
}

/* =========================================================
   SCORE PAGE
========================================================= */

async function showScore(scoreData = null) {
  const student = requireStudent();
  if (!student) return;

  let result = scoreData;

  if (!result && currentAttempt) {
    result = {
      correct: Number(currentAttempt.score || 0),
      total: Number(currentAttempt.total || 0),
      percentage: Number(currentAttempt.percentage || 0)
    };
  }

  if (!result) {
    return;
  }

  const correctEl =
    document.getElementById("scoreCorrect");

  const totalEl =
    document.getElementById("scoreTotal");

  const percentageEl =
    document.getElementById("scorePercentage");

  const titleEl =
    document.getElementById("scoreExamTitle");

  if (correctEl) {
    correctEl.textContent = result.correct;
  }

  if (totalEl) {
    totalEl.textContent = result.total;
  }

  if (percentageEl) {
    percentageEl.textContent =
      `${result.percentage}%`;
  }

  if (titleEl) {
    titleEl.textContent =
      currentExam?.title || "Qormaata";
  }

  await loadStudentResults();
}

/* =========================================================
   STUDENT RESULTS
========================================================= */

async function loadStudentResults() {
  if (!currentStudent) return;

  const container =
    document.getElementById("studentResults");

  if (!container) return;

  const { data, error } = await db
    .from("results")
    .select("*, exams(title)")
    .eq("student_id", currentStudent.id)
    .order("submitted_at", {
      ascending: false
    });

  if (error) {
    console.error("STUDENT RESULTS ERROR:", error);
    container.innerHTML =
      `<div class="empty-state">❌ Qabxii fe'uu hin dandeenye.</div>`;
    return;
  }

  if (!data?.length) {
    container.innerHTML =
      `<div class="empty-state">Qabxiin ammaaf hin jiru.</div>`;
    return;
  }

  container.innerHTML = data.map((result) => `
    <div class="result-card">
      <div>
        <h4>
          ${escapeHtml(
            result.exams?.title ||
            result.exam_title ||
            "Qormaata"
          )}
        </h4>
        <p>${formatDateTime(result.submitted_at)}</p>
      </div>

      <div class="result-score">
        <strong>
          ${Number(result.correct || 0)}/${Number(result.total || 0)}
        </strong>
        <span>
          ${Number(result.percentage || 0)}%
        </span>
      </div>
    </div>
  `).join("");
}

/* =========================================================
   PROFILE
========================================================= */

async function loadProfile() {
  const student = requireStudent();
  if (!student) return;

  const nameInput =
    document.getElementById("profileNameInput");

  const idEl =
    document.getElementById("profileStudentId");

  const codeEl =
    document.getElementById("profileActivationCode");

  const statusEl =
    document.getElementById("profileStatus");

  if (nameInput) {
    nameInput.value = student.name || "";
  }

  if (idEl) {
    idEl.textContent = student.student_id || "";
  }

  if (codeEl) {
    codeEl.textContent =
      student.activation_code || "";
  }

  if (statusEl) {
    statusEl.textContent =
      student.status || "";
  }

  await loadStudentAverage();
}

/* =========================================================
   STUDENT AVERAGE
========================================================= */

async function loadStudentAverage() {
  const student = requireStudent();
  if (!student) return;

  const { data, error } = await db
    .from("results")
    .select("percentage")
    .eq("student_id", student.id);

  if (error) {
    console.error("AVERAGE ERROR:", error);
    return;
  }

  const values = (data || [])
    .map((row) => Number(row.percentage || 0))
    .filter((value) => Number.isFinite(value));

  const average =
    values.length
      ? Math.round(
          values.reduce((a, b) => a + b, 0) /
          values.length
        )
      : 0;

  const averageEl =
    document.getElementById("profileAverage");

  if (averageEl) {
    averageEl.textContent = `${average}%`;
  }
}

/* =========================================================
   SAVE PROFILE
========================================================= */

async function saveProfile() {
  const student = requireStudent();
  if (!student) return;

  const name =
    document.getElementById("profileNameInput")
      ?.value.trim() || "";

  if (name.length < 2) {
    alert("Maqaa sirrii galchi.");
    return;
  }

  const { data, error } = await db
    .from("students")
    .update({
      name
    })
    .eq("id", student.id)
    .select()
    .single();

  if (error) {
    alert(getErrorMessage(error));
    return;
  }

  currentStudent = data;

  alert("Maqaan kee sirreeffameera.");

  await loadProfile();
  await loadStudentHome();
}

/* =========================================================
   STUDENT LOGOUT
========================================================= */

async function studentLogout() {
  stopExamTimer();

  currentStudent = null;
  currentExam = null;
  currentQuestions = [];
  currentAnswers = {};
  currentAttempt = null;

  localStorage.removeItem("ao_student_id");

  try {
    await db.auth.signOut();
  } catch (error) {
    console.warn("AUTH SIGNOUT:", error);
  }

  showPublicLoginPage();
}

/* =========================================================
   ADMIN LOGIN
========================================================= */

async function adminLogin() {
  const username =
    document.getElementById("adminUsername")
      ?.value.trim() || "";

  const password =
    document.getElementById("adminPassword")
      ?.value || "";

  if (!username || !password)
async function populateExamSelects(exams = null) {
  let list = exams;

  if (!list) {
    const { data } = await db
      .from("exams")
      .select("id,title")
      .order("created_at", { ascending: false });

    list = data || [];
  }

  ["questionExamSelect", "aiQuestionExamSelect"].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;

    const current = select.value;

    select.innerHTML = `
      <option value="">Qormaata filadhu</option>
      ${list
        .map(
          (exam) =>
            `<option value="${exam.id}">${escapeHtml(exam.title)}</option>`
        )
        .join("")}
    `;

    if (list.some((exam) => String(exam.id) === String(current))) {
      select.value = current;
    }
  });
}

async function createExam() {
  return createUnifiedExam();
}

/* =========================================================
   ADMIN - MANUAL QUESTIONS
   Old single-question function kept for compatibility.
========================================================= */

async function createQuestion() {
  if (!requireAdmin()) return;

  alert(
    "Gaaffilee hunda Qormaata Haaraa Uumi keessatti bakka tokkootti copy/paste godhi."
  );
}

async function loadAdminQuestions() {
  if (!requireAdmin()) return;

  const container = document.getElementById("adminQuestionsList");
  if (!container) return;

  const { data, error } = await db
    .from("questions")
    .select("*, exams(title)")
    .order("id", { ascending: false });

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

  container.innerHTML = data
    .map((row, index) => {
      const question = normalizeQuestion(row);

      return `
        <div class="question-admin-item">
          <div class="question-number">${index + 1}</div>

          <div class="item-main">
            <small>
              ${escapeHtml(row.exams?.title || "Qormaata")}
            </small>

            <h3>
              ${escapeHtml(question.text)}
            </h3>

            <div class="options-preview">
              <span>
                A. ${escapeHtml(question.optionA)}
              </span>

              <span>
                B. ${escapeHtml(question.optionB)}
              </span>

              <span>
                C. ${escapeHtml(question.optionC)}
              </span>

              <span>
                D. ${escapeHtml(question.optionD)}
              </span>
            </div>

            <p class="correct-answer">
              Deebii sirrii:
              ${escapeHtml(question.correctAnswer)}
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
    })
    .join("");
}

async function deleteQuestion(questionId) {
  if (!requireAdmin()) return;

  if (!confirm("Gaaffii kana haquuf mirkaneessi.")) {
    return;
  }

  const { error } = await db
    .from("questions")
    .delete()
    .eq("id", questionId);

  if (error) {
    alert(getErrorMessage(error));
    return;
  }

  await loadAdminQuestions();
  await loadAdminExams();
}

/* =========================================================
   ADMIN - DELETE WHOLE EXAM
   Qormaata + gaaffilee + attempts + results ni haqa.
========================================================= */

async function deleteExam(examId) {
  if (!requireAdmin()) return;

  const { data: exam, error: examError } = await db
    .from("exams")
    .select("id,title")
    .eq("id", examId)
    .maybeSingle();

  if (examError) {
    console.error(examError);
    alert(getErrorMessage(examError));
    return;
  }

  if (!exam) {
    alert("Qormaanni kun hin argamne.");
    return;
  }

  const confirmed = confirm(
    `Qormaata "${exam.title}" fi wantoota isaa hunda haquuf mirkaneessi.\n\n` +
    `• Maqaa qormaataa\n` +
    `• Gaaffilee\n` +
    `• Bu'aawwan\n` +
    `• Attemptwwan\n\n` +
    `Haqamuu isaa mirkaneessaa?`
  );

  if (!confirmed) {
    return;
  }

  /*
    Answer details yoo table'n jiraate,
    dura haqna. Yoo table'n hin jirre error isaa
    hojii delete qormaataa hin dhaabu.
  */
  try {
    await db
      .from("exam_attempt_answers")
      .delete()
      .in(
        "attempt_id",
        (
          await db
            .from("exam_attempts")
            .select("id")
            .eq("exam_id", examId)
        ).data?.map((row) => row.id) || []
      );
  } catch (error) {
    console.warn(
      "exam_attempt_answers delete skipped:",
      error
    );
  }

  /*
    Results haqna.
  */
  const { error: resultsError } = await db
    .from("results")
    .delete()
    .eq("exam_id", examId);

  if (resultsError) {
    console.warn(
      "Results delete warning:",
      resultsError
    );
  }

  /*
    Exam attempts haqna.
  */
  const { error: attemptsError } = await db
    .from("exam_attempts")
    .delete()
    .eq("exam_id", examId);

  if (attemptsError) {
    console.warn(
      "Attempts delete warning:",
      attemptsError
    );
  }

  /*
    Questions haqna.
  */
  const { error: questionsError } = await db
    .from("questions")
    .delete()
    .eq("exam_id", examId);

  if (questionsError) {
    alert(
      "Gaaffilee qormaataa haquun hin danda'amne: " +
        getErrorMessage(questionsError)
    );
    return;
  }

  /*
    Dhuma irratti exam mataa isaa haqna.
  */
  const { error: deleteExamError } = await db
    .from("exams")
    .delete()
    .eq("id", examId);

  if (deleteExamError) {
    alert(
      "Qormaata mataa isaa haquun hin danda'amne: " +
        getErrorMessage(deleteExamError)
    );
    return;
  }

  alert(
    `✅ Qormaata "${exam.title}" fi wantoonni isaa hundi haqamaniiru.`
  );

  await loadAdminExams();
  await loadAdminResults();
  await populateExamSelects();
}

/* =========================================================
   END OF PART 3
========================================================= */
/* =========================================================
   AI QUESTION GENERATOR
========================================================= */

function changeAIQuestionSource() {
  const type =
    document.getElementById("aiQuestionSourceType")?.value || "topic";

  const map = {
    topic: "aiTopicSource",
    text: "aiTextSource",
    pdf: "aiPdfSource",
    image: "aiImageSource"
  };

  Object.values(map).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const selected = document.getElementById(map[type]);

  if (selected) {
    selected.style.display = "block";
  }
}

async function generateAIQuestions() {
  if (!requireAdmin()) return;

  const examId =
    document.getElementById("aiQuestionExamSelect")?.value || "";

  const type =
    document.getElementById("aiQuestionSourceType")?.value || "topic";

  const count = Number(
    document.getElementById("aiQuestionCount")?.value || 5
  );

  if (!examId) {
    setMessage(
      "aiQuestionMessage",
      "Dura qormaata gaaffiin itti galuu filadhu.",
      "error"
    );
    return;
  }

  let source = "";

  if (type === "topic") {
    source =
      document.getElementById("aiTopicInput")?.value.trim() || "";
  }

  if (type === "text") {
    source =
      document.getElementById("aiTextInput")?.value.trim() || "";
  }

  if (type === "pdf") {
    const file =
      document.getElementById("aiPdfInput")?.files?.[0];

    source = file ? file.name : "";
  }

  if (type === "image") {
    const file =
      document.getElementById("aiImageInput")?.files?.[0];

    source = file ? file.name : "";
  }

  if (!source) {
    setMessage(
      "aiQuestionMessage",
      "Madda barnootaa guuti.",
      "error"
    );
    return;
  }

  setMessage(
    "aiQuestionMessage",
    "⏳ Gaaffii AI qopheessaa jira...",
    ""
  );

  /*
    Yoo backend AI jiraate itti fayyadama.
  */

  try {
    const response = await fetch(
      window.AI_FUNCTION_URL || "/api/generate-questions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          exam_id: examId,
          source_type: type,
          source,
          count
        })
      }
    );

    if (!response.ok) {
      throw new Error("AI API request failed");
    }

    const result = await response.json();

    const generated = result.questions || [];

    if (!generated.length) {
      throw new Error("Gaaffii AI hin argamne.");
    }

    const rows = generated.map((q) => ({
      exam_id: examId,
      question_text: q.question || q.text || "",
      option_a: q.option_a || q.optionA || "",
      option_b: q.option_b || q.optionB || "",
      option_c: q.option_c || q.optionC || "",
      option_d: q.option_d || q.optionD || "",
      correct_answer: String(
        q.correct_answer || q.correctAnswer || ""
      ).toUpperCase(),
      source_type: type,
      source_text: source
    }));

    const { error } = await db
      .from("questions")
      .insert(rows);

    if (error) {
      throw error;
    }

    setMessage(
      "aiQuestionMessage",
      `✅ Gaaffii ${rows.length} milkaa'inaan dabalameera.`,
      "success"
    );

    await loadAdminQuestions();
    await loadAdminExams();
  } catch (error) {
    console.error(error);

    setMessage(
      "aiQuestionMessage",
      "⚠️ AI question generator amma hin hojjenne. Gaaffii harkaan galchuu dandeessa.",
      "error"
    );
  }
}


/* =========================================================
   GOOGLE LOGIN
========================================================= */

async function googleLogin() {
  try {
    const { error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          window.location.origin +
          window.location.pathname
      }
    });

    if (error) {
      console.error(error);
      alert(
        "Google Login irratti rakkoon uumame:\n" +
          getErrorMessage(error)
      );
    }
  } catch (error) {
    console.error(error);

    alert(
      "Google Login hin milkoofne:\n" +
        getErrorMessage(error)
    );
  }
}


/* =========================================================
   GOOGLE AUTH SESSION
========================================================= */

async function handleAuthSession(session) {
  if (!session?.user) return;

  const user = session.user;

  const email =
    String(user.email || "")
      .trim()
      .toLowerCase();

  console.log(
    "Google user authenticated:",
    email || user.id
  );

  /*
    Admin Google accounts
  */

  const ADMIN_EMAILS = [
    "suufiyaanjeeylaanofficial@gmail.com",
    "seyfudin67@gmail.com"
  ];

  if (ADMIN_EMAILS.includes(email)) {
    setSession({
      type: "admin",
      authUserId: user.id,
      email,
      name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        email
    });

    showPage("adminDashboardPage");

    await initializeAdmin();

    return;
  }

  /*
    Student Google account.
    Existing student hin jiru taanaan record haaraa uuma.
  */

  let { data: student, error } = await db
    .from("students")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    alert(
      "Barataa Google irraa barbaaduun hin danda'amne:\n" +
        getErrorMessage(error)
    );
    return;
  }

  /*
    Yoo Google user kun duraan hin jirre,
    student_code haaraa uuma.
  */

  if (!student) {
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      email.split("@")[0] ||
      "Barataa";

    const studentCode =
      "ST-" +
      Math.floor(
        100000 +
          Math.random() * 900000
      );

    const { data: createdStudent, error: createError } =
      await db
        .from("students")
        .insert({
          id: user.id,
          student_code: studentCode,
          name: fullName,
          status: "pending"
        })
        .select("*")
        .single();

    /*
      Yoo yeroo wal fakkaataa keessatti
      record uumame, duplicate key hin dhaabu.
    */

    if (createError) {
      if (
        String(createError.code) === "23505" ||
        String(createError.message || "").includes(
          "duplicate key"
        )
      ) {
        const retry = await db
          .from("students")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (retry.error || !retry.data) {
          alert(
            "Student account argachuu hin dandeenye."
          );
          return;
        }

        student = retry.data;
      } else {
        console.error(createError);

        alert(
          "Student account uumuu hin dandeenye:\n" +
            getErrorMessage(createError)
        );

        return;
      }
    } else {
      student = createdStudent;
    }
  }

  /*
    Google account tokko = student record tokko.
    Kanaaf yeroo itti aanu ID fi qabxii isaa hin badu.
  */

  setSession({
    type: "student",
    authUserId: user.id,
    studentId: student.id,
    studentCode: student.student_code,
    name: student.name,
    status: student.status || "pending",
    email
  });

  if (student.status !== "active") {
    showPage("studentHomePage");

    const message =
      document.getElementById("studentHomeMessage");

    if (message) {
      message.textContent =
        "⏳ Galmeen kee admin'n akka mirkaneessu eeggachaa jira.";
    }

    return;
  }

  showPage("studentHomePage");

  await loadStudentHome();
}


/* =========================================================
   TELEGRAM LOGIN
========================================================= */

async function telegramLogin() {
  alert(
    "Telegram Login qindeessaa jirra. Google Login amma qophaa'eera."
  );
}


/* =========================================================
   REFRESH ADMIN
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

let authListenerReady = false;

function initializeAuthListener() {
  if (authListenerReady) return;

  authListenerReady = true;

  db.auth.onAuthStateChange(
    async (_event, session) => {
      await handleAuthSession(session);
    }
  );
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeApp() {
  initializeAuthListener();

  changeAIQuestionSource();

  const student = await restoreStudent();

  if (student) {
    showPage("studentHomePage");

    await loadStudentHome();

    return;
  }

  const admin = await restoreAdmin();

  if (admin) {
    showPage("adminDashboardPage");

    await initializeAdmin();

    return;
  }

  showPage("rolePage");
}


/* =========================================================
   INLINE HTML FUNCTIONS
========================================================= */

window.showPage = showPage;

window.openStudentLogin =
  openStudentLogin;

window.openAdminLogin =
  openAdminLogin;

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

window.loadProfile =
  loadProfile;

window.saveProfile =
  saveProfile;

window.studentLogout =
  studentLogout;

window.openLesson =
  openLesson;


/* ADMIN */

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

window.createUnifiedExam =
  createUnifiedExam;

window.previewUnifiedQuestions =
  previewUnifiedQuestions;

window.clearUnifiedExamForm =
  clearUnifiedExamForm;

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


/* AI */

window.changeAIQuestionSource =
  changeAIQuestionSource;

window.generateAIQuestions =
  generateAIQuestions;


/* LOGIN */

window.googleLogin =
  googleLogin;

window.telegramLogin =
  telegramLogin;


/* =========================================================
   START APP
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);
