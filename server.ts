import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality, ThinkingLevel, Type } from "@google/genai";
import type { LiveServerMessage } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function formatGeminiError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("API_KEY_INVALID") ||
    msg.includes("403")
  ) {
    return "Verifica la clave GEMINI_API_KEY en el panel Settings > Secrets.";
  }
  if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
    return "Se alcanzó el límite temporal de solicitudes de la API. Intenta de nuevo en unos segundos o revisa tu clave en Settings > Secrets.";
  }
  if (msg.includes("NOT_FOUND") || msg.includes("404")) {
    return `El modelo solicitado no está disponible actualmente (${msg}).`;
  }
  return fallback;
}

const TOPIC_MAP: Record<string, { labelEn: string; hintEn: string }> = {
  free: {
    labelEn: "Everyday Free Talk",
    hintEn: "everyday life, daily routines, weekend plans, or casual personal stories",
  },
  cafe: {
    labelEn: "Coffee Shops & Dining",
    hintEn: "ordering food or coffee, favorite meals, cooking at home, or restaurant experiences",
  },
  work: {
    labelEn: "Work & Collaboration",
    hintEn: "daily work tasks, teamwork, meetings, deadlines, and work-life balance",
  },
  travel: {
    labelEn: "Travel & Getting Around",
    hintEn: "trips, airports, hotels, asking for directions, and memorable places visited",
  },
  routine: {
    labelEn: "Daily Routine & Hobbies",
    hintEn: "morning routines, hobbies, exercise, books, and relaxing after work",
  },
  shopping: {
    labelEn: "Shopping & Errands",
    hintEn: "shopping in stores or online, returning items, groceries, and everyday errands",
  },
};

function buildTutorInstruction(level: string, pace: string, topicId: string): string {
  const topic = TOPIC_MAP[topicId] ?? TOPIC_MAP.free;

  const levelGuidance: Record<string, string> = {
    A1: "Student level is A1 (Beginner). Use very simple, high-frequency everyday words and short sentences (5-10 words). Speak slowly and clearly.",
    A2: "Student level is A2 (Elementary). Use clear, simple everyday vocabulary and common past/present/future forms. Keep turns concise.",
    B1: "Student level is B1 (Intermediate). Use natural everyday English with moderate vocabulary and useful phrasal verbs, introducing occasional B1-B2 expressions naturally.",
    B2: "Student level is B2 (Upper-Intermediate). Use natural, idiomatic everyday English and nuanced phrasing suitable for fluent conversation.",
    C1: "Student level is C1 (Advanced). Speak at natural conversational depth with rich idioms, collocations, and nuanced expressions.",
  };

  const paceGuidance: Record<string, string> = {
    slow: "Speak noticeably slowly and articulate clearly, pausing briefly between phrases.",
    adaptive:
      "Adapt your speaking speed and vocabulary complexity in real time to match the student's fluency and confidence. Slow down gently if they hesitate or make several mistakes.",
    natural: "Speak at a relaxed, natural native conversational pace.",
  };

  return [
    "You are a warm, patient, encouraging private English conversation tutor speaking live by voice with a Spanish-speaking student.",
    levelGuidance[level] ?? levelGuidance.B1,
    paceGuidance[pace] ?? paceGuidance.adaptive,
    `Current everyday conversation focus: ${topic.labelEn} (${topic.hintEn}).`,
    "",
    "STRICT PEDAGOGICAL RULES:",
    "1. Always start the session by greeting the student warmly in English and asking ONE simple everyday question related to the topic.",
    "2. Ask ONLY ONE question per turn. Never stack two questions in the same reply.",
    "3. Whenever the student makes an English grammar, word-choice, or phrasing mistake, correct it briefly and kindly FIRST (in 1 short sentence, e.g. 'Quick correction: we say \"I went\" instead of \"I goed\".') BEFORE responding naturally to what they meant and asking your single follow-up question. If they made multiple tiny slips, only correct the single most helpful one so conversation stays encouraging.",
    "4. If the student freezes, goes blank, hesitates, or asks you for help in Spanish (for example asking how to say something in Spanish or saying they don't know a word), immediately translate what they want to say into natural English, briefly confirm it, and explicitly ask them to repeat that English phrase out loud before moving on.",
    "5. Introduce useful everyday English words naturally in context so the student builds practical vocabulary.",
    "6. Keep every spoken response concise (2 to 4 short sentences total) and completely conversational. NEVER output markdown, bullet lists, asterisks, parentheses, or stage directions—only natural spoken words.",
  ].join("\n");
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  app.get("/api/health", (_req, res) => {
    const ai = getAiClient();
    res.json({ ok: true, hasApiKey: Boolean(ai) });
  });

  app.post("/api/analyze-turn", async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: "Falta configurar GEMINI_API_KEY en el panel Settings > Secrets.",
      });
      return;
    }

    const { studentText, tutorText, level, existingWords } = req.body as {
      studentText?: string;
      tutorText?: string;
      level?: string;
      existingWords?: string[];
    };

    if (!tutorText || !tutorText.trim()) {
      res.json({ correction: null, vocabulary: [] });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: [
          `Student CEFR Level: ${level || "B1"}`,
          `Already captured words (do NOT repeat these): ${(existingWords || []).join(", ") || "none"}`,
          `Student said: ${studentText?.trim() || "(opening greeting / no student speech yet)"}`,
          `Tutor replied: ${tutorText.trim()}`,
          "",
          "Analyze this conversation turn and extract:",
          "1) If the tutor corrected a mistake made by the student or translated a phrase the student asked for in Spanish, record it in `correction` with `hasCorrection: true`, `originalPhrase` (what the student said or asked in Spanish), `correctedPhrase` (the natural English form), and `explanationEs` (a brief 1-sentence tip in Spanish). Otherwise set `hasCorrection: false` and empty strings.",
          "2) Extract 0 to 3 genuinely useful new English vocabulary words, collocations, or phrasal verbs encountered in this turn (appropriate for expanding a learner at this CEFR level; skip trivial words like hello, good, today, very, nice, thank you, yes, no). Provide a clear definition in English and a natural example sentence in English.",
        ].join("\n"),
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              correction: {
                type: Type.OBJECT,
                properties: {
                  hasCorrection: { type: Type.BOOLEAN },
                  originalPhrase: { type: Type.STRING },
                  correctedPhrase: { type: Type.STRING },
                  explanationEs: { type: Type.STRING },
                },
                required: ["hasCorrection", "originalPhrase", "correctedPhrase", "explanationEs"],
              },
              vocabulary: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    partOfSpeech: { type: Type.STRING },
                    definitionEn: { type: Type.STRING },
                    exampleEn: { type: Type.STRING },
                    levelTag: { type: Type.STRING },
                  },
                  required: ["word", "partOfSpeech", "definitionEn", "exampleEn", "levelTag"],
                },
              },
            },
            required: ["correction", "vocabulary"],
          },
        },
      });

      const raw = (response.text ?? "{}").trim();
      const parsed = JSON.parse(raw) as {
        correction?: {
          hasCorrection: boolean;
          originalPhrase: string;
          correctedPhrase: string;
          explanationEs: string;
        };
        vocabulary?: Array<{
          word: string;
          partOfSpeech: string;
          definitionEn: string;
          exampleEn: string;
          levelTag: string;
        }>;
      };

      const correction =
        parsed.correction && parsed.correction.hasCorrection && parsed.correction.correctedPhrase
          ? {
              originalPhrase: parsed.correction.originalPhrase,
              correctedPhrase: parsed.correction.correctedPhrase,
              explanationEs: parsed.correction.explanationEs,
            }
          : null;

      res.json({
        correction,
        vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
      });
    } catch (err) {
      console.error("Error in /api/analyze-turn:", err);
      res.status(500).json({
        error: formatGeminiError(err, "No se pudo analizar el turno de conversación."),
      });
    }
  });

  app.post("/api/session-vocab", async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: "Falta configurar GEMINI_API_KEY en el panel Settings > Secrets.",
      });
      return;
    }

    const { transcriptTurns, existingWords, level, topicLabelEn } = req.body as {
      transcriptTurns?: Array<{ speaker: string; text: string }>;
      existingWords?: Array<{
        word: string;
        partOfSpeech: string;
        definitionEn: string;
        exampleEn: string;
        levelTag: string;
      }>;
      level?: string;
      topicLabelEn?: string;
    };

    if (!transcriptTurns || transcriptTurns.length === 0) {
      res.json({ vocabulary: existingWords || [] });
      return;
    }

    try {
      const formattedTranscript = transcriptTurns
        .map((t) => `${t.speaker === "student" ? "Student" : "Tutor"}: ${t.text}`)
        .join("\n");

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: [
          `Student CEFR Level: ${level || "B1"}`,
          `Topic: ${topicLabelEn || "Everyday Conversation"}`,
          "",
          "Full session transcript:",
          formattedTranscript,
          "",
          `Words already captured live: ${JSON.stringify(existingWords || [])}`,
          "",
          "Task: Compile the final deduplicated list of ALL noteworthy, useful English vocabulary words, phrasal verbs, or everyday expressions encountered during this conversation practice (including words the tutor introduced, corrected, or translated from Spanish).",
          "- Keep useful words already captured and add any missed ones from the transcript.",
          "- Skip trivial beginner filler words unless they were specifically taught/corrected.",
          "- For every word, write a clear, accurate definition in English and a natural example sentence in English (matching the context of the conversation where possible).",
        ].join("\n"),
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vocabulary: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    partOfSpeech: { type: Type.STRING },
                    definitionEn: { type: Type.STRING },
                    exampleEn: { type: Type.STRING },
                    levelTag: { type: Type.STRING },
                  },
                  required: ["word", "partOfSpeech", "definitionEn", "exampleEn", "levelTag"],
                },
              },
            },
            required: ["vocabulary"],
          },
        },
      });

      const raw = (response.text ?? "{}").trim();
      const parsed = JSON.parse(raw) as {
        vocabulary?: Array<{
          word: string;
          partOfSpeech: string;
          definitionEn: string;
          exampleEn: string;
          levelTag: string;
        }>;
      };

      res.json({
        vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : existingWords || [],
      });
    } catch (err) {
      console.error("Error in /api/session-vocab:", err);
      res.status(500).json({
        error: formatGeminiError(err, "No se pudo consolidar la lista final de vocabulario."),
        vocabulary: existingWords || [],
      });
    }
  });

  app.post("/api/transcribe", async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: "Falta configurar GEMINI_API_KEY en el panel Settings > Secrets.",
      });
      return;
    }

    const { audioBase64, mimeType } = req.body as {
      audioBase64?: string;
      mimeType?: string;
    };

    if (!audioBase64) {
      res.status(400).json({ error: "No se recibió audio para transcribir." });
      return;
    }

    try {
      const cleanMime = (mimeType || "audio/webm").split(";")[0].trim();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-transcribe",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: cleanMime,
                data: audioBase64,
              },
            },
            {
              text: "Transcribe this spoken audio accurately in its original language (English or Spanish). Return only the transcribed text without commentary.",
            },
          ],
        },
      });

      res.json({ text: (response.text ?? "").trim() });
    } catch (err) {
      console.error("Error in /api/transcribe:", err);
      res.status(500).json({
        error: formatGeminiError(err, "No se pudo transcribir el audio capturado."),
      });
    }
  });

  app.post("/api/search-grounding", async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: "Falta configurar GEMINI_API_KEY en el panel Settings > Secrets.",
      });
      return;
    }

    const { query, level } = req.body as {
      query?: string;
      level?: string;
    };

    if (!query || !query.trim()) {
      res.status(400).json({ error: "Escribe un tema o pregunta para buscar información actual." });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: [
          `Look up accurate, up-to-date information using Google Search for: "${query.trim()}".`,
          `Write a clear, concise 2-3 sentence summary in natural English suitable for a ${level || "B1"} English learner, followed by 1 simple everyday conversation question about this topic.`,
          "Do not use markdown headings or bullet points.",
        ].join("\n"),
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const seenUris = new Set<string>();
      const sources: Array<{ title: string; uri: string }> = [];

      for (const chunk of chunks) {
        const uri = chunk.web?.uri;
        const title = chunk.web?.title;
        if (uri && !seenUris.has(uri)) {
          seenUris.add(uri);
          sources.push({
            title: title || uri,
            uri,
          });
        }
      }

      res.json({
        query: query.trim(),
        summaryEn: (response.text ?? "").trim(),
        sources,
      });
    } catch (err) {
      console.error("Error in /api/search-grounding:", err);
      res.status(500).json({
        error: formatGeminiError(
          err,
          "No se pudo consultar información actualizada en Google Search."
        ),
      });
    }
  });

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname === "/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", async (clientWs: WebSocket, request) => {
    const ai = getAiClient();
    if (!ai) {
      clientWs.send(
        JSON.stringify({
          type: "error",
          message:
            "Falta configurar GEMINI_API_KEY en Settings > Secrets para iniciar la sesión de voz.",
        })
      );
      clientWs.close();
      return;
    }

    const url = new URL(request.url || "/live", `http://${request.headers.host || "localhost"}`);
    const level = url.searchParams.get("level") || "B1";
    const pace = url.searchParams.get("pace") || "adaptive";
    const voice = url.searchParams.get("voice") || "Zephyr";
    const topicId = url.searchParams.get("topicId") || "free";

    const systemInstruction = buildTutorInstruction(level, pace, topicId);

    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    let isClosed = false;

    const safeSend = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    try {
      liveSession = await ai.live.connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            safeSend({ type: "ready" });
          },
          onmessage: (message: LiveServerMessage) => {
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              safeSend({
                type: "inputTranscript",
                text: content.inputTranscription.text,
              });
            }
            if (content?.outputTranscription?.text) {
              safeSend({
                type: "outputTranscript",
                text: content.outputTranscription.text,
              });
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                safeSend({
                  type: "audio",
                  data: part.inlineData.data,
                });
              }
            }
            if (content?.interrupted) {
              safeSend({ type: "interrupted" });
            }
            if (content?.turnComplete) {
              safeSend({ type: "turnComplete" });
            }
          },
          onerror: (err: unknown) => {
            console.error("Gemini Live error:", err);
            safeSend({
              type: "error",
              message: "Se produjo un error en la conexión de voz con el tutor.",
            });
          },
          onclose: () => {
            if (!isClosed) {
              safeSend({ type: "closed" });
            }
          },
        },
      });

      const topic = TOPIC_MAP[topicId] ?? TOPIC_MAP.free;
      liveSession.sendRealtimeInput({
        text: `Start the conversation now. Greet me warmly in English (level ${level}) and ask me ONE simple everyday question about ${topic.labelEn}.`,
      });
    } catch (err) {
      console.error("Failed to connect Gemini Live:", err);
      safeSend({
        type: "error",
        message:
          err instanceof Error
            ? `No se pudo iniciar la sesión de voz: ${err.message}`
            : "No se pudo conectar con el servicio de voz.",
      });
      clientWs.close();
      return;
    }

    clientWs.on("message", (raw) => {
      if (!liveSession || isClosed) return;
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          data?: string;
          text?: string;
          level?: string;
          pace?: string;
          topicId?: string;
          groundedSummary?: string;
          groundedQuery?: string;
        };

        if (msg.type === "audio" && msg.data) {
          liveSession.sendRealtimeInput({
            audio: { data: msg.data, mimeType: "audio/pcm;rate=16000" },
          });
        } else if (msg.type === "text" && msg.text) {
          liveSession.sendRealtimeInput({
            text: msg.text,
          });
        } else if (msg.type === "groundedTopic" && msg.groundedSummary) {
          liveSession.sendRealtimeInput({
            text: `[The student wants to practice talking about this real-world topic from Google Search ("${msg.groundedQuery || "Current topic"}"): ${msg.groundedSummary}. Acknowledge it warmly in English, keep your correction-first rule, and ask ONE simple everyday question about it.]`,
          });
        } else if (msg.type === "contextUpdate") {
          const updatedTopic = TOPIC_MAP[msg.topicId || "free"] ?? TOPIC_MAP.free;
          liveSession.sendRealtimeInput({
            text: `[Context update from app: Adjust your CEFR level to ${msg.level || "B1"}, speaking pace to ${msg.pace || "adaptive"}, and transition naturally on your next turn to the everyday topic "${updatedTopic.labelEn}" (${updatedTopic.hintEn}). Keep asking only one question at a time.]`,
          });
        }
      } catch (err) {
        console.error("Failed to parse client WS message:", err);
      }
    });

    clientWs.on("close", () => {
      isClosed = true;
      try {
        liveSession?.close();
      } catch {
        // ignore close errors
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Fluentia server running at http://localhost:${PORT}`);
  });
}

startServer();
