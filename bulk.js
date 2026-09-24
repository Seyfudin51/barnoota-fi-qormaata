"use strict";

const BULK_SUPABASE_URL =
  "https://xhkkaevhcqvkwabcsljm.supabase.co";

const BULK_SUPABASE_ANON_KEY =
  "sb_publishable_8nBE4n2bQ1jRnEr_83FrdA_vSqqIpSz";

const bulkDb = window.supabase.createClient(
  BULK_SUPABASE_URL,
  BULK_SUPABASE_ANON_KEY
);

function showBulkMessage(message, type = "info") {
  const box = document.getElementById("bulkMessage");

  if (!box) return;

  box.textContent = message;
  box.className = `message ${type}`.trim();
}

async function loadBulkExamSelect() {
  const select = document.getElementById("bulkExamSelect");

  if (!select) return;

  const { data, error } = await bulkDb
    .from("exams")
    .select("id,title")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("BULK EXAM SELECT ERROR:", error);
    return;
  }

  select.innerHTML = `
    <option value="">Qormaata filadhu</option>
    ${(data || [])
      .map(
        (exam) => `
          <option value="${exam.id}">
            ${escapeBulkHtml(exam.title)}
          </option>
        `
      )
      .join("")}
  `;
}

function escapeBulkHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseBulkQuestions(text) {
  const cleaned = String(text || "")
    .replace(/\r/g, "")
    .trim();

  if (!cleaned) {
    throw new Error("Gaaffilee galchi.");
  }

  const blocks = cleaned
    .split(/(?=^\s*\d+\s*[\.\)]\s*)/gm)
    .map((item) => item.trim())
    .filter(Boolean);

  const questions = [];

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];

    const questionMatch = block.match(
      /^\s*\d+\s*[\.\)]\s*(.+?)(?=\n\s*A[\)\.:])/is
    );

    const optionAMatch = block.match(
      /(?:^|\n)\s*A[\)\.:]\s*(.+?)(?=\n\s*B[\)\.:])/is
    );

    const optionBMatch = block.match(
      /(?:^|\n)\s*B[\)\.:]\s*(.+?)(?=\n\s*C[\)\.:])/is
    );

    const optionCMatch = block.match(
      /(?:^|\n)\s*C[\)\.:]\s*(.+?)(?=\n\s*D[\)\.:])/is
    );

    const optionDMatch = block.match(
      /(?:^|\n)\s*D[\)\.:]\s*(.+?)(?=\n|$)/is
    );

    const answerMatch = block.match(
      /(?:✅\s*)?(?:Deebii\s*sirrii|Deebii|Answer)\s*:\s*([ABCD])/i
    );

    if (
      !questionMatch ||
      !optionAMatch ||
      !optionBMatch ||
      !optionCMatch ||
      !optionDMatch ||
      !answerMatch
    ) {
      throw new Error(
        `Gaaffii ${index + 1} sirriitti hin qindaa'in. Lakkoofsa, A-D fi Deebii sirrii mirkaneessi.`
      );
    }

    questions.push({
      question: questionMatch[1].trim(),
      option_a: optionAMatch[1].trim(),
      option_b: optionBMatch[1].trim(),
      option_c: optionCMatch[1].trim(),
      option_d: optionDMatch[1].trim(),
      correct_answer: answerMatch[1].toUpperCase(),
      source_type: "admin",
      source_text: null
    });
  }

  return questions;
}

async function createBulkQuestions() {
  const select = document.getElementById("bulkExamSelect");
  const input = document.getElementById("bulkQuestionsInput");
  const button = document.querySelector(
    '[onclick="createBulkQuestions()"]'
  );

  const examId = select?.value || "";
  const text = input?.value || "";

  if (!examId) {
    showBulkMessage(
      "❌ Jalqaba qormaata filadhu.",
      "error"
    );
    return;
  }

  if (!text.trim()) {
    showBulkMessage(
      "❌ Gaaffilee copy gootee textarea keessa galchi.",
      "error"
    );
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "⏳ Gaaffilee galchaa jira...";
    }

    const questions = parseBulkQuestions(text);

    const rows = questions.map((question) => ({
      ...question,
      exam_id: examId
    }));

    const { error } = await bulkDb
      .from("questions")
      .insert(rows);

    if (error) {
      throw error;
    }

    showBulkMessage(
      `✅ Gaaffiiwwan ${rows.length} milkaa'inaan galfamaniiru.`,
      "success"
    );

    input.value = "";

    if (typeof window.loadAdminQuestions === "function") {
      await window.loadAdminQuestions();
    }

    if (typeof window.loadAdminExams === "function") {
      await window.loadAdminExams();
    }
  } catch (error) {
    console.error("BULK IMPORT ERROR:", error);

    showBulkMessage(
      `❌ ${error.message || "Gaaffilee galchuun hin milkoofne."}`,
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "📥 Gaaffilee Hedduu Galchi";
    }
  }
}

window.createBulkQuestions = createBulkQuestions;
window.loadBulkExamSelect = loadBulkExamSelect;

document.addEventListener("DOMContentLoaded", () => {
  loadBulkExamSelect();
});
