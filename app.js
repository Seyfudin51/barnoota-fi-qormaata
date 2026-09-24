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
