let currentStudent = null;
let currentExam = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let currentAnswers = [];
let selectedAnswer = null;
let studentAuthMode = "new";


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
   HELPERS
========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function generateActivationCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 8; i++) {
    code += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }

  return code;
}


function generateStudentCode(name) {
  const cleanName = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);

  const random = Math.floor(1000 + Math.random() * 9000);

  return `ST-${cleanName || "USER"}-${random}`;
}


function setMessage(id, text, color = "#2563eb") {
  const el = document.getElementById(id);

  if (!el) return;

  el.textContent = text;
  el.style.color = color;
}


/* =========================================================
   ROLE
========================================================= */

function openStudentLogin() {
  showPage("loginPage");
  setStudentAuthMode("new");
}


function openAdminLogin() {
  showPage("adminLoginPage");
}


/* =========================================================
   ADMIN SECURITY
========================================================= */

function isAdminLoggedIn() {
  return localStorage.getItem("admin_logged") === "true";
}


/* =========================================================
   STUDENT AUTH MODE
========================================================= */

function setStudentAuthMode(mode) {
  studentAuthMode = mode;

  const description =
    document.getElementById("studentAuthDescription");

  const newButton =
    document.getElementById("newStudentModeButton");

  const existingButton =
    document.getElementById("existingStudentModeButton");

  const idBox =
    document.getElementById("studentIdBox");

  const codeBox =
    document.getElementById("activationCodeBox");

  const registerButton =
    document.getElementById("studentRegisterButton");

  const loginButton =
    document.getElementById("studentLoginButton");

  if (mode === "new") {

    description.textContent =
      "Account haaraa uumuuf maqaa kee galchi.";

    newButton.classList.add("active");
    existingButton.classList.remove("active");

    idBox.style.display = "none";
    codeBox.style.display = "none";

    registerButton.style.display = "block";
    loginButton.style.display = "none";

  } else {

    description.textContent =
      "Maqaa, Student ID fi Activation Code kee galchi.";

    newButton.classList.remove("active");
    existingButton.classList.add("active");

    idBox.style.display = "block";
    codeBox.style.display = "block";

    registerButton.style.display = "none";
    loginButton.style.display = "block";
  }

  setMessage(
    "studentLoginMessage",
    "",
    "#2563eb"
  );
}


/* =========================================================
   NEW STUDENT REGISTRATION
========================================================= */

async function registerStudent() {

  const nameInput =
    document.getElementById("nameInput");

  const name =
    nameInput.value.trim();

  if (!name) {
    setMessage(
      "studentLoginMessage",
      "Maqaa kee galchi.",
      "#dc2626"
    );
    return;
  }

  setMessage(
    "studentLoginMessage",
    "Account kee uumaa jira...",
    "#2563eb"
  );

  try {

    /* Prevent exact duplicate registration */
    const {
      data: existingStudents,
      error: checkError
    } = await supabaseClient
      .from("students")
      .select("id,name,status,student_code,activation_code")
      .ilike("name", name)
      .limit(1);

    if (checkError) throw checkError;

    if (
      existingStudents &&
      existingStudents.length > 0
    ) {

      const existing =
        existingStudents[0];

      setMessage(
        "studentLoginMessage",
        "Maqaan kun duraan account qaba. 'Account qaba' filadhu; Student ID fi Activation Code galchi.",
        "#dc2626"
      );

      return;
    }


    const studentCode =
      generateStudentCode(name);

    const activationCode =
      generateActivationCode();


    const {
      data,
      error
    } = await supabaseClient
      .from("students")
      .insert([
        {
          name: name,
          student_code: studentCode,
          activation_code: activationCode,
          status: "pending"
        }
      ])
      .select()
      .single();

    if (error) throw error;


    currentStudent = data;

    localStorage.setItem(
      "student_id",
      data.id
    );


    /* Show credentials immediately */
    const message = document.getElementById(
      "studentLoginMessage"
    );

    message.innerHTML = `
      <div style="
        padding:14px;
        margin-top:10px;
        border-radius:12px;
        background:#eff6ff;
        color:#1e3a8a;
        line-height:1.7;
      ">
        <b>✅ Galmeen kee milkaa'eera!</b><br><br>

        🆔 <b>Student ID:</b>
        ${escapeHTML(data.student_code)}
        <br>

        🔐 <b>Activation Code:</b>
        ${escapeHTML(data.activation_code)}
        <br><br>

        ⏳ <b>Status:</b> Eegaa jiru
        <br><br>

        Admin 1 ykn Admin 2 akka siif eeyyamu eegi.
        ID fi Activation Code kee hin dagatin.
      </div>
    `;

    message.style.color = "#1e3a8a";

    /* Do not enter student home while pending */
    localStorage.removeItem("student_id");

  } catch (error) {

    console.error(error);

    setMessage(
      "studentLoginMessage",
      "Dogoggorri uumame: " + error.message,
      "#dc2626"
    );
  }
}


/* =========================================================
   EXISTING STUDENT LOGIN
========================================================= */

async function studentLogin() {

  const name =
    document.getElementById(
      "nameInput"
    ).value.trim();

  const studentCode =
    document.getElementById(
      "studentIdInput"
    ).value.trim();

  const activationCode =
    document.getElementById(
      "activationCodeInput"
    ).value.trim().toUpperCase();


  if (!name) {

    setMessage(
      "studentLoginMessage",
      "Maqaa kee galchi.",
      "#dc2626"
    );

    return;
  }


  if (!studentCode) {

    setMessage(
      "studentLoginMessage",
      "Student ID kee galchi.",
      "#dc2626"
    );

    return;
  }


  if (!activationCode) {

    setMessage(
      "studentLoginMessage",
      "Activation Code kee galchi.",
      "#dc2626"
    );

    return;
  }


  setMessage(
    "studentLoginMessage",
    "Account kee mirkaneessaa jira...",
    "#2563eb"
  );


  try {

    const {
      data,
      error
    } = await supabaseClient
      .from("students")
      .select("*")
      .eq(
        "student_code",
        studentCode
      )
      .eq(
        "activation_code",
        activationCode
      )
      .limit(1);


    if (error) throw error;


    if (
      !data ||
      data.length === 0
    ) {

      setMessage(
        "studentLoginMessage",
        "Student ID ykn Activation Code sirrii miti.",
        "#dc2626"
      );

      return;
    }


    const student =
      data[0];


    if (
      student.status !== "active"
    ) {

      if (
        student.status === "pending" ||
        !student.status
      ) {

        setMessage(
          "studentLoginMessage",
          "⏳ Account kee ammallee Admin irraa hin eeyyamamne.",
          "#d97706"
        );

      } else if (
        student.status === "rejected"
      ) {

        setMessage(
          "studentLoginMessage",
          "❌ Account kee Admin irraa didameera.",
          "#dc2626"
        );

      } else {

        setMessage(
          "studentLoginMessage",
          "Account kee hojii irra hin jiru.",
          "#dc2626"
        );
      }

      return;
    }


    /*
      Name is NOT used to identify the account.
      Student ID + Activation Code identify it.
      Therefore a small name spelling difference
      does not change the account.
    */

    currentStudent = student;

    localStorage.setItem(
      "student_id",
      student.id
    );


    document.getElementById(
      "studentWelcomeName"
    ).textContent =
      student.name;


    await loadStudentHome();

    showPage("homePage");


  } catch (error) {

    console.error(error);

    setMessage(
      "studentLoginMessage",
      "Dogoggora: " + error.message,
      "#dc2626"
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


  const {
    data,
    error
  } = await supabaseClient
    .from("students")
    .select("*")
    .eq("id", id)
    .single();


  if (
    !error &&
    data &&
    data.status === "active"
  ) {

    currentStudent = data;

  } else {

    localStorage.removeItem(
      "student_id"
    );

    currentStudent = null;
  }
}


/* =========================================================
   STUDENT ACCOUNT STATUS
========================================================= */

function showStudentAccountStatus() {

  const box =
    document.getElementById(
      "studentAccountStatus"
    );

  if (!box || !currentStudent) return;

  box.innerHTML = `
    <div style="
      padding:12px;
      border-radius:12px;
      background:#f0fdf4;
      color:#166534;
      margin-bottom:14px;
    ">
      🆔 <b>Student ID:</b>
      ${escapeHTML(currentStudent.student_code)}
    </div>
  `;
}


/* =========================================================
   STUDENT HOME
========================================================= */

async function loadStudentHome() {

  if (!currentStudent) return;


  document.getElementById(
    "studentWelcomeName"
  ).textContent =
    currentStudent.name;


  showStudentAccountStatus();


  const box =
    document.getElementById(
      "studentLessons"
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
      "<p>Barnoota argachuu hin dandeenye.</p>";

    return;
  }


  if (
    !data ||
    data.length === 0
  ) {

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


  box.innerHTML =
    data.map(
      lesson => `
        <div class="lesson-card">

          <div class="card-icon">
            📖
          </div>

          <div>

            <h3>
              ${escapeHTML(lesson.title)}
            </h3>

            <p>
              ${escapeHTML(
                lesson.description ||
                "Barnoota haaraa"
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
      `
    ).join("");
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

    alert(
      "Barnoota banuun hin danda'amne."
    );

    return;
  }


  document.getElementById(
    "lessonDetailTitle"
  ).textContent =
    data.title;


  document.getElementById(
    "lessonDetailDescription"
  ).textContent =
    data.description || "";


  document.getElementById(
    "lessonDetailContent"
  ).textContent =
    data.content || "";


  showPage(
    "lessonDetailPage"
  );
}


/* =========================================================
   EXAMS - STUDENT
========================================================= */

async function loadExams() {

  const box =
    document.getElementById(
      "examList"
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
      "<p>Qormaata argachuu hin dandeenye.</p>";

    return;
  }


  if (
    !data ||
    data.length === 0
  ) {

    box.innerHTML = `
      <div class="exam-card">

        <h3>
          📝 Qormaanni hin jiru
        </h3>

        <p>
          Admin qormaata yeroo booda ni uuma.
        </p>

      </div>
    `;

    return;
  }


  box.innerHTML =
    data.map(
      exam => `
        <div class="exam-card">

          <div class="card-icon">
            📝
          </div>

          <h3>
            ${escapeHTML(exam.title)}
          </h3>

          <p>
            ${escapeHTML(
              exam.description ||
              "Qormaata"
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
      `
    ).join("");
}


/* =========================================================
   START EXAM
========================================================= */

async function startExam(examId) {

  if (!currentStudent) {

    alert(
      "Mee jalqaba akka barataa seeni."
    );

    return;
  }


  const {
    data: exam,
    error: examError
  } = await supabaseClient
    .from("exams")
    .select("*")
    .eq("id", examId)
    .single();


  if (examError) {

    alert(
      "Qormaata banuun hin danda'amne."
    );

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


  if (
    !questions ||
    questions.length === 0
  ) {

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


  document.getElementById(
    "examTitle"
  ).textContent =
    exam.title;


  showPage(
    "examPage"
  );


  showQuestion();
}


/* =========================================================
   QUESTION
========================================================= */

function showQuestion() {

  const q =
    currentQuestions[
      currentQuestionIndex
    ];


  if (!q) return;


  selectedAnswer =
    currentAnswers[
      currentQuestionIndex
    ] || null;


  document.getElementById(
    "questionNumber"
  ).textContent =
    `${currentQuestionIndex + 1} / ${currentQuestions.length}`;


  document.getElementById(
    "questionText"
  ).textContent =
    q.question;


  const percent =
    (
      ((currentQuestionIndex + 1) /
        currentQuestions.length) *
      100
    );


  document.getElementById(
    "progressBar"
  ).style.width =
    percent + "%";


  const options = [
    ["A", q.option_a],
    ["B", q.option_b],
    ["C", q.option_c],
    ["D", q.option_d]
  ];


  document.getElementById(
    "optionsBox"
  ).innerHTML =
    options.map(
      ([letter, text]) => `
        <button
          class="option ${
            selectedAnswer === letter
              ? "selected"
              : ""
          }"
          onclick="selectAnswer('${letter}')"
          type="button"
        >
          <b>${letter})</b>
          ${escapeHTML(text)}
        </button>
      `
    ).join("");


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

  selectedAnswer =
    answer;


  currentAnswers[
    currentQuestionIndex
  ] = answer;


  document
    .querySelectorAll(".option")
    .forEach(btn => {

      btn.classList.remove(
        "selected"
      );


      const text =
        btn.textContent.trim();


      if (
        text.startsWith(
          answer + ")"
        )
      ) {

        btn.classList.add(
          "selected"
        );
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
        String(
          q.correct_answer || ""
        ).toUpperCase()
      ) {

        score++;
      }

    }
  );


  const total =
    currentQuestions.length;


  const percentage =
    total > 0
      ? Number(
          ((score / total) * 100)
            .toFixed(1)
        )
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


  showPage(
    "scorePage"
  );
}


/* =========================================================
   STUDENT SCORE
========================================================= */

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


  if (
    error ||
    !data
  ) {

    showScore(
      0,
      0,
      0
    );

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
    currentStudent.student_code ||
    "-";


  const activation =
    document.getElementById(
      "profileActivationCode"
    );

  if (activation) {
    activation.textContent =
      currentStudent.activation_code ||
      "-";
  }


  const status =
    document.getElementById(
      "profileStatus"
    );

  if (status) {

    status.textContent =
      currentStudent.status === "active"
        ? "Active"
        : currentStudent.status || "-";
  }


  document.getElementById(
    "profileNameInput"
  ).value =
    currentStudent.name;
}


async function saveProfile() {

  if (!currentStudent) return;


  const input =
    document.getElementById(
      "profileNameInput"
    );


  const name =
    input.value.trim();


  if (!name) {

    alert(
      "Maqaa galchi."
    );

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


  currentStudent =
    data;


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


  if (
    !username ||
    !password
  ) {

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


  showPage(
    "adminPage"
  );


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
    "<p>Barattoota fe'aa jira...</p>";


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
      escapeHTML(
        error.message
      ) +
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
      (student, index) => {

        const status =
          student.status ||
          "pending";


        let statusText =
          "⏳ Pending";

        let statusColor =
          "#d97706";


        if (
          status === "active"
        ) {

          statusText =
            "✅ Active";

          statusColor =
            "#16a34a";

        } else if (
          status === "rejected"
        ) {

          statusText =
            "❌ Rejected";

          statusColor =
            "#dc2626";
        }


        return `
          <div
            class="admin-list-item"
            style="margin-bottom:12px;"
          >

            <b>
              ${index + 1}.
              ${escapeHTML(
                student.name
              )}
            </b>

            <small>

              🆔 Student ID:
              <b>
                ${escapeHTML(
                  student.student_code || "-"
                )}
              </b>

              <br>

              🔐 Activation Code:
              <b>
                ${escapeHTML(
                  student.activation_code || "-"
                )}
              </b>

              <br>

              📌 Status:
              <b style="color:${statusColor}">
                ${statusText}
              </b>

            </small>


            <div
              style="
                display:flex;
                gap:7px;
                flex-wrap:wrap;
                margin-top:10px;
              "
            >

              ${
                status !== "active"
                  ? `
                    <button
                      onclick="approveStudent('${student.id}')"
                      style="
                        padding:8px 12px;
                        border:0;
                        border-radius:9px;
                        background:#16a34a;
                        color:white;
                        cursor:pointer;
                      "
                    >
                      ✅ Eeyyami
                    </button>
                  `
                  : ""
              }


              ${
                status !== "rejected"
                  ? `
                    <button
                      onclick="rejectStudent('${student.id}')"
                      style="
                        padding:8px 12px;
                        border:0;
                        border-radius:9px;
                        background:#dc2626;
                        color:white;
                        cursor:pointer;
                      "
                    >
                      ❌ Didii
                    </button>
                  `
                  : ""
              }


              <button
                onclick="deleteStudent('${student.id}')"
                style="
                  padding:8px 12px;
                  border:0;
                  border-radius:9px;
                  background:#6b7280;
                  color:white;
                  cursor:pointer;
                "
              >
                🗑️ Haqi
              </button>

            </div>

          </div>
        `;
      }
    ).join("");
}


/* =========================================================
   APPROVE STUDENT
========================================================= */

async function approveStudent(id) {

  if (!isAdminLoggedIn()) return;


  const {
    error
  } = await supabaseClient
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
      "Barataa eeyyamuu hin dandeenye:\n" +
      error.message
    );

    return;
  }


  alert(
    "✅ Barataan eeyyamameera."
  );


  await loadAdminStudents();
}


/* =========================================================
   REJECT STUDENT
========================================================= */

async function rejectStudent(id) {

  if (!isAdminLoggedIn()) return;


  const confirmation =
    confirm(
      "Barataa kana diduu barbaaddaa?"
    );


  if (!confirmation) return;


  const {
    error
  } = await supabaseClient
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
      "Barataa diduun hin danda'amne:\n" +
      error.message
    );

    return;
  }


  alert(
    "❌ Barataan didameera."
  );


  await loadAdminStudents();
}


/* =========================================================
   DELETE STUDENT
========================================================= */

async function deleteStudent(id) {

  if (!isAdminLoggedIn()) return;


  const confirmation =
    confirm(
      "⚠️ Barataa kana haquu barbaaddaa?\n\n" +
      "Qabxiiwwan isaa waliin account isaa ni haqama."
    );


  if (!confirmation) return;


  /* Delete results first */
  const {
    error: resultError
  } = await supabaseClient
    .from("results")
    .delete()
    .eq(
      "student_id",
      id
    );


  if (resultError) {

    alert(
      "Qabxiiwwan barataa haquun hin danda'amne:\n" +
      resultError.message
    );

    return;
  }


  const {
    error
  } = await supabaseClient
    .from("students")
    .delete()
    .eq(
      "id",
      id
    );


  if (error) {

    alert(
      "Barataa haquun hin danda'amne:\n" +
      error.message
    );

    return;
  }


  alert(
    "🗑️ Account barataa haqameera."
  );


  await loadAdminStudents();
  await loadAdminResults();
}


/* =========================================================
   ADMIN RESULTS TABLE
========================================================= */

async function loadAdminResults() {

  if (!isAdminLoggedIn()) return;


  const tbody =
    document.getElementById(
      "adminResultsTableBody"
    );


  const thead =
    document.getElementById(
      "adminResultsTableHead"
    );


  if (!tbody || !thead) return;


  tbody.innerHTML =
    `<tr>
      <td colspan="10">
        Bu'aa fe'aa jira...
      </td>
    </tr>`;


  const [
    studentsResponse,
    examsResponse,
    resultsResponse
  ] = await Promise.all([

    supabaseClient
      .from("students")
      .select("*")
      .order("created_at", {
        ascending: true
      }),

    supabaseClient
      .from("exams")
      .select("*")
      .order("created_at", {
        ascending: true
      }),

    supabaseClient
      .from("results")
      .select("*")
  ]);


  if (
    studentsResponse.error ||
    examsResponse.error ||
    resultsResponse.error
  ) {

    const error =
      studentsResponse.error ||
      examsResponse.error ||
      resultsResponse.error;


    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          ${escapeHTML(
            error.message
          )}
        </td>
      </tr>
    `;

    return;
  }


  const students =
    studentsResponse.data || [];

  const exams =
    examsResponse.data || [];

  const results =
    resultsResponse.data || [];


  /*
    Dynamic exam columns
  */

  thead.innerHTML = `
    <tr>

      <th>#</th>

      <th>Barataa</th>

      <th>Student ID</th>

      ${exams.map(
        exam => `
          <th>
            ${escapeHTML(
              exam.title
            )}
          </th>
        `
      ).join("")}

      <th>Total</th>

      <th>Average</th>

      <th>Rank</th>

    </tr>
  `;


  if (
    students.length === 0
  ) {

    tbody.innerHTML = `
      <tr>
        <td colspan="${6 + exams.length}">
          Barataan hin jiru.
        </td>
      </tr>
    `;

    return;
  }


  /*
    Calculate student statistics
  */

  const studentStats =
    students.map(
      student => {

        const studentResults =
          results.filter(
            result =>
              String(
                result.student_id
              ) ===
              String(
                student.id
              )
          );


        let totalScore = 0;
        let totalPossible = 0;
        let percentageSum = 0;


        studentResults.forEach(
          result => {

            totalScore +=
              Number(
                result.score || 0
              );

            totalPossible +=
              Number(
                result.total || 0
              );

            percentageSum +=
              Number(
                result.percentage || 0
              );
          }
        );


        const completed =
          studentResults.length;


        const average =
          completed > 0
            ? Number(
                (
                  percentageSum /
                  completed
                ).toFixed(1)
              )
            : 0;


        return {
          student,
          studentResults,
          totalScore,
          totalPossible,
          average
        };
      }
    );


  /*
    Rank:
    higher average first.
    Students with no result remain without rank.
  */

  const ranked =
    studentStats
      .filter(
        item =>
          item.studentResults.length > 0
      )
      .sort(
        (a, b) =>
          b.average -
          a.average
      );


  let previousAverage = null;
  let currentRank = 0;


  ranked.forEach(
    (item, index) => {

      if (
        previousAverage === null ||
        item.average !== previousAverage
      ) {

        currentRank =
          index + 1;
      }


      item.rank =
        currentRank;


      previousAverage =
        item.average;
    }
  );


  const rankMap =
    new Map();


  ranked.forEach(
    item => {

      rankMap.set(
        String(
          item.student.id
        ),
        item.rank
      );

    }
  );


  /*
    Build table
  */

  tbody.innerHTML =
    studentStats.map(
      (item, index) => {

        const {
          student,
          studentResults,
          totalScore,
          average
        } = item;


        const resultMap =
          new Map();


        studentResults.forEach(
          result => {

            resultMap.set(
              String(
                result.exam_id
              ),
              result
            );

          }
        );


        const examCells =
          exams.map(
            exam => {

              const result =
                resultMap.get(
                  String(exam.id)
                );


              if (!result) {

                return `
                  <td>
                    —
                  </td>
                `;
              }


              return `
                <td>
                  <b>
                    ${escapeHTML(
                      result.score
                    )}/${escapeHTML(
                      result.total
                    )}
                  </b>
                  <br>
                  <small>
                    ${escapeHTML(
                      result.percentage || 0
                    )}%
                  </small>
                </td>
              `;
            }
          ).join("");


        const rank =
          rankMap.get(
            String(
              student.id
            )
          );


        return `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              <b>
                ${escapeHTML(
                  student.name
                )}
              </b>
            </td>

            <td>
              ${escapeHTML(
                student.student_code || "-"
              )}
            </td>

            ${examCells}

            <td>
              <b>
                ${totalScore}
              </b>
            </td>

            <td>
              <b>
                ${
                  studentResults.length > 0
                    ? average + "%"
                    : "—"
                }
              </b>
            </td>

            <td>
              <b>
                ${
                  rank
                    ? "#" + rank
                    : "—"
                }
              </b>
            </td>

          </tr>
        `;
      }
    ).join("");
}


/* =========================================================
   OLD RESULT LIST SUPPORT
========================================================= */

async function loadOldAdminResults() {

  const box =
    document.getElementById(
      "adminResultsList"
    );

  if (!box) return;


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
      escapeHTML(
        error.message
      ) +
      "</p>";

    return;
  }


  if (
    !data ||
    data.length === 0
  ) {

    box.innerHTML =
      "<p>Bu'aan hin jiru.</p>";

    return;
  }


  box.innerHTML =
    data.map(
      result => `
        <div class="admin-list-item">

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

            ${result.score}/${result.total}
            (${result.percentage || 0}%)
          </small>

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
            🗑️ Haqi
          </button>

        </div>
      `
    ).join("");
}


/* =========================================================
   DELETE RESULT
========================================================= */

async function deleteResult(id) {

  if (!isAdminLoggedIn()) {
    alert(
      "⛔ Admin qofa."
    );
    return;
  }


  const confirmation =
    confirm(
      "⚠️ Qabxii kana haquu akka barbaaddu mirkaneeffattaa?"
    );


  if (!confirmation) return;


  const {
    error
  } = await supabaseClient
    .from("results")
    .delete()
    .eq(
      "id",
      id
    );


  if (error) {

    alert(
      "Qabxii haquun hin danda'amne:\n" +
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


  if (
    !title ||
    !content
  ) {

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
      escapeHTML(
        error.message
      ) +
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


  if (
    error ||
    !lesson
  ) {

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
      title:
        title.trim(),

      description:
        description.trim(),

      content:
        content.trim()
    })
    .eq(
      "id",
      id
    );


  if (updateError) {

    alert(
      "Barnoota sirreessuun hin danda'amne:\n" +
      updateError.message
    );

    return;
  }


  alert(
    "✅ Barnoonni haaromfameera."
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
    .eq(
      "id",
      id
    );


  if (error) {

    alert(
      "Barnoota haquun hin danda'amne:\n" +
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
      escapeHTML(
        error.message
      ) +
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


  if (
    error ||
    !exam
  ) {

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
      title:
        title.trim(),

      description:
        description.trim()
    })
    .eq(
      "id",
      id
    );


  if (updateError) {

    alert(
      "Qormaata sirreessuun hin danda'amne:\n" +
      updateError.message
    );

    return;
  }


  alert(
    "✅ Qormaanni haaromfameera."
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
      "Qabxiiwwan barattootaa fi gaaffiiwwan isaa hundi ni haqamu."
    );


  if (!confirmation) return;


  const {
    error: resultsDeleteError
  } = await supabaseClient
    .from("results")
    .delete()
    .eq(
      "exam_id",
      id
    );


  if (resultsDeleteError) {

    alert(
      "Qabxiiwwan haquun hin danda'amne:\n" +
      resultsDeleteError.message
    );

    return;
  }


  const {
    error: questionDeleteError
  } = await supabaseClient
    .from("questions")
    .delete()
    .eq(
      "exam_id",
      id
    );


  if (questionDeleteError) {

    alert(
      "Gaaffiiwwan haquun hin danda'amne:\n" +
      questionDeleteError.message
    );

    return;
  }


  const {
    error: examDeleteError
  } = await supabaseClient
    .from("exams")
    .delete()
    .eq(
      "id",
      id
    );


  if (examDeleteError) {

    alert(
      "Qormaata haquun hin danda'amne:\n" +
      examDeleteError.message
    );

    return;
  }


  alert(
    "✅ Qormaanni, gaaffiiwwan isaa fi qabxiiwwan isaa haqamaniiru."
  );


  await loadAdminExams();
  await loadQuestionExamSelect();
  await loadAdminQuestions();
  await loadAdminResults();
  await loadExams();
}


/* =========================================================
   QUESTION EXAM SELECT
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


  (data || []).forEach(
    exam => {

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
    }
  );
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
    "✅ Gaaffiin dabalameera.";

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
      escapeHTML(
        error.message
      ) +
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
            ${escapeHTML(
              q.question
            )}
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

    alert(
      "⛔ Admin qofa."
    );

    showPage(
      "rolePage"
    );

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


  setTimeout(
    () => {

      panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

    },
    50
  );
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


  const idInput =
    document.getElementById(
      "studentIdInput"
    );

  if (idInput) {
    idInput.value = "";
  }


  const codeInput =
    document.getElementById(
      "activationCodeInput"
    );

  if (codeInput) {
    codeInput.value = "";
  }


  showPage(
    "rolePage"
  );
}


function adminLogout() {

  localStorage.removeItem(
    "admin_logged"
  );


  hideAdminPanels();


  showPage(
    "rolePage"
  );
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
   START APP
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    /* ROLE */

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


    /* STUDENT AUTH MODE */

    document
      .getElementById(
        "newStudentModeButton"
      )
      .addEventListener(
        "click",
        () =>
          setStudentAuthMode(
            "new"
          )
      );


    document
      .getElementById(
        "existingStudentModeButton"
      )
      .addEventListener(
        "click",
        () =>
          setStudentAuthMode(
            "existing"
          )
      );


    /* BACK */

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


    /* STUDENT */

    document
      .getElementById(
        "studentRegisterButton"
      )
      .addEventListener(
        "click",
        registerStudent
      );


    document
      .getElementById(
        "studentLoginButton"
      )
      .addEventListener(
        "click",
        studentLogin
      );


    /* ADMIN */

    document
      .getElementById(
        "adminLoginButton"
      )
      .addEventListener(
        "click",
        adminLogin
      );


    /* QUICK EXAM */

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


    /* HOME */

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


    /* EXAMS */

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


    /* SCORE */

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


    /* PROFILE */

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


    /* LESSON BACK */

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


    /* EXAM LIST BACK */

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


    /* EXAM BACK */

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


    /* SCORE HOME */

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


    /* PROFILE BACK */

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


    /* SAVE PROFILE */

    document
      .getElementById(
        "profileSaveButton"
      )
      .addEventListener(
        "click",
        saveProfile
      );


    /* STUDENT LOGOUT */

    document
      .getElementById(
        "studentLogoutButton"
      )
      .addEventListener(
        "click",
        studentLogout
      );


    /* PROFILE NAV HOME */

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


    /* PROFILE NAV EXAMS */

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


    /* PROFILE NAV SCORE */

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


    /* PROFILE NAV PROFILE */

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


    /* NEXT QUESTION */

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


    /* CLOSE PANELS */

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


    /* ADMIN CREATE */

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
       RESTORE SESSION
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
