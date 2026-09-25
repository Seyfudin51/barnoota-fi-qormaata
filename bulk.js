"use strict";

/* =========================================================
   BULK QUESTIONS IMPORT HANDLER
========================================================= */

const BULK_SUPABASE_URL = "https://xhkkaevhcqvkwabcsljm.supabase.co";
const BULK_SUPABASE_ANON_KEY = "sb_publishable_8nBE4n2bQ1jRnEr_83FrdA_vSqqIpSz";

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

function escapeBulkHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadBulkExamSelect() {
  const select = document.getElementById("bulkExamSelect");
  if (!select) return;

  try {
    const { data: exams, error } = await bulkDb
      .from("exams")
      .select("id, title")
      .order("created_at", { ascending: false });

    if (error || !exams) {
      return;
    }

    const currentVal = select.value;
    select.innerHTML = '<option value="">Qormaata filadhu</option>' +
      exams.map(e => `<option value="${e.id}">${escapeBulkHtml(e.title)}</option>`).join("");

    if (currentVal && exams.some(e => String(e.id) === String(currentVal))) {
      select.value = currentVal;
    }
  } catch (err) {
    console.error("BULK EXAM POPULATE EXCEPTION:", err);
  }
}

function parseBulkQuestions(text) {
  const cleaned = String(text || "").replace(/\r/g, "").trim();
  if (!cleaned) {
    throw new Error("Gaaffilee galchi.");
  }

  // Lakkoofsa gaaffiitiin (fakkeenyaaf: 1., 2., 1), 2)) qooda
  const blocks = cleaned
    .split(/(?=^\s*\d+\s*[\.\)]\s*)/gm)
    .map(item => item.trim())
    .filter(Boolean);

  if (!blocks.length) {
    throw new Error("Gaaffiin tokkollee hin argamne. Qindoomina isaa ilaali.");
  }

  const questions = [];

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];

    // 1. Gaaffii baasuu
    const questionMatch = block.match(/^\s*\d+\s*[\.\)]\s*(.+?)(?=\n\s*A[\)\.:])/is);

    // 2. Filannoowwan A, B, C, D baasuu
    const optionAMatch = block.match(/(?:^|\n)\s*A[\)\.:]\s*(.+?)(?=\n\s*B[\)\.:])/is);
    const optionBMatch = block.match(/(?:^|\n)\s*B[\)\.:]\s*(.+?)(?=\n\s*C[\)\.:])/is);
    const optionCMatch = block.match(/(?:^|\n)\s*C[\)\.:]\s*(.+?)(?=\n\s*D[\)\.:])/is);
    const optionDMatch = block.match(/(?:^|\n)\s*D[\)\.:]\s*(.+?)(?=\n|$)/is);

    // 3. Deebii sirrii baasuu (Fakkeenya: Deebii: A, Deebii sirrii: B, Answer: C, ✅ Deebii: D)
    const answerMatch = block.match(/(?:✅\s*)?(?:Deebii\s*sirrii|Deebii|Answer)\s*:\s*([ABCD])/i);

    if (!questionMatch || !optionAMatch || !optionBMatch || !optionCMatch || !optionDMatch || !answerMatch) {
      throw new Error(`Gaaffii ${index + 1}ffaa irratti dogoggorri jira! Gaaffii, A, B, C, D fi "Deebii: [A/B/C/D]" jiraachuu isaa mirkaneessi.`);
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
  const button = document.querySelector('[onclick="createBulkQuestions()"]');

  const examId = select?.value || "";
  const text = input?.value || "";

  if (!examId) {
    alert("❌ Jalqaba qormaata filadhu.");
    showBulkMessage("❌ Qormaata filadhu.", "error");
    return;
  }

  if (!text.trim()) {
    alert("❌ Gaaffilee copy gootee galchi.");
    showBulkMessage("❌ Gaaffilee galchi.", "error");
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "⏳ Gaaffilee galchaa jira...";
    }

    const parsedQuestions = parseBulkQuestions(text);

    // Exam ID wajjin qindeessuu
    const rows = parsedQuestions.map(q => ({
      ...q,
      exam_id: Number.isInteger(Number(examId)) ? Number(examId) : examId
    }));

    const { error } = await bulkDb
      .from("questions")
      .insert(rows);

    if (error) {
      throw error;
    }

    alert(`✅ Gaaffiiwwan ${rows.length} milkaa'inaan galfamaniiru!`);
    showBulkMessage(`✅ Gaaffiiwwan ${rows.length} qormaata keessa galaniiru.`, "success");

    input.value = "";

    // Admin view haaromsuu
    if (typeof window.loadAdminQuestions === "function") {
      await window.loadAdminQuestions();
    }
    if (typeof window.loadAdminExams === "function") {
      await window.loadAdminExams();
    }
  } catch (error) {
    console.error("BULK IMPORT ERROR:", error);
    alert("❌ " + (error.message || "Gaaffilee galchuun hin danda'amne."));
    showBulkMessage("❌ " + (error.message || "Dogoggorri uumame."), "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "📥 Gaaffilee Hedduu Galchi";
    }
  }
}

// Window irratti qabsiisuu
window.createBulkQuestions = createBulkQuestions;
window.loadBulkExamSelect = loadBulkExamSelect;

// Yeroo banamu dropdown guutuu
document.addEventListener("DOMContentLoaded", () => {
  loadBulkExamSelect();
});

setInterval(() => {
  const select = document.getElementById("bulkExamSelect");
  if (select && select.options.length <= 1) {
    loadBulkExamSelect();
  }
}, 2000);
