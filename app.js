"use strict";

/* =========================================================
   AKKAADAAMII OROMIYAA
   APP.JS - FULL VERSION
========================================================= */

const SUPABASE_URL =
  "https://xhkkaevhcqvkwabcsljm.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_8nBE4n2bQ1jRnEr_83FrdA_vSqqIpSz";

const AI_FUNCTION_URL =
  `${SUPABASE_URL}/functions/v1/generate-ai-questions`;

let db = null;

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
   SUPABASE
========================================================= */

function initSupabase() {
  if (db) return db;

  if (
    window.supabase &&
    typeof window.supabase.createClient === "function"
  ) {
    db = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

    return db;
  }

  return null;
}

function requireDb() {
  const client = initSupabase();

  if (!client) {
    throw new Error(
      "Supabase hin fe'amne. Mee fuula kana haaromsi."
    );
  }

  return client;
}


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

function formatText(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function truncate(value, length = 120) {
  const text = String(value ?? "");
  return text.length > length
    ? text.slice(0, length) + "..."
    : text;
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
  el.className = `message ${type}`;
}

function showAdminMessage(message, type = "info") {
  const el = document.getElementById("adminLoginMessage");

  if (!el) return;

  el.textContent = message;
  el.className = `message ${type}`;
}

function showAIMessage(message, type = "info") {
  const el = document.getElementById("aiQuestionMessage");

  if (!el) return;

  el.innerHTML = message;
  el.className = `message ${type}`;
}

function generateStudentCode() {
  let result = "ST-";

  for (let i = 0; i < 6; i++) {
    result += Math.floor(Math.random() * 10);
  }

  return result;
}

function generateActivationCode() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < 8; i++) {
    result += chars[
      Math.floor(Math.random() * chars.length)
    ];
  }

  return result;
}

function normalizeQuestion(row) {
  return {
    ...row,

    id: row.id,

    examId:
      row.exam_id ??
      row.examId,

    text:
      row.question ??
      row.question_text ??
      row.text ??
      "",

    optionA:
      row.option_a ??
      row.optionA ??
      "",

    optionB:
      row.option_b ??
      row.optionB ??
      "",

    optionC:
      row.option_c ??
      row.optionC ??
      "",

    optionD:
      row.option_d ??
      row.optionD ??
      "",

    correctAnswer: String(
      row.correct_answer ??
      row.correctAnswer ??
      ""
    )
      .toUpperCase()
      .charAt(0)
  };
}

function normalizeExam(row) {
  return {
    ...row,

    questionLimit: Number(
      row.question_limit ??
      row.questionLimit ??
      0
    ),

    attemptLimit: Number(
      row.attempt_limit ??
      row.attemptLimit ??
      1
    ),

    isFinal: Boolean(
      row.is_final ??
      row.isFinal ??
      false
    ),

    duration: Number(
      row.duration_minutes ??
      row.duration ??
      30
    ),

    startDate:
      row.start_date ??
      row.startDate ??
      "",

    endDate:
      row.end_date ??
      row.endDate ??
      "",

    startTime:
      row.start_time ??
      row.startTime ??
      "",

    endTime:
      row.end_time ??
      row.endTime ??
      ""
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


/* =========================================================
   PAGE NAVIGATION
========================================================= */

function showPage(pageId) {
  document
    .querySelectorAll(".page")
    .forEach((page) => {
      page.classList.remove("active");
    });

  const page = document.getElementById(pageId);

  if (page) {
    page.classList.add("active");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }
}

function openStudentLogin() {
  showPage("studentLoginPage");

  const input =
    document.getElementById("nameInput");

  if (input) {
    setTimeout(() => input.focus(), 100);
  }
}

function openAdminLogin() {
  showPage("adminLoginPage");

  const input =
    document.getElementById("adminUsername");

  if (input) {
    setTimeout(() => input.focus(), 100);
  }
}


/* =========================================================
   STUDENT REGISTRATION
========================================================= */

async function studentRegister() {
  const dbClient = requireDb();

  const name =
    document
      .getElementById("nameInput")
      ?.value
      .trim() || "";

  if (name.length < 2) {
    showStudentMessage(
      "Maqaa kee guutuu sirriitti galchi.",
      "error"
    );
    return;
  }

  try {
    const {
      data: existing,
      error: existingError
    } = await dbClient
      .from("students")
      .select(
        "id,student_id,activation_code,name,status"
      )
      .ilike("name", name)
      .maybeSingle();

    if (
      existingError &&
      existingError.code !== "PGRST116"
    ) {
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
    let activationCode =
      generateActivationCode();

    for (let i = 0; i < 10; i++) {
      const { data: duplicate } =
        await dbClient
          .from("students")
          .select("id")
          .or(
            `student_id.eq.${studentId},activation_code.eq.${activationCode}`
          )
          .limit(1);

      if (!duplicate?.length) break;

      studentId = generateStudentCode();
      activationCode =
        generateActivationCode();
    }

    const {
      data: student,
      error
    } = await dbClient
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
      `Galmeen milkaa'e!\n\n` +
      `Maqaa: ${student.name}\n` +
      `Student ID: ${student.student_id}\n` +
      `Activation Code: ${student.activation_code}\n\n` +
      `Adminiin erga si mirkaneessee booda seenuu dandeessa.`
    );

    const input =
      document.getElementById("nameInput");

    if (input) input.value = "";

    showStudentMessage(
      "Galmeen kee milkaa'eera. Admin eegi.",
      "success"
    );
  } catch (error) {
    console.error(error);

    showStudentMessage(
      getErrorMessage(error),
      "error"
    );
  }
}


/* =========================================================
   STUDENT LOGIN
========================================================= */

async function studentLogin() {
  const dbClient = requireDb();

  const studentId =
    document
      .getElementById("studentIdInput")
      ?.value
      .trim() || "";

  const activationCode =
    document
      .getElementById("activationCodeInput")
      ?.value
      .trim() || "";

  if (!studentId || !activationCode) {
    showStudentMessage(
      "Student ID fi Activation Code lamaan galchi.",
      "error"
    );
    return;
  }

  try {
    const {
      data: student,
      error
    } = await dbClient
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

    localStorage.setItem(
      "ao_student_id",
      student.id
    );

    document.getElementById(
      "studentIdInput"
    ).value = "";

    document.getElementById(
      "activationCodeInput"
    ).value = "";

    showPage("studentHomePage");

    await loadStudentHome();
  } catch (error) {
    console.error(error);

    showStudentMessage(
      getErrorMessage(error),
      "error"
    );
  }
}

async function restoreStudent() {
  const id =
    localStorage.getItem("ao_student_id");

  if (!id) return null;

  try {
    const {
      data,
      error
    } = await requireDb()
      .from("students")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    if (!data || data.status !== "active") {
      localStorage.removeItem(
        "ao_student_id"
      );

      currentStudent = null;

      return null;
    }

    currentStudent = data;

    return data;
  } catch (error) {
    console.error(error);
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
   STUDENT HOME
========================================================= */

async function loadStudentHome() {
  const student = requireStudent();

  if (!student) return;

  const name =
    document.getElementById(
      "studentWelcomeName"
    );

  if (name) {
    name.textContent = student.name;
  }

  const message =
    document.getElementById(
      "studentHomeMessage"
    );

  if (message) {
    message.textContent =
      "Barnoota dubbisi, qormaata fudhadhu, qabxii kees ilaali.";
  }

  await loadStudentLessons();
}

async function loadStudentLessons() {
  const container =
    document.getElementById(
      "studentLessons"
    );

  if (!container) return;

  try {
    const {
      data,
      error
    } = await requireDb()
      .from("lessons")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (error) throw error;

    if (!data?.length) {
      container.innerHTML =
        `<div class="empty-state">📚 Ammaaf barnoonni hin fe'amne.</div>`;
      return;
    }

    container.innerHTML =
      data
        .map(
          (lesson) => `
          <article class="item-card">
            <div class="item-icon">📚</div>

            <div class="item-main">
              <h4>${escapeHtml(lesson.title)}</h4>

              <p>
                ${escapeHtml(
                  truncate(
                    lesson.content,
                    120
                  )
                )}
              </p>

              <button
                type="button"
                class="small-btn"
                onclick="openLesson('${lesson.id}')"
              >
                Baradhu →
              </button>
            </div>
          </article>
        `
        )
        .join("");
  } catch (error) {
    console.error(error);

    container.innerHTML =
      `<div class="empty-state">❌ Barnoota fe'uu hin dandeenye.</div>`;
  }
}

async function openLesson(lessonId) {
  try {
    const {
      data,
      error
    } = await requireDb()
      .from("lessons")
      .select("*")
      .eq("id", lessonId)
      .maybeSingle();

    if (error || !data) return;

    const title =
      document.getElementById(
        "lessonDetailTitle"
      );

    const content =
      document.getElementById(
        "lessonDetailContent"
      );

    if (title) {
      title.textContent = data.title;
    }

    if (content) {
      content.innerHTML =
        `<div class="lesson-content">${formatText(
          data.content
        )}</div>`;
    }

    showPage("lessonDetailPage");
  } catch (error) {
    console.error(error);
  }
}


/* =========================================================
   EXAM WINDOW
========================================================= */

function getExamWindowStatus(exam) {
  const now = new Date();

  if (exam.startDate) {
    const start =
      new Date(
        `${exam.startDate}T${
          exam.startTime || "00:00"
        }`
      );

    if (
      !Number.isNaN(start.getTime()) &&
      now < start
    ) {
      return {
        available: false,
        reason: "not_started",
        date: start
      };
    }
  }

  if (exam.endDate) {
    const end =
      new Date(
        `${exam.endDate}T${
          exam.endTime || "23:59:59"
        }`
      );

    if (
      !Number.isNaN(end.getTime()) &&
      now > end
    ) {
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


/* =========================================================
   ATTEMPTS
========================================================= */

async function getCompletedAttempts(
  examId,
  studentId
) {
  try {
    const {
      data,
      error
    } = await requireDb()
      .from("exam_attempts")
      .select("*")
      .eq("exam_id", examId)
      .eq("student_id", studentId)
      .eq("completed", true)
      .order("attempt_number", {
        ascending: false
      });

    if (error) {
      console.error(error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error(error);
    return [];
  }
}


/* =========================================================
   LOAD EXAMS
========================================================= */

async function loadExams() {
  const student = requireStudent();

  if (!student) return;

  const container =
    document.getElementById(
      "studentExams"
    );

  if (!container) return;

  try {
    const {
      data,
      error
    } = await requireDb()
      .from("exams")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (error) throw error;

    if (!data?.length) {
      container.innerHTML =
        `<div class="empty-state">📝 Ammaaf qormaanni hin jiru.</div>`;
      return;
    }

    const exams =
      data.map(normalizeExam);

    let html = "";

    for (const exam of exams) {
      const attempts =
        await getCompletedAttempts(
          exam.id,
          student.id
        );

      const limit =
        Number(
          exam.attemptLimit || 1
        );

      const window =
        getExamWindowStatus(exam);

      let action = "";

      if (!window.available) {
        let text = "";

        if (
          window.reason ===
          "not_started"
        ) {
          text =
            `⏳ Hin jalqabne: ${formatDateTime(
              window.date
            )}`;
        } else if (
          window.reason === "ended"
        ) {
          text =
            "⛔ Yeroon qormaataa darbeera.";
        } else {
          text =
            "⛔ Qormaanni cufameera.";
        }

        action =
          `<span class="status blocked">${escapeHtml(
            text
          )}</span>`;
      } else if (
        attempts.length >= limit
      ) {
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

      html += `
        <article class="exam-card">

          <div class="exam-badge">
            ${
              exam.isFinal
                ? "🏆 FINAL"
                : "📝 EXAM"
            }
          </div>

          <h3>
            ${escapeHtml(exam.title)}
          </h3>

          <p>
            ${escapeHtml(
              exam.description || ""
            )}
          </p>

          <div class="exam-meta">

            <span>
              ❓ ${
                exam.questionLimit > 0
                  ? exam.questionLimit
                  : "Hunda"
              }
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
      `;
    }

    container.innerHTML = html;
  } catch (error) {
    console.error(error);

    container.innerHTML =
      `<div class="empty-state">❌ Qormaata fe'uu hin dandeenye.</div>`;
  }
}


/* =========================================================
   START EXAM
========================================================= */

async function startExam(examId) {
  const student = requireStudent();

  if (!student) return;

  try {
    const {
      data: examRow,
      error: examError
    } = await requireDb()
      .from("exams")
      .select("*")
      .eq("id", examId)
      .maybeSingle();

    if (examError || !examRow) {
      alert("Qormaanni hin argamne.");
      return;
    }

    const exam =
      normalizeExam(examRow);

    const window =
      getExamWindowStatus(exam);

    if (!window.available) {
      alert(
        window.reason ===
          "not_started"
          ? "Qormaanni yeroo isaa hin geenye."
          : window.reason === "ended"
          ? "Yeroon qormaataa darbeera."
          : "Qormaanni cufameera."
      );

      return;
    }

    const attempts =
      await getCompletedAttempts(
        exam.id,
        student.id
      );

    const attemptLimit =
      Number(
        exam.attemptLimit || 1
      );

    if (
      attempts.length >= attemptLimit
    ) {
      alert(
        "Attempt kee xumurameera."
      );
      return;
    }

    const {
      data: questionRows,
      error: questionError
    } = await requireDb()
      .from("questions")
      .select("*")
      .eq("exam_id", exam.id);

    if (questionError) {
      alert(
        getErrorMessage(
          questionError
        )
      );
      return;
    }

    let questions =
      (questionRows || [])
        .map(normalizeQuestion);

    if (!questions.length) {
      alert(
        "Qormaata kana keessatti gaaffiin hin jiru."
      );
      return;
    }

    questions =
      questions.sort(
        () => Math.random() - 0.5
      );

    if (exam.questionLimit > 0) {
      questions =
        questions.slice(
          0,
          exam.questionLimit
        );
    }

    const attemptNumber =
      attempts.length + 1;

    const {
      data: attempt,
      error: attemptError
    } = await requireDb()
      .from("exam_attempts")
      .insert({
        student_id: student.id,
        exam_id: exam.id,
        attempt_number:
          attemptNumber,
        score: 0,
        total: questions.length,
        percentage: 0,
        completed: false
      })
      .select()
      .single();

    if (attemptError) {
      alert(
        getErrorMessage(
          attemptError
        )
      );
      return;
    }

    currentExam = exam;
    currentQuestions = questions;
    currentQuestionIndex = 0;
    currentAnswers = {};
    currentAttempt = attempt;
    pendingSubmit = false;

    const title =
      document.getElementById(
        "examTitle"
      );

    if (title) {
      title.textContent =
        exam.title;
    }

    examSecondsLeft =
      Math.max(
        1,
        exam.duration * 60
      );

    renderCurrentQuestion();
    startExamTimer();

    showPage("examPage");
  } catch (error) {
    console.error(error);

    alert(
      "Qormaata jalqabuun hin milkoofne: " +
      getErrorMessage(error)
    );
  }
}


/* =========================================================
   RENDER QUESTION
========================================================= */

function renderCurrentQuestion() {
  if (
    !currentExam ||
    !currentQuestions.length
  ) {
    return;
  }

  const question =
    currentQuestions[
      currentQuestionIndex
    ];

  const total =
    currentQuestions.length;

  const number =
    document.getElementById(
      "questionNumber"
    );

  const text =
    document.getElementById(
      "questionText"
    );

  const container =
    document.getElementById(
      "answersContainer"
    );

  if (number) {
    number.textContent =
      ` ${currentQuestionIndex + 1}/${total}`;
  }

  if (text) {
    text.textContent =
      question.text;
  }

  if (!container) return;

  const selected =
    currentAnswers[
      question.id
    ];

  const options = [
    ["A", question.optionA],
    ["B", question.optionB],
    ["C", question.optionC],
    ["D", question.optionD]
  ];

  container.innerHTML =
    options
      .map(
        ([letter, value]) => `
        <label class="answer-option">

          <input
            type="radio"
            name="currentAnswer"
            value="${letter}"
            ${
              selected === letter
                ? "checked"
                : ""
            }
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
    document.getElementById(
      "nextQuestionButton"
    );

  const submitButton =
    document.getElementById(
      "submitExamButton"
    );

  const answered =
    Boolean(
      currentAnswers[
        question.id
      ]
    );

  if (nextButton) {
    nextButton.disabled =
      !answered;

    nextButton.style.display =
      currentQuestionIndex ===
      total - 1
        ? "none"
        : "block";
  }

  if (submitButton) {
    submitButton.disabled =
      !answered;

    submitButton.style.display =
      currentQuestionIndex ===
      total - 1
        ? "block"
        : "none";
  }
}

function selectAnswer(letter) {
  const question =
    currentQuestions[
      currentQuestionIndex
    ];

  if (!question) return;

  currentAnswers[
    question.id
  ] = letter;

  const nextButton =
    document.getElementById(
      "nextQuestionButton"
    );

  const submitButton =
    document.getElementById(
      "submitExamButton"
    );

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


/* =========================================================
   SUBMIT CONFIRMATION
========================================================= */

function requestSubmitExam() {
  if (!currentExam) return;

  const unanswered =
    currentQuestions.filter(
      (question) =>
        !currentAnswers[
          question.id
        ]
    ).length;

  const message =
    document.getElementById(
      "submitWarningMessage"
    );

  if (message) {
    message.textContent =
      unanswered > 0
        ? `Gaaffii ${unanswered} hin deebifne. Qormaata submit gochuu barbaaddaa?`
        : "⚠️ Gaaffii hunda xumurteettaa? Qormaata submit gochuu barbaaddaa?";
  }

  pendingSubmit = true;

  showPage(
    "submitConfirmPage"
  );
}

function confirmSubmitExam(
  confirmSubmit
) {
  if (!confirmSubmit) {
    pendingSubmit = false;

    showPage("examPage");

    return;
  }

  if (
    !pendingSubmit ||
    !currentExam
  ) {
    return;
  }

  finishExam();
}


/* =========================================================
   FINISH EXAM
========================================================= */

async function finishExam() {
  const student =
    requireStudent();

  if (
    !student ||
    !currentExam ||
    !currentAttempt
  ) {
    return;
  }

  stopExamTimer();

  let correct = 0;

  currentQuestions.forEach(
    (question) => {
      if (
        currentAnswers[
          question.id
        ] ===
        question.correctAnswer
      ) {
        correct++;
      }
    }
  );

  const total =
    currentQuestions.length;

  const percentage =
    total > 0
      ? Math.round(
          (correct / total) * 100
        )
      : 0;

  try {
    const dbClient =
      requireDb();

    const {
      error: attemptError
    } = await dbClient
      .from("exam_attempts")
      .update({
        score: correct,
        total,
        percentage,
        completed: true,
        submitted_at:
          new Date().toISOString()
      })
      .eq(
        "id",
        currentAttempt.id
      );

    if (attemptError) {
      throw attemptError;
    }

    const resultPayload = {
      student_id:
        student.id,

      exam_id:
        currentExam.id,

      exam_title:
        currentExam.title,

      correct,

      total,

      percentage,

      answers:
        currentAnswers,

      submitted_at:
        new Date().toISOString()
    };

    const {
      data: oldResult
    } = await dbClient
      .from("results")
      .select("id")
      .eq(
        "student_id",
        student.id
      )
      .eq(
        "exam_id",
        currentExam.id
      )
      .maybeSingle();

    if (oldResult?.id) {
      const {
        error
      } = await dbClient
        .from("results")
        .update(
          resultPayload
        )
        .eq(
          "id",
          oldResult.id
        );

      if (error) {
        throw error;
      }
    } else {
      const {
        error
      } = await dbClient
        .from("results")
        .insert(
          resultPayload
        );

      if (error) {
        throw error;
      }
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
    console.error(error);

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

  examTimer =
    setInterval(() => {
      examSecondsLeft--;

      updateExamTimer();

      if (
        examSecondsLeft <= 0
      ) {
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

  if (!el) return;

  const minutes =
    Math.floor(
      Math.max(
        0,
        examSecondsLeft
      ) / 60
    );

  const seconds =
    Math.max(
      0,
      examSecondsLeft
    ) % 60;

  el.textContent =
    `${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(
      2,
      "0"
    )}`;
}

function stopExamTimer() {
  if (examTimer) {
    clearInterval(
      examTimer
    );

    examTimer = null;
  }
}


/* =========================================================
   SCORE
========================================================= */

async function showScore() {
  const student =
    requireStudent();

  if (!student) return;

  const container =
    document.getElementById(
      "studentScore"
    );

  if (!container) return;

  try {
    const {
      data,
      error
    } = await requireDb()
      .from("results")
      .select("*")
      .eq(
        "student_id",
        student.id
      )
      .order(
        "submitted_at",
        {
          ascending: false
        }
      );

    if (error) throw error;

    if (!data?.length) {
      container.innerHTML =
        `<div class="empty-state">📊 Ammaaf qormaata tokko illee hin xumurre.</div>`;
      return;
    }

    container.innerHTML =
      data
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
                  result.percentage ||
                  0
                )}%
              </strong>

              <span>
                ${Number(
                  result.correct ||
                  0
                )}/${Number(
                  result.total ||
                  0
                )}
              </span>

            </div>

          </div>
        `
        )
        .join("");
  } catch (error) {
    console.error(error);

    container.innerHTML =
      `<div class="empty-state">❌ Qabxii fe'uu hin dandeenye.</div>`;
  }
}


/* =========================================================
   PROFILE
========================================================= */

async function loadProfile() {
  const student =
    requireStudent();

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
      student.student_id || "";
  }

  if (activation) {
    activation.textContent =
      student.activation_code || "";
  }

  if (status) {
    status.innerHTML =
      student.status === "active"
        ? `<span class="status active">● Active</span>`
        : `<span class="status blocked">● Cufame</span>`;
  }
}

async function saveProfile() {
  const student =
    requireStudent();

  if (!student) return;

  const name =
    document
      .getElementById(
        "profileNameInput"
      )
      ?.value
      .trim() || "";

  if (name.length < 2) {
    alert(
      "Maqaa sirrii galchi."
    );
    return;
  }

  try {
    const {
      data,
      error
    } = await requireDb()
      .from("students")
      .update({
        name
      })
      .eq(
        "id",
        student.id
      )
      .select()
      .single();

    if (error) throw error;

    currentStudent = data;

    await loadProfile();
    await loadStudentHome();

    alert(
      "Maqaan kee olkaa'ameera."
    );
  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
}

function studentLogout() {
  localStorage.removeItem(
    "ao_student_id"
  );

  currentStudent = null;

  stopExamTimer();

  currentExam = null;
  currentQuestions = [];
  currentAnswers = {};
  currentAttempt = null;

  showPage("rolePage");
}


/* =========================================================
   ADMIN LOGIN
========================================================= */

async function adminLogin() {
  const username =
    document
      .getElementById(
        "adminUsername"
      )
      ?.value
      .trim() || "";

  const password =
    document
      .getElementById(
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
    const {
      data,
      error
    } = await requireDb()
      .from("admins")
      .select("*")
      .eq(
        "username",
        username
      )
      .eq(
        "password",
        password
      )
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

    showPage(
      "adminDashboardPage"
    );

    await initializeAdmin();
  } catch (error) {
    console.error(error);

    showAdminMessage(
      getErrorMessage(error),
      "error"
    );
  }
}

function adminLogout() {
  localStorage.removeItem(
    "ao_admin_id"
  );

  currentAdmin = null;

  showPage("rolePage");
}

async function restoreAdmin() {
  const id =
    localStorage.getItem(
      "ao_admin_id"
    );

  if (!id) return null;

  try {
    const {
      data,
      error
    } = await requireDb()
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
    console.error(error);

    return null;
  }
}

function requireAdmin() {
  if (!currentAdmin) {
    showPage(
      "adminLoginPage"
    );

    return null;
  }

  return currentAdmin;
}


/* =========================================================
   ADMIN INITIALIZE
========================================================= */

async function initializeAdmin() {
  if (!requireAdmin()) return;

  await openAdminPanel(
    "students"
  );

  await refreshAllAdminLists();
}

async function openAdminPanel(
  panel
) {
  if (!requireAdmin()) return;

  const panels = {
    students:
      "adminStudentsPanel",

    results:
      "adminResultsPanel",

    lessons:
      "adminLessonsPanel",

    exams:
      "adminExamsPanel"
  };

  Object.values(
    panels
  ).forEach((id) => {
    const el =
      document.getElementById(
        id
      );

    if (el) {
      el.classList.remove(
        "active"
      );

      el.style.display =
        "none";
    }
  });

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
   ADMIN STUDENTS
========================================================= */

async function loadAdminStudents() {
  if (!requireAdmin()) return;

  const container =
    document.getElementById(
      "adminStudentsList"
    );

  if (!container) return;

  try {
    const {
      data,
      error
    } = await requireDb()
      .from("students")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

    if (error) throw error;

    if (!data?.length) {
      container.innerHTML =
        `<div class="empty-state">👨‍🎓 Barataan hin galmoofne.</div>`;
      return;
    }

    container.innerHTML =
      data
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
                    student.student_id
                  )}
                </strong>
                <br>

                Code:
                <strong>
                  ${escapeHtml(
                    student.activation_code
                  )}
                </strong>
                <br>

                Galmaa'e:
                ${formatDateTime(
                  student.created_at
                )}
              </p>

              <span class="status ${
                student.status ===
                "active"
                  ? "active"
                  : "blocked"
              }">

                ●
                ${
                  student.status ===
                  "active"
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
                  student.status ===
                  "active"
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
  } catch (error) {
    console.error(error);

    container.innerHTML =
      `<div class="empty-state">❌ Barattoota fe'uu hin dandeenye.</div>`;
  }
}

async function toggleStudentStatus(
  studentId
) {
  if (!requireAdmin()) return;

  try {
    const {
      data: student,
      error
    } = await requireDb()
      .from("students")
      .select("id,status")
      .eq(
        "id",
        studentId
      )
      .maybeSingle();

    if (error || !student) return;

    const newStatus =
      student.status ===
      "active"
        ? "blocked"
        : "active";

    const {
      error: updateError
    } = await requireDb()
      .from("students")
      .update({
        status: newStatus
      })
      .eq(
        "id",
        studentId
      );

    if (updateError) {
      throw updateError;
    }

    await loadAdminStudents();
  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
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

  try {
    const dbClient =
      requireDb();

    await dbClient
      .from("results")
      .delete()
      .eq(
        "student_id",
        studentId
      );

    await dbClient
      .from("exam_attempts")
      .delete()
      .eq(
        "student_id",
        studentId
      );

    const {
      error
    } = await dbClient
      .from("students")
      .delete()
      .eq(
        "id",
        studentId
      );

    if (error) throw error;

    await loadAdminStudents();
    await loadAdminResults();
  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
}


/* =========================================================
   ADMIN RESULTS
========================================================= */

async function loadAdminResults() {
  if (!requireAdmin()) return;

  const table =
    document.getElementById(
      "adminResultsTable"
    );

  if (!table) return;

  const thead =
    table.querySelector(
      "thead"
    );

  const tbody =
    table.querySelector(
      "tbody"
    );

  try {
    const {
      data,
      error
    } = await requireDb()
      .from("results")
      .select(
        "*, students(name,student_id), exams(title)"
      )
      .order(
        "submitted_at",
        {
          ascending: false
        }
      );

    if (error) throw error;

    if (thead) {
      thead.innerHTML = `
        <tr>
          <th>Barataa</th>
          <th>Qormaata</th>
          <th>Qabxii</th>
          <th>%</th>
          <th>Guyyaa</th>
        </tr>
      `;
    }

    if (!data?.length) {
      if (tbody) {
        tbody.innerHTML =
          `<tr><td colspan="5">Bu'aan qormaataa hin jiru.</td></tr>`;
      }

      return;
    }

    if (tbody) {
      tbody.innerHTML =
        data
          .map(
            (result) => `
            <tr>

              <td>
                ${escapeHtml(
                  result.students
                    ?.name ||
                  "Barataa"
                )}
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
                )}/${Number(
                  result.total ||
                  0
                )}
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
                ${formatDateTime(
                  result.submitted_at
                )}
              </td>

            </tr>
          `
          )
          .join("");
    }
  } catch (error) {
    console.error(error);

    if (tbody) {
      tbody.innerHTML =
        `<tr><td colspan="5">❌ Qabxii fe'uu hin dandeenye.</td></tr>`;
    }
  }
}


/* =========================================================
   ADMIN LESSONS
========================================================= */

async function loadAdminLessons() {
  if (!requireAdmin()) return;

  const container =
    document.getElementById(
      "adminLessonsList"
    );

  if (!container) return;

  try {
    const {
      data,
      error
    } = await requireDb()
      .from("lessons")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

    if (error) throw error;

    if (!data?.length) {
      container.innerHTML =
        `<div class="empty-state">📚 Barnoonni hin jiru.</div>`;
      return;
    }

    container.innerHTML =
      data
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
  } catch (error) {
    console.error(error);

    container.innerHTML =
      `<div class="empty-state">❌ Barnoota fe'uu hin dandeenye.</div>`;
  }
}

async function createLesson() {
  if (!requireAdmin()) return;

  const title =
    document
      .getElementById(
        "lessonTitleInput"
      )
      ?.value
      .trim() || "";

  const content =
    document
      .getElementById(
        "lessonContentInput"
      )
      ?.value
      .trim() || "";

  if (!title || !content) {
    alert(
      "Mata-duree fi qabiyyee barnootaa lamaan galchi."
    );

    return;
  }

  try {
    const {
      error
    } = await requireDb()
      .from("lessons")
      .insert({
        title,
        content
      });

    if (error) throw error;

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
  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
}

async function editLesson(
  lessonId
) {
  if (!requireAdmin()) return;

  try {
    const {
      data: lesson,
      error
    } = await requireDb()
      .from("lessons")
      .select("*")
      .eq(
        "id",
        lessonId
      )
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
    } = await requireDb()
      .from("lessons")
      .update({
        title:
          title.trim() ||
          lesson.title,

        content:
          content.trim() ||
          lesson.content
      })
      .eq(
        "id",
        lessonId
      );

    if (updateError) {
      throw updateError;
    }

    await loadAdminLessons();
    await loadStudentLessons();
  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
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

  try {
    const {
      error
    } = await requireDb()
      .from("lessons")
      .delete()
      .eq(
        "id",
        lessonId
      );

    if (error) throw error;

    await loadAdminLessons();
    await loadStudentLessons();
  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
}


/* =========================================================
   ADMIN EXAMS
========================================================= */

async function loadAdminExams() {
  if (!requireAdmin()) return;

  const container =
    document.getElementById(
      "adminExamsList"
    );

  if (!container) return;

  try {
    const {
      data,
      error
    } = await requireDb()
      .from("exams")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

    if (error) throw error;

    if (!data?.length) {
      container.innerHTML =
        `<div class="empty-state">📝 Qormaanni hin jiru.</div>`;

      await populateExamSelects([]);

      return;
    }

    const exams =
      data.map(normalizeExam);

    const {
      data: questionRows
    } = await requireDb()
      .from("questions")
      .select(
        "id,exam_id"
      );

    const counts = {};

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
          <div class="admin-list-item">

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
                exam.status ===
                "active"
                  ? "active"
                  : "blocked"
              }">

                ●
                ${
                  exam.status ===
                  "active"
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
  } catch (error) {
    console.error(error);

    container.innerHTML =
      `<div class="empty-state">❌ Qormaata fe'uu hin dandeenye.</div>`;
  }
}

async function populateExamSelects(
  exams = null
) {
  let list = exams;

  if (!list) {
    const {
      data
    } = await requireDb()
      .from("exams")
      .select(
        "id,title"
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );

    list = data || [];
  }

  [
    "questionExamSelect",
    "aiQuestionExamSelect"
  ].forEach((id) => {
    const select =
      document.getElementById(
        id
      );

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
          String(
            exam.id
          ) ===
          String(current)
      )
    ) {
      select.value =
        current;
    }
  });
}


/* =========================================================
   CREATE EXAM
========================================================= */

async function createExam() {
  if (!requireAdmin()) return;

  const title =
    document
      .getElementById(
        "examTitleInput"
      )
      ?.value
      .trim() || "";

  const description =
    document
      .getElementById(
        "examDescriptionInput"
      )
      ?.value
      .trim() || "";

  const questionLimit =
    Number(
      document
        .getElementById(
          "examQuestionLimitInput"
        )
        ?.value || 0
    );

  const attemptLimit =
    Number(
      document
        .getElementById(
          "examAttemptLimitInput"
        )
        ?.value || 1
    );

  const isFinal =
    document
      .getElementById(
        "examFinalInput"
      )
      ?.value === "true";

  const duration =
    Number(
      document
        .getElementById(
          "examDurationInput"
        )
        ?.value || 30
    );

  const startDate =
    document
      .getElementById(
        "examStartDateInput"
      )
      ?.value || null;

  const endDate =
    document
      .getElementById(
        "examEndDateInput"
      )
      ?.value || null;

  const startTime =
    document
      .getElementById(
        "examStartTimeInput"
      )
      ?.value || null;

  const endTime =
    document
      .getElementById(
        "examEndTimeInput"
      )
      ?.value || null;

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

  try {
    const {
      error
    } = await requireDb()
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
        status:
          "active"
      });

    if (error) throw error;

    [
      "examTitleInput",
      "examDescriptionInput",
      "examStartDateInput",
      "examEndDateInput",
      "examStartTimeInput",
      "examEndTimeInput"
    ].forEach((id) => {
      const el =
        document.getElementById(
          id
        );

      if (el) {
        el.value = "";
      }
    });

    await loadAdminExams();

    alert(
      "Qormaanni uumameera. Amma gaaffii itti dabali."
    );
  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
}

async function toggleExamStatus(
  examId
) {
  if (!requireAdmin()) return;

  try {
    const {
      data: exam,
      error
    } = await requireDb()
      .from("exams")
      .select(
        "id,status"
      )
      .eq(
        "id",
        examId
      )
      .maybeSingle();

    if (error || !exam) return;

    const {
      error: updateError
    } = await requireDb()
      .from("exams")
      .update({
        status:
          exam.status ===
          "active"
            ? "disabled"
            : "active"
      })
      .eq(
        "id",
        examId
      );

    if (updateError) {
      throw updateError;
    }

    await loadAdminExams();
  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
}

async function editExam(
  examId
) {
  if (!requireAdmin()) return;

  try {
    const {
      data: exam,
      error
    } = await requireDb()
      .from("exams")
      .select("*")
      .eq(
        "id",
        examId
      )
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
        exam.description ||
          ""
      );

    if (
      description === null
    ) {
      return;
    }

    const {
      error: updateError
    } = await requireDb()
      .from("exams")
      .update({
        title:
          title.trim() ||
          exam.title,

        description:
          description.trim()
      })
      .eq(
        "id",
        examId
      );

    if (updateError) {
      throw updateError;
    }

    await loadAdminExams();
  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
}

async function deleteExam(
  examId
) {
  if (!requireAdmin()) return;

  try {
    const {
      data: exam
    } = await requireDb()
      .from("exams")
      .select(
        "id,title"
      )
      .eq(
        "id",
        examId
      )
      .maybeSingle();

    if (!exam) return;

    if (
      !confirm(
        `Qormaata "${exam.title}" fi gaaffilee isaa haquuf mirkaneessi.`
      )
    ) {
      return;
    }

    const dbClient =
      requireDb();

    await dbClient
      .from("results")
      .delete()
      .eq(
        "exam_id",
        examId
      );

    await dbClient
      .from("exam_attempts")
      .delete()
      .eq(
        "exam_id",
        examId
      );

    await dbClient
      .from("questions")
      .delete()
      .eq(
        "exam_id",
        examId
      );

    const {
      error
    } = await dbClient
      .from("exams")
      .delete()
      .eq(
        "id",
        examId
      );

    if (error) throw error;

    await loadAdminExams();
    await loadAdminResults();
  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
}


/* =========================================================
   MANUAL QUESTIONS
========================================================= */

async function createQuestion() {
  if (!requireAdmin()) return;

  const examId =
    document
      .getElementById(
        "questionExamSelect"
      )
      ?.value || "";

  const question =
    document
      .getElementById(
        "questionTextInput"
      )
      ?.value
      .trim() || "";

  const optionA =
    document
      .getElementById(
        "optionAInput"
      )
      ?.value
      .trim() || "";

  const optionB =
    document
      .getElementById(
        "optionBInput"
      )
      ?.value
      .trim() || "";

  const optionC =
    document
      .getElementById(
        "optionCInput"
      )
      ?.value
      .trim() || "";

  const optionD =
    document
      .getElementById(
        "optionDInput"
      )
      ?.value
      .trim() || "";

  const correctAnswer =
    document
      .getElementById(
        "correctAnswerInput"
      )
      ?.value || "";

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

  try {
    const {
      error
    } = await requireDb()
      .from("questions")
      .insert({
        exam_id:
          examId,

        question,

        option_a:
          optionA,

        option_b:
          optionB,

        option_c:
          optionC,

        option_d:
          optionD,

        correct_answer:
          correctAnswer,

        source_type:
          "admin",

        source_text:
          null
      });

    if (error) throw error;

    [
      "questionTextInput",
      "optionAInput",
      "optionBInput",
      "optionCInput",
      "optionDInput"
    ].forEach((id) => {
      const el =
        document.getElementById(
          id
        );

      if (el) {
        el.value = "";
      }
    });

    const correct =
      document.getElementById(
        "correctAnswerInput"
      );

    if (correct) {
      correct.value = "";
    }

    await loadAdminQuestions();
    await loadAdminExams();

    alert(
      "Gaaffiin dabalameera."
    );
  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
}

async function loadAdminQuestions() {
  if (!requireAdmin()) return;

  const container =
    document.getElementById(
      "adminQuestionsList"
    );

  if (!container) return;

  try {
    const {
      data,
      error
    } = await requireDb()
      .from("questions")
      .select(
        "*, exams(title)"
      )
      .order(
        "id",
        {
          ascending: false
        }
      );

    if (error) throw error;

    if (!data?.length) {
      container.innerHTML =
        `<div class="empty-state">❓ Gaaffiin hin jiru.</div>`;
      return;
    }

    container.innerHTML =
      data
        .map(
          (row, index) => {
            const q =
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
                      row.exams
                        ?.title ||
                      "Qormaata"
                    )}
                  </small>

                  <h3>
                    ${escapeHtml(
                      q.text
                    )}
                  </h3>

                  <div class="options-preview">

                    <span>
                      A.
                      ${escapeHtml(
                        q.optionA
                      )}
                    </span>

                    <span>
                      B.
                      ${escapeHtml(
                        q.optionB
                      )}
                    </span>

                    <span>
                      C.
                      ${escapeHtml(
                        q.optionC
                      )}
                    </span>

                    <span>
                      D.
                      ${escapeHtml(
                        q.optionD
                      )}
                    </span>

                  </div>

                  <p class="correct-answer">
                    Deebii sirrii:
                    ${escapeHtml(
                      q.correctAnswer
                    )}
                  </p>

                </div>

                <button
                  type="button"
                  class="danger-small-btn"
                  onclick="deleteQuestion(${q.id})"
                >
                  🗑️
                </button>

              </div>
            `;
          }
        )
        .join("");
  } catch (error) {
    console.error(error);

    container.innerHTML =
      `<div class="empty-state">❌ Gaaffilee fe'uu hin dandeenye.</div>`;
  }
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

  try {
    const {
      error
    } = await requireDb()
      .from("questions")
      .delete()
      .eq(
        "id",
        questionId
      );

    if (error) throw error;

    await loadAdminQuestions();
    await loadAdminExams();
  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
}


/* =========================================================
   AI QUESTION SOURCE
========================================================= */

function changeAIQuestionSource() {
  const type =
    document
      .getElementById(
        "aiQuestionSourceType"
      )
      ?.value || "topic";

  const map = {
    topic:
      "aiTopicSource",

    text:
      "aiTextSource",

    pdf:
      "aiPdfSource",

    image:
      "aiImageSource"
  };

  Object.values(
    map
  ).forEach((id) => {
    const el =
      document.getElementById(
        id
      );

    if (el) {
      el.style.display =
        "none";
    }
  });

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

      reader.onload =
        () => {
          const result =
            String(
              reader.result ||
                ""
            );

          const comma =
            result.indexOf(
              ","
            );

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


/* =========================================================
   AI QUESTION GENERATOR
========================================================= */

async function generateAIQuestions() {
  if (!requireAdmin()) return;

  const examId =
    document
      .getElementById(
        "aiQuestionExamSelect"
      )
      ?.value || "";

  const sourceType =
    document
      .getElementById(
        "aiQuestionSourceType"
      )
      ?.value || "topic";

  const count =
    Number(
      document
        .getElementById(
          "aiQuestionCount"
        )
        ?.value || 5
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
      exam_id:
        Number(examId),

      source_type:
        sourceType,

      count
    };

    if (
      sourceType ===
      "topic"
    ) {
      const topic =
        document
          .getElementById(
            "aiTopicInput"
          )
          ?.value
          .trim() || "";

      if (!topic) {
        throw new Error(
          "Mata-duree galchi."
        );
      }

      body.topic =
        topic;
    }

    if (
      sourceType ===
      "text"
    ) {
      const sourceText =
        document
          .getElementById(
            "aiTextInput"
          )
          ?.value
          .trim() || "";

      if (!sourceText) {
        throw new Error(
          "Barreeffama galchi."
        );
      }

      body.source_text =
        sourceText;
    }

    if (
      sourceType ===
      "pdf"
    ) {
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
        50 *
          1024 *
          1024
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

    if (
      sourceType ===
      "image"
    ) {
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
        15 *
          1024 *
          1024
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
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            apikey:
              SUPABASE_ANON_KEY
          },

          body:
            JSON.stringify(
              body
            )
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
      button.disabled =
        false;

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
    const client =
      initSupabase();

    if (!client) {
      alert(
        "Supabase ammallee hin fe'amne. Mee app sana haaromsiitii irra deebi'ii tuqi."
      );
      return;
    }

    const {
      error
    } =
      await client.auth
        .signInWithOAuth({
          provider:
            "google",

          options: {
            redirectTo:
              window.location
                .origin +
              window.location
                .pathname
          }
        });

    if (error) {
      console.error(
        "GOOGLE LOGIN ERROR:",
        error
      );

      alert(
        "Google Login irratti dogoggorri uumame: " +
        getErrorMessage(
          error
        )
      );
    }
  } catch (error) {
    console.error(
      "GOOGLE LOGIN ERROR:",
      error
    );

    alert(
      "Google Login hin milkoofne: " +
      getErrorMessage(
        error
      )
    );
  }
}


/* =========================================================
   GOOGLE AUTH SESSION
========================================================= */

async function handleAuthSession(
  session
) {
  if (!session?.user) {
    return;
  }

  console.log(
    "Google user authenticated:",
    session.user.email ||
      session.user.id
  );

  showPage("rolePage");
}


/* =========================================================
   TELEGRAM LOGIN
========================================================= */

async function telegramLogin() {
  try {
    if (
      window.Telegram &&
      window.Telegram.WebApp
    ) {
      const user =
        window.Telegram.WebApp
          .initDataUnsafe
          ?.user;

      if (user) {
        alert(
          `Telegram Login milkaa'eera!\n\nMaqaa: ${
            user.first_name ||
            ""
          }`
        );

        showPage(
          "studentLoginPage"
        );

        return;
      }
    }

    alert(
      "Telegram Login button hojjeta. Garuu Telegram authentication guutuu xumuruuf Telegram Bot/Login Widget qindeessuun barbaachisa."
    );
  } catch (error) {
    console.error(error);

    alert(
      "Telegram Login irratti dogoggorri uumame: " +
      getErrorMessage(error)
    );
  }
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
   AUTH LISTENER
========================================================= */

function initializeAuthListener() {
  if (authListenerReady) {
    return;
  }

  authListenerReady =
    true;

  const client =
    initSupabase();

  if (!client) {
    console.error(
      "Supabase hin fe'amne."
    );

    return;
  }

  client.auth.onAuthStateChange(
    async (
      _event,
      session
    ) => {
      await handleAuthSession(
        session
      );
    }
  );
}


/* =========================================================
   INITIALIZE APP
========================================================= */

async function initializeApp() {
  initSupabase();

  initializeAuthListener();

  changeAIQuestionSource();

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
    showPage(
      "adminDashboardPage"
    );

    await initializeAdmin();

    return;
  }

  showPage("rolePage");
}


/* =========================================================
   MAKE FUNCTIONS AVAILABLE TO HTML
========================================================= */

window.showPage =
  showPage;

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

window.loadAdminQuestions =
  loadAdminQuestions;

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
   START
========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApp
  );
} else {
  initializeApp();
}
