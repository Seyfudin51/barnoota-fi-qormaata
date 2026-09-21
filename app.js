const SUPABASE_URL = "https://xhkkaevhcqvkwabcsljm.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_8nBE4n2bQ1jRnEr_83FrdA_vSqqIpSz";

const { createClient } = supabase;

const db = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


let currentStudent = null;
let currentExam = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let currentAnswers = [];
let selectedAnswer = null;


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


function showStudentMessage(message, type = "info") {

  const el = document.getElementById(
    "studentLoginMessage"
  );

  if (!el) return;

  el.innerHTML = message;
  el.className = `message ${type}`;
}


function showAdminMessage(message, type = "info") {

  const el = document.getElementById(
    "adminLoginMessage"
  );

  if (!el) return;

  el.innerHTML = message;
  el.className = `message ${type}`;
}


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


async function studentRegister() {

  const name =
    document
      .getElementById("nameInput")
      .value
      .trim();

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
            name: name,
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


    document.getElementById(
      "nameInput"
    ).value = "";


  } catch (error) {

    console.error(error);

    showStudentMessage(
      "❌ Galmeen hin milkoofne: " +
      escapeHtml(error.message),
      "error"
    );
  }
}


async function studentLogin() {

  const studentId =
    document
      .getElementById("studentIdInput")
      .value
      .trim();


  const activationCode =
    document
      .getElementById("activationCodeInput")
      .value
      .trim();


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

          <p>
            Galmeen kee fudhatameera.
          </p>

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

          <p>
            Maaloo Admin qunnami.
          </p>

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
      escapeHtml(error.message),
      "error"
    );
  }
}


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

      localStorage.removeItem(
        "student_id"
      );

      currentStudent = null;

      return;
    }


    currentStudent = data;

    await loadStudentHome();

    showPage("studentHomePage");


  } catch (error) {

    console.error(error);

    localStorage.removeItem(
      "student_id"
    );
  }
}


async function loadStudentHome() {

  if (!currentStudent) return;


  document.getElementById(
    "studentWelcomeName"
  ).textContent =
    `Baga nagaan dhuftan, ${currentStudent.name}`;


  document.getElementById(
    "studentHomeMessage"
  ).textContent =
    `Student ID: ${currentStudent.student_code}`;


  const container =
    document.getElementById(
      "studentLessons"
    );


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

    alert(error.message);

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


async function loadExams() {

  const container =
    document.getElementById(
      "studentExams"
    );


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


  container.innerHTML =
    data.map(exam => `

      <div class="card">

        <h3>
          📝 ${escapeHtml(exam.title)}
        </h3>

        <p>
          ${escapeHtml(
            exam.description || ""
          )}
        </p>

        <button
          class="primary-btn"
          onclick="startExam('${exam.id}')"
        >
          Qormaata Jalqabi →
        </button>

      </div>

    `).join("");
}


async function startExam(examId) {

  const exam =
    await db
      .from("exams")
      .select("*")
      .eq("id", examId)
      .single();


  if (exam.error) {

    alert(exam.error.message);

    return;
  }


  const questions =
    await db
      .from("questions")
      .select("*")
      .eq("exam_id", examId)
      .order("created_at", {
        ascending: true
      });


  if (questions.error) {

    alert(questions.error.message);

    return;
  }


  currentExam = exam.data;

  currentQuestions =
    questions.data || [];


  if (currentQuestions.length === 0) {

    alert(
      "Qormaata kana keessatti gaaffiin hin jiru."
    );

    return;
  }


  currentQuestionIndex = 0;

  currentAnswers =
    new Array(
      currentQuestions.length
    ).fill(null);


  selectedAnswer = null;


  document.getElementById(
    "examTitle"
  ).textContent =
    currentExam.title;


  showPage("examPage");

  showQuestion();
}


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


  document.getElementById(
    "questionNumber"
  ).textContent =
    `${currentQuestionIndex + 1} / ${currentQuestions.length}`;


  document.getElementById(
    "questionText"
  ).textContent =
    question.question ||
    question.text ||
    "";


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


function selectAnswer(answer) {

  selectedAnswer = answer;


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
          ?.textContent;


      if (letter === answer) {

        button.classList.add(
          "selected"
        );

      }

    });


  updateNextButton();
}


function updateNextButton() {

  const button =
    document.getElementById(
      "nextQuestionButton"
    );


  button.disabled =
    !selectedAnswer;


  button.textContent =
    currentQuestionIndex ===
    currentQuestions.length - 1
      ? "Qormaata Xumuri ✓"
      : "Itti Aanuu →";
}


function nextQuestion() {

  if (!selectedAnswer) {

    alert("Deebii tokko filadhu.");

    return;
  }


  if (
    currentQuestionIndex <
    currentQuestions.length - 1
  ) {

    currentQuestionIndex++;

    showQuestion();

  } else {

    finishExam();
  }
}


async function finishExam() {

  let score = 0;


  currentQuestions.forEach(
    (question, index) => {

      const answer =
        currentAnswers[index];


      const correct =
        String(
          question.correct_answer || ""
        ).toUpperCase();


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


  const existing =
    await db
      .from("results")
      .select("id")
      .eq("student_id", currentStudent.id)
      .eq("exam_id", currentExam.id)
      .maybeSingle();


  if (existing.error) {

    alert(existing.error.message);

    return;
  }


  let error;


  if (existing.data) {

    const result =
      await db
        .from("results")
        .update({
          score,
          total,
          percentage
        })
        .eq("id", existing.data.id);


    error = result.error;

  } else {

    const result =
      await db
        .from("results")
        .insert([
          {
            student_id: currentStudent.id,
            exam_id: currentExam.id,
            score,
            total,
            percentage
          }
        ]);


    error = result.error;
  }


  if (error) {

    alert(
      "Qabxii olkaa'uu hin dandeenye: " +
      error.message
    );

    return;
  }


  alert(
    `Qormaata xumurame!\n\nQabxii: ${score}/${total}\nDhibbeentaa: ${percentage}%`
  );


  showPage("scorePage");

  await showScore();
}


async function showScore() {

  const container =
    document.getElementById(
      "studentScore"
    );


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
      .eq("student_id", currentStudent.id)
      .order("created_at", {
        ascending: false
      });


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


function loadProfile() {

  if (!currentStudent) return;


  document.getElementById(
    "profileNameInput"
  ).value =
    currentStudent.name || "";


  document.getElementById(
    "profileCode"
  ).textContent =
    currentStudent.student_code || "";


  document.getElementById(
    "profileActivationCode"
  ).textContent =
    currentStudent.activation_code || "";


  document.getElementById(
    "profileStatus"
  ).textContent =
    currentStudent.status === "active"
      ? "✅ Active"
      : currentStudent.status;
}


async function saveProfile() {

  const name =
    document
      .getElementById(
        "profileNameInput"
      )
      .value
      .trim();


  if (!name) {

    alert("Maqaa galchi.");

    return;
  }


  const { data, error } =
    await db
      .from("students")
      .update({
        name
      })
      .eq("id", currentStudent.id)
      .select()
      .single();


  if (error) {

    alert(error.message);

    return;
  }


  currentStudent = data;


  alert("✅ Maqaan kee jijjiirame.");

  await loadStudentHome();

  loadProfile();
}


async function adminLogin() {

  const username =
    document
      .getElementById(
        "adminUsername"
      )
      .value
      .trim();


  const password =
    document.getElementById(
      "adminPassword"
    ).value;


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
      .eq("username", username)
      .eq("password", password)
      .maybeSingle();


  if (error) {

    showAdminMessage(
      error.message,
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


  showPage("adminPage");

  openAdminPanel("students");
}


function hideAdminPanels() {

  document
    .querySelectorAll(".admin-panel")
    .forEach(panel => {

      panel.style.display = "none";

    });
}


async function openAdminPanel(panel) {

  hideAdminPanels();


  if (panel === "students") {

    document.getElementById(
      "adminStudentsPanel"
    ).style.display = "block";

    await loadAdminStudents();

  }


  if (panel === "results") {

    document.getElementById(
      "adminResultsPanel"
    ).style.display = "block";

    await loadAdminResults();

  }


  if (panel === "lessons") {

    document.getElementById(
      "adminLessonsPanel"
    ).style.display = "block";

    await loadAdminLessons();

  }


  if (panel === "exams") {

    document.getElementById(
      "adminExamsPanel"
    ).style.display = "block";

    await loadAdminExams();

    await loadQuestionExamSelect();

    await loadAdminQuestions();

  }
}


async function loadAdminStudents() {

  const container =
    document.getElementById(
      "adminStudentsList"
    );


  const { data, error } =
    await db
      .from("students")
      .select("*")
      .order("created_at", {
        ascending: false
      });


  if (error) {

    container.innerHTML =
      `<p>❌ ${escapeHtml(error.message)}</p>`;

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

            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                ${escapeHtml(student.name)}
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
      .eq("id", id);


  if (error) {

    alert(error.message);

    return;
  }


  alert("✅ Barataan hayyamame.");

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
      .eq("id", id);


  if (error) {

    alert(error.message);

    return;
  }


  alert("❌ Barataan didame.");

  await loadAdminStudents();
}


async function deleteStudent(id) {

  if (
    !confirm(
      "Barataa kana guutummaatti haquu barbaaddaa?"
    )
  ) return;


  const resultDelete =
    await db
      .from("results")
      .delete()
      .eq("student_id", id);


  if (resultDelete.error) {

    alert(resultDelete.error.message);

    return;
  }


  const { error } =
    await db
      .from("students")
      .delete()
      .eq("id", id);


  if (error) {

    alert(error.message);

    return;
  }


  alert("✅ Barataan haqame.");

  await loadAdminStudents();

  await loadAdminResults();
}


async function loadAdminResults() {

  const table =
    document.getElementById(
      "adminResultsTable"
    );


  const studentsResult =
    await db
      .from("students")
      .select("*")
      .order("name", {
        ascending: true
      });


  const examsResult =
    await db
      .from("exams")
      .select("*")
      .order("created_at", {
        ascending: true
      });


  const resultsResult =
    await db
      .from("results")
      .select("*");


  if (
    studentsResult.error ||
    examsResult.error ||
    resultsResult.error
  ) {

    table.querySelector(
      "tbody"
    ).innerHTML = `
      <tr>
        <td>
          ❌ Qabxii fe'uu hin dandeenye.
        </td>
      </tr>
    `;

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
          ${escapeHtml(exam.title)}
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
            Number(result.score || 0);

          averageTotal +=
            Number(
              result.percentage || 0
            );

          count++;

        } else {

          examValues[exam.id] = "—";
        }

      });


      const average =
        count
          ? Math.round(
              averageTotal / count
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
    [...rows].sort((a, b) =>
      b.average - a.average ||
      b.total - a.total
    );


  ranked.forEach((row, index) => {

    if (row.count === 0) {

      row.rank = "—";

    } else {

      row.rank = index + 1;

    }

  });


  rows.sort((a, b) =>
    a.student.name.localeCompare(
      b.student.name
    )
  );


  table.querySelector(
    "tbody"
  ).innerHTML = rows.map(
    (row, index) => `

      <tr>

        <td>
          ${index + 1}
        </td>

        <td>
          <strong>
            ${escapeHtml(row.student.name)}
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
            ${row.examValues[exam.id]}
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


async function createLesson() {

  const title =
    document
      .getElementById(
        "lessonTitleInput"
      )
      .value
      .trim();


  const content =
    document
      .getElementById(
        "lessonContentInput"
      )
      .value
      .trim();


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

    alert(error.message);

    return;
  }


  document.getElementById(
    "lessonTitleInput"
  ).value = "";


  document.getElementById(
    "lessonContentInput"
  ).value = "";


  alert("✅ Barnoonni dabalamе.");

  await loadAdminLessons();

  await loadStudentHome();
}


async function loadAdminLessons() {

  const container =
    document.getElementById(
      "adminLessonsList"
    );


  const { data, error } =
    await db
      .from("lessons")
      .select("*")
      .order("created_at", {
        ascending: false
      });


  if (error) {

    container.innerHTML =
      `<p>❌ ${escapeHtml(error.message)}</p>`;

    return;
  }


  container.innerHTML =
    (data || []).map(lesson => `

      <div class="card">

        <h3>
          📚 ${escapeHtml(lesson.title)}
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

    `).join("");
}


async function editLesson(id) {

  const { data, error } =
    await db
      .from("lessons")
      .select("*")
      .eq("id", id)
      .single();


  if (error) {

    alert(error.message);

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


  const { error: updateError } =
    await db
      .from("lessons")
      .update({
        title: title.trim(),
        content: content.trim()
      })
      .eq("id", id);


  if (updateError) {

    alert(updateError.message);

    return;
  }


  alert("✅ Barnoonni sirreeffame.");

  await loadAdminLessons();

  await loadStudentHome();
}


async function deleteLesson(id) {

  if (
    !confirm(
      "Barnoota kana haquu barbaaddaa?"
    )
  ) return;


  const { error } =
    await db
      .from("lessons")
      .delete()
      .eq("id", id);


  if (error) {

    alert(error.message);

    return;
  }


  alert("✅ Barnoonni haqame.");

  await loadAdminLessons();

  await loadStudentHome();
}


async function createExam() {

  const title =
    document
      .getElementById(
        "examTitleInput"
      )
      .value
      .trim();


  const description =
    document
      .getElementById(
        "examDescriptionInput"
      )
      .value
      .trim();


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
          description
        }
      ]);


  if (error) {

    alert(error.message);

    return;
  }


  document.getElementById(
    "examTitleInput"
  ).value = "";


  document.getElementById(
    "examDescriptionInput"
  ).value = "";


  alert("✅ Qormaanni dabalamе.");

  await loadAdminExams();

  await loadQuestionExamSelect();
}


async function loadAdminExams() {

  const container =
    document.getElementById(
      "adminExamsList"
    );


  const { data, error } =
    await db
      .from("exams")
      .select("*")
      .order("created_at", {
        ascending: false
      });


  if (error) {

    container.innerHTML =
      `<p>❌ ${escapeHtml(error.message)}</p>`;

    return;
  }


  container.innerHTML =
    (data || []).map(exam => `

      <div class="card">

        <h3>
          📝 ${escapeHtml(exam.title)}
        </h3>

        <p>
          ${escapeHtml(
            exam.description || ""
          )}
        </p>

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

    `).join("");
}


async function editExam(id) {

  const { data, error } =
    await db
      .from("exams")
      .select("*")
      .eq("id", id)
      .single();


  if (error) {

    alert(error.message);

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


  const { error: updateError } =
    await db
      .from("exams")
      .update({
        title: title.trim(),
        description: description.trim()
      })
      .eq("id", id);


  if (updateError) {

    alert(updateError.message);

    return;
  }


  alert("✅ Qormaanni sirreeffame.");

  await loadAdminExams();

  await loadQuestionExamSelect();

  await loadAdminResults();
}


async function deleteExam(id) {

  if (
    !confirm(
      "Qormaata kana haquu barbaaddaa?\n\nQabxii fi gaaffileen isaa ni haqamu."
    )
  ) return;


  const results =
    await db
      .from("results")
      .delete()
      .eq("exam_id", id);


  if (results.error) {

    alert(results.error.message);

    return;
  }


  const questions =
    await db
      .from("questions")
      .delete()
      .eq("exam_id", id);


  if (questions.error) {

    alert(questions.error.message);

    return;
  }


  const exam =
    await db
      .from("exams")
      .delete()
      .eq("id", id);


  if (exam.error) {

    alert(exam.error.message);

    return;
  }


  alert("✅ Qormaanni haqame.");

  await loadAdminExams();

  await loadQuestionExamSelect();

  await loadAdminQuestions();

  await loadAdminResults();

  await loadExams();
}


async function loadQuestionExamSelect() {

  const select =
    document.getElementById(
      "questionExamSelect"
    );


  const { data, error } =
    await db
      .from("exams")
      .select("*")
      .order("created_at", {
        ascending: false
      });


  if (error) return;


  select.innerHTML =
    `<option value="">Qormaata filadhu</option>`;


  (data || []).forEach(exam => {

    select.innerHTML += `
      <option value="${exam.id}">
        ${escapeHtml(exam.title)}
      </option>
    `;

  });
}


async function createQuestion() {

  const examId =
    document.getElementById(
      "questionExamSelect"
    ).value;


  const question =
    document
      .getElementById(
        "questionTextInput"
      )
      .value
      .trim();


  const a =
    document
      .getElementById(
        "optionAInput"
      )
      .value
      .trim();


  const b =
    document
      .getElementById(
        "optionBInput"
      )
      .value
      .trim();


  const c =
    document
      .getElementById(
        "optionCInput"
      )
      .value
      .trim();


  const d =
    document
      .getElementById(
        "optionDInput"
      )
      .value
      .trim();


  const correct =
    document.getElementById(
      "correctAnswerInput"
    ).value;


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
          exam_id: examId,
          question,
          option_a: a,
          option_b: b,
          option_c: c,
          option_d: d,
          correct_answer: correct
        }
      ]);


  if (error) {

    alert(error.message);

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


  alert("✅ Gaaffiin dabalamе.");

  await loadAdminQuestions();
}


async function loadAdminQuestions() {

  const container =
    document.getElementById(
      "adminQuestionsList"
    );


  const { data, error } =
    await db
      .from("questions")
      .select(`
        *,
        exams (
          title
        )
      `)
      .order("created_at", {
        ascending: false
      });


  if (error) {

    container.innerHTML =
      `<p>❌ ${escapeHtml(error.message)}</p>`;

    return;
  }


  container.innerHTML =
    (data || []).map(
      (question, index) => `

      <div class="card">

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


async function deleteQuestion(id) {

  if (
    !confirm(
      "Gaaffii kana haquu barbaaddaa?"
    )
  ) return;


  const { error } =
    await db
      .from("questions")
      .delete()
      .eq("id", id);


  if (error) {

    alert(error.message);

    return;
  }


  alert("✅ Gaaffiin haqame.");

  await loadAdminQuestions();
}


function studentLogout() {

  localStorage.removeItem(
    "student_id"
  );

  currentStudent = null;

  currentExam = null;

  currentQuestions = [];

  currentAnswers = [];

  showPage("rolePage");
}


function adminLogout() {

  localStorage.removeItem(
    "admin_logged"
  );

  showPage("rolePage");
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


document.addEventListener(
  "DOMContentLoaded",
  async () => {

    hideAdminPanels();


    if (
      localStorage.getItem(
        "admin_logged"
      ) === "true"
    ) {

      showPage("adminPage");

      await openAdminPanel(
        "students"
      );

      return;
    }


    if (
      localStorage.getItem(
        "student_id"
      )
    ) {

      await restoreStudent();

      if (currentStudent) return;

    }


    showPage("rolePage");
  }
);
