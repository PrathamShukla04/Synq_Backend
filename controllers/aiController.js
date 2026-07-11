const { InferenceClient } = require("@huggingface/inference");
const File = require("../models/File");

const hf = new InferenceClient(process.env.HF_TOKEN);

// Configurable via .env so a model swap never needs a code change —
// useful because free-tier provider availability shifts over time.
const MODEL_MAIN = process.env.HF_MODEL_MAIN || "Qwen/Qwen2.5-Coder-32B-Instruct";
const MODEL_FAST = process.env.HF_MODEL_FAST || "Qwen/Qwen2.5-Coder-7B-Instruct";

async function callHF({ model = MODEL_MAIN, system, prompt, maxTokens = 1024 }) {
  const out = await hf.chatCompletion({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    max_tokens: maxTokens,
  });
  return out.choices?.[0]?.message?.content ?? "";
}

function stripCodeFence(text) {
  return text
    .trim()
    .replace(/^```[\w-]*\n?/, "")
    .replace(/```$/, "")
    .trim();
}

// ---------- 1. Code completion ----------
exports.complete = async (req, res) => {
  try {
    const { code = "", cursorLine, language = "javascript" } = req.body;
    if (!code) return res.status(400).json({ message: "code is required" });

    const lines = code.split("\n");
    const cursor = typeof cursorLine === "number" ? cursorLine : lines.length - 1;
    const before = lines.slice(Math.max(0, cursor - 40), cursor + 1).join("\n");
    const after = lines.slice(cursor + 1, cursor + 15).join("\n");

    const text = await callHF({
      model: MODEL_FAST,
      system:
        `You are an inline code completion engine for a ${language} file, like GitHub Copilot. ` +
        `Given code before and after the cursor, output ONLY the code that should be inserted at the cursor. ` +
        `No explanation, no markdown fences, no repeating existing code. If nothing sensible completes, return an empty string.`,
      prompt: `--- code before cursor ---\n${before}\n--- code after cursor ---\n${after}\n--- completion ---`,
      maxTokens: 200,
    });

    res.json({ completion: stripCodeFence(text) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Completion failed" });
  }
};

// ---------- 2. Bug detection ----------
exports.detectBugs = async (req, res) => {
  try {
    const { code = "", language = "javascript" } = req.body;
    if (!code) return res.status(400).json({ message: "code is required" });

    const text = await callHF({
      system:
        `You are a static analysis tool for ${language}. Analyze the code for real bugs, ` +
        `not style preferences. Return ONLY valid JSON, no markdown fences, matching this shape: ` +
        `{"issues":[{"line":number,"severity":"error"|"warning"|"info","type":string,"message":string,"suggestion":string}]}. ` +
        `If there are no issues, return {"issues":[]}.`,
      prompt: code,
      maxTokens: 1500,
    });

    let parsed;
    try {
      parsed = JSON.parse(stripCodeFence(text));
    } catch {
      parsed = { issues: [] };
    }
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Bug detection failed" });
  }
};

// ---------- 3. Explain ----------
exports.explain = async (req, res) => {
  try {
    const { code = "", language = "javascript" } = req.body;
    if (!code) return res.status(400).json({ message: "code is required" });

    const explanation = await callHF({
      system: `Explain the following ${language} code clearly and concisely in plain English, for a developer reading it for the first time. No preamble.`,
      prompt: code,
      maxTokens: 800,
    });

    res.json({ explanation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Explain failed" });
  }
};

// ---------- 4. Refactor ----------
exports.refactor = async (req, res) => {
  try {
    const { code = "", language = "javascript", goal = "improve readability" } = req.body;
    if (!code) return res.status(400).json({ message: "code is required" });

    const text = await callHF({
      system:
        `You refactor ${language} code. Goal: ${goal}. ` +
        `Return ONLY the refactored code, no explanation, no markdown fences. Preserve behavior exactly.`,
      prompt: code,
      maxTokens: 2000,
    });

    res.json({ refactored: stripCodeFence(text) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Refactor failed" });
  }
};

// ---------- 5. Docs generation ----------
exports.generateDocs = async (req, res) => {
  try {
    const { code = "", language = "javascript" } = req.body;
    if (!code) return res.status(400).json({ message: "code is required" });

    const text = await callHF({
      system:
        `Write documentation comments for the following ${language} code (JSDoc for JS/TS, docstrings for Python, etc — match the language convention). ` +
        `Return ONLY the doc comment block(s) to insert above the relevant code, no markdown fences, no repeated code body.`,
      prompt: code,
      maxTokens: 600,
    });

    res.json({ docs: stripCodeFence(text) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Docs generation failed" });
  }
};

// ---------- 6. Test generation ----------
exports.generateTests = async (req, res) => {
  try {
    const { code = "", language = "javascript", framework } = req.body;
    if (!code) return res.status(400).json({ message: "code is required" });

    const fw = framework || (language === "python" ? "pytest" : "Jest");

    const text = await callHF({
      system:
        `Write unit tests for the following ${language} code using ${fw}. ` +
        `Cover the main cases and at least one edge case. Return ONLY the test file content, no markdown fences, no explanation.`,
      prompt: code,
      maxTokens: 1500,
    });

    res.json({ tests: stripCodeFence(text), framework: fw });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Test generation failed" });
  }
};

// ---------- 7. RAG-lite chatbot ----------
// Keyword-overlap retrieval against project files — no vector DB yet.
// Good enough for small/medium projects; swap for embeddings later if needed.
// .lean() so we get plain objects back — needed because the chat handler
// below may splice in an unsaved editor buffer over one of these entries.
async function retrieveRelevantFiles(projectId, question, limit = 5) {
  const files = await File.find({ projectId, type: "file" }).select("name path content").lean();
  const qWords = question.toLowerCase().match(/[a-z0-9_]+/g) || [];

  const scored = files.map((f) => {
    const haystack = `${f.name} ${f.path} ${f.content || ""}`.toLowerCase();
    const score = qWords.reduce((acc, w) => acc + (w.length > 2 && haystack.includes(w) ? 1 : 0), 0);
    return { file: f, score };
  });

  const matched = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  // nothing matched by keyword — fall back to sending the whole project
  // (fine for small/medium projects; for big ones, tighten this later)
  const pool = matched.length > 0 ? matched : scored;

  return pool.slice(0, limit).map((s) => s.file);
}

exports.chat = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { message, history = [], activeFile = null } = req.body;
    if (!message) return res.status(400).json({ message: "message is required" });

    const relevantFiles = await retrieveRelevantFiles(projectId, message);

    // Editor's unsaved buffer wins over whatever's in Mongo for that file —
    // the DB copy is stale by definition until the user hits Save.
    if (activeFile?.path && typeof activeFile.content === "string") {
      const idx = relevantFiles.findIndex((f) => f.path === activeFile.path);
      const liveEntry = { name: activeFile.path.split("/").pop(), path: activeFile.path, content: activeFile.content };
      if (idx >= 0) relevantFiles[idx] = liveEntry;
      else relevantFiles.unshift(liveEntry);
    }

    const context = relevantFiles
      .map((f) => `--- ${f.path || f.name} ---\n${(f.content || "").slice(0, 3000)}`)
      .join("\n\n");

    const system =
      `You are a coding assistant with access to relevant files from the user's project. ` +
      `Answer using the provided context where relevant. If the context doesn't contain the answer, say so. ` +
      `Be concise and cite file names when referencing code.` +
      (context ? `\n\nRELEVANT PROJECT FILES:\n${context}` : "\n\n(No matching files found in the project for this question.)");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      const stream = hf.chatCompletionStream({
        model: MODEL_MAIN,
        messages: [{ role: "system", content: system }, ...history, { role: "user", content: message }],
        max_tokens: 1200,
      });

      for await (const chunk of stream) {
        const piece = chunk.choices?.[0]?.delta?.content;
        if (piece) res.write(`data: ${JSON.stringify({ text: piece })}\n\n`);
      }

      res.write(
        `data: ${JSON.stringify({ done: true, sourceFiles: relevantFiles.map((f) => f.path || f.name) })}\n\n`
      );
      res.end();
    } catch (streamErr) {
      console.error(streamErr);
      res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
      res.end();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Chat failed" });
  }
};