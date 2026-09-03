const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env")
});

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_MODEL = "gemini-3.6-flash";

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SchemeSaathi backend is working"
  });
});

app.post("/api/explain", async (req, res) => {
  try {
    const { scheme, profile, language = "English" } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing from server/.env"
      });
    }

    if (!scheme) {
      return res.status(400).json({
        error: "Scheme information is required"
      });
    }

    const prompt = `
Explain the following government scheme for an entrepreneur in India.

Use simple, clear language in ${language}.

Scheme information:
${JSON.stringify(scheme, null, 2)}

User profile:
${JSON.stringify(profile || {}, null, 2)}

Include these sections:
1. Why this scheme matched the user
2. Main benefits
3. Important eligibility points
4. Documents the user may need
5. What the user should do next

Rules:
- Do not promise approval.
- Do not invent information.
- Do not make the eligibility decision.
- If information is unclear, tell the user to verify it using the official scheme link.
- Keep the explanation practical and easy to understand.
`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: "You are SchemeSaathi, a careful assistant for Indian entrepreneurs."
              }
            ]
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini API error:", data);

      return res.status(502).json({
        error: "Gemini request failed",
        details: data.error?.message || "Unknown Gemini API error"
      });
    }

    const explanation = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n");

    if (!explanation) {
      return res.status(502).json({
        error: "Gemini returned no explanation"
      });
    }

    res.json({
      success: true,
      explanation
    });
  } catch (error) {
    console.error("Explanation error:", error);

    res.status(500).json({
      error: "Could not generate scheme explanation"
    });
  }
});console.log("Gemini key loaded:", Boolean(process.env.GEMINI_API_KEY));

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});