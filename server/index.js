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

    let geminiResponse;
    let data;
    let explanation;
    const maxRetries = 2;
    const delays = [1000, 3000];
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        geminiResponse = await fetch(
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

        data = await geminiResponse.json();

        if (geminiResponse.ok) {
          explanation = data.candidates?.[0]?.content?.parts
            ?.map((part) => part.text)
            .filter(Boolean)
            .join("\n");
          break;
        }

        console.error(`Gemini API error (attempt ${attempt + 1}):`, data);
        const status = geminiResponse.status;

        const retriableStatuses = [429, 500, 502, 503, 504];
        if (retriableStatuses.includes(status)) {
          if (attempt < maxRetries) {
            const delay = delays[attempt];
            await new Promise((resolve) => setTimeout(resolve, delay));
            attempt++;
            continue;
          } else {
            return res.status(503).json({
              error: "Gemini is temporarily busy. Please try again in a moment."
            });
          }
        } else {
          return res.status(502).json({
            error: "Gemini request failed",
            details: data.error?.message || "Unknown Gemini API error"
          });
        }
      } catch (err) {
        console.error(`Gemini fetch error (attempt ${attempt + 1}):`, err);
        if (attempt < maxRetries) {
          const delay = delays[attempt];
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempt++;
          continue;
        } else {
          return res.status(503).json({
            error: "Gemini is temporarily busy. Please try again in a moment."
          });
        }
      }
    }

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