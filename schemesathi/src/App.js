import { useEffect, useState } from "react";
import Papa from "papaparse";
import Auth from "./Auth";
import SavedSchemes from "./SavedSchemes";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import ApplicationChecklist from "./ApplicationChecklist";
import SpeakButton from "./SpeakButton";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000";

const initialForm = {
  state: "",
  age: "",
  gender: "",
  socialCategory: "",
  businessType: "",
  businessStage: "",
  previousLoanDefault: ""
};

const languages = [
  "English",
  "Hindi",
  "Bengali",
  "Marathi",
  "Tamil",
  "Assamese"
];

const businessTypeAliases = {
  Manufacturing: ["Manufacturing"],
  Services: ["Services"],
  Retail: ["Retail", "Trading"],
  Trading: ["Trading", "Retail"],
  Tailoring: ["Tailoring", "Services"],
  Handicrafts: ["Handicrafts", "Services", "Manufacturing"],
  "Food Processing": ["Food Processing", "Manufacturing", "Services"],
  Agriculture: ["Agriculture"],
  "Dairy & Livestock": ["Dairy & Livestock", "Agriculture"],
  Fishing: ["Fishing", "Agriculture"],
  "Beauty & Wellness": ["Beauty & Wellness", "Services"],
  Transport: ["Transport", "Services"],
  "Repair Services": ["Repair Services", "Services"],
  "Digital Services": ["Digital Services", "Services", "Technology"],
  Construction: ["Construction", "Services"],
  Technology: ["Technology", "Digital Services"]
};

function parseMinimumAge(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function getStates(value) {
  const text = String(value || "").toLowerCase();

  if (
    text.includes("india") ||
    /\b(all|any)\b/.test(text) ||
    text.includes("pan india")
  ) {
    return ["ALL"];
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getBusinessTypes(value) {
  const text = String(value || "").toLowerCase();

  if (
    /\b(any|all)\b/.test(text) ||
    /\ball types?\b/.test(text)
  ) {
    return ["ALL"];
  }

  const types = [];

  function addType(type) {
    if (!types.includes(type)) types.push(type);
  }

  if (text.includes("manufactur")) addType("Manufacturing");
  if (text.includes("service") || text.includes("skill") || text.includes("training")) addType("Services");
  if (text.includes("retail") || text.includes("shop") || text.includes("store")) {
    addType("Retail");
    addType("Trading");
  }
  if (text.includes("trad") || text.includes("commerce")) addType("Trading");
  if (text.includes("tailor") || text.includes("stitch") || text.includes("garment") || text.includes("apparel")) {
    addType("Tailoring");
    addType("Services");
  }
  if (text.includes("handicraft") || text.includes("handloom") || text.includes("artisan") || text.includes("craft")) {
    addType("Handicrafts");
    addType("Services");
    addType("Manufacturing");
  }
  if (text.includes("food") || text.includes("bakery") || text.includes("restaurant") || text.includes("processing")) {
    addType("Food Processing");
    addType("Manufacturing");
    addType("Services");
  }
  if (text.includes("agri") || text.includes("farm")) addType("Agriculture");
  if (text.includes("dairy") || text.includes("livestock") || text.includes("poultry") || text.includes("animal husbandry")) {
    addType("Dairy & Livestock");
    addType("Agriculture");
  }
  if (text.includes("fish") || text.includes("aquaculture")) {
    addType("Fishing");
    addType("Agriculture");
  }
  if (text.includes("beauty") || text.includes("salon") || text.includes("wellness") || text.includes("cosmetic")) {
    addType("Beauty & Wellness");
    addType("Services");
  }
  if (text.includes("transport") || text.includes("logistics") || text.includes("delivery")) {
    addType("Transport");
    addType("Services");
  }
  if (text.includes("repair") || text.includes("maintenance") || text.includes("service center")) {
    addType("Repair Services");
    addType("Services");
  }
  if (text.includes("digital") || text.includes("software") || text.includes("online") || text.includes("technology") || text.includes("tech")) {
    addType("Digital Services");
    addType("Technology");
  }
  if (text.includes("construction") || text.includes("building") || text.includes("contractor")) {
    addType("Construction");
    addType("Services");
  }

  return types.length ? types : ["ALL"];
}
function convertCsvRow(row, index) {
  return {
    id: row["Scheme Name"] || "scheme-" + index,
    name: row["Scheme Name"] || "Unnamed scheme",
    minimumAge: parseMinimumAge(row["Minimum Age"]),
    states: getStates(row["Target Location"]),
    businessTypes: getBusinessTypes(
      row["Business Type / Industry"]
    ),
    targetGender: String(
      row["Target Gender"] || ""
    ).toLowerCase(),
    targetCommunity: String(
      row["Target Community / Category"] || ""
    ).toLowerCase(),
    businessStageRequirement: String(
      row["Business Stage"] || ""
    ).toLowerCase(),
    loanDefaultRequirement: String(
      row["Previous Loan Default"] || ""
    ).toLowerCase(),
    benefit:
      row["Financial Benefit"] ||
      "Benefit information is not listed yet.",
    eligibility:
      row["Plain-Text Eligibility Summary"] ||
      "Eligibility information is not listed yet.",
    documents:
      row["Documents Required"] ||
      "Document information is not listed yet.",
    howToApply:
      row["How to Apply"] ||
      "Application information is not listed yet.",
    link: row["Official Link"] || "#"
  };
}

function genderMatches(form, scheme) {
  const text = scheme.targetGender;

  if (!text || /\b(any|all)\b/.test(text)) return true;

  if (
    form.gender === "Woman" &&
    /\b(woman|women|female)\b/.test(text)
  ) {
    return true;
  }

  if (
    form.gender === "Man" &&
    /\b(man|men|male)\b/.test(text)
  ) {
    return true;
  }

  return false;
}

function categoryMatches(form, scheme) {
  const text = scheme.targetCommunity;

  if (!text || /\b(any|all)\b/.test(text)) return true;

  if (
    form.socialCategory === "SC" &&
    (/\bsc\b/.test(text) ||
      text.includes("scheduled caste"))
  ) {
    return true;
  }

  if (
    form.socialCategory === "ST" &&
    (/\bst\b/.test(text) ||
      text.includes("scheduled tribe"))
  ) {
    return true;
  }

  if (
    form.socialCategory === "OBC" &&
    (/\bobc\b/.test(text) ||
      text.includes("backward class"))
  ) {
    return true;
  }

  if (
    form.socialCategory === "General" &&
    /\bgeneral\b/.test(text)
  ) {
    return true;
  }

  if (
    form.gender === "Woman" &&
    /\b(woman|women|female)\b/.test(text)
  ) {
    return true;
  }

  return false;
}

function businessTypeMatches(selectedBusinessType, schemeBusinessTypes) {
  if (schemeBusinessTypes.includes("ALL")) return true;

  const acceptedTypes =
    businessTypeAliases[selectedBusinessType] ||
    [selectedBusinessType];

  return acceptedTypes.some((type) =>
    schemeBusinessTypes.includes(type)
  );
}

function businessStageMatches(form, scheme) {
  const requirement = scheme.businessStageRequirement;

  if (
    !requirement ||
    /\b(any|all)\b/.test(requirement)
  ) {
    return true;
  }

  if (
    requirement.includes("new") ||
    requirement.includes("greenfield")
  ) {
    return form.businessStage === "New business";
  }

  if (requirement.includes("existing")) {
    return form.businessStage === "Existing business";
  }

  return true;
}

function loanDefaultMatches(form, scheme) {
  const requirement = scheme.loanDefaultRequirement;

  if (
    !requirement ||
    /\b(any|all)\b/.test(requirement)
  ) {
    return true;
  }

  if (
    requirement.includes("no") ||
    requirement.includes("not defaulted") ||
    requirement.includes("without default")
  ) {
    return form.previousLoanDefault === "No";
  }

  return true;
}

function getMatchDetails(form, scheme) {
  let score = 0;
  const reasons = [];
  const state = form.state.trim().toLowerCase();

  if (
    scheme.states.includes("ALL") ||
    scheme.states.includes(state)
  ) {
    score += 25;
    reasons.push(
      scheme.states.includes("ALL")
        ? "Available across India."
        : "Available in your state."
    );
  }

  if (Number(form.age) >= scheme.minimumAge) {
    score += 20;
    reasons.push(
      scheme.minimumAge
        ? "You meet the minimum age of " +
          scheme.minimumAge +
          " years."
        : "No minimum age restriction is listed."
    );
  }

  if (
    scheme.businessTypes.includes("ALL") ||
    scheme.businessTypes.includes(form.businessType)
  ) {
    score += 25;
    reasons.push("Your business type is supported.");
  }

  if (genderMatches(form, scheme)) {
    score += 15;
    reasons.push(
      scheme.targetGender
        ? "Your profile fits the listed gender group."
        : "No gender restriction is listed."
    );
  }

  if (categoryMatches(form, scheme)) {
    score += 15;
    reasons.push(
      scheme.targetCommunity
        ? "Your community category fits the listed group."
        : "No community restriction is listed."
    );
  }

  if (
    scheme.businessStageRequirement &&
    businessStageMatches(form, scheme)
  ) {
    reasons.push(
      "Your business stage matches the scheme requirement."
    );
  }

  if (
    scheme.loanDefaultRequirement &&
    loanDefaultMatches(form, scheme)
  ) {
    reasons.push(
      "Your loan repayment history matches the listed requirement."
    );
  }

  return {
    matchScore: Math.min(score, 100),
    matchReasons: reasons
  };
}

function getMatchStatus(score) {
  if (score >= 85) {
    return {
      label: "Strong match",
      description:
        "Most of your answers match the listed conditions.",
      tone: "strong"
    };
  }

  if (score >= 65) {
    return {
      label: "Possible match",
      description:
        "Several conditions match, but check the details carefully.",
      tone: "possible"
    };
  }

  return {
    label: "Needs verification",
    description:
      "Review the official eligibility rules before applying.",
    tone: "verify"
  };
}

function schemeMatches(form, scheme) {
  const state = form.state.trim().toLowerCase();

  return (
    (scheme.states.includes("ALL") ||
      scheme.states.includes(state)) &&
    Number(form.age) >= scheme.minimumAge &&
    (businessTypeMatches(
        form.businessType,
        scheme.businessTypes
      )) &&
    genderMatches(form, scheme) &&
    categoryMatches(form, scheme) &&
    businessStageMatches(form, scheme) &&
    loanDefaultMatches(form, scheme)
  );
}

function SchemeCard({
  scheme,
  saved,
  onSave,
  onDetails,
  onExplain
}) {
  const hasMatch = scheme.matchScore !== undefined;

  return (
    <article
      className="ss-scheme-card"
      data-testid={"card-scheme-" + scheme.id}
    >
      <div className="ss-scheme-topline">
        <h3 className="ss-scheme-name">{scheme.name}</h3>

        <button
          className={"ss-save " + (saved ? "saved" : "")}
          type="button"
          onClick={onSave}
          aria-label={
            saved
              ? "Saved " + scheme.name
              : "Save " + scheme.name
          }
          data-testid={
            "button-save-scheme-" + scheme.id
          }
        >
          {saved ? "♥" : "♡"}
        </button>
      </div>

      <p className="ss-scheme-benefit">
        {scheme.benefit}
      </p>

      <div className="ss-match-row">
        <div
          className={
            "ss-match-pip " +
            (scheme.matchStatus?.tone || "")
          }
        >
          {hasMatch ? scheme.matchScore + "%" : "✓"}
        </div>

        <div className="ss-match-copy">
          <strong>
            {hasMatch
              ? scheme.matchStatus?.label ||
                "Possible match"
              : "Saved for later"}
          </strong>
          <span>
            {hasMatch
              ? scheme.matchStatus?.description ||
                "Based on your answers"
              : "Keep this scheme close"}
          </span>
        </div>
      </div>

      <div className="ss-card-actions">
        <button
          type="button"
          className="ss-pill-button ghost"
          onClick={onDetails}
          data-testid={
            "button-details-scheme-" + scheme.id
          }
        >
          See details
        </button>

        {hasMatch && (
          <button
            type="button"
            className="ss-pill-button primary"
            onClick={onExplain}
            data-testid={
              "button-explain-scheme-" + scheme.id
            }
          >
            Explain
          </button>
        )}
      </div>
    </article>
  );
}

function SchemeDetail({
  scheme,
  user,
  language,
  explanation,
  loadingExplanation,
  explanationError,
  onExplain,
  onClose,
  onSave,
  saved
}) {
  return (
    <div
      className="ss-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="ss-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scheme-detail-title"
      >
        <div className="ss-modal-head">
          <div>
            <span className="ss-eyebrow">
              <span className="ss-eyebrow-dot" />
              Scheme details
            </span>
            <h2 id="scheme-detail-title">
              {scheme.name}
            </h2>
          </div>

          <button
            className="ss-modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close details"
            data-testid="button-close-details"
          >
            ×
          </button>
        </div>

        {scheme.matchReasons?.length > 0 && (
          <div className="ss-detail-block">
            <h4>Why this appeared for you</h4>
            <ul className="ss-reason-list">
              {scheme.matchReasons.map(
                (reason, index) => (
                  <li key={index}>{reason}</li>
                )
              )}
            </ul>
          </div>
        )}

        <div className="ss-detail-block">
          <h4>What you could receive</h4>
          <p>{scheme.benefit}</p>
        </div>

        <div className="ss-detail-block">
          <h4>Eligibility</h4>
          <p>{scheme.eligibility}</p>
        </div>

        <div className="ss-detail-block">
          <h4>Documents to keep ready</h4>
          <p>{scheme.documents}</p>
        </div>

        <div className="ss-detail-block">
          <h4>How to apply</h4>
          <p>{scheme.howToApply}</p>
        </div>

        {explanation && (
          <div
            className="ss-explanation"
            data-testid={"text-explanation-" + scheme.id}
          >
            <h4>In plain language · {language}</h4>
            <p>{explanation}</p>
            <SpeakButton
              text={explanation}
              language={language}
            />
          </div>
        )}

        <ApplicationChecklist
          scheme={scheme}
          user={user}
        />

        {explanationError && (
          <div
            className="ss-alert error"
            data-testid={
              "status-explanation-error-" + scheme.id
            }
          >
            <span>!</span>
            <span>{explanationError}</span>
          </div>
        )}

        <div className="ss-alert info">
          <span>ⓘ</span>
          <span>
            This result is guidance based on the
            information you provided. The official
            department or bank will make the final
            eligibility decision.
          </span>
        </div>

        <div className="ss-card-actions ss-modal-actions">
          <button
            type="button"
            className={
              "ss-pill-button " +
              (saved ? "warm" : "ghost")
            }
            onClick={onSave}
            data-testid={
              "button-detail-save-" + scheme.id
            }
          >
            {saved ? "♥ Saved" : "♡ Save scheme"}
          </button>

          <button
            type="button"
            className="ss-pill-button primary"
            onClick={onExplain}
            disabled={loadingExplanation}
            data-testid={
              "button-detail-explain-" + scheme.id
            }
          >
            {loadingExplanation
              ? "Writing your explanation…"
              : "Explain in " + language}
          </button>

          {scheme.link !== "#" && (
            <a
              className="ss-pill-button ghost"
              href={scheme.link}
              target="_blank"
              rel="noreferrer"
              data-testid={
                "link-official-" + scheme.id
              }
            >
              Official site ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState("matcher");
  const [form, setForm] = useState(initialForm);
  const [schemes, setSchemes] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loadingSchemes, setLoadingSchemes] =
    useState(true);
  const [schemeError, setSchemeError] = useState("");
  const [searched, setSearched] = useState(false);
  const [savedIds, setSavedIds] = useState(new Set());
  const [explanations, setExplanations] = useState({});
  const [explanationLoading, setExplanationLoading] =
    useState({});
  const [explanationErrors, setExplanationErrors] =
    useState({});
  const [selectedLanguage, setSelectedLanguage] =
    useState("English");
  const [selectedScheme, setSelectedScheme] =
    useState(null);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setAuthReady(true);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    fetch("/data/schemes.csv")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Could not find schemes.csv");
        }
        return response.text();
      })
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => {
            if (result.errors?.length > 0) {
              console.warn(
                "CSV warnings:",
                result.errors
              );
            }

            const converted = result.data
              .map(convertCsvRow)
              .filter(
                (scheme) =>
                  scheme.name !== "Unnamed scheme"
              );

            if (converted.length === 0) {
              setSchemeError(
                "No valid schemes were found in public/data/schemes.csv."
              );
              setLoadingSchemes(false);
              return;
            }

            console.table(
              converted.slice(0, 5).map((scheme) => ({
                name: scheme.name,
                minimumAge: scheme.minimumAge,
                states: scheme.states.join(", "),
                businessTypes:
                  scheme.businessTypes.join(", "),
                businessStageRequirement:
                  scheme.businessStageRequirement,
                loanDefaultRequirement:
                  scheme.loanDefaultRequirement,
                link: scheme.link
              }))
            );

            setSchemes(converted);
            setLoadingSchemes(false);
          },
          error: (error) => {
            console.error("CSV parsing error:", error);
            setSchemeError(
              "The scheme file could not be read."
            );
            setLoadingSchemes(false);
          }
        });
      })
      .catch((error) => {
        console.error("CSV loading error:", error);
        setSchemeError(
          "The scheme file could not be loaded. Check public/data/schemes.csv."
        );
        setLoadingSchemes(false);
      });
  }, []);

  function goToMatcher() {
    setView("matcher");

    window.setTimeout(() => {
      document
        .getElementById("scheme-profile")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }, 50);
  }

  function handleSubmit(event) {
    event.preventDefault();
    setSaveMessage(null);

    const matching = schemes
      .filter((scheme) => schemeMatches(form, scheme))
      .map((scheme) => {
        const details = getMatchDetails(form, scheme);

        return {
          ...scheme,
          ...details,
          matchStatus: getMatchStatus(
            details.matchScore
          )
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    setMatches(matching);
    setSearched(true);
    setExplanations({});
    setExplanationLoading({});
    setExplanationErrors({});

    if (!user || !user.uid) {
      setSaveMessage({
        type: "error",
        text: "Please sign in before saving your profile."
      });
      return;
    }

    setDoc(
      doc(db, "users", user.uid),
      {
        email: user.email || "",
        profile: form,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    )
      .then(() => {
        setSaveMessage({
          type: "success",
          text:
            "Your profile is ready. Here are the schemes that may fit."
        });
      })
      .catch((error) => {
        console.error("Profile save error:", error);
        setSaveMessage({
          type: "error",
          text:
            "Profile could not be saved. Firebase error: " +
            error.code
        });
      });

    window.setTimeout(() => {
      document
        .getElementById("results")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }, 50);
  }

  async function handleExplainScheme(scheme) {
    setExplanationLoading((current) => ({
      ...current,
      [scheme.id]: true
    }));

    setExplanationErrors((current) => ({
      ...current,
      [scheme.id]: ""
    }));

    try {
      const response = await fetch(
        API_BASE_URL + "/api/explain",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            scheme,
            profile: form,
            language: selectedLanguage
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.explanation) {
        throw new Error(
          data.error ||
            data.details ||
            "Could not generate an explanation."
        );
      }

      setExplanations((current) => ({
        ...current,
        [scheme.id]: data.explanation
      }));
    } catch (error) {
      console.error("Explanation error:", error);

      setExplanationErrors((current) => ({
        ...current,
        [scheme.id]:
          error.message === "Failed to fetch"
            ? "Could not reach the explanation server. Make sure the backend is running on port 5000."
            : error.message ||
              "The explanation could not be generated."
      }));
    } finally {
      setExplanationLoading((current) => ({
        ...current,
        [scheme.id]: false
      }));
    }
  }

  async function handleSaveScheme(scheme) {
    if (!user || !user.uid) {
      setSaveMessage({
        type: "error",
        text: "Please sign in before saving a scheme."
      });
      return;
    }

    try {
      const safeSchemeId = scheme.id.replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );

      await setDoc(
        doc(
          db,
          "users",
          user.uid,
          "savedSchemes",
          safeSchemeId
        ),
        {
          schemeId: scheme.id,
          name: scheme.name,
          benefit: scheme.benefit,
          eligibility: scheme.eligibility,
          documents: scheme.documents,
          howToApply: scheme.howToApply,
          link: scheme.link,
          savedAt: serverTimestamp()
        }
      );

      setSavedIds(
        (current) =>
          new Set([...current, scheme.id])
      );

      setSaveMessage({
        type: "success",
        text: scheme.name + " is saved for later."
      });
    } catch (error) {
      console.error("Save scheme error:", error);

      setSaveMessage({
        type: "error",
        text:
          "This scheme could not be saved. Firebase error: " +
          error.code
      });
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      setUser(null);
      setView("matcher");
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: "Logout could not be completed."
      });
    }
  }

  if (!authReady) {
    return (
      <div className="ss-boot">
        <div className="ss-boot-dot" />
        <h2>Checking login...</h2>
        <p>
          Preparing a trusted space to find schemes for you.
        </p>
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  if (view === "saved") {
    return (
      <SavedSchemes
        user={user}
        onBack={() => setView("matcher")}
      />
    );
  }

  return (
    <div className="ss-app">
      <header className="ss-container ss-nav">
        <button
          className="ss-brand ss-brand-button"
          type="button"
          onClick={goToMatcher}
          data-testid="button-home"
        >
          <span className="ss-mark">S</span>
          <span>
            <span className="ss-brand-name">
              SchemeSathi
            </span>
            <span className="ss-brand-sub">
              Your next step, made clearer
            </span>
          </span>
        </button>

        <nav
          className="ss-nav-links"
          aria-label="Primary navigation"
        >
          <button
            className="ss-nav-link active"
            type="button"
            onClick={goToMatcher}
            data-testid="button-find-schemes"
          >
            Find schemes
          </button>
          <button
            className="ss-nav-link"
            type="button"
            onClick={() => setView("saved")}
            data-testid="button-saved-schemes"
          >
            Saved
          </button>
        </nav>

        <div className="ss-account">
          <button
            type="button"
            className="ss-user-chip"
            onClick={handleLogout}
            title="Sign out"
            data-testid="button-sign-out"
          >
            <span className="ss-avatar">
              {(user.email || "U")
                .slice(0, 1)
                .toUpperCase()}
            </span>
            <span className="ss-user-label">
              {user.email}
            </span>
            <span>↪</span>
          </button>
        </div>
      </header>

      <main>
        <section className="ss-container ss-hero">
          <div className="ss-hero-copy">
            <span className="ss-eyebrow">
              <span className="ss-eyebrow-dot" />
              A more human way to find support
            </span>
            <h1>
              Good work deserves a <em>fair start.</em>
            </h1>
            <p className="ss-hero-lede">
              Tell us a little about yourself and your work.
              SchemeSathi quietly looks through government
              support and brings the most relevant next steps
              to you.
            </p>
            <div className="ss-hero-actions">
              <a
                href="#scheme-profile"
                className="ss-pill-button primary"
                data-testid="link-start-matcher"
              >
                Find my schemes →
              </a>
              <span className="ss-trust-note">
                Free to use · no paperwork here
              </span>
            </div>
          </div>

          <div
            className="ss-art"
            aria-label="Abstract illustration of growth"
          >
            <div className="ss-art-halo" />
            <div className="ss-art-leaf" />
            <div className="ss-art-petal one" />
            <div className="ss-art-petal two" />
            <div className="ss-art-petal three" />
            <div className="ss-art-sun" />
            <div className="ss-art-card">
              <span>Your match, made clearer</span>
              <strong>Stand-Up India</strong>
              <div className="ss-art-card-bar">
                <i />
              </div>
            </div>
          </div>
        </section>

        <section
          className="ss-section soft"
          id="scheme-profile"
        >
          <div className="ss-container">
            <div className="ss-section-head">
              <div>
                <span className="ss-eyebrow">
                  <span className="ss-eyebrow-dot" />
                  Takes about two minutes
                </span>
                <h2 className="ss-section-title">
                  Start with what matters.
                </h2>
              </div>
              <p className="ss-section-description">
                No jargon, no wrong answers. We only use
                these details to make your shortlist more
                useful.
              </p>
            </div>

            {saveMessage && (
              <div
                className={"ss-alert " + saveMessage.type}
                data-testid={
                  "status-profile-" + saveMessage.type
                }
              >
                <span>
                  {saveMessage.type === "success"
                    ? "✓"
                    : "!"}
                </span>
                <span>{saveMessage.text}</span>
              </div>
            )}

            {loadingSchemes && (
              <div className="ss-form-card">
                <div className="ss-skeleton" />
              </div>
            )}

            {schemeError && (
              <div className="ss-alert error">
                <span>!</span>
                <span>{schemeError}</span>
              </div>
            )}

            {!loadingSchemes && !schemeError && (
              <form
                className="ss-form-card"
                onSubmit={handleSubmit}
              >
                <div className="ss-stepper">
                  {[
                    "state",
                    "age",
                    "gender",
                    "category",
                    "business",
                    "stage",
                    "loan history"
                  ].map((label, index) => (
                    <div className="ss-step" key={label}>
                      <div className="ss-step-bar">
                        {index === 0 && (
                          <span style={{ width: "100%" }} />
                        )}
                      </div>
                      <div className="ss-step-label">
                        {index + 1} · {label}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="ss-form-grid">
                  <label className="ss-form-field">
                    <span>State</span>
                    <input
                      className="ss-input"
                      type="text"
                      name="state"
                      value={form.state}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          state: event.target.value
                        })
                      }
                      required
                      placeholder="For example, Assam"
                      data-testid="input-state"
                    />
                  </label>

                  <label className="ss-form-field">
                    <span>Age</span>
                    <input
                      className="ss-input"
                      type="number"
                      name="age"
                      value={form.age}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          age: event.target.value
                        })
                      }
                      min="1"
                      required
                      placeholder="Your age"
                      data-testid="input-age"
                    />
                  </label>

                  <label className="ss-form-field">
                    <span>Gender</span>
                    <select
                      className="ss-select"
                      name="gender"
                      value={form.gender}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          gender: event.target.value
                        })
                      }
                      required
                      data-testid="select-gender"
                    >
                      <option value="">Choose one</option>
                      <option value="Woman">Woman</option>
                      <option value="Man">Man</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <label className="ss-form-field">
                    <span>Social category</span>
                    <select
                      className="ss-select"
                      name="socialCategory"
                      value={form.socialCategory}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          socialCategory:
                            event.target.value
                        })
                      }
                      required
                      data-testid="select-social-category"
                    >
                      <option value="">Choose one</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                      <option value="OBC">OBC</option>
                      <option value="General">General</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <label className="ss-form-field">
                    <span>Business type</span>
                    <select
                      className="ss-select"
                      name="businessType"
                      value={form.businessType}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          businessType:
                            event.target.value
                        })
                      }
                      required
                      data-testid="select-business-type"
                    >
                      <option value="">Choose one</option>
                      <option value="">Choose one</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Services">General services</option>
                      <option value="Retail">Retail shop</option>
                      <option value="Trading">Trading and wholesale</option>
                      <option value="Tailoring">Tailoring and garments</option>
                      <option value="Handicrafts">Handicrafts and handloom</option>
                      <option value="Food Processing">Food processing and bakery</option>
                      <option value="Agriculture">Agriculture and farming</option>
                      <option value="Dairy & Livestock">Dairy, poultry and livestock</option>
                      <option value="Fishing">Fishing and aquaculture</option>
                      <option value="Beauty & Wellness">Beauty and wellness</option>
                      <option value="Transport">Transport and delivery</option>
                      <option value="Repair Services">Repair and maintenance</option>
                      <option value="Digital Services">Digital and online services</option>
                      <option value="Construction">Construction</option>
                      <option value="Technology">Technology</option>
                    </select>
                  </label>

                  <label className="ss-form-field">
                    <span>Business stage</span>
                    <select
                      className="ss-select"
                      name="businessStage"
                      value={form.businessStage}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          businessStage:
                            event.target.value
                        })
                      }
                      required
                      data-testid="select-business-stage"
                    >
                      <option value="">Choose one</option>
                      <option value="New business">
                        New business
                      </option>
                      <option value="Existing business">
                        Existing business
                      </option>
                    </select>
                  </label>

                  <label className="ss-form-field">
                    <span>Previous loan default</span>
                    <select
                      className="ss-select"
                      name="previousLoanDefault"
                      value={form.previousLoanDefault}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          previousLoanDefault:
                            event.target.value
                        })
                      }
                      required
                      data-testid="select-loan-default"
                    >
                      <option value="">Choose one</option>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                      <option value="Not sure">
                        Not sure
                      </option>
                    </select>
                  </label>
                </div>

                <div className="ss-form-footer">
                  <span className="ss-helper">
                    Your answers stay private to your account.
                  </span>
                  <button
                    type="submit"
                    className="ss-pill-button primary"
                    disabled={schemes.length === 0}
                    data-testid="button-submit-matcher"
                  >
                    Show my matches →
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {searched && (
          <section className="ss-section" id="results">
            <div className="ss-container">
              <div className="ss-results-head">
                <div>
                  <span className="ss-eyebrow">
                    <span className="ss-eyebrow-dot" />
                    Your shortlist
                  </span>
                  <h2 className="ss-section-title">
                    A few doors worth opening.
                  </h2>
                  <p
                    className="ss-results-count"
                    data-testid="text-results-count"
                  >
                    {matches.length} possible matches
                  </p>
                </div>

                <select
                  className="ss-language"
                  value={selectedLanguage}
                  onChange={(event) =>
                    setSelectedLanguage(
                      event.target.value
                    )
                  }
                  aria-label="Explanation language"
                  data-testid="select-language"
                >
                  {languages.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>

              {matches.length === 0 ? (
                <div className="ss-empty">
                  <div className="ss-empty-icon">?</div>
                  <h3>Nothing close enough yet</h3>
                  <p>
                    Try another state spelling or a broader
                    business type. Your answers can be changed
                    above.
                  </p>
                </div>
              ) : (
                <div className="ss-scheme-grid">
                  {matches.map((scheme) => (
                    <SchemeCard
                      key={scheme.id}
                      scheme={scheme}
                      saved={savedIds.has(scheme.id)}
                      onSave={() =>
                        handleSaveScheme(scheme)
                      }
                      onDetails={() =>
                        setSelectedScheme(scheme)
                      }
                      onExplain={() => {
                        setSelectedScheme(scheme);
                        handleExplainScheme(scheme);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="ss-container ss-footer">
        <span>
          SchemeSathi · a clearer path to support
        </span>
        <span>
          India-wide catalogue, thoughtfully simplified
        </span>
      </footer>

      {selectedScheme && (
        <SchemeDetail
          scheme={selectedScheme}
          user={user}
          language={selectedLanguage}
          explanation={
            explanations[selectedScheme.id] || ""
          }
          loadingExplanation={Boolean(
            explanationLoading[selectedScheme.id]
          )}
          explanationError={
            explanationErrors[selectedScheme.id] || ""
          }
          onExplain={() =>
            handleExplainScheme(selectedScheme)
          }
          onClose={() => setSelectedScheme(null)}
          onSave={() =>
            handleSaveScheme(selectedScheme)
          }
          saved={savedIds.has(selectedScheme.id)}
        />
      )}
    </div>
  );
}

export default App;