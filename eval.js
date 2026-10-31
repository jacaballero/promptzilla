// Promptzilla — Prompt evaluation
// Collects the student's prompts per challenge, asks the LLM in the background
// (when leaving each challenge) for qualitative feedback, and builds a final
// report on the win screen. State lives only in memory: a reload wipes it.
//
//   PromptEval.record({ challengeId, prompt, mode, answer, cost })
//   PromptEval.closeChallenge(ch, correct)
//   PromptEval.finalize()        → Promise<report|null>
//   PromptEval.buildReportHTML(report) / downloadReport(report)
//   PromptEval.reset()

"use strict";

/* global LLM, I18N, window, document, DOMParser, Blob, URL */

const PromptEval = (function () {

  // Only flag prompts that are the same (or nearly the same) as the statement.
  const COPY_THRESHOLD = 0.9;

  let gen = 0;               // game generation: late replies from older games are dropped
  let buffer = [];           // prompts of the challenge currently open
  let attempts = [];         // closed challenges, in play order
  const pending = new Set();

  function cfg() { return (window.CONFIG && window.CONFIG.evaluation) || {}; }
  function enabled() { return cfg().enabled !== false; }

  function connectionOverride() {
    const c = cfg();
    return {
      provider: c.provider, endpoint: c.endpoint, apiToken: c.apiToken, model: c.model,
      maxTokens: c.maxTokens, temperature: c.temperature, timeoutMs: c.timeoutMs
    };
  }

  // ─── Text helpers ───────────────────────────────────────────────────────
  function htmlToText(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    return doc.body.textContent || "";
  }

  function normalize(s) {
    return String(s || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function similarity(a, b) {
    const max = Math.max(a.length, b.length);
    return max ? 1 - levenshtein(a, b) / max : 1;
  }

  function challengeTexts(ch) {
    const question = htmlToText(I18N.pick(ch.question));
    const options = (ch.options || []).map(o => htmlToText(I18N.pick(o.text)));
    const labelled = (ch.options || []).map((o, i) => `${o.label} ${options[i]}`);
    return [
      question,
      ...options,
      `${question} ${options.join(" ")}`,
      `${question} ${labelled.join(" ")}`
    ].map(normalize).filter(Boolean);
  }

  function isCopy(prompt, texts) {
    const p = normalize(prompt);
    return !!p && texts.some(t => similarity(p, t) >= COPY_THRESHOLD);
  }

  // ─── Collection ─────────────────────────────────────────────────────────
  function record({ challengeId, prompt, mode, answer, cost }) {
    if (!enabled()) return;
    buffer.push({ challengeId, prompt, mode, answer, cost });
  }

  // correct: true/false, or null when the student left without answering.
  function closeChallenge(ch, correct) {
    if (!enabled() || !ch) return;
    const mine = buffer.filter(r => r.challengeId === ch.id);
    buffer = buffer.filter(r => r.challengeId !== ch.id);
    if (correct === null && !mine.length) return;

    const texts = challengeTexts(ch);
    const items = [];
    const byKey = new Map();
    mine.forEach(r => {
      const key = normalize(r.prompt);
      let item = byKey.get(key);
      if (!item) {
        item = { prompt: r.prompt, copied: isCopy(r.prompt, texts), uses: [], status: "pending", feedback: null };
        byKey.set(key, item);
        items.push(item);
      }
      item.uses.push({ mode: r.mode, answer: r.answer, cost: r.cost });
    });

    const attempt = {
      challengeId: ch.id,
      number: ch.number,
      title: I18N.pick(ch.title),
      titleText: ch.title,
      correct: correct === null ? null : !!correct,
      items
    };
    attempts.push(attempt);
    if (items.length) evaluateAttempt(attempt, ch);
  }

  // ─── Per-challenge evaluation ───────────────────────────────────────────
  const ATTEMPT_SCHEMA = {
    type: "object",
    properties: {
      evaluations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "integer" },
            clarity: { type: "string" },
            context: { type: "string" },
            conciseness: { type: "string" },
            overall: { type: "string" },
            suggestion: { type: "string" }
          },
          required: ["id", "clarity", "context", "conciseness", "overall", "suggestion"]
        }
      }
    },
    required: ["evaluations"]
  };

  function attemptUserMessage(attempt, ch) {
    const options = (ch.options || []).map(o => `${o.label}) ${htmlToText(I18N.pick(o.text))}`).join("\n");
    const prompts = attempt.items.map((it, i) =>
      `[${i + 1}] copied_statement=${it.copied}\n<<<${it.prompt}>>>`).join("\n\n");
    return `Quiz statement:\n${htmlToText(I18N.pick(ch.question))}\n\nOptions:\n${options}\n\n` +
      `Student prompts (evaluate each one; reply with the same id):\n${prompts}`;
  }

  function evaluateAttempt(attempt, ch) {
    const myGen = gen;
    const p = LLM.complete({
      system: LLM.localize(cfg().systemPerChallenge),
      user: attemptUserMessage(attempt, ch),
      schema: ATTEMPT_SCHEMA,
      schemaName: "prompt_evaluations",
      cfgOverride: connectionOverride()
    }).then(res => {
      if (myGen !== gen) return;
      const list = (res && Array.isArray(res.evaluations)) ? res.evaluations : [];
      attempt.items.forEach((it, i) => {
        const ev = list.find(e => Number(e.id) === i + 1);
        if (ev) { it.feedback = ev; it.status = "done"; }
        else it.status = "failed";
      });
    }).catch(err => {
      console.warn("Prompt evaluation failed:", err);
      if (myGen !== gen) return;
      attempt.items.forEach(it => { it.status = "failed"; });
    }).finally(() => pending.delete(p));
    pending.add(p);
  }

  // ─── Final summary ──────────────────────────────────────────────────────
  const SUMMARY_SCHEMA = {
    type: "object",
    properties: {
      strengths: { type: "array", items: { type: "string" } },
      improvements: { type: "array", items: { type: "string" } },
      conclusion: { type: "string" }
    },
    required: ["strengths", "improvements", "conclusion"]
  };

  function summaryUserMessage() {
    const lines = [];
    attempts.forEach(a => {
      const done = a.items.filter(it => it.status === "done");
      if (!done.length) return;
      lines.push(`Challenge "${a.title}":`);
      done.forEach(it => {
        lines.push(`- Prompt: <<<${it.prompt}>>>${it.copied ? " (copied from the statement)" : ""}` +
          `\n  Feedback: ${it.feedback.overall} Suggestion: ${it.feedback.suggestion}`);
      });
    });
    return lines.join("\n");
  }

  function waitPending(ms) {
    if (!pending.size) return Promise.resolve();
    return Promise.race([
      Promise.allSettled([...pending]),
      new Promise(resolve => setTimeout(resolve, ms))
    ]);
  }

  async function finalize() {
    if (!enabled()) return null;
    const myGen = gen;
    await waitPending(cfg().finalWaitMs ?? 30000);
    if (myGen !== gen) return null;

    attempts.forEach(a => a.items.forEach(it => { if (it.status === "pending") it.status = "failed"; }));

    const report = { attempts, summary: null, summaryStatus: "none" };
    const anyDone = attempts.some(a => a.items.some(it => it.status === "done"));
    if (!anyDone) {
      report.summaryStatus = attempts.some(a => a.items.length) ? "failed" : "none";
      return report;
    }
    try {
      const res = await LLM.complete({
        system: LLM.localize(cfg().systemSummary),
        user: summaryUserMessage(),
        schema: SUMMARY_SCHEMA,
        schemaName: "prompting_summary",
        cfgOverride: connectionOverride()
      });
      if (myGen !== gen) return null;
      report.summary = {
        strengths: Array.isArray(res.strengths) ? res.strengths : [],
        improvements: Array.isArray(res.improvements) ? res.improvements : [],
        conclusion: String(res.conclusion || "")
      };
      report.summaryStatus = "done";
    } catch (err) {
      console.warn("Prompt summary failed:", err);
      if (myGen !== gen) return null;
      report.summaryStatus = "failed";
    }
    return report;
  }

  function reset() {
    gen++;
    buffer = [];
    attempts = [];
    pending.clear();
  }

  // ─── Report rendering ───────────────────────────────────────────────────
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function listHTML(items) {
    return items.length ? `<ul>${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>` : "<p>—</p>";
  }

  function summaryHTML(report) {
    const t = I18N.t;
    if (report.summaryStatus === "done") {
      const s = report.summary;
      return `
        <h3>${t("report.strengths")}</h3>${listHTML(s.strengths)}
        <h3>${t("report.improvements")}</h3>${listHTML(s.improvements)}
        <h3>${t("report.conclusion")}</h3><p>${esc(s.conclusion)}</p>`;
    }
    if (report.summaryStatus === "failed") return `<p class="rep-warn">${t("report.summaryUnavailable")}</p>`;
    return `<p>${t("report.noConsults")}</p>`;
  }

  function itemHTML(it, full) {
    const t = I18N.t;
    const repeated = it.uses.length > 1 ? ` <span class="rep-tag">${t("report.repeated", { n: it.uses.length })}</span>` : "";
    const copied = it.copied ? ` <span class="rep-tag rep-copy">${t("report.copied")}</span>` : "";
    const uses = it.uses.map(u => `
      <div class="rep-use">
        <div class="rep-meta">${t(u.mode === "socratic" ? "report.modeSocratic" : "report.modeDirect")} · ${esc(u.cost)} tokens</div>
        <div class="rep-answer">${esc(u.answer)}</div>
      </div>`).join("");
    const fb = it.status === "done" ? `
      <dl class="rep-fb">
        <dt>${t("report.clarity")}</dt><dd>${esc(it.feedback.clarity)}</dd>
        <dt>${t("report.context")}</dt><dd>${esc(it.feedback.context)}</dd>
        <dt>${t("report.conciseness")}</dt><dd>${esc(it.feedback.conciseness)}</dd>
        <dt>${t("report.overall")}</dt><dd>${esc(it.feedback.overall)}</dd>
        <dt>${t("report.suggestion")}</dt><dd>${esc(it.feedback.suggestion)}</dd>
      </dl>` : `<p class="rep-warn">${t("report.notEvaluated")}</p>`;
    return `
      <details class="rep-item">
        <summary><span class="rep-prompt">${esc(it.prompt)}</span>${repeated}${copied}</summary>
        ${fb}
        ${full ? `<h4>${t("report.tutorAnswer")}</h4>${uses}` : ""}
      </details>`;
  }

  function attemptHTML(a, full) {
    const t = I18N.t;
    const result = a.correct === null
      ? `<span class="rep-left">${t("report.abandoned")}</span>`
      : a.correct
        ? `<span class="rep-ok">${t("report.passed")}</span>`
        : `<span class="rep-ko">${t("report.failed")}</span>`;
    const body = a.items.length
      ? a.items.map(it => itemHTML(it, full)).join("")
      : `<p class="rep-none">${t(a.correct ? "report.solvedNoConsult" : "report.answeredNoConsult")}</p>`;
    return `
      <section class="rep-attempt">
        <h3>${t("report.attempt", { number: esc(a.number), title: esc(a.title) })} ${result}</h3>
        ${body}
      </section>`;
  }

  // Compact (on-screen) mode skips challenges without prompts and the tutor's answers.
  function buildReportHTML(report, { full = false } = {}) {
    const shown = full ? report.attempts : report.attempts.filter(a => a.items.length);
    return `
      <h2>${I18N.t("report.summary")}</h2>
      <div class="rep-summary">${summaryHTML(report)}</div>
      ${shown.length ? `<h2>${I18N.t("report.detail")}</h2>${shown.map(a => attemptHTML(a, full)).join("")}` : ""}`;
  }

  const DOWNLOAD_CSS = `
    body{font-family:system-ui,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;color:#222;line-height:1.45}
    h1{margin-bottom:.2rem}h2{margin-top:2rem}h3{margin:1.2rem 0 .4rem}
    .rep-head{display:flex;align-items:center;gap:14px}.rep-head img{height:56px;width:auto}
    .rep-head h1{font-size:1.5rem;margin:0}.rep-head p{margin:.1rem 0 0;color:#666;font-size:.85rem}
    .rep-attempt{border-top:1px solid #ddd;padding-top:.5rem}
    .rep-item{border:1px solid #ddd;border-radius:6px;padding:.5rem .8rem;margin:.5rem 0}
    .rep-item summary{cursor:pointer;font-weight:600}
    .rep-tag{font-size:.75rem;background:#eee;border-radius:4px;padding:1px 6px;margin-left:4px}
    .rep-copy{background:#ffe1c2}.rep-ok{color:#1a7f37}.rep-ko{color:#c62828}.rep-left{color:#666}.rep-warn{color:#a15c00}
    .rep-fb dt{font-weight:600;margin-top:.4rem}.rep-fb dd{margin:0 0 0 1rem}
    .rep-use{background:#f6f6f6;border-radius:4px;padding:.4rem .6rem;margin:.3rem 0}
    .rep-meta{font-size:.8rem;color:#666}.rep-answer{white-space:pre-wrap}`;

  function downloadReport(report) {
    const date = new Date().toLocaleString(I18N.locale());
    const logo = window.PROMPTZILLA_LOGO;
    const title = esc(I18N.t("report.title"));
    const head = logo
      ? `<header class="rep-head"><img src="${logo}" alt="Promptzilla"><div><h1>${title}</h1><p>${esc(date)}</p></div></header>`
      : `<h1>Promptzilla — ${title}</h1><p>${esc(date)}</p>`;
    const html = `<!DOCTYPE html>
<html lang="${I18N.lang}"><head><meta charset="UTF-8"><title>${esc(I18N.t("report.docTitle"))}</title>
<style>${DOWNLOAD_CSS}</style></head>
<body>${head}
${buildReportHTML(report, { full: true })}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = I18N.t("report.filename");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { record, closeChallenge, finalize, reset, buildReportHTML, downloadReport, enabled };
})();

window.PromptEval = PromptEval;
