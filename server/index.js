const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env")
});

const express = require("express");
const cors = require("cors");

const app = express();

const PORT = Number(process.env.PORT) || 5000;

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite"
].filter(
  (model, index, models) =>
    models.indexOf(model) === index
);

let geminiClientPromise = null;

function getGeminiClient() {
  if (!geminiClientPromise) {
    geminiClientPromise = import("@google/genai").then(
      ({ GoogleGenAI }) => {
        const apiKey =
          process.env.GEMINI_API_KEY?.trim();

        if (!apiKey) {
          throw new Error(
            "GEMINI_API_KEY is missing from server/.env"
          );
        }

        return new GoogleGenAI({
          apiKey
        });
      }
    );
  }

  return geminiClientPromise;
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getErrorStatus(error) {
  const directStatus = Number(
    error?.status || error?.code
  );

  if (Number.isInteger(directStatus)) {
    return directStatus;
  }

  const message = String(
    error?.message || error || ""
  );

  const match = message.match(
    /\b(401|403|429|500|502|503|504)\b/
  );

  return match ? Number(match[1]) : null;
}

function isTemporaryError(error) {
  const status = getErrorStatus(error);

  if (
    [429, 500, 502, 503, 504].includes(status)
  ) {
    return true;
  }

  const message = String(
    error?.message || error || ""
  ).toLowerCase();

  return (
    message.includes("unavailable") ||
    message.includes("high demand") ||
    message.includes("temporarily busy") ||
    message.includes("resource exhausted") ||
    message.includes("rate limit")
  );
}

function extractInteractionText(interaction) {
  if (
    typeof interaction?.output_text ===
    "string"
  ) {
    return interaction.output_text.trim();
  }

  if (Array.isArray(interaction?.outputs)) {
    return interaction.outputs
      .map((output) => {
        if (typeof output?.text === "string") {
          return output.text;
        }

        if (Array.isArray(output?.content)) {
          return output.content
            .map((part) => part?.text || "")
            .join("");
        }

        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SchemeSathi backend is working"
  });
});

app.post("/api/explain", async (req, res) => {
  try {
    const {
      scheme,
      profile,
      language = "English"
    } = req.body || {};

    const apiKey =
      process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY is missing from server/.env"
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

    const ai = await getGeminiClient();

    let explanation = "";
    let lastErrorMessage = "";

    for (
      let attempt = 0;
      attempt < GEMINI_MODELS.length;
      attempt++
    ) {
      const model = GEMINI_MODELS[attempt];

      try {
        console.log(
          `Trying Gemini model: ${model}`
        );

        const interaction =
          await ai.interactions.create({
            model,
            input: `
You are SchemeSathi, a careful assistant
for marginalized entrepreneurs in India.

${prompt}
            `
          });

        explanation =
          extractInteractionText(interaction);

        if (explanation) {
          break;
        }

        lastErrorMessage =
          "Gemini returned no explanation.";
      } catch (error) {
        const status = getErrorStatus(error);

        lastErrorMessage =
          error?.message ||
          "Unknown Gemini error";

        console.error(
          `Gemini error from ${model}:`,
          {
            status,
            message: lastErrorMessage
          }
        );

        if (!isTemporaryError(error)) {
          return res.status(502).json({
            error: "Gemini request failed",
            details: lastErrorMessage
          });
        }
      }

      if (
        !explanation &&
        attempt < GEMINI_MODELS.length - 1
      ) {
        const delay =
          1500 * Math.pow(2, attempt);

        console.log(
          `Waiting ${delay}ms before trying the next model...`
        );

        await sleep(delay);
      }
    }

    if (!explanation) {
      return res.status(503).json({
        error:
          "Gemini is temporarily busy. Please try again shortly.",
        details: lastErrorMessage
      });
    }

    return res.json({
      success: true,
      explanation
    });
  } catch (error) {
    console.error("Explanation error:", {
      message: error?.message,
      status: getErrorStatus(error)
    });

    return res.status(500).json({
      error:
        "Could not generate scheme explanation",
      details:
        error?.message || "Unknown server error"
    });
  }
});

console.log(
  "Gemini key loaded:",
  Boolean(process.env.GEMINI_API_KEY?.trim())
);

console.log(
  "Gemini fallback models:",
  GEMINI_MODELS.join(", ")
);

app.listen(PORT, () => {
  console.log(
    `Backend running at http://localhost:${PORT}`
  );
});