const SUPABASE_URL = "https://xhkkaevhcqvkwabcsljm.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_8nBE4n2bQ1jRnEr_83FrdA_vSqqIpSz";

const { createClient } = supabase;

const db = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let currentStudent = null;
let currentExam = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let currentAnswers = [];
let selectedAnswer = null;
let currentAttempt = null;

let examTimerInterval = null;
let examSecondsLeft = 0;


/* =========================================================
   PAGE CONTROL
========================================================= */

function showPage(id) {

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  const page = document.getElementById(id);

  if (page) {
    page.classList.add("active");
  }
}

function openStudentLogin() {
  showPage("studentLoginPage");
}

function openAdminLogin() {
  showPage("adminLoginPage");
}


/* =========================================================
   MESSAGES
========================================================= */

function showStudentMessage(message, type = "info") {

  const el = document.getElementById("studentLoginMessage");

  if (!el) return;

  el.innerHTML = message;
  el.className = `message ${type}`;
}

function showAdminMessage(message, type = "info") {

  const el = document.getElementById("adminLoginMessage");

  if (!el) return;

  el.innerHTML = message;
  el.className = `message ${type}`;
}


/* =========================================================
   HELPERS
========================================================= */

function generateStudentCode() {

  return "ST-" +
    Math.floor(
      100000 + Math.random() * 900000
    );
}

function generateActivationCode() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 8; i++) {

    code += chars.charAt(
      Math.floor(
        Math.random() * chars.length
      )
    );
  }

  return code;
}

function escapeHtml(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function truncate(text, length) {

  if (!text) return "";

  return text.length <= length
    ? text
    : text.substring(0, length) + "...";
}

function formatText(text) {

  return escapeHtml(text)
    .replace(/\n/g, "<br>");
}

function getErrorMessage(error) {

  return error?.message ||
    error?.details ||
    error?.hint ||
    "Rakkoo hin beekamne.";
}


/* =========================================================
   STUDENT REGISTER
========================================================= */

async function studentRegister() {

  const input =
    document.getElementById("nameInput");

  const name =
    input?.value.trim() || "";

  if (!name) {

    showStudentMessage(
      "Maqaa kee galchi.",
      "error"
    );

    return;
  }

  try {

    showStudentMessage(
      "⏳ Galmaa'aa jira...",
      "info"
    );

    let studentCode =
      generateStudentCode();

    let activationCode =
      generateActivationCode();

    const { data, error } =
      await db
        .from("students")
        .insert([
          {
            name,
            student_code: studentCode,
            activation_code: activationCode,
            status: "pending"
          }
        ])
        .select()
        .single();

    if (error) throw error;

    showStudentMessage(
      `
      <div class="success-box">

        <h3>✅ Galmeen milkaa'e!</h3>

        <p>
          <strong>Maqaa:</strong>
          ${escapeHtml(data.name)}
        </p>

        <p>
          <strong>Student ID:</strong><br>
          <span class="big-code">
            ${escapeHtml(data.student_code)}
          </span>
        </p>

        <p>
          <strong>Activation Code:</strong><br>
          <span class="big-code">
            ${escapeHtml(data.activation_code)}
          </span>
        </p>

        <p>
          ⏳ Amma Admin akka siif hayyamu eeguu qabda.
        </p>

        <p>
          Student ID fi Activation Code kee eegi.
        </p>

      </div>
      `,
      "success"
    );

    if (input) {
      input.value = "";
    }

  } catch (error) {

    console.error(error);

    showStudentMessage(
      "❌ Galmeen hin milkoofne: " +
      escapeHtml(getErrorMessage(error)),
      "error"
    );
  }
}


/* =========================================================
   STUDENT LOGIN
========================================================= */

async function studentLogin() {

  const studentId =
    document
      .getElementById("studentIdInput")
      ?.value.trim() || "";

  const activationCode =
    document
      .getElementById("activationCodeInput")
      ?.value.trim() || "";

  if (!studentId || !activationCode) {

    showStudentMessage(
      "Student ID fi Activation Code lamaan galchi.",
      "error"
    );

    return;
  }

  try {

    showStudentMessage(
      "⏳ Odeeffannoo kee mirkaneessaa jira...",
      "info"
    );

    const { data, error } =
      await db
        .from("students")
        .select("*")
        .eq("student_code", studentId)
        .eq("activation_code", activationCode)
        .maybeSingle();

    if (error) throw error;

    if (!data) {

      showStudentMessage(
        "❌ Student ID ykn Activation Code sirrii miti.",
        "error"
      );

      return;
    }

    if (data.status === "pending") {

      showStudentMessage(
        `
        <div class="warning-box">
          <h3>⏳ Admin Hayyama Eegaa Jirta</h3>
          <p>Galmeen kee fudhatameera.</p>
          <p>
            Admin erga siif hayyamee booda seenuu dandeessa.
          </p>
        </div>
        `,
        "warning"
      );

      return;
    }

    if (data.status === "rejected") {

      showStudentMessage(
        `
        <div class="error-box">
          <h3>❌ Galmeen Kee Didame</h3>
          <p>Maaloo Admin qunnami.</p>
        </div>
        `,
        "error"
      );

      return;
    }

    if (data.status !== "active") {

      showStudentMessage(
        "Status account kee sirrii miti.",
        "error"
      );

      return;
    }

    currentStudent = data;

    localStorage.setItem(
      "student_id",
      data.id
    );

    document.getElementById(
      "studentIdInput"
    ).value = "";

    document.getElementById(
      "activationCodeInput"
    ).value = "";

    await loadStudentHome();

    showPage("studentHomePage");

  } catch (error) {

    console.error(error);

    showStudentMessage(
      "❌ Rakkoo uumame: " +
      escapeHtml(getErrorMessage(error)),
      "error"
    );
  }
}


/* =========================================================
   RESTORE STUDENT
========================================================= */

async function restoreStudent() {

  const id =
    localStorage.getItem("student_id");

  if (!id) return;

  try {

    const { data, error } =
      await db
        .from("students")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (error) throw error;

    if (!data || data.status !== "active") {

      localStorage.removeItem("student_id");

      currentStudent = null;

      return;
    }

    currentStudent = data;

    await loadStudentHome();

    showPage("studentHomePage");

  } catch (error) {

    console.error(error);

    localStorage.removeItem("student_id");
  }
}


/* =========================================================
   STUDENT HOME / LESSONS
========================================================= */

async function loadStudentHome() {

  if (!currentStudent) return;

  const welcome =
    document.getElementById(
      "studentWelcomeName"
    );

  if (welcome) {

    welcome.textContent =
      `Baga nagaan dhuftan, ${currentStudent.name}`;
  }

  const homeMessage =
    document.getElementById(
      "studentHomeMessage"
    );

  if (homeMessage) {

    homeMessage.textContent =
      `Student ID: ${currentStudent.student_code}`;
  }

  const container =
    document.getElementById(
      "studentLessons"
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
      "<p>❌ Barnoota fe'uu hin dandeenye.</p>";

    return;
  }

  if (!data || data.length === 0) {

    container.innerHTML =
      "<p>Barnoonni ammaaf hin jiru.</p>";

    return;
  }

  container.innerHTML =
    data.map(lesson => `

      <div class="card">

        <h3>
          📚 ${escapeHtml(lesson.title)}
        </h3>

        <p>
          ${escapeHtml(
            truncate(
              lesson.content || "",
              120
            )
          )}
        </p>

        <button
          class="primary-btn"
          onclick="openLesson('${lesson.id}')"
        >
          Baradhu →
        </button>

      </div>

    `).join("");
}

async function openLesson(id) {

  const { data, error } =
    await db
      .from("lessons")
      .select("*")
      .eq("id", id)
      .single();

  if (error) {

    alert(getErrorMessage(error));

    return;
  }

  document.getElementById(
    "lessonDetailTitle"
  ).textContent = data.title;

  document.getElementById(
    "lessonDetailContent"
  ).innerHTML =
    formatText(data.content || "");

  showPage("lessonDetailPage");
}


/* =========================================================
   EXAM DATE / TIME
========================================================= */

function getExamWindowStatus(exam) {

  const now = new Date();

  let startDateTime = null;
  let endDateTime = null;

  if (exam.start_date) {

    const time =
      exam.start_time || "00:00:00";

    startDateTime =
      new Date(
        `${exam.start_date}T${time}`
      );
  }

  if (exam.end_date) {

    const time =
      exam.end_time || "23:59:59";

    endDateTime =
      new Date(
        `${exam.end_date}T${time}`
      );
  }

  if (
    startDateTime &&
    now < startDateTime
  ) {

    return {
      allowed: false,
      message:
        `⏳ Qormaanni amma hin jalqabne. Jalqaba: ${formatDateTime(startDateTime)}`
    };
  }

  if (
    endDateTime &&
    now > endDateTime
  ) {

    return {
      allowed: false,
      message:
        `⛔ Yeroon qormaataa xumurame. Xumura: ${formatDateTime(endDateTime)}`
    };
  }

  return {
    allowed: true,
    message: "Qormaata jalqabi"
  };
}

function formatDateTime(date) {

  try {

    return date.toLocaleString(
      "en-GB",
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    );

  } catch {

    return date.toString();
  }
}


/* =========================================================
   STUDENT EXAMS
========================================================= */

async function loadExams() {

  const container =
    document.getElementById(
      "studentExams"
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
      "<p>❌ Qormaata fe'uu hin dandeenye.</p>";

    return;
  }

  if (!data || data.length === 0) {

    container.innerHTML =
      "<p>Qormaanni ammaaf hin jiru.</p>";

    return;
  }

  const examCards = [];

  for (const exam of data) {

    const windowStatus =
      getExamWindowStatus(exam);

    let completedAttempts = 0;

    if (currentStudent) {

      const attempts =
        await db
          .from("exam_attempts")
          .select("id")
          .eq(
            "student_id",
            currentStudent.id
          )
          .eq(
            "exam_id",
            exam.id
          )
          .eq(
            "completed",
            true
          );

      if (!attempts.error) {

        completedAttempts =
          (attempts.data || []).length;
      }
    }

    const attemptLimit =
      Number(exam.attempt_limit || 1);

    const attemptsFinished =
      completedAttempts >= attemptLimit;

    let buttonHtml = "";

    if (!windowStatus.allowed) {

      buttonHtml = `
        <button
          class="secondary-btn"
          disabled
        >
          ${escapeHtml(windowStatus.message)}
        </button>
      `;

    } else if (attemptsFinished) {

      buttonHtml = `
        <button
          class="secondary-btn"
          disabled
        >
          ✅ Attempt xumurame
        </button>
      `;

    } else {

      buttonHtml = `
        <button
          class="primary-btn"
          onclick="startExam('${exam.id}')"
        >
          Qormaata Jalqabi →
        </button>
      `;
    }

    examCards.push(`

      <div class="card">

        <h3>
          📝 ${escapeHtml(exam.title)}
        </h3>

        <p>
          ${escapeHtml(
            exam.description || ""
          )}
        </p>

        <p>
          🔢 Gaaffii:
          ${
            Number(exam.question_limit || 0) === 0
              ? "Hunda"
              : exam.question_limit
          }
        </p>

        <p>
          🔁 Attempt:
          ${completedAttempts}/${attemptLimit}
        </p>

        <p>
          ⏱️ Yeroo:
          ${Number(exam.duration_minutes || 30)} daqiiqaa
        </p>

        ${exam.is_final ? `
          <p>
            🏆 <strong>Qormaata Waliigalaa</strong>
          </p>
        ` : ""}

        ${buttonHtml}

      </div>

    `);
  }

  container.innerHTML =
    examCards.join("");
}


/* =========================================================
   START EXAM
========================================================= */

async function startExam(examId) {

  if (!currentStudent) {

    alert("Maaloo jalqaba seeni.");

    return;
  }

  const examResult =
    await db
      .from("exams")
      .select("*")
      .eq("id", examId)
      .single();

  if (examResult.error) {

    alert(
      getErrorMessage(
        examResult.error
      )
    );

    return;
  }

  const exam =
    examResult.data;

  const windowStatus =
    getExamWindowStatus(exam);

  if (!windowStatus.allowed) {

    alert(
      windowStatus.message
    );

    return;
  }

  const attemptsResult =
    await db
      .from("exam_attempts")
      .select("*")
      .eq(
        "student_id",
        currentStudent.id
      )
      .eq(
        "exam_id",
        examId
      )
      .eq(
        "completed",
        true
      )
      .order(
        "attempt_number",
        {
          ascending: false
        }
      );

  if (attemptsResult.error) {

    alert(
      getErrorMessage(
        attemptsResult.error
      )
    );

    return;
  }

  const completedAttempts =
    attemptsResult.data || [];

  const attemptLimit =
    Number(
      exam.attempt_limit || 1
    );

  if (
    completedAttempts.length >=
    attemptLimit
  ) {

    alert(
      `⛔ Attempt kee guuteera.\n\nAttempt: ${attemptLimit}`
    );

    return;
  }

  const nextAttemptNumber =
    completedAttempts.length + 1;

  const questionsResult =
    await db
      .from("questions")
      .select("*")
      .eq(
        "exam_id",
        examId
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );

  if (questionsResult.error) {

    alert(
      getErrorMessage(
        questionsResult.error
      )
    );

    return;
  }

  let questions =
    questionsResult.data || [];

  if (questions.length === 0) {

    alert(
      "Qormaata kana keessatti gaaffiin hin jiru."
    );

    return;
  }

  const questionLimit =
    Number(
      exam.question_limit || 0
    );

  if (
    questionLimit > 0 &&
    questions.length > questionLimit
  ) {

    questions =
      questions.slice(
        0,
        questionLimit
      );
  }

  const attemptResult =
    await db
      .from("exam_attempts")
      .insert([
        {
          student_id:
            currentStudent.id,

          exam_id:
            exam.id,

          attempt_number:
            nextAttemptNumber,

          score: 0,

          total:
            questions.length,

          percentage: 0,

          completed: false
        }
      ])
      .select()
      .single();

  if (attemptResult.error) {

    alert(
      "Attempt jalqabsiisuu hin dandeenye: " +
      getErrorMessage(
        attemptResult.error
      )
    );

    return;
  }

  currentAttempt =
    attemptResult.data;

  currentExam =
    exam;

  currentQuestions =
    questions;

  currentQuestionIndex =
    0;

  currentAnswers =
    new Array(
      currentQuestions.length
    ).fill(null);

  selectedAnswer =
    null;

  document.getElementById(
    "examTitle"
  ).textContent =
    currentExam.title;

  startExamTimer(
    Number(
      currentExam.duration_minutes || 30
    )
  );

  showPage(
    "examPage"
  );

  showQuestion();
}


/* =========================================================
   TIMER
========================================================= */

function startExamTimer(minutes) {

  stopExamTimer();

  examSecondsLeft =
    Math.max(
      1,
      minutes * 60
    );

  updateExamTimerDisplay();

  examTimerInterval =
    setInterval(() => {

      examSecondsLeft--;

      updateExamTimerDisplay();

      if (
        examSecondsLeft <= 0
      ) {

        stopExamTimer();

        alert(
          "⏰ Yeroon qormaataa xumurame. Qormaanni ofumaan submit godhameera."
        );

        submitExamDirectly();
      }

    }, 1000);
}

function stopExamTimer() {

  if (examTimerInterval) {

    clearInterval(
      examTimerInterval
    );

    examTimerInterval = null;
  }
}

function updateExamTimerDisplay() {

  const value =
    document.getElementById(
      "examTimerValue"
    );

  if (!value) return;

  const minutes =
    Math.floor(
      examSecondsLeft / 60
    );

  const seconds =
    examSecondsLeft % 60;

  value.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}


/* =========================================================
   SHOW QUESTION
========================================================= */

function showQuestion() {

  const question =
    currentQuestions[
      currentQuestionIndex
    ];

  if (!question) return;

  selectedAnswer =
    currentAnswers[
      currentQuestionIndex
    ] || null;

  const number =
    document.getElementById(
      "questionNumber"
    );

  if (number) {

    number.textContent =
      `${currentQuestionIndex + 1} / ${currentQuestions.length}`;
  }

  const questionText =
    document.getElementById(
      "questionText"
    );

  if (questionText) {

    questionText.textContent =
      question.question ||
      question.text ||
      "";
  }

  const options = [
    ["A", question.option_a],
    ["B", question.option_b],
    ["C", question.option_c],
    ["D", question.option_d]
  ];

  const container =
    document.getElementById(
      "answersContainer"
    );

  if (!container) return;

  container.innerHTML =
    options.map(option => {

      if (!option[1]) return "";

      const selected =
        selectedAnswer === option[0]
          ? "selected"
          : "";

      return `

        <button
          class="answer-btn ${selected}"
          onclick="selectAnswer('${option[0]}')"
        >

          <strong>
            ${option[0]}
          </strong>

          <span>
            ${escapeHtml(option[1])}
          </span>

        </button>

      `;

    }).join("");

  updateNextButton();
}


/* =========================================================
   SELECT ANSWER
========================================================= */

function selectAnswer(answer) {

  selectedAnswer =
    answer;

  currentAnswers[
    currentQuestionIndex
  ] = answer;

  document
    .querySelectorAll(".answer-btn")
    .forEach(button => {

      button.classList.remove(
        "selected"
      );
    });

  document
    .querySelectorAll(".answer-btn")
    .forEach(button => {

      const letter =
        button
          .querySelector("strong")
          ?.textContent
          .trim();

      if (
        letter === answer
      ) {

        button.classList.add(
          "selected"
        );
      }
    });

  updateNextButton();
}


/* =========================================================
   NEXT QUESTION
========================================================= */

function updateNextButton() {

  const button =
    document.getElementById(
      "nextQuestionButton"
    );

  if (!button) return;

  button.disabled =
    !selectedAnswer;

  if (
    currentQuestionIndex ===
    currentQuestions.length - 1
  ) {

    button.textContent =
      "Qormaata Xumuri ✓";

  } else {

    button.textContent =
      "Itti Aanuu →";
  }
}

function nextQuestion() {

  if (!selectedAnswer) {

    alert(
      "Deebii tokko filadhu."
    );

    return;
  }

  if (
    currentQuestionIndex <
    currentQuestions.length - 1
  ) {

    currentQuestionIndex++;

    showQuestion();

  } else {

    requestSubmitExam();
  }
}


/* =========================================================
   SUBMIT CONFIRMATION
========================================================= */

function requestSubmitExam() {

  const unanswered =
    currentAnswers.filter(
      answer => !answer
    ).length;

  const confirmPage =
    document.getElementById(
      "submitConfirmPage"
    );

  const warning =
    document.getElementById(
      "submitWarningMessage"
    );

  if (!confirmPage) {

    submitExamDirectly();

    return;
  }

  if (unanswered > 0) {

    if (warning) {

      warning.innerHTML = `
        ⚠️ <strong>Gaaffii ${unanswered}</strong>
        deebisuun hafee jira.<br><br>
        Qormaata submit gochuu barbaaddaa?
      `;
    }

  } else {

    if (warning) {

      warning.innerHTML = `
        ⚠️ Gaaffii hunda xumurteettaa?
        Qormaata submit gochuu barbaaddaa?
      `;
    }
  }

  showPage(
    "submitConfirmPage"
  );
}

function confirmSubmitExam(yes) {

  if (yes) {

    submitExamDirectly();

    return;
  }

  if (
    currentQuestionIndex > 0
  ) {

    currentQuestionIndex--;
  }

  showPage(
    "examPage"
  );

  showQuestion();
}


/* =========================================================
   DIRECT SUBMIT
========================================================= */

async function submitExamDirectly() {

  if (
    !currentExam ||
    !currentAttempt
  ) {

    return;
  }

  stopExamTimer();

  let score = 0;

  currentQuestions.forEach(
    (question, index) => {

      const answer =
        currentAnswers[index];

      const correct =
        String(
          question.correct_answer || ""
        )
          .trim()
          .toUpperCase();

      if (
        answer &&
        answer.toUpperCase() === correct
      ) {

        score++;
      }
    }
  );

  const total =
    currentQuestions.length;

  const percentage =
    total > 0
      ? Math.round(
          (score / total) * 100
        )
      : 0;

  const attemptUpdate =
    await db
      .from("exam_attempts")
      .update({
        score,
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

  if (attemptUpdate.error) {

    alert(
      "Attempt olkaa'uu hin dandeenye: " +
      getErrorMessage(
        attemptUpdate.error
      )
    );

    return;
  }

  const existing =
    await db
      .from("results")
      .select("id")
      .eq(
        "student_id",
        currentStudent.id
      )
      .eq(
        "exam_id",
        currentExam.id
      )
      .maybeSingle();

  if (existing.error) {

    alert(
      getErrorMessage(
        existing.error
      )
    );

    return;
  }

  let resultError = null;

  if (existing.data) {

    const result =
      await db
        .from("results")
        .update({
          score,
          total,
          percentage
        })
        .eq(
          "id",
          existing.data.id
        );

    resultError =
      result.error;

  } else {

    const result =
      await db
        .from("results")
        .insert([
          {
            student_id:
              currentStudent.id,

            exam_id:
              currentExam.id,

            score,
            total,
            percentage
          }
        ]);

    resultError =
      result.error;
  }

  if (resultError) {

    alert(
      "Qabxii olkaa'uu hin dandeenye: " +
      getErrorMessage(
        resultError
      )
    );

    return;
  }

  alert(
    `✅ Qormaata xumurame!\n\nQabxii: ${score}/${total}\nDhibbeentaa: ${percentage}%`
  );

  showPage(
    "scorePage"
  );

  await showScore();

  renderExamReview();

  currentAttempt = null;
}


/* =========================================================
   BACKWARD COMPATIBILITY
========================================================= */

async function finishExam() {

  await submitExamDirectly();
}


/* =========================================================
   EXAM REVIEW
========================================================= */

function renderExamReview() {

  const container =
    document.getElementById(
      "studentScore"
    );

  if (!container) return;

  if (
    !currentExam ||
    !currentQuestions.length
  ) return;

  const reviewHtml =
    currentQuestions.map(
      (question, index) => {

        const selected =
          currentAnswers[index];

        const correct =
          String(
            question.correct_answer || ""
          )
            .trim()
            .toUpperCase();

        const options = [
          ["A", question.option_a],
          ["B", question.option_b],
          ["C", question.option_c],
          ["D", question.option_d]
        ];

        return `

          <div
            class="card"
            style="margin-top:15px;"
          >

            <h4>
              ${index + 1}.
              ${escapeHtml(
                question.question || ""
              )}
            </h4>

            ${options.map(
              option => {

                if (!option[1]) {
                  return "";
                }

                const letter =
                  option[0];

                const isCorrect =
                  letter === correct;

                const isSelected =
                  letter === selected;

                let icon = "⚪";

                if (isCorrect) {

                  icon = "✅";

                } else if (
                  isSelected &&
                  !isCorrect
                ) {

                  icon = "❌";
                }

                const background =
                  isCorrect
                    ? "#d1fae5"
                    : (
                      isSelected
                        ? "#fee2e2"
                        : ""
                    );

                return `

                  <div
                    style="
                      padding:10px;
                      margin:6px 0;
                      border-radius:8px;
                      background:${background};
                    "
                  >

                    ${icon}

                    <strong>
                      ${letter}.
                    </strong>

                    ${escapeHtml(
                      option[1]
                    )}

                  </div>

                `;
              }
            ).join("")}

          </div>

        `;
      }
    ).join("");

  container.innerHTML += `

    <div style="margin-top:25px;">

      <h3>
        📋 Deebii Qormaataa
      </h3>

      ${reviewHtml}

    </div>

  `;
}


/* =========================================================
   STUDENT SCORE
========================================================= */

async function showScore() {

  const container =
    document.getElementById(
      "studentScore"
    );

  if (!container) return;

  if (!currentStudent) return;

  const { data, error } =
    await db
      .from("results")
      .select(`
        *,
        exams (
          title
        )
      `)
      .eq(
        "student_id",
        currentStudent.id
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) {

    container.innerHTML =
      "<p>❌ Qabxii fe'uu hin dandeenye.</p>";

    return;
  }

  if (!data || data.length === 0) {

    container.innerHTML =
      "<p>Ati ammallee qormaata hin fudhanne.</p>";

    return;
  }

  container.innerHTML =
    data.map(result => `

      <div class="card">

        <h3>
          📝 ${escapeHtml(
            result.exams?.title ||
            "Qormaata"
          )}
        </h3>

        <p>
          <strong>Qabxii:</strong>
          ${result.score}/${result.total}
        </p>

        <p>
          <strong>Dhibbeentaa:</strong>
          ${result.percentage}%
        </p>

      </div>

    `).join("");
}


/* =========================================================
   PROFILE
========================================================= */

function loadProfile() {

  if (!currentStudent) return;

  const name =
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

  if (name) {

    name.value =
      currentStudent.name || "";
  }

  if (code) {

    code.textContent =
      currentStudent.student_code || "";
  }

  if (activation) {

    activation.textContent =
      currentStudent.activation_code || "";
  }

  if (status) {

    status.textContent =
      currentStudent.status === "active"
        ? "✅ Active"
        : currentStudent.status;
  }
}

async function saveProfile() {

  const name =
    document
      .getElementById(
        "profileNameInput"
      )
      ?.value.trim() || "";

  if (!name) {

    alert(
      "Maqaa galchi."
    );

    return;
  }

  const { data, error } =
    await db
      .from("students")
      .update({
        name
      })
      .eq(
        "id",
        currentStudent.id
      )
      .select()
      .single();

  if (error) {

    alert(
      getErrorMessage(error)
    );

    return;
  }

  currentStudent = data;

  alert(
    "✅ Maqaan kee jijjiirame."
  );

  await loadStudentHome();

  loadProfile();
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
      ?.value.trim() || "";

  const password =
    document
      .getElementById(
        "adminPassword"
      )?.value || "";

  if (!username || !password) {

    showAdminMessage(
      "Username fi password galchi.",
      "error"
    );

    return;
  }

  const { data, error } =
    await db
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

  if (error) {

    showAdminMessage(
      getErrorMessage(error),
      "error"
    );

    return;
  }

  if (!data) {

    showAdminMessage(
      "❌ Username ykn password sirrii miti.",
      "error"
    );

    return;
  }

  localStorage.setItem(
    "admin_logged",
    "true"
  );

  showPage(
    "adminPage"
  );

  openAdminPanel(
    "students"
  );
}


/* =========================================================
   ADMIN PANELS
========================================================= */

function hideAdminPanels() {

  document
    .querySelectorAll(".admin-panel")
    .forEach(panel => {

      panel.style.display =
        "none";

    });
}

async function openAdminPanel(panel) {

  hideAdminPanels();

  if (panel === "students") {

    document.getElementById(
      "adminStudentsPanel"
    ).style.display =
      "block";

    await loadAdminStudents();
  }

  if (panel === "results") {

    document.getElementById(
      "adminResultsPanel"
    ).style.display =
      "block";

    await loadAdminResults();
  }

  if (panel === "lessons") {

    document.getElementById(
      "adminLessonsPanel"
    ).style.display =
      "block";

    await loadAdminLessons();
  }

  if (panel === "exams") {

    document.getElementById(
      "adminExamsPanel"
    ).style.display =
      "block";

    await loadAdminExams();

    await loadQuestionExamSelect();

    await loadAIQuestionExamSelect();

    await loadAdminQuestions();
  }
}


/* =========================================================
   ADMIN STUDENTS
========================================================= */

async function loadAdminStudents() {

  const container =
    document.getElementById(
      "adminStudentsList"
    );

  if (!container) return;

  const { data, error } =
    await db
      .from("students")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) {

    container.innerHTML =
      `<p>❌ ${escapeHtml(
        getErrorMessage(error)
      )}</p>`;

    return;
  }

  if (!data || data.length === 0) {

    container.innerHTML =
      "<p>Barataan hin jiru.</p>";

    return;
  }

  container.innerHTML = `

    <div class="table-wrapper">

      <table>

        <thead>

          <tr>
            <th>#</th>
            <th>Maqaa</th>
            <th>Student ID</th>
            <th>Activation Code</th>
            <th>Status</th>
            <th>Gocha</th>
          </tr>

        </thead>

        <tbody>

          ${data.map(
            (student, index) => `

            <tr
              data-student-id="${escapeHtml(student.id)}"
            >

              <td>
                ${index + 1}
              </td>

              <td>
                ${escapeHtml(
                  student.name
                )}
              </td>

              <td>
                <strong>
                  ${escapeHtml(
                    student.student_code
                  )}
                </strong>
              </td>

              <td>
                <strong>
                  ${escapeHtml(
                    student.activation_code ||
                    "-"
                  )}
                </strong>
              </td>

              <td>
                ${
                  student.status === "active"
                    ? "✅ Active"
                    : student.status === "pending"
                    ? "⏳ Pending"
                    : "❌ Rejected"
                }
              </td>

              <td>

                ${
                  student.status === "pending"
                    ? `
                      <button
                        class="success-btn"
                        onclick="approveStudent('${student.id}')"
                      >
                        ✅ Hayyami
                      </button>

                      <button
                        class="danger-btn"
                        onclick="rejectStudent('${student.id}')"
                      >
                        ❌ Diduu
                      </button>
                    `
                    : `
                      <button
                        class="danger-btn"
                        onclick="deleteStudent('${student.id}')"
                      >
                        🗑️ Haqi
                      </button>
                    `
                }

              </td>

            </tr>

          `
          ).join("")}

        </tbody>

      </table>

    </div>
  `;
}

async function approveStudent(id) {

  if (
    !confirm(
      "Barataa kanaaf hayyama kennuu barbaaddaa?"
    )
  ) return;

  const { error } =
    await db
      .from("students")
      .update({
        status: "active"
      })
      .eq(
        "id",
        id
      );

  if (error) {

    alert(
      getErrorMessage(error)
    );

    return;
  }

  alert(
    "✅ Barataan hayyamame."
  );

  await loadAdminStudents();
}

async function rejectStudent(id) {

  if (
    !confirm(
      "Barataa kana diduu barbaaddaa?"
    )
  ) return;

  const { error } =
    await db
      .from("students")
      .update({
        status: "rejected"
      })
      .eq(
        "id",
        id
      );

  if (error) {

    alert(
      getErrorMessage(error)
    );

    return;
  }

  alert(
    "❌ Barataan didame."
  );

  await loadAdminStudents();
}


/* =========================================================
   DELETE STUDENT — FULLY FIXED
========================================================= */

async function deleteStudent(id) {

  if (
    !confirm(
      "Barataa kana guutummaatti haquu barbaaddaa?\n\n" +
      "Qabxii fi exam attempts isaa ni haqamu."
    )
  ) {
    return;
  }

  try {

    /*
      1. RESULTS HAQI
    */

    const {
      error: resultsError
    } =
      await db
        .from("results")
        .delete()
        .eq(
          "student_id",
          id
        );

    if (resultsError) {
      throw resultsError;
    }


    /*
      2. EXAM ATTEMPTS HAQI
    */

    const {
      error: attemptsError
    } =
      await db
        .from("exam_attempts")
        .delete()
        .eq(
          "student_id",
          id
        );

    if (attemptsError) {
      throw attemptsError;
    }


    /*
      3. STUDENT HAQI
      
      .select("id") dabalameera.
      Kun barataan dhugumaan
      database irraa haqame moo
      hin haqamne mirkaneessa.
    */

    const {
      data: deletedStudent,
      error: studentError
    } =
      await db
        .from("students")
        .delete()
        .eq(
          "id",
          id
        )
        .select("id");

    if (studentError) {
      throw studentError;
    }


    /*
      4. DHUGAAN HAQAMEE?
      
      Yoo array duwwaa ta'e,
      Supabase irraa row hin haqamne.
    */

    if (
      !deletedStudent ||
      deletedStudent.length === 0
    ) {

      throw new Error(
        "Barataan database irraa hin haqamne. Supabase RLS DELETE policy ilaali."
      );
    }


    /*
      5. APP KEESSA TARREE HAAROMSI
    */

    await loadAdminStudents();


    /*
      6. QABXII HAAROMSI
    */

    await loadAdminResults();


    /*
      7. YOO BARATAAN AMMA LOGGED-IN TA'E
         LOCAL STORAGE ILLEE HAQI
    */

    if (
      currentStudent &&
      currentStudent.id === id
    ) {

      currentStudent = null;

      localStorage.removeItem(
        "student_id"
      );
    }


    alert(
      "✅ Barataan guutummaatti haqame."
    );

  } catch (error) {

    console.error(
      "DELETE STUDENT ERROR:",
      error
    );

    alert(
      "❌ Barataa haquun hin milkoofne:\n\n" +
      getErrorMessage(error)
    );
  }
}


/* =========================================================
   ADMIN RESULTS
========================================================= */

async function loadAdminResults() {

  const table =
    document.getElementById(
      "adminResultsTable"
    );

  if (!table) return;

  const studentsResult =
    await db
      .from("students")
      .select("*")
      .order(
        "name",
        {
          ascending: true
        }
      );

  const examsResult =
    await db
      .from("exams")
      .select("*")
      .order(
        "created_at",
        {
          ascending: true
        }
      );

  const resultsResult =
    await db
      .from("results")
      .select("*");

  if (
    studentsResult.error ||
    examsResult.error ||
    resultsResult.error
  ) {

    const tbody =
      table.querySelector(
        "tbody"
      );

    if (tbody) {

      tbody.innerHTML = `
        <tr>
          <td>
            ❌ Qabxii fe'uu hin dandeenye.
          </td>
        </tr>
      `;
    }

    return;
  }

  const students =
    studentsResult.data || [];

  const exams =
    examsResult.data || [];

  const results =
    resultsResult.data || [];

  table.querySelector(
    "thead"
  ).innerHTML = `

    <tr>

      <th>#</th>

      <th>Barataa</th>

      ${exams.map(exam => `
        <th>
          ${escapeHtml(
            exam.title
          )}
        </th>
      `).join("")}

      <th>Total</th>

      <th>Average</th>

      <th>Rank</th>

    </tr>

  `;

  const rows =
    students.map(student => {

      let total = 0;

      let count = 0;

      let averageTotal = 0;

      const examValues = {};

      exams.forEach(exam => {

        const result =
          results.find(r =>
            r.student_id === student.id &&
            r.exam_id === exam.id
          );

        if (result) {

          examValues[exam.id] =
            `${result.score}/${result.total}`;

          total +=
            Number(
              result.score || 0
            );

          averageTotal +=
            Number(
              result.percentage || 0
            );

          count++;

        } else {

          examValues[exam.id] =
            "—";
        }

      });

      const average =
        count
          ? Math.round(
              averageTotal /
              count
            )
          : 0;

      return {
        student,
        examValues,
        total,
        average,
        count
      };
    });

  const ranked =
    [...rows].sort(
      (a, b) =>
        b.average - a.average ||
        b.total - a.total
    );

  ranked.forEach(
    (row, index) => {

      row.rank =
        row.count === 0
          ? "—"
          : index + 1;
    }
  );

  rows.sort(
    (a, b) =>
      a.student.name.localeCompare(
        b.student.name
      )
  );

  table.querySelector(
    "tbody"
  ).innerHTML =
    rows.map(
      (row, index) => `

      <tr>

        <td>
          ${index + 1}
        </td>

        <td>
          <strong>
            ${escapeHtml(
              row.student.name
            )}
          </strong>

          <br>

          <small>
            ${escapeHtml(
              row.student.student_code
            )}
          </small>
        </td>

        ${exams.map(exam => `

          <td>
            ${row.examValues[
              exam.id
            ]}
          </td>

        `).join("")}

        <td>
          <strong>
            ${row.total}
          </strong>
        </td>

        <td>
          <strong>
            ${row.average}%
          </strong>
        </td>

        <td>
          ${
            row.rank === "—"
              ? "—"
              : "#" + row.rank
          }
        </td>

      </tr>

    `
    ).join("");
}


/* =========================================================
   CREATE LESSON
========================================================= */

async function createLesson() {

  const title =
    document
      .getElementById(
        "lessonTitleInput"
      )
      ?.value.trim() || "";

  const content =
    document
      .getElementById(
        "lessonContentInput"
      )
      ?.value.trim() || "";

  if (!title || !content) {

    alert(
      "Mata-duree fi qabiyyee guuti."
    );

    return;
  }

  const { error } =
    await db
      .from("lessons")
      .insert([
        {
          title,
          content
        }
      ]);

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

  alert(
    "✅ Barnoonni dabale."
  );

  await loadAdminLessons();

  await loadStudentHome();
}


/* =========================================================
   ADMIN LESSONS
========================================================= */

async function loadAdminLessons() {

  const container =
    document.getElementById(
      "adminLessonsList"
    );

  if (!container) return;

  const { data, error } =
    await db
      .from("lessons")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) {

    container.innerHTML =
      `<p>❌ ${escapeHtml(
        getErrorMessage(error)
      )}</p>`;

    return;
  }

  if (!data || data.length === 0) {

    container.innerHTML =
      "<p>Barnoonni hin jiru.</p>";

    return;
  }

  container.innerHTML =
    data.map(
      lesson => `

      <div
        class="card"
        data-lesson-id="${escapeHtml(lesson.id)}"
      >

        <h3>
          📚 ${escapeHtml(
            lesson.title
          )}
        </h3>

        <p>
          ${escapeHtml(
            truncate(
              lesson.content || "",
              200
            )
          )}
        </p>

        <button
          class="secondary-btn"
          onclick="editLesson('${lesson.id}')"
        >
          ✏️ Sirreessi
        </button>

        <button
          class="danger-btn"
          onclick="deleteLesson('${lesson.id}')"
        >
          🗑️ Haqi
        </button>

      </div>

    `
    ).join("");
}

async function editLesson(id) {

  const { data, error } =
    await db
      .from("lessons")
      .select("*")
      .eq(
        "id",
        id
      )
      .single();

  if (error) {

    alert(
      getErrorMessage(error)
    );

    return;
  }

  const title =
    prompt(
      "Mata-duree haaraa:",
      data.title
    );

  if (title === null) return;

  const content =
    prompt(
      "Qabiyyee haaraa:",
      data.content
    );

  if (content === null) return;

  const {
    error: updateError
  } =
    await db
      .from("lessons")
      .update({
        title:
          title.trim(),

        content:
          content.trim()
      })
      .eq(
        "id",
        id
      );

  if (updateError) {

    alert(
      getErrorMessage(
        updateError
      )
    );

    return;
  }

  alert(
    "✅ Barnoonni sirreeffame."
  );

  await loadAdminLessons();

  await loadStudentHome();
}


/* =========================================================
   DELETE LESSON
========================================================= */

async function deleteLesson(id) {

  if (
    !confirm(
      "Barnoota kana guutummaatti haquu barbaaddaa?"
    )
  ) {
    return;
  }

  try {

    const {
      data: deletedLesson,
      error
    } =
      await db
        .from("lessons")
        .delete()
        .eq(
          "id",
          id
        )
        .select("id");

    if (error) {
      throw error;
    }

    if (
      !deletedLesson ||
      deletedLesson.length === 0
    ) {

      throw new Error(
        "Barnoonni database irraa hin haqamne."
      );
    }

    await loadAdminLessons();

    await loadStudentHome();

    alert(
      "✅ Barnoonni guutummaatti haqame."
    );

  } catch (error) {

    console.error(
      "DELETE LESSON ERROR:",
      error
    );

    alert(
      "❌ Barnoota haquun hin milkoofne:\n\n" +
      getErrorMessage(error)
    );
  }
}


/* =========================================================
   CREATE EXAM
========================================================= */

async function createExam() {

  const title =
    document
      .getElementById(
        "examTitleInput"
      )
      ?.value.trim() || "";

  const description =
    document
      .getElementById(
        "examDescriptionInput"
      )
      ?.value.trim() || "";

  const questionLimit =
    Number(
      document.getElementById(
        "examQuestionLimitInput"
      )?.value || 10
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

  const durationMinutes =
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

  const { error } =
    await db
      .from("exams")
      .insert([
        {
          title,
          description,

          question_limit:
            questionLimit,

          attempt_limit:
            attemptLimit,

          is_final:
            isFinal,

          duration_minutes:
            durationMinutes,

          start_date:
            startDate,

          end_date:
            endDate,

          start_time:
            startTime,

          end_time:
            endTime
        }
      ]);

  if (error) {

    alert(
      getErrorMessage(error)
    );

    return;
  }

  document.getElementById(
    "examTitleInput"
  ).value = "";

  document.getElementById(
    "examDescriptionInput"
  ).value = "";

  alert(
    "✅ Qormaanni dabale."
  );

  await loadAdminExams();

  await loadQuestionExamSelect();

  await loadAIQuestionExamSelect();
}


/* =========================================================
   ADMIN EXAMS
========================================================= */

async function loadAdminExams() {

  const container =
    document.getElementById(
      "adminExamsList"
    );

  if (!container) return;

  const { data, error } =
    await db
      .from("exams")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) {

    container.innerHTML =
      `<p>❌ ${escapeHtml(
        getErrorMessage(error)
      )}</p>`;

    return;
  }

  if (!data || data.length === 0) {

    container.innerHTML =
      "<p>Qormaanni hin jiru.</p>";

    return;
  }

  container.innerHTML =
    data.map(
      exam => `

      <div
        class="card"
        data-exam-id="${escapeHtml(exam.id)}"
      >

        <h3>
          📝 ${escapeHtml(
            exam.title
          )}
        </h3>

        <p>
          ${escapeHtml(
            exam.description || ""
          )}
        </p>

        <p>
          🔢 Gaaffii:
          ${
            Number(
              exam.question_limit || 0
            ) === 0
              ? "Hunda"
              : exam.question_limit
          }
        </p>

        <p>
          🔁 Attempt:
          ${exam.attempt_limit || 1}
        </p>

        <p>
          ⏱️ Yeroo:
          ${exam.duration_minutes || 30}
          daqiiqaa
        </p>

        ${
          exam.is_final
            ? `
              <p>
                🏆 Qormaata Waliigalaa
              </p>
            `
            : ""
        }

        ${
          exam.start_date
            ? `
              <p>
                🗓️ Jalqaba:
                ${escapeHtml(
                  exam.start_date
                )}
                ${
                  exam.start_time
                    ? " " +
                      escapeHtml(
                        exam.start_time
                      )
                    : ""
                }
              </p>
            `
            : ""
        }

        ${
          exam.end_date
            ? `
              <p>
                🛑 Xumura:
                ${escapeHtml(
                  exam.end_date
                )}
                ${
                  exam.end_time
                    ? " " +
                      escapeHtml(
                        exam.end_time
                      )
                    : ""
                }
              </p>
            `
            : ""
        }

        <button
          class="secondary-btn"
          onclick="editExam('${exam.id}')"
        >
          ✏️ Sirreessi
        </button>

        <button
          class="danger-btn"
          onclick="deleteExam('${exam.id}')"
        >
          🗑️ Haqi
        </button>

      </div>

    `
    ).join("");
}


/* =========================================================
   EDIT EXAM
========================================================= */

async function editExam(id) {

  const { data, error } =
    await db
      .from("exams")
      .select("*")
      .eq(
        "id",
        id
      )
      .single();

  if (error) {

    alert(
      getErrorMessage(error)
    );

    return;
  }

  const title =
    prompt(
      "Mata-duree haaraa:",
      data.title
    );

  if (title === null) return;

  const description =
    prompt(
      "Ibsa haaraa:",
      data.description || ""
    );

  if (description === null) return;

  const questionLimit =
    prompt(
      "Lakkoofsa gaaffii (0 = hunda):",
      data.question_limit ?? 10
    );

  if (questionLimit === null) return;

  const attemptLimit =
    prompt(
      "Attempt meeqa:",
      data.attempt_limit ?? 1
    );

  if (attemptLimit === null) return;

  const duration =
    prompt(
      "Yeroo daqiiqaa:",
      data.duration_minutes ?? 30
    );

  if (duration === null) return;

  const isFinal =
    confirm(
      "Qormaata waliigalaa/final gochuu barbaaddaa?"
    );

  const startDate =
    prompt(
      "Guyyaa jalqabaa (YYYY-MM-DD), ykn duwwaa:",
      data.start_date || ""
    );

  if (startDate === null) return;

  const endDate =
    prompt(
      "Guyyaa xumuraa (YYYY-MM-DD), ykn duwwaa:",
      data.end_date || ""
    );

  if (endDate === null) return;

  const startTime =
    prompt(
      "Sa'aatii jalqabaa (HH:MM), ykn duwwaa:",
      data.start_time
        ? String(
            data.start_time
          ).substring(0, 5)
        : ""
    );

  if (startTime === null) return;

  const endTime =
    prompt(
      "Sa'aatii xumuraa (HH:MM), ykn duwwaa:",
      data.end_time
        ? String(
            data.end_time
          ).substring(0, 5)
        : ""
    );

  if (endTime === null) return;

  const {
    error: updateError
  } =
    await db
      .from("exams")
      .update({
        title:
          title.trim(),

        description:
          description.trim(),

        question_limit:
          Math.max(
            0,
            Number(
              questionLimit
            ) || 0
          ),

        attempt_limit:
          Math.max(
            1,
            Number(
              attemptLimit
            ) || 1
          ),

        duration_minutes:
          Math.max(
            1,
            Number(
              duration
            ) || 30
          ),

        is_final:
          isFinal,

        start_date:
          startDate.trim() ||
          null,

        end_date:
          endDate.trim() ||
          null,

        start_time:
          startTime.trim() ||
          null,

        end_time:
          endTime.trim() ||
          null
      })
      .eq(
        "id",
        id
      );

  if (updateError) {

    alert(
      getErrorMessage(
        updateError
      )
    );

    return;
  }

  alert(
    "✅ Qormaanni sirreeffame."
  );

  await loadAdminExams();

  await loadQuestionExamSelect();

  await loadAIQuestionExamSelect();

  await loadAdminResults();
}


/* =========================================================
   DELETE EXAM
========================================================= */

async function deleteExam(id) {

  if (
    !confirm(
      "Qormaata kana guutummaatti haquu barbaaddaa?\n\n" +
      "Qormaata, gaaffii, qabxii fi attempt isaa ni haqamu."
    )
  ) {
    return;
  }

  try {

    const {
      error: resultsError
    } =
      await db
        .from("results")
        .delete()
        .eq(
          "exam_id",
          id
        );

    if (resultsError) {
      throw resultsError;
    }

    const {
      error: attemptsError
    } =
      await db
        .from("exam_attempts")
        .delete()
        .eq(
          "exam_id",
          id
        );

    if (attemptsError) {
      throw attemptsError;
    }

    const {
      error: questionsError
    } =
      await db
        .from("questions")
        .delete()
        .eq(
          "exam_id",
          id
        );

    if (questionsError) {
      throw questionsError;
    }

    const {
      data: deletedExam,
      error: examError
    } =
      await db
        .from("exams")
        .delete()
        .eq(
          "id",
          id
        )
        .select("id");

    if (examError) {
      throw examError;
    }

    if (
      !deletedExam ||
      deletedExam.length === 0
    ) {

      throw new Error(
        "Qormaanni database irraa hin haqamne."
      );
    }

    await loadAdminExams();

    await loadQuestionExamSelect();

    await loadAIQuestionExamSelect();

    await loadAdminQuestions();

    await loadAdminResults();

    await loadExams();

    alert(
      "✅ Qormaanni guutummaatti haqame."
    );

  } catch (error) {

    console.error(
      "DELETE EXAM ERROR:",
      error
    );

    alert(
      "❌ Qormaata haquun hin milkoofne:\n\n" +
      getErrorMessage(error)
    );
  }
}


/* =========================================================
   QUESTION EXAM SELECT
========================================================= */

async function loadQuestionExamSelect() {

  const select =
    document.getElementById(
      "questionExamSelect"
    );

  if (!select) return;

  const { data, error } =
    await db
      .from("exams")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) return;

  select.innerHTML =
    `<option value="">
      Qormaata filadhu
    </option>`;

  (data || []).forEach(
    exam => {

      select.innerHTML += `
        <option value="${exam.id}">
          ${escapeHtml(
            exam.title
          )}
        </option>
      `;
    }
  );
}


/* =========================================================
   MANUAL QUESTION
========================================================= */

async function createQuestion() {

  const examId =
    document.getElementById(
      "questionExamSelect"
    )?.value || "";

  const question =
    document
      .getElementById(
        "questionTextInput"
      )
      ?.value.trim() || "";

  const a =
    document
      .getElementById(
        "optionAInput"
      )
      ?.value.trim() || "";

  const b =
    document
      .getElementById(
        "optionBInput"
      )
      ?.value.trim() || "";

  const c =
    document
      .getElementById(
        "optionCInput"
      )
      ?.value.trim() || "";

  const d =
    document
      .getElementById(
        "optionDInput"
      )
      ?.value.trim() || "";

  const correct =
    document.getElementById(
      "correctAnswerInput"
    )?.value || "";

  if (
    !examId ||
    !question ||
    !a ||
    !b ||
    !c ||
    !d ||
    !correct
  ) {

    alert(
      "Odeeffannoo gaaffii hunda guuti."
    );

    return;
  }

  const { error } =
    await db
      .from("questions")
      .insert([
        {
          exam_id:
            examId,

          question,

          option_a:
            a,

          option_b:
            b,

          option_c:
            c,

          option_d:
            d,

          correct_answer:
            correct,

          source_type:
            "admin",

          source_text:
            null
        }
      ]);

  if (error) {

    alert(
      getErrorMessage(error)
    );

    return;
  }

  document.getElementById(
    "questionTextInput"
  ).value = "";

  document.getElementById(
    "optionAInput"
  ).value = "";

  document.getElementById(
    "optionBInput"
  ).value = "";

  document.getElementById(
    "optionCInput"
  ).value = "";

  document.getElementById(
    "optionDInput"
  ).value = "";

  document.getElementById(
    "correctAnswerInput"
  ).value = "";

  alert(
    "✅ Gaaffiin dabale."
  );

  await loadAdminQuestions();
}


/* =========================================================
   ADMIN QUESTIONS
========================================================= */

async function loadAdminQuestions() {

  const container =
    document.getElementById(
      "adminQuestionsList"
    );

  if (!container) return;

  const { data, error } =
    await db
      .from("questions")
      .select(`
        *,
        exams (
          title
        )
      `)
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) {

    container.innerHTML =
      `<p>❌ ${escapeHtml(
        getErrorMessage(error)
      )}</p>`;

    return;
  }

  if (!data || data.length === 0) {

    container.innerHTML =
      "<p>Gaaffiin hin jiru.</p>";

    return;
  }

  container.innerHTML =
    data.map(
      (question, index) => `

      <div
        class="card"
        data-question-id="${escapeHtml(question.id)}"
      >

        <p>
          <strong>
            ${index + 1}.
            ${escapeHtml(
              question.question ||
              ""
            )}
          </strong>
        </p>

        <p>
          📝 Qormaata:
          ${escapeHtml(
            question.exams?.title ||
            "-"
          )}
        </p>

        <p>
          A. ${escapeHtml(
            question.option_a || ""
          )}
        </p>

        <p>
          B. ${escapeHtml(
            question.option_b || ""
          )}
        </p>

        <p>
          C. ${escapeHtml(
            question.option_c || ""
          )}
        </p>

        <p>
          D. ${escapeHtml(
            question.option_d || ""
          )}
        </p>

        <p>
          ✅ Deebii:
          <strong>
            ${escapeHtml(
              question.correct_answer ||
              ""
            )}
          </strong>
        </p>

        <p>
          📌 Madda:
          ${escapeHtml(
            question.source_type ||
            "admin"
          )}
        </p>

        <button
          class="danger-btn"
          onclick="deleteQuestion('${question.id}')"
        >
          🗑️ Haqi
        </button>

      </div>

    `
    ).join("");
}


/* =========================================================
   DELETE QUESTION
========================================================= */

async function deleteQuestion(id) {

  if (
    !confirm(
      "Gaaffii kana guutummaatti haquu barbaaddaa?"
    )
  ) {
    return;
  }

  try {

    const {
      data: deletedQuestion,
      error
    } =
      await db
        .from("questions")
        .delete()
        .eq(
          "id",
          id
        )
        .select("id");

    if (error) {
      throw error;
    }

    if (
      !deletedQuestion ||
      deletedQuestion.length === 0
    ) {

      throw new Error(
        "Gaaffiin database irraa hin haqamne."
      );
    }

    await loadAdminQuestions();

    alert(
      "✅ Gaaffiin guutummaatti haqame."
    );

  } catch (error) {

    console.error(
      "DELETE QUESTION ERROR:",
      error
    );

    alert(
      "❌ Gaaffii haquun hin milkoofne:\n\n" +
      getErrorMessage(error)
    );
  }
}


/* =========================================================
   AI QUESTION GENERATOR
========================================================= */

const AI_FUNCTION_URL =
  `${SUPABASE_URL}/functions/v1/generate-ai-questions`;


/* =========================================================
   AI SOURCE CHANGE
========================================================= */

function changeAIQuestionSource() {

  const type =
    document.getElementById(
      "aiQuestionSourceType"
    )?.value;

  const topic =
    document.getElementById(
      "aiTopicSource"
    );

  const text =
    document.getElementById(
      "aiTextSource"
    );

  const pdf =
    document.getElementById(
      "aiPdfSource"
    );

  const image =
    document.getElementById(
      "aiImageSource"
    );

  if (topic) {

    topic.style.display =
      type === "topic"
        ? "block"
        : "none";
  }

  if (text) {

    text.style.display =
      type === "text"
        ? "block"
        : "none";
  }

  if (pdf) {

    pdf.style.display =
      type === "pdf"
        ? "block"
        : "none";
  }

  if (image) {

    image.style.display =
      type === "image"
        ? "block"
        : "none";
  }
}


/* =========================================================
   AI EXAM SELECT
========================================================= */

async function loadAIQuestionExamSelect() {

  const select =
    document.getElementById(
      "aiQuestionExamSelect"
    );

  if (!select) return;

  const { data, error } =
    await db
      .from("exams")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) return;

  select.innerHTML =
    `<option value="">
      Qormaata filadhu
    </option>`;

  (data || []).forEach(
    exam => {

      select.innerHTML += `
        <option value="${exam.id}">
          ${escapeHtml(
            exam.title
          )}
        </option>
      `;
    }
  );
}


/* =========================================================
   FILE TO BASE64
========================================================= */

function fileToBase64(file) {

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
            ? result.substring(
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
   AI QUESTION GENERATION
========================================================= */

async function generateAIQuestions() {

  const message =
    document.getElementById(
      "aiQuestionMessage"
    );

  const examId =
    document.getElementById(
      "aiQuestionExamSelect"
    )?.value;

  const sourceType =
    document.getElementById(
      "aiQuestionSourceType"
    )?.value;

  const count =
    Number(
      document.getElementById(
        "aiQuestionCount"
      )?.value || 5
    );

  if (!examId) {

    if (message) {

      message.innerHTML =
        "❌ Qormaata filadhu.";
    }

    return;
  }

  if (!sourceType) {

    if (message) {

      message.innerHTML =
        "❌ Madda gaaffii filadhu.";
    }

    return;
  }

  const button =
    document.getElementById(
      "generateAIQuestionsButton"
    );

  if (button) {

    button.disabled =
      true;

    button.textContent =
      "⏳ AI qopheessaa jira...";
  }

  if (message) {

    message.innerHTML =
      "⏳ Gaaffilee AI irraa qopheessaa jira...";
  }

  try {

    let sourceData = {
      type:
        sourceType
    };


    /* TOPIC */

    if (
      sourceType === "topic"
    ) {

      const topic =
        document
          .getElementById(
            "aiTopicInput"
          )
          ?.value.trim();

      if (!topic) {

        throw new Error(
          "Mata-duree galchi."
        );
      }

      sourceData.topic =
        topic;
    }


    /* TEXT */

    if (
      sourceType === "text"
    ) {

      const text =
        document
          .getElementById(
            "aiTextInput"
          )
          ?.value.trim();

      if (!text) {

        throw new Error(
          "Barreeffama galchi."
        );
      }

      sourceData.text =
        text;
    }


    /* PDF */

    if (
      sourceType === "pdf"
    ) {

      const input =
        document.getElementById(
          "aiPdfInput"
        );

      const file =
        input?.files?.[0];

      if (!file) {

        throw new Error(
          "PDF filadhu."
        );
      }

      const base64 =
        await fileToBase64(file);

      sourceData.fileName =
        file.name;

      sourceData.mimeType =
        file.type ||
        "application/pdf";

      sourceData.base64 =
        base64;
    }


    /* IMAGE */

    if (
      sourceType === "image"
    ) {

      const input =
        document.getElementById(
          "aiImageInput"
        );

      const file =
        input?.files?.[0];

      if (!file) {

        throw new Error(
          "Suuraa filadhu."
        );
      }

      const base64 =
        await fileToBase64(file);

      sourceData.fileName =
        file.name;

      sourceData.mimeType =
        file.type;

      sourceData.base64 =
        base64;
    }


    /* CALL EDGE FUNCTION */

    const response =
      await fetch(
        AI_FUNCTION_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              exam_id:
                examId,

              source_type:
                sourceType,

              source:
                sourceData,

              count:
                count
            })
        }
      );


    let result = null;

    try {

      result =
        await response.json();

    } catch {

      result = null;
    }


    if (!response.ok) {

      throw new Error(
        result?.error ||
        result?.message ||
        `AI server error: ${response.status}`
      );
    }


    const questions =
      Array.isArray(result)
        ? result
        : (
          result?.questions ||
          []
        );


    if (!questions.length) {

      throw new Error(
        "AI gaaffii hin deebifne."
      );
    }


    let inserted = 0;


    for (
      const q of questions
    ) {

      const questionText =
        q.question ||
        q.text ||
        "";

      const optionA =
        q.option_a ||
        q.a ||
        "";

      const optionB =
        q.option_b ||
        q.b ||
        "";

      const optionC =
        q.option_c ||
        q.c ||
        "";

      const optionD =
        q.option_d ||
        q.d ||
        "";

      let correct =
        q.correct_answer ||
        q.correct ||
        "";

      correct =
        String(
          correct
        )
          .trim()
          .toUpperCase()
          .charAt(0);


      if (
        !questionText ||
        !optionA ||
        !optionB ||
        !optionC ||
        !optionD ||
        !["A", "B", "C", "D"]
          .includes(correct)
      ) {

        continue;
      }


      const insertResult =
        await db
          .from("questions")
          .insert([
            {
              exam_id:
                examId,

              question:
                questionText,

              option_a:
                optionA,

              option_b:
                optionB,

              option_c:
                optionC,

              option_d:
                optionD,

              correct_answer:
                correct,

              source_type:
                sourceType,

              source_text:
                sourceType === "topic"
                  ? sourceData.topic
                  : sourceType === "text"
                  ? sourceData.text
                  : sourceData.fileName ||
                    null
            }
          ]);

      if (!insertResult.error) {

        inserted++;
      }
    }


    if (message) {

      message.innerHTML =
        `
        <div class="success-box">
          ✅ ${inserted} gaaffii AI irraa
          qormaata keessa galchame.
        </div>
        `;
    }

    await loadAdminQuestions();

  } catch (error) {

    console.error(
      "AI ERROR:",
      error
    );

    if (message) {

      message.innerHTML =
        `
        <div class="error-box">
          ❌ ${escapeHtml(
            getErrorMessage(error)
          )}
        </div>
        `;
    }

  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "🤖 AI'n Gaaffii Uumi";
    }
  }
}


/* =========================================================
   LOGOUT
========================================================= */

function studentLogout() {

  stopExamTimer();

  localStorage.removeItem(
    "student_id"
  );

  currentStudent = null;
  currentExam = null;
  currentQuestions = [];
  currentAnswers = [];
  currentAttempt = null;
  selectedAnswer = null;

  showPage(
    "rolePage"
  );
}

function adminLogout() {

  localStorage.removeItem(
    "admin_logged"
  );

  showPage(
    "rolePage"
  );
}


/* =========================================================
   PAGE START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    hideAdminPanels();

    changeAIQuestionSource();


    /*
      ADMIN LOGIN RESTORE
    */

    if (
      localStorage.getItem(
        "admin_logged"
      ) === "true"
    ) {

      showPage(
        "adminPage"
      );

      await openAdminPanel(
        "students"
      );

      return;
    }


    /*
      STUDENT LOGIN RESTORE
    */

    if (
      localStorage.getItem(
        "student_id"
      )
    ) {

      await restoreStudent();

      if (
        currentStudent
      ) return;
    }


    /*
      DEFAULT PAGE
    */

    showPage(
      "rolePage"
    );
  }
);
