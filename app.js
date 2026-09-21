let currentStudent = null;
let currentExam = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let currentAnswers = [];
let selectedAnswer = null;


/* =========================================================
   PAGE
========================================================= */

function showPage(id) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  const page = document.getElementById(id);

  if (page) {
    page.classList.add("active");
    window.scrollTo(0, 0);
  }
}


/* =========================================================
   ROLE
========================================================= */

function openStudentLogin() {
  showPage("loginPage");
}

function openAdminLogin() {
  showPage("adminLoginPage");
}


/* =========================================================
   ADMIN SECURITY CHECK
========================================================= */

function isAdminLoggedIn() {
  return localStorage.getItem("admin_logged") === "true";
}


/* =========================================================
   STUDENT LOGIN
========================================================= */

async function studentLogin() {
  const input = document.getElementById("nameInput");
  const message = document.getElementById("studentLoginMessage");

  const name = input.value.trim();

  if (!name) {
    message.textContent = "Maqaa kee galchi.";
    message.style.color = "#dc2626";
    return;
  }

  message.textContent = "Seenaa jira...";
  message.style.color = "#2563eb";

  try {
    let {
      data: students,
      error
    } = await supabaseClient
      .from("students")
      .select("*")
      .eq("name", name)
      .limit(1);

    if (error) throw error;

    if (students && students.length > 0) {

      currentStudent = students[0];

    } else {

      const cleanName = name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 8);

      const studentCode =
        "ST-" +
        (cleanName || "USER") +
        "-" +
        Math.floor(1000 + Math.random() * 9000);

      const {
        data,
        error: insertError
      } = await supabaseClient
        .from("students")
        .insert([
          {
            name: name,
            student_code: studentCode
          }
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      currentStudent = data;
    }

    localStorage.setItem("student_id", currentStudent.id);

    document.getElementById("studentWelcomeName").textContent =
      currentStudent.name;

    await loadStudentHome();

    showPage("homePage");

  } catch (error) {

    console.error(error);

    message.textContent =
      "Dogoggorri uumame: " + error.message;

    message.style.color = "#dc2626";
  }
}


/* =========================================================
   RESTORE STUDENT
========================================================= */

async function restoreStudent() {

  const id = localStorage.getItem("student_id");

  if (!id) return;

  const {
    data,
    error
  } = await supabaseClient
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  if (!error && data) {
    currentStudent = data;
  }
}


/* =========================================================
   STUDENT HOME
========================================================= */

async function loadStudentHome() {

  if (!currentStudent) return;

  document.getElementById("studentWelcomeName").textContent =
    currentStudent.name;

  const box = document.getElementById("studentLessons");

  box.innerHTML = "<p>Barnoota fe'aa jira...</p>";

  const {
    data,
    error
  } = await supabaseClient
    .from("lessons")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {

    box.innerHTML =
      "<p>Barnoota argachuu hin dandeenye.</p>";

    return;
  }

  if (!data || data.length === 0) {

    box.innerHTML = `
      <div class="lesson-card">
        <div>
          <h3>📚 Barnoonni hin jiru</h3>
          <p>Admin barnoota yeroo booda ni dabala.</p>
        </div>
      </div>
    `;

    return;
  }

  box.innerHTML = data.map(lesson => `
    <div class="lesson-card">

      <div class="card-icon">📖</div>

      <div>
        <h3>${escapeHTML(lesson.title)}</h3>

        <p>
          ${escapeHTML(
            lesson.description || "Barnoota haaraa"
          )}
        </p>
      </div>

      <button
        class="open-btn"
        onclick="openLesson(${lesson.id})"
      >
        Ilaali
      </button>

    </div>
  `).join("");
}


/* =========================================================
   LESSON DETAIL
========================================================= */

async function openLesson(id) {

  const {
    data,
    error
  } = await supabaseClient
    .from("lessons")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {

    alert("Barnoota banuun hin danda'amne.");

    return;
  }

  document.getElementById("lessonDetailTitle").textContent =
    data.title;

  document.getElementById("lessonDetailDescription").textContent =
    data.description || "";

  document.getElementById("lessonDetailContent").textContent =
    data.content || "";

  showPage("lessonDetailPage");
}


/* =========================================================
   EXAMS - STUDENT
========================================================= */

async function loadExams() {

  const box = document.getElementById("examList");

  box.innerHTML = "<p>Qormaata fe'aa jira...</p>";

  const {
    data,
    error
  } = await supabaseClient
    .from("exams")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {

    box.innerHTML =
      "<p>Qormaata argachuu hin dandeenye.</p>";

    return;
  }

  if (!data || data.length === 0) {

    box.innerHTML = `
      <div class="exam-card">
        <h3>📝 Qormaanni hin jiru</h3>
        <p>Admin qormaata yeroo booda ni uuma.</p>
      </div>
    `;

    return;
  }

  box.innerHTML = data.map(exam => `
    <div class="exam-card">

      <div class="card-icon">📝</div>

      <h3>${escapeHTML(exam.title)}</h3>

      <p>
        ${escapeHTML(
          exam.description || "Qormaata"
        )}
      </p>

      <button
        class="primary-btn"
        style="margin-top:14px"
        onclick="startExam(${exam.id})"
      >
        Qormaata Jalqabi →
      </button>

    </div>
  `).join("");
}


/* =========================================================
   START EXAM
========================================================= */

async function startExam(examId) {

  const {
    data: exam,
    error: examError
  } = await supabaseClient
    .from("exams")
    .select("*")
    .eq("id", examId)
    .single();

  if (examError) {

    alert("Qormaata banuun hin danda'amne.");

    return;
  }

  const {
    data: questions,
    error
  } = await supabaseClient
    .from("questions")
    .select("*")
    .eq("exam_id", examId)
    .order("id", {
      ascending: true
    });

  if (error) {

    alert(
      "Gaaffiiwwan qormaataa argachuu hin dandeenye."
    );

    return;
  }

  if (!questions || questions.length === 0) {

    alert(
      "Qormaata kana keessatti gaaffiin hin jiru."
    );

    return;
  }

  currentExam = exam;
  currentQuestions = questions;
  currentQuestionIndex = 0;
  currentAnswers = [];
  selectedAnswer = null;

  document.getElementById("examTitle").textContent =
    exam.title;

  showPage("examPage");

  showQuestion();
}


/* =========================================================
   QUESTION
========================================================= */

function showQuestion() {

  const q =
    currentQuestions[currentQuestionIndex];

  if (!q) return;

  selectedAnswer =
    currentAnswers[currentQuestionIndex] || null;

  document.getElementById("questionNumber").textContent =
    `${currentQuestionIndex + 1} / ${currentQuestions.length}`;

  document.getElementById("questionText").textContent =
    q.question;

  const percent =
    ((currentQuestionIndex + 1) /
      currentQuestions.length) *
    100;

  document.getElementById("progressBar").style.width =
    percent + "%";

  const options = [
    ["A", q.option_a],
    ["B", q.option_b],
    ["C", q.option_c],
    ["D", q.option_d]
  ];

  document.getElementById("optionsBox").innerHTML =
    options.map(([letter, text]) => `
      <button
        class="option ${
          selectedAnswer === letter
            ? "selected"
            : ""
        }"
        onclick="selectAnswer('${letter}')"
      >
        <b>${letter})</b>
        ${escapeHTML(text)}
      </button>
    `).join("");

  const next =
    document.getElementById(
      "nextQuestionButton"
    );

  if (
    currentQuestionIndex ===
    currentQuestions.length - 1
  ) {

    next.textContent =
      "Qormaata Xumuri ✓";

  } else {

    next.textContent =
      "Itti Aanee →";
  }
}


/* =========================================================
   SELECT ANSWER
========================================================= */

function selectAnswer(answer) {

  selectedAnswer = answer;

  currentAnswers[
    currentQuestionIndex
  ] = answer;

  document
    .querySelectorAll(".option")
    .forEach(btn => {

      btn.classList.remove("selected");

      if (
        btn.textContent
          .trim()
          .startsWith(answer + ")")
      ) {
        btn.classList.add("selected");
      }

    });
}


/* =========================================================
   NEXT QUESTION
========================================================= */

async function nextQuestion() {

  if (!selectedAnswer) {

    alert(
      "Mee deebii tokko filadhu."
    );

    return;
  }

  currentAnswers[
    currentQuestionIndex
  ] = selectedAnswer;

  if (
    currentQuestionIndex <
    currentQuestions.length - 1
  ) {

    currentQuestionIndex++;

    showQuestion();

  } else {

    await finishExam();
  }
}


/* =========================================================
   FINISH EXAM
========================================================= */

async function finishExam() {

  let score = 0;

  currentQuestions.forEach(
    (q, index) => {

      if (
        currentAnswers[index] &&
        currentAnswers[index]
          .toUpperCase() ===
        q.correct_answer
          .toUpperCase()
      ) {

        score++;
      }

    }
  );

  const total =
    currentQuestions.length;

  const percentage =
    total > 0
      ? ((score / total) * 100).toFixed(1)
      : 0;

  if (
    currentStudent &&
    currentExam
  ) {

    const {
      error
    } = await supabaseClient
      .from("results")
      .insert([
        {
          student_id:
            currentStudent.id,

          exam_id:
            currentExam.id,

          score:
            score,

          total:
            total,

          percentage:
            percentage
        }
      ]);

    if (error) {

      console.error(error);

      alert(
        "Qormaanni xumurame, garuu bu'aa kuusuu irratti rakkoon uumame."
      );
    }
  }

  showScore(
    score,
    total,
    percentage
  );
}


/* =========================================================
   SCORE
========================================================= */

function showScore(
  score,
  total,
  percentage
) {

  document.getElementById(
    "scoreText"
  ).textContent =
    `${score} / ${total}`;

  document.getElementById(
    "percentageText"
  ).textContent =
    `${percentage}%`;

  document.getElementById(
    "scoreValue"
  ).textContent =
    score;

  document.getElementById(
    "totalValue"
  ).textContent =
    total;

  showPage("scorePage");
}


async function showLatestStudentScore() {

  if (!currentStudent) return;

  const {
    data,
    error
  } = await supabaseClient
    .from("results")
    .select(`
      *,
      exams(title)
    `)
    .eq(
      "student_id",
      currentStudent.id
    )
    .order("created_at", {
      ascending: false
    })
    .limit(1)
    .maybeSingle();

  if (error || !data) {

    showScore(0, 0, 0);

    return;
  }

  showScore(
    data.score,
    data.total,
    data.percentage || 0
  );
}


/* =========================================================
   PROFILE
========================================================= */

function loadProfile() {

  if (!currentStudent) return;

  document.getElementById(
    "profileName"
  ).textContent =
    currentStudent.name;

  document.getElementById(
    "profileCode"
  ).textContent =
    currentStudent.student_code;

  document.getElementById(
    "profileNameInput"
  ).value =
    currentStudent.name;
}


async function saveProfile() {

  const input =
    document.getElementById(
      "profileNameInput"
    );

  const name =
    input.value.trim();

  if (!name) {

    alert("Maqaa galchi.");

    return;
  }

  const {
    data,
    error
  } = await supabaseClient
    .from("students")
    .update({
      name: name
    })
    .eq(
      "id",
      currentStudent.id
    )
    .select()
    .single();

  if (error) {

    alert(
      "Maqaa haaromsuun hin danda'amne."
    );

    return;
  }

  currentStudent = data;

  document.getElementById(
    "profileName"
  ).textContent =
    data.name;

  document.getElementById(
    "studentWelcomeName"
  ).textContent =
    data.name;

  alert(
    "Maqaan kee sirriitti haaromfame."
  );
}


/* =========================================================
   ADMIN LOGIN
========================================================= */

async function adminLogin() {

  const username =
    document.getElementById(
      "adminUsername"
    ).value.trim();

  const password =
    document.getElementById(
      "adminPassword"
    ).value;

  const message =
    document.getElementById(
      "adminLoginMessage"
    );

  if (!username || !password) {

    message.textContent =
      "Username fi password guuti.";

    message.style.color =
      "#dc2626";

    return;
  }

  message.textContent =
    "Seenaa jira...";

  message.style.color =
    "#2563eb";

  const {
    data,
    error
  } = await supabaseClient
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
    .limit(1);

  if (error) {

    message.textContent =
      "Dogoggora: " +
      error.message;

    message.style.color =
      "#dc2626";

    return;
  }

  if (
    !data ||
    data.length === 0
  ) {

    message.textContent =
      "Username ykn password sirrii miti.";

    message.style.color =
      "#dc2626";

    return;
  }

  localStorage.setItem(
    "admin_logged",
    "true"
  );

  showPage("adminPage");

  hideAdminPanels();
}


/* =========================================================
   ADMIN STUDENTS
========================================================= */

async function loadAdminStudents() {

  if (!isAdminLoggedIn()) return;

  const box =
    document.getElementById(
      "adminStudentsList"
    );

  box.innerHTML =
    "<p>Fe'aa jira...</p>";

  const {
    data,
    error
  } = await supabaseClient
    .from("students")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {

    box.innerHTML =
      "<p>" +
      escapeHTML(error.message) +
      "</p>";

    return;
  }

  if (
    !data ||
    data.length === 0
  ) {

    box.innerHTML =
      "<p>Barataan hin jiru.</p>";

    return;
  }

  box.innerHTML =
    data.map(
      (student, i) => `
        <div class="admin-list-item">

          <b>
            ${i + 1}.
            ${escapeHTML(student.name)}
          </b>

          <small>
            Code:
            ${escapeHTML(
              student.student_code
            )}
          </small>

        </div>
      `
    ).join("");
}


/* =========================================================
   ADMIN RESULTS
========================================================= */

async function loadAdminResults() {

  if (!isAdminLoggedIn()) return;

  const box =
    document.getElementById(
      "adminResultsList"
    );

  box.innerHTML =
    "<p>Bu'aa fe'aa jira...</p>";

  const {
    data,
    error
  } = await supabaseClient
    .from("results")
    .select(`
      *,
      students(name, student_code),
      exams(title)
    `)
    .order("created_at", {
      ascending: false
    });

  if (error) {

    box.innerHTML =
      "<p>" +
      escapeHTML(error.message) +
      "</p>";

    return;
  }

  if (
    !data ||
    data.length === 0
  ) {

    box.innerHTML =
      "<p>Bu'aan qormaataa hin jiru.</p>";

    return;
  }

  box.innerHTML =
    data.map(
      result => `
        <div class="admin-list-item result-item">

          <div style="flex:1">

            <b>
              ${escapeHTML(
                result.students?.name ||
                "Barataa"
              )}
            </b>

            <small>

              ${escapeHTML(
                result.exams?.title ||
                "Qormaata"
              )}

              <br>

              Code:
              ${escapeHTML(
                result.students?.student_code ||
                ""
              )}

            </small>

          </div>

          <div
            style="
              display:flex;
              align-items:center;
              gap:10px;
            "
          >

            <div class="result-score">

              ${result.score}/${result.total}

              <br>

              ${result.percentage || 0}%

            </div>

            <button
              onclick="deleteResult(${result.id})"
              style="
                padding:8px 12px;
                border:0;
                border-radius:9px;
                background:#dc2626;
                color:white;
                cursor:pointer;
              "
            >
              🗑️
            </button>

          </div>

        </div>
      `
    ).join("");
}


/* =========================================================
   DELETE RESULT / SCORE
========================================================= */

async function deleteResult(id) {

  if (!isAdminLoggedIn()) {
    alert("⛔ Hojii kana Admin qofa raawwachuu danda'a.");
    return;
  }

  const confirmation =
    confirm(
      "⚠️ Qabxii kana haquu akka barbaaddu mirkaneeffattaa?\n\n" +
      "Qabxiin barataa kun bu'aa keessatti guutumaan guutuutti ni haqama."
    );

  if (!confirmation) return;

  const {
    error
  } = await supabaseClient
    .from("results")
    .delete()
    .eq("id", id);

  if (error) {

    alert(
      "Qabxii haquun hin danda'amne: " +
      error.message
    );

    return;
  }

  alert(
    "🗑️ Qabxiin haqameera."
  );

  await loadAdminResults();
}


/* =========================================================
   CREATE LESSON
========================================================= */

async function createLesson() {

  if (!isAdminLoggedIn()) {
    alert("⛔ Admin qofa.");
    return;
  }

  const title =
    document.getElementById(
      "lessonTitleInput"
    ).value.trim();

  const description =
    document.getElementById(
      "lessonDescriptionInput"
    ).value.trim();

  const content =
    document.getElementById(
      "lessonContentInput"
    ).value.trim();

  const message =
    document.getElementById(
      "lessonCreateMessage"
    );

  if (!title || !content) {

    message.textContent =
      "Mata duree fi qabiyyee guuti.";

    message.style.color =
      "#dc2626";

    return;
  }

  const {
    error
  } = await supabaseClient
    .from("lessons")
    .insert([
      {
        title,
        description,
        content
      }
    ]);

  if (error) {

    message.textContent =
      "Dogoggora: " +
      error.message;

    message.style.color =
      "#dc2626";

    return;
  }

  message.textContent =
    "✅ Barnoonni uumameera.";

  message.style.color =
    "#16a34a";

  document.getElementById(
    "lessonTitleInput"
  ).value = "";

  document.getElementById(
    "lessonDescriptionInput"
  ).value = "";

  document.getElementById(
    "lessonContentInput"
  ).value = "";

  await loadAdminLessons();
}


/* =========================================================
   ADMIN LESSONS
========================================================= */

async function loadAdminLessons() {

  if (!isAdminLoggedIn()) return;

  const box =
    document.getElementById(
      "adminLessonsList"
    );

  box.innerHTML =
    "<p>Barnoota fe'aa jira...</p>";

  const {
    data,
    error
  } = await supabaseClient
    .from("lessons")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {

    box.innerHTML =
      "<p>" +
      escapeHTML(error.message) +
      "</p>";

    return;
  }

  if (
    !data ||
    data.length === 0
  ) {

    box.innerHTML =
      "<p>Barnoonni hin jiru.</p>";

    return;
  }

  box.innerHTML =
    data.map(
      lesson => `
        <div class="admin-list-item">

          <b>
            ${escapeHTML(
              lesson.title
            )}
          </b>

          <small>
            ${escapeHTML(
              lesson.description || ""
            )}
          </small>

          <div
            style="
              display:flex;
              gap:8px;
              margin-top:10px;
              flex-wrap:wrap;
            "
          >

            <button
              onclick="editLesson(${lesson.id})"
              style="
                padding:9px 14px;
                border:0;
                border-radius:10px;
                background:#2563eb;
                color:white;
                cursor:pointer;
              "
            >
              ✏️ Sirreessi
            </button>

            <button
              onclick="deleteLesson(${lesson.id})"
              style="
                padding:9px 14px;
                border:0;
                border-radius:10px;
                background:#dc2626;
                color:white;
                cursor:pointer;
              "
            >
              🗑️ Haqi
            </button>

          </div>

        </div>
      `
    ).join("");
}


/* =========================================================
   EDIT LESSON
========================================================= */

async function editLesson(id) {

  if (!isAdminLoggedIn()) {
    alert("⛔ Admin qofa.");
    return;
  }

  const {
    data: lesson,
    error
  } = await supabaseClient
    .from("lessons")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !lesson) {

    alert(
      "Barnoota argachuun hin danda'amne."
    );

    return;
  }

  const title =
    prompt(
      "Mata duree barnootaa:",
      lesson.title || ""
    );

  if (title === null) return;

  const description =
    prompt(
      "Ibsa gabaabaa:",
      lesson.description || ""
    );

  if (description === null) return;

  const content =
    prompt(
      "Qabiyyee barnootaa:",
      lesson.content || ""
    );

  if (content === null) return;

  if (
    !title.trim() ||
    !content.trim()
  ) {

    alert(
      "Mata duree fi qabiyyee guutuu qabu."
    );

    return;
  }

  const {
    error: updateError
  } = await supabaseClient
    .from("lessons")
    .update({
      title: title.trim(),
      description: description.trim(),
      content: content.trim()
    })
    .eq("id", id);

  if (updateError) {

    alert(
      "Barnoota sirreessuun hin danda'amne: " +
      updateError.message
    );

    return;
  }

  alert(
    "✅ Barnoonni sirriitti haaromfameera."
  );

  await loadAdminLessons();
  await loadStudentHome();
}


/* =========================================================
   DELETE LESSON
========================================================= */

async function deleteLesson(id) {

  if (!isAdminLoggedIn()) {
    alert("⛔ Admin qofa.");
    return;
  }

  const confirmation =
    confirm(
      "⚠️ Barnoota kana haquu akka barbaaddu mirkaneeffattaa?"
    );

  if (!confirmation) return;

  const {
    error
  } = await supabaseClient
    .from("lessons")
    .delete()
    .eq("id", id);

  if (error) {

    alert(
      "Barnoota haquun hin danda'amne: " +
      error.message
    );

    return;
  }

  alert(
    "🗑️ Barnoonni haqameera."
  );

  await loadAdminLessons();
  await loadStudentHome();
}


/* =========================================================
   CREATE EXAM
========================================================= */

async function createExam() {

  if (!isAdminLoggedIn()) {
    alert("⛔ Admin qofa.");
    return;
  }

  const title =
    document.getElementById(
      "examTitleInput"
    ).value.trim();

  const description =
    document.getElementById(
      "examDescriptionInput"
    ).value.trim();

  const message =
    document.getElementById(
      "examCreateMessage"
    );

  if (!title) {

    message.textContent =
      "Maqaa qormaataa galchi.";

    message.style.color =
      "#dc2626";

    return;
  }

  const {
    error
  } = await supabaseClient
    .from("exams")
    .insert([
      {
        title,
        description
      }
    ]);

  if (error) {

    message.textContent =
      "Dogoggora: " +
      error.message;

    message.style.color =
      "#dc2626";

    return;
  }

  message.textContent =
    "✅ Qormaanni uumameera.";

  message.style.color =
    "#16a34a";

  document.getElementById(
    "examTitleInput"
  ).value = "";

  document.getElementById(
    "examDescriptionInput"
  ).value = "";

  await loadAdminExams();
  await loadQuestionExamSelect();
}


/* =========================================================
   ADMIN EXAMS
========================================================= */

async function loadAdminExams() {

  if (!isAdminLoggedIn()) return;

  const box =
    document.getElementById(
      "adminExamsList"
    );

  box.innerHTML =
    "<p>Qormaata fe'aa jira...</p>";

  const {
    data,
    error
  } = await supabaseClient
    .from("exams")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {

    box.innerHTML =
      "<p>" +
      escapeHTML(error.message) +
      "</p>";

    return;
  }

  if (
    !data ||
    data.length === 0
  ) {

    box.innerHTML =
      "<p>Qormaanni hin jiru.</p>";

    return;
  }

  box.innerHTML =
    data.map(
      exam => `
        <div class="admin-list-item">

          <b>
            ${escapeHTML(
              exam.title
            )}
          </b>

          <small>
            ${escapeHTML(
              exam.description || ""
            )}
          </small>

          <div
            style="
              display:flex;
              gap:8px;
              margin-top:10px;
              flex-wrap:wrap;
            "
          >

            <button
              onclick="editExam(${exam.id})"
              style="
                padding:9px 14px;
                border:0;
                border-radius:10px;
                background:#2563eb;
                color:white;
                cursor:pointer;
              "
            >
              ✏️ Sirreessi
            </button>

            <button
              onclick="deleteExam(${exam.id})"
              style="
                padding:9px 14px;
                border:0;
                border-radius:10px;
                background:#dc2626;
                color:white;
                cursor:pointer;
              "
            >
              🗑️ Haqi
            </button>

          </div>

        </div>
      `
    ).join("");
}


/* =========================================================
   EDIT EXAM
========================================================= */

async function editExam(id) {

  if (!isAdminLoggedIn()) {
    alert("⛔ Admin qofa.");
    return;
  }

  const {
    data: exam,
    error
  } = await supabaseClient
    .from("exams")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !exam) {

    alert(
      "Qormaata argachuun hin danda'amne."
    );

    return;
  }

  const title =
    prompt(
      "Maqaa qormaataa:",
      exam.title || ""
    );

  if (title === null) return;

  const description =
    prompt(
      "Ibsa qormaataa:",
      exam.description || ""
    );

  if (description === null) return;

  if (!title.trim()) {

    alert(
      "Maqaa qormaataa galchi."
    );

    return;
  }

  const {
    error: updateError
  } = await supabaseClient
    .from("exams")
    .update({
      title: title.trim(),
      description: description.trim()
    })
    .eq("id", id);

  if (updateError) {

    alert(
      "Qormaata sirreessuun hin danda'amne: " +
      updateError.message
    );

    return;
  }

  alert(
    "✅ Qormaanni sirriitti haaromfameera."
  );

  await loadAdminExams();
  await loadQuestionExamSelect();
  await loadExams();
}


/* =========================================================
   DELETE EXAM + RESULTS + QUESTIONS
========================================================= */

async function deleteExam(id) {

  if (!isAdminLoggedIn()) {
    alert("⛔ Admin qofa.");
    return;
  }

  const confirmation =
    confirm(
      "⚠️ Qormaata kana haquu barbaaddaa?\n\n" +
      "Qormaata kanaan walqabatan:\n" +
      "• Qabxiiwwan barattootaa\n" +
      "• Gaaffiiwwan qormaataa\n" +
      "hundi ni haqamu.\n\n" +
      "Kun deebifamee argamuu hin danda'u."
    );

  if (!confirmation) return;


  /* =====================================================
     1. QABXIIWWAN / RESULTS HAQI
  ===================================================== */

  const {
    error: resultsDeleteError
  } = await supabaseClient
    .from("results")
    .delete()
    .eq("exam_id", id);

  if (resultsDeleteError) {

    alert(
      "❌ Qabxiiwwan haquun hin danda'amne:\n\n" +
      resultsDeleteError.message
    );

    return;
  }


  /* =====================================================
     2. GAAFFIIWWAN HAQI
  ===================================================== */

  const {
    error: questionDeleteError
  } = await supabaseClient
    .from("questions")
    .delete()
    .eq("exam_id", id);

  if (questionDeleteError) {

    alert(
      "❌ Gaaffiiwwan qormaataa haquun hin danda'amne:\n\n" +
      questionDeleteError.message
    );

    return;
  }


  /* =====================================================
     3. QORMAATA HAQI
  ===================================================== */

  const {
    error: examDeleteError
  } = await supabaseClient
    .from("exams")
    .delete()
    .eq("id", id);

  if (examDeleteError) {

    alert(
      "❌ Qormaata haquun hin danda'amne:\n\n" +
      examDeleteError.message
    );

    return;
  }

  alert(
    "✅ Qormaanni haqameera.\n\n" +
    "Qabxiiwwan isaa fi gaaffiiwwan isaa waliin haqamaniiru."
  );

  await loadAdminExams();
  await loadQuestionExamSelect();
  await loadAdminQuestions();
  await loadAdminResults();
  await loadExams();
}


/* =========================================================
   QUESTION SELECT
========================================================= */

async function loadQuestionExamSelect() {

  if (!isAdminLoggedIn()) return;

  const select =
    document.getElementById(
      "questionExamSelect"
    );

  const {
    data,
    error
  } = await supabaseClient
    .from("exams")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) return;

  select.innerHTML =
    '<option value="">Qormaata filadhu</option>';

  data.forEach(exam => {

    const option =
      document.createElement(
        "option"
      );

    option.value =
      exam.id;

    option.textContent =
      exam.title;

    select.appendChild(
      option
    );
  });
}


/* =========================================================
   CREATE QUESTION
========================================================= */

async function createQuestion() {

  if (!isAdminLoggedIn()) {
    alert("⛔ Admin qofa.");
    return;
  }

  const examId =
    document.getElementById(
      "questionExamSelect"
    ).value;

  const question =
    document.getElementById(
      "questionInput"
    ).value.trim();

  const optionA =
    document.getElementById(
      "optionAInput"
    ).value.trim();

  const optionB =
    document.getElementById(
      "optionBInput"
    ).value.trim();

  const optionC =
    document.getElementById(
      "optionCInput"
    ).value.trim();

  const optionD =
    document.getElementById(
      "optionDInput"
    ).value.trim();

  const correct =
    document.getElementById(
      "correctAnswerInput"
    ).value;

  const message =
    document.getElementById(
      "questionCreateMessage"
    );

  if (
    !examId ||
    !question ||
    !optionA ||
    !optionB ||
    !optionC ||
    !optionD ||
    !correct
  ) {

    message.textContent =
      "Mee odeeffannoo gaaffii hunda guuti.";

    message.style.color =
      "#dc2626";

    return;
  }

  const {
    error
  } = await supabaseClient
    .from("questions")
    .insert([
      {
        exam_id:
          Number(examId),

        question:
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
          correct
      }
    ]);

  if (error) {

    message.textContent =
      "Dogoggora: " +
      error.message;

    message.style.color =
      "#dc2626";

    return;
  }

  message.textContent =
    "✅ Gaaffiin qormaataa dabalamera.";

  message.style.color =
    "#16a34a";

  document.getElementById(
    "questionInput"
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

  await loadAdminQuestions();
}


/* =========================================================
   ADMIN QUESTIONS
========================================================= */

async function loadAdminQuestions() {

  if (!isAdminLoggedIn()) return;

  const box =
    document.getElementById(
      "adminQuestionsList"
    );

  box.innerHTML =
    "<p>Gaaffiiwwan fe'aa jira...</p>";

  const {
    data,
    error
  } = await supabaseClient
    .from("questions")
    .select(`
      *,
      exams(title)
    `)
    .order("id", {
      ascending: false
    });

  if (error) {

    box.innerHTML =
      "<p>" +
      escapeHTML(error.message) +
      "</p>";

    return;
  }

  if (
    !data ||
    data.length === 0
  ) {

    box.innerHTML =
      "<p>Gaaffiin hin jiru.</p>";

    return;
  }

  box.innerHTML =
    data.map(
      (q, index) => `
        <div class="admin-list-item">

          <b>
            ${index + 1}.
            ${escapeHTML(q.question)}
          </b>

          <small>

            Qormaata:
            ${escapeHTML(
              q.exams?.title || ""
            )}

            <br><br>

            A)
            ${escapeHTML(
              q.option_a
            )}

            <br>

            B)
            ${escapeHTML(
              q.option_b
            )}

            <br>

            C)
            ${escapeHTML(
              q.option_c
            )}

            <br>

            D)
            ${escapeHTML(
              q.option_d
            )}

            <br><br>

            Deebii sirrii:
            <b>
              ${escapeHTML(
                q.correct_answer
              )}
            </b>

          </small>

        </div>
      `
    ).join("");
}


/* =========================================================
   ADMIN PANELS
========================================================= */

function hideAdminPanels() {

  [
    "adminStudentsPanel",
    "adminResultsPanel",
    "adminLessonsPanel",
    "adminExamsPanel"
  ].forEach(id => {

    const panel =
      document.getElementById(id);

    if (panel) {
      panel.style.display =
        "none";
    }

  });
}


async function openAdminPanel(id) {

  if (!isAdminLoggedIn()) {
    alert("⛔ Admin qofa.");
    showPage("rolePage");
    return;
  }

  hideAdminPanels();

  const panel =
    document.getElementById(id);

  if (!panel) return;

  panel.style.display =
    "block";

  if (
    id ===
    "adminStudentsPanel"
  ) {

    await loadAdminStudents();
  }

  if (
    id ===
    "adminResultsPanel"
  ) {

    await loadAdminResults();
  }

  if (
    id ===
    "adminLessonsPanel"
  ) {

    await loadAdminLessons();
  }

  if (
    id ===
    "adminExamsPanel"
  ) {

    await loadAdminExams();

    await loadQuestionExamSelect();

    await loadAdminQuestions();
  }

  setTimeout(() => {

    panel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  }, 50);
}


/* =========================================================
   LOGOUT
========================================================= */

function studentLogout() {

  localStorage.removeItem(
    "student_id"
  );

  currentStudent = null;

  document.getElementById(
    "nameInput"
  ).value = "";

  showPage("rolePage");
}


function adminLogout() {

  localStorage.removeItem(
    "admin_logged"
  );

  hideAdminPanels();

  showPage("rolePage");
}


/* =========================================================
   NAVIGATION
========================================================= */

function setNav(activeId) {

  document
    .querySelectorAll(".nav-item")
    .forEach(item => {

      item.classList.remove(
        "active"
      );

    });

  const active =
    document.getElementById(
      activeId
    );

  if (active) {
    active.classList.add(
      "active"
    );
  }
}


/* =========================================================
   HELPERS
========================================================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    document
      .getElementById(
        "studentRoleButton"
      )
      .addEventListener(
        "click",
        openStudentLogin
      );

    document
      .getElementById(
        "adminRoleButton"
      )
      .addEventListener(
        "click",
        openAdminLogin
      );


    document
      .getElementById(
        "studentBackButton"
      )
      .addEventListener(
        "click",
        () => {
          showPage(
            "rolePage"
          );
        }
      );


    document
      .getElementById(
        "adminBackButton"
      )
      .addEventListener(
        "click",
        () => {
          showPage(
            "rolePage"
          );
        }
      );


    document
      .getElementById(
        "studentLoginButton"
      )
      .addEventListener(
        "click",
        studentLogin
      );


    document
      .getElementById(
        "adminLoginButton"
      )
      .addEventListener(
        "click",
        adminLogin
      );


    document
      .getElementById(
        "quickExamButton"
      )
      .addEventListener(
        "click",
        async () => {

          setNav(
            "navExams"
          );

          await loadExams();

          showPage(
            "examListPage"
          );

        }
      );


    document
      .getElementById(
        "navHome"
      )
      .addEventListener(
        "click",
        async () => {

          setNav(
            "navHome"
          );

          await loadStudentHome();

          showPage(
            "homePage"
          );

        }
      );


    document
      .getElementById(
        "navExams"
      )
      .addEventListener(
        "click",
        async () => {

          setNav(
            "navExams"
          );

          await loadExams();

          showPage(
            "examListPage"
          );

        }
      );


    document
      .getElementById(
        "navScore"
      )
      .addEventListener(
        "click",
        async () => {

          setNav(
            "navScore"
          );

          await showLatestStudentScore();

        }
      );


    document
      .getElementById(
        "navProfile"
      )
      .addEventListener(
        "click",
        () => {

          setNav(
            "navProfile"
          );

          loadProfile();

          showPage(
            "profilePage"
          );

        }
      );


    document
      .getElementById(
        "lessonBackButton"
      )
      .addEventListener(
        "click",
        () => {

          showPage(
            "homePage"
          );

        }
      );


    document
      .getElementById(
        "examListBackButton"
      )
      .addEventListener(
        "click",
        () => {

          setNav(
            "navHome"
          );

          showPage(
            "homePage"
          );

        }
      );


    document
      .getElementById(
        "examBackButton"
      )
      .addEventListener(
        "click",
        async () => {

          await loadExams();

          showPage(
            "examListPage"
          );

        }
      );


    document
      .getElementById(
        "scoreHomeButton"
      )
      .addEventListener(
        "click",
        async () => {

          setNav(
            "navHome"
          );

          await loadStudentHome();

          showPage(
            "homePage"
          );

        }
      );


    document
      .getElementById(
        "profileBackButton"
      )
      .addEventListener(
        "click",
        () => {

          setNav(
            "navHome"
          );

          showPage(
            "homePage"
          );

        }
      );


    document
      .getElementById(
        "profileSaveButton"
      )
      .addEventListener(
        "click",
        saveProfile
      );


    document
      .getElementById(
        "studentLogoutButton"
      )
      .addEventListener(
        "click",
        studentLogout
      );


    document
      .getElementById(
        "profileNavHome"
      )
      .addEventListener(
        "click",
        async () => {

          setNav(
            "navHome"
          );

          await loadStudentHome();

          showPage(
            "homePage"
          );

        }
      );


    document
      .getElementById(
        "profileNavExams"
      )
      .addEventListener(
        "click",
        async () => {

          setNav(
            "navExams"
          );

          await loadExams();

          showPage(
            "examListPage"
          );

        }
      );


    document
      .getElementById(
        "profileNavScore"
      )
      .addEventListener(
        "click",
        async () => {

          setNav(
            "navScore"
          );

          await showLatestStudentScore();

        }
      );


    document
      .getElementById(
        "profileNavProfile"
      )
      .addEventListener(
        "click",
        () => {

          setNav(
            "navProfile"
          );

          loadProfile();

          showPage(
            "profilePage"
          );

        }
      );


    document
      .getElementById(
        "nextQuestionButton"
      )
      .addEventListener(
        "click",
        nextQuestion
      );


    /* =====================================================
       ADMIN BUTTONS
    ===================================================== */

    document
      .getElementById(
        "adminLogoutButton"
      )
      .addEventListener(
        "click",
        adminLogout
      );


    document
      .getElementById(
        "adminStudentsButton"
      )
      .addEventListener(
        "click",
        () =>
          openAdminPanel(
            "adminStudentsPanel"
          )
      );


    document
      .getElementById(
        "adminResultsButton"
      )
      .addEventListener(
        "click",
        () =>
          openAdminPanel(
            "adminResultsPanel"
          )
      );


    document
      .getElementById(
        "adminLessonsButton"
      )
      .addEventListener(
        "click",
        () =>
          openAdminPanel(
            "adminLessonsPanel"
          )
      );


    document
      .getElementById(
        "adminExamsButton"
      )
      .addEventListener(
        "click",
        () =>
          openAdminPanel(
            "adminExamsPanel"
          )
      );


    document
      .getElementById(
        "closeStudentsPanel"
      )
      .addEventListener(
        "click",
        hideAdminPanels
      );


    document
      .getElementById(
        "closeResultsPanel"
      )
      .addEventListener(
        "click",
        hideAdminPanels
      );


    document
      .getElementById(
        "closeLessonsPanel"
      )
      .addEventListener(
        "click",
        hideAdminPanels
      );


    document
      .getElementById(
        "closeExamsPanel"
      )
      .addEventListener(
        "click",
        hideAdminPanels
      );


    document
      .getElementById(
        "createLessonButton"
      )
      .addEventListener(
        "click",
        createLesson
      );


    document
      .getElementById(
        "createExamButton"
      )
      .addEventListener(
        "click",
        createExam
      );


    document
      .getElementById(
        "createQuestionButton"
      )
      .addEventListener(
        "click",
        createQuestion
      );


    /* =====================================================
       RESTORE
    ===================================================== */

    await restoreStudent();

    const adminLogged =
      localStorage.getItem(
        "admin_logged"
      );


    if (currentStudent) {

      await loadStudentHome();

      showPage(
        "homePage"
      );

    } else if (
      adminLogged === "true"
    ) {

      showPage(
        "adminPage"
      );

    } else {

      showPage(
        "rolePage"
      );

    }

  }
);
