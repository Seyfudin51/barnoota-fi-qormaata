"use strict";
const SUPABASE_URL = "https://xhkkaevhcqvkwabcsljm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8nBE4n2bQ1jRnEr_83FrdA_vSqqIpSz";
const AI_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/generate-ai-questions`;
let db = null;

function initSupabase() {
  if (db) return db;
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    return null;
  }
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return db;
}

function requireDb() {
  const client = initSupabase();
  if (!client) {
    throw new Error("Supabase hin fe'amne. Fuula haaromsiitii yaali.");
  }
  return client;
}

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
  showPage("studentLoginPage");
  const input = document.getElementById("nameInput");
  if (input) setTimeout(() => input.focus(), 100);
}

function openAdminLogin() {
  showPage("adminLoginPage");
  const input = document.getElementById("adminUsername");
  if (input) setTimeout(() => input.focus(), 100);
}

async function studentRegister() {
  const name = document.getElementById("nameInput")?.value.trim() || "";

  if (name.length < 2) {
    showStudentMessage("Maqaa kee guutuu sirriitti galchi.", "error");
    return;
  }

  try {
    const { data: existing, error: existingError } = await requireDb()
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
      const { data: duplicate } = await requireDb()
        .from("students")
        .select("id")
        .or(`student_id.eq.${studentId},activation_code.eq.${activationCode}`)
        .limit(1);

      if (!duplicate?.length) break;

      studentId = generateStudentCode();
      activationCode = generateActivationCode();
    }

    const { data: student, error } = await requireDb()
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
    const { data: student, error } = await requireDb()
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
    const { data, error } = await requireDb()
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

  const { data, error } = await requireDb()
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
  const { data, error } = await requireDb()
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
  const { data, error } = await requireDb()
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

  const { data, error } = await requireDb()
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
async function startExam(examId) {
  const student = requireStudent();
  if (!student) return;

  const { data: examRow, error: examError } = await requireDb()
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
        : "Qormaanni cufame."
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

  const { data: questionRows, error: questionError } =
    await requireDb()
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

  if (exam.questionLimit > 0) {
    questions = questions.slice(0, exam.questionLimit);
  }

  const attemptNumber = completedAttempts.length + 1;

  const { data: attempt, error: attemptError } =
    await requireDb()
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

  if (title) {
    title.textContent = exam.title;
  }

  examSecondsLeft = Math.max(1, exam.duration * 60);

  startExamTimer();
  renderCurrentQuestion();
  showPage("examPage");
}

function renderCurrentQuestion() {
  if (!currentExam || !currentQuestions.length) return;

  const question = currentQuestions[currentQuestionIndex];
  const total = currentQuestions.length;

  const number = document.getElementById("questionNumber");
  const text = document.getElementById("questionText");
  const container = document.getElementById("answersContainer");

  if (number) {
    number.textContent =
      ` ${currentQuestionIndex + 1}/${total}`;
  }

  if (text) {
    text.textContent = question.text;
  }

  if (!container) return;

  const selected = currentAnswers[question.id];

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
      <span><strong>${letter}.</strong> ${escapeHtml(value)}</span>
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
  const question = currentQuestions[currentQuestionIndex];

  if (!question) return;

  currentAnswers[question.id] = letter;

  const nextButton =
    document.getElementById("nextQuestionButton");

  const submitButton =
    document.getElementById("submitExamButton");

  if (nextButton) nextButton.disabled = false;
  if (submitButton) submitButton.disabled = false;
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

  const unanswered = currentQuestions.filter(
    (question) => !currentAnswers[question.id]
  ).length;

  const message =
    document.getElementById("submitWarningMessage");

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

async function finishExam() {
  const student = requireStudent();

  if (!student || !currentExam || !currentAttempt) {
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

  const percentage = total
    ? Math.round((correct / total) * 100)
    : 0;

  try {
    const { error: attemptError } =
      await requireDb()
        .from("exam_attempts")
        .update({
          score: correct,
          total,
          percentage,
          completed: true,
          submitted_at: new Date().toISOString()
        })
        .eq("id", currentAttempt.id);

    if (attemptError) throw attemptError;

    const resultPayload = {
      student_id: student.id,
      exam_id: currentExam.id,
      exam_title: currentExam.title,
      correct,
      total,
      percentage,
      answers: currentAnswers,
      submitted_at: new Date().toISOString()
    };

    const { data: oldResult } =
      await requireDb()
        .from("results")
        .select("id")
        .eq("student_id", student.id)
        .eq("exam_id", currentExam.id)
        .maybeSingle();

    if (oldResult?.id) {
      const { error } =
        await requireDb()
          .from("results")
          .update(resultPayload)
          .eq("id", oldResult.id);

      if (error) throw error;
    } else {
      const { error } =
        await requireDb()
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
    console.error("FINISH EXAM ERROR:", error);

    alert(
      "Qormaata submit gochuun hin milkoofne: " +
        getErrorMessage(error)
    );
  }
}

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
    document.getElementById("examTimerValue");

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

async function showScore() {
  const student = requireStudent();

  if (!student) return;

  const container =
    document.getElementById("studentScore");

  if (!container) return;

  const { data, error } =
    await requireDb()
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
        <h3>${escapeHtml(
          result.exam_title || "Qormaata"
        )}</h3>
        <p>${formatDateTime(
          result.submitted_at
        )}</p>
      </div>

      <div class="result-score">
        <strong>${Number(
          result.percentage || 0
        )}%</strong>

        <span>${Number(
          result.correct || 0
        )}/${Number(result.total || 0)}</span>
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
    document.getElementById("profileNameInput");

  const code =
    document.getElementById("profileCode");

  const activation =
    document.getElementById(
      "profileActivationCode"
    );

  const status =
    document.getElementById("profileStatus");

  if (nameInput) {
    nameInput.value = student.name || "";
  }

  if (code) {
    code.textContent = student.student_id || "";
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
    document
      .getElementById("profileNameInput")
      ?.value.trim() || "";

  if (name.length < 2) {
    alert("Maqaa sirrii galchi.");
    return;
  }

  const { data, error } =
    await requireDb()
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

function studentLogout() {
  localStorage.removeItem("ao_student_id");

  currentStudent = null;

  stopExamTimer();

  currentExam = null;
  currentQuestions = [];
  currentAnswers = {};
  currentAttempt = null;

  showPage("rolePage");
}

async function adminLogin() {
  const username =
    document
      .getElementById("adminUsername")
      ?.value.trim() || "";

  const password =
    document.getElementById("adminPassword")
      ?.value || "";

  if (!username || !password) {
    showAdminMessage(
      "Username fi Password galchi.",
      "error"
    );
    return;
  }

  try {
    const { data, error } =
      await requireDb()
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

    showPage("adminDashboardPage");

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
  localStorage.removeItem("ao_admin_id");
  localStorage.removeItem(
    "ao_google_admin_email"
  );

  currentAdmin = null;

  try {
    await initSupabase()?.auth.signOut();
  } catch (_) {}

  showPage("rolePage");
}

async function restoreAdmin() {
  const googleEmail =
    localStorage.getItem(
      "ao_google_admin_email"
    );

  if (
    googleEmail &&
    ADMIN_GOOGLE_EMAILS.has(googleEmail)
  ) {
    currentAdmin = {
      id: `google-${googleEmail}`,
      username: googleEmail,
      email: googleEmail
    };

    return currentAdmin;
  }

  const id =
    localStorage.getItem("ao_admin_id");

  if (!id) return null;

  try {
    const { data, error } =
      await requireDb()
        .from("admins")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
      localStorage.removeItem("ao_admin_id");
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

  await openAdminPanel("students");
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

  Object.values(panels).forEach((id) => {
    const el = document.getElementById(id);

    if (el) el.style.display = "none";
  });

  const selected =
    document.getElementById(
      panels[panel]
    );

  if (selected) {
    selected.style.display = "block";
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

async function loadAdminStudents() {
  if (!requireAdmin()) return;

  const container =
    document.getElementById(
      "adminStudentsList"
    );

  if (!container) return;

  const { data, error } =
    await requireDb()
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
        <h3>${escapeHtml(student.name)}</h3>

        <p>
          ID:
          <strong>${escapeHtml(
            student.student_id
          )}</strong><br>

          Code:
          <strong>${escapeHtml(
            student.activation_code
          )}</strong><br>

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
              : student.status === "pending"
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

async function toggleStudentStatus(studentId) {
  if (!requireAdmin()) return;

  const {
    data: student,
    error: findError
  } = await requireDb()
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
    await requireDb()
      .from("students")
      .update({
        status: newStatus
      })
      .eq("id", studentId);

  if (error) {
    alert(getErrorMessage(error));
    return;
  }

  await loadAdminStudents();
}

async function deleteStudent(studentId) {
  if (!requireAdmin()) return;

  if (
    !confirm(
      "Barataa kana haquuf mirkaneessi."
    )
  ) {
    return;
  }

  await requireDb()
    .from("results")
    .delete()
    .eq("student_id", studentId);

  await requireDb()
    .from("exam_attempts")
    .delete()
    .eq("student_id", studentId);

  const { error } =
    await requireDb()
      .from("students")
      .delete()
      .eq("id", studentId);

  if (error) {
    alert(getErrorMessage(error));
    return;
  }

  await loadAdminStudents();
  await loadAdminResults();
}
