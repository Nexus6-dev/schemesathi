import { useEffect, useState } from "react";
import Papa from "papaparse";
import Auth from "./Auth";
import SavedSchemes from "./SavedSchemes";

import {
  onAuthStateChanged,
  signOut
} from "firebase/auth";

import { auth, db } from "./firebase";

import {
  doc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";

function parseMinimumAge(value) {
  const text = String(value || "");
  const number = text.match(/\d+/);

  return number ? Number(number[0]) : 0;
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

  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getBusinessTypes(value) {
  const text = String(value || "").toLowerCase();
  const types = [];

  if (
    /\b(any|all)\b/.test(text) ||
    /\ball types?\b/.test(text)
  ) {
    return ["ALL"];
  }

  if (text.includes("manufactur")) {
    types.push("Manufacturing");
  }

  if (
    text.includes("service") ||
    text.includes("skill") ||
    text.includes("training")
  ) {
    types.push("Services");
  }

  if (text.includes("trad")) {
    types.push("Trading");
  }

  if (
    text.includes("agri") ||
    text.includes("farm") ||
    text.includes("fisher")
  ) {
    types.push("Agriculture");
  }

  if (
    text.includes("tech") ||
    text.includes("startup") ||
    text.includes("telecom") ||
    text.includes("ict")
  ) {
    types.push("Technology");
  }

  return types.length > 0 ? types : ["ALL"];
}

function convertCsvRow(row, index) {
  return {
    id: row["Scheme Name"] || `scheme-${index}`,

    name:
      row["Scheme Name"] ||
      "Unnamed Scheme",

    minimumAge: parseMinimumAge(
      row["Minimum Age"]
    ),

    states: getStates(
      row["Target Location"]
    ),

    businessTypes: getBusinessTypes(
      row["Business Type / Industry"]
    ),

    targetGender: String(
      row["Target Gender"] || ""
    ).toLowerCase(),

    targetCommunity: String(
      row["Target Community / Category"] || ""
    ).toLowerCase(),

    benefit:
      row["Financial Benefit"] ||
      "Benefit information unavailable",

    eligibility:
      row["Plain-Text Eligibility Summary"] ||
      "Eligibility information unavailable",

    documents:
      row["Documents Required"] ||
      "Document information unavailable",

    howToApply:
      row["How to Apply"] ||
      "Application information unavailable",

    link:
      row["Official Link"] ||
      "#"
  };
}

function genderMatches(form, scheme) {
  const text = scheme.targetGender;

  if (
    !text ||
    /\b(any|all)\b/.test(text)
  ) {
    return true;
  }

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

  if (
    !text ||
    /\b(any|all)\b/.test(text)
  ) {
    return true;
  }

  if (
    form.socialCategory === "SC" &&
    (
      /\bsc\b/.test(text) ||
      text.includes("scheduled caste")
    )
  ) {
    return true;
  }

  if (
    form.socialCategory === "ST" &&
    (
      /\bst\b/.test(text) ||
      text.includes("scheduled tribe")
    )
  ) {
    return true;
  }

  if (
    form.socialCategory === "OBC" &&
    (
      /\bobc\b/.test(text) ||
      text.includes("backward class")
    )
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

function schemeMatches(form, scheme) {
  const selectedState = form.state
    .trim()
    .toLowerCase();

  const stateMatches =
    scheme.states.includes("ALL") ||
    scheme.states.includes(selectedState);

  const ageMatches =
    Number(form.age) >= scheme.minimumAge;

  const businessTypeMatches =
    scheme.businessTypes.includes("ALL") ||
    scheme.businessTypes.includes(form.businessType);

  const genderMatchesResult =
    genderMatches(form, scheme);

  const categoryMatchesResult =
    categoryMatches(form, scheme);

  return (
    stateMatches &&
    ageMatches &&
    businessTypeMatches &&
    genderMatchesResult &&
    categoryMatchesResult
  );
}

function getMatchDetails(form, scheme) {
  let score = 0;
  const reasons = [];

  const selectedState = form.state
    .trim()
    .toLowerCase();

  const stateMatches =
    scheme.states.includes("ALL") ||
    scheme.states.includes(selectedState);

  if (stateMatches) {
    score += 25;

    if (scheme.states.includes("ALL")) {
      reasons.push(
        "This scheme is available across India."
      );
    } else {
      reasons.push(
        "This scheme is available in your state."
      );
    }
  }

  const ageMatches =
    Number(form.age) >= scheme.minimumAge;

  if (ageMatches) {
    score += 20;

    if (scheme.minimumAge > 0) {
      reasons.push(
        `You meet the minimum age requirement of ${scheme.minimumAge} years.`
      );
    } else {
      reasons.push(
        "No minimum age restriction was listed."
      );
    }
  }

  const businessTypeMatches =
    scheme.businessTypes.includes("ALL") ||
    scheme.businessTypes.includes(form.businessType);

  if (businessTypeMatches) {
    score += 25;
    reasons.push(
      "Your business type is supported."
    );
  }

  const genderIsMatch =
    genderMatches(form, scheme);

  if (genderIsMatch) {
    score += 15;

    if (scheme.targetGender) {
      reasons.push(
        "Your gender matches the listed target group."
      );
    } else {
      reasons.push(
        "No gender restriction was listed."
      );
    }
  }

  const categoryIsMatch =
    categoryMatches(form, scheme);

  if (categoryIsMatch) {
    score += 15;

    if (scheme.targetCommunity) {
      reasons.push(
        "Your social category matches the listed target group."
      );
    } else {
      reasons.push(
        "No social category restriction was listed."
      );
    }
  }

  return {
    matchScore: Math.min(score, 100),
    matchReasons: reasons
  };
}

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState("matcher");

  const [form, setForm] = useState({
    state: "",
    age: "",
    gender: "",
    socialCategory: "",
    businessType: ""
  });

  const [schemes, setSchemes] = useState([]);
  const [matches, setMatches] = useState([]);
  const [searched, setSearched] = useState(false);

  const [loadingSchemes, setLoadingSchemes] =
    useState(true);

  const [schemeError, setSchemeError] =
    useState("");

  const [saveMessage, setSaveMessage] =
    useState(null);

  const [explanations, setExplanations] =
    useState({});

  const [explanationLoading, setExplanationLoading] =
    useState({});

  const [explanationErrors, setExplanationErrors] =
    useState({});

  const [selectedLanguage, setSelectedLanguage] =
    useState("English");

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
          throw new Error(
            "Could not find schemes.csv"
          );
        }

        return response.text();
      })
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,

          complete: (result) => {
            const convertedSchemes = result.data
              .map((row, index) =>
                convertCsvRow(row, index)
              )
              .filter(
                (scheme) =>
                  scheme.name !== "Unnamed Scheme"
              );

            setSchemes(convertedSchemes);
            setLoadingSchemes(false);
          },

          error: (error) => {
            console.error(
              "CSV parsing error:",
              error
            );

            setSchemeError(
              "The scheme file could not be read."
            );

            setLoadingSchemes(false);
          }
        });
      })
      .catch((error) => {
        console.error(
          "Scheme loading error:",
          error
        );

        setSchemeError(
          "The scheme file could not be loaded. Check public/data/schemes.csv."
        );

        setLoadingSchemes(false);
      });
  }, []);

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSaveMessage(null);

    if (!user || !user.uid) {
      setSaveMessage({
        type: "error",
        text: "Please login before submitting your profile."
      });

      return;
    }

    const matchingSchemes = schemes
      .filter((scheme) =>
        schemeMatches(form, scheme)
      )
      .map((scheme) => ({
        ...scheme,
        ...getMatchDetails(form, scheme)
      }))
      .sort(
        (firstScheme, secondScheme) =>
          secondScheme.matchScore -
          firstScheme.matchScore
      );

    setMatches(matchingSchemes);
    setSearched(true);
    setExplanations({});
    setExplanationLoading({});
    setExplanationErrors({});

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email || "",

          profile: {
            state: form.state,
            age: form.age,
            gender: form.gender,
            socialCategory: form.socialCategory,
            businessType: form.businessType
          },

          updatedAt: serverTimestamp()
        },
        {
          merge: true
        }
      );

      setSaveMessage({
        type: "success",
        text: "Your profile has been saved successfully."
      });
    } catch (error) {
      console.error(
        "Firestore save error:",
        error
      );

      setSaveMessage({
        type: "error",
        text:
          "Profile could not be saved. Firebase error: " +
          error.code
      });
    }
  }

  async function handleExplainScheme(scheme) {
    const schemeId = scheme.id;

    setExplanationLoading((current) => ({
      ...current,
      [schemeId]: true
    }));

    setExplanationErrors((current) => ({
      ...current,
      [schemeId]: ""
    }));

    try {
      const response = await fetch(
        "http://localhost:5000/api/explain",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            scheme: scheme,
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
        [schemeId]: data.explanation
      }));
    } catch (error) {
      console.error(
        "Explain scheme error:",
        error
      );

      const readableError =
        error.message === "Failed to fetch"
          ? "Could not reach the explanation server. Make sure the backend is running on port 5000."
          : error.message ||
            "The explanation could not be generated. Please try again.";

      setExplanationErrors((current) => ({
        ...current,
        [schemeId]: readableError
      }));
    } finally {
      setExplanationLoading((current) => ({
        ...current,
        [schemeId]: false
      }));
    }
  }

  async function handleSaveScheme(scheme) {
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
          link: scheme.link,
          savedAt: serverTimestamp()
        }
      );

      setSaveMessage({
        type: "success",
        text: `${scheme.name} saved successfully.`
      });
    } catch (error) {
      console.error(
        "Save scheme error:",
        error
      );

      setSaveMessage({
        type: "error",
        text: "This scheme could not be saved."
      });
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      setUser(null);
      setView("matcher");
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    }
  }

  if (!authReady) {
    return (
      <div className="ss-boot">
        <div className="ss-boot-dot" />
        <h2>Checking login...</h2>
        <p>Preparing a trusted space to find schemes for you.</p>
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
    <div className="ss-page">
      <div className="ss-shell">
        <header className="ss-nav">
          <div className="ss-brand">
            <div className="ss-mark">S</div>
            <div>
              <h1>SchemeSaathi</h1>
              <p className="ss-user">
                Logged in as: {user.email}
              </p>
            </div>
          </div>

          <div className="ss-nav-actions">
            <button
              type="button"
              onClick={() => setView("saved")}
              className="ss-btn ss-btn--navy"
            >
              Saved Schemes
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="ss-btn ss-btn--ghost"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="ss-hero">
          <div>
            <span className="ss-kicker">
              Your scheme companion
            </span>
            <h2>
              Find the right government scheme for your business
            </h2>
            <p className="ss-hero-copy">
              Answer a few simple questions about your profile.
              We will match schemes that may support your work,
              show why they fit, and help you save the useful ones.
            </p>
            <a href="#scheme-profile" className="ss-btn ss-btn--primary">
              Find my schemes
            </a>
          </div>

          <aside className="ss-hero-aside">
            <h3>Clear, personal matches</h3>
            <p>
              See a match score, eligibility notes, documents,
              official links, and an AI explanation in your language.
            </p>
            <p className="ss-hero-stat">
              {loadingSchemes
                ? "Loading the scheme library..."
                : schemeError
                ? "Scheme library needs attention"
                : `${schemes.length} schemes ready to match`}
            </p>
          </aside>
        </section>

        {loadingSchemes && (
          <div className="ss-banner ss-banner--info">
            Loading schemes...
          </div>
        )}

        {schemeError && (
          <div className="ss-banner ss-banner--error">
            {schemeError}
          </div>
        )}

        {!loadingSchemes && !schemeError && (
          <div className="ss-banner ss-banner--success">
            {schemes.length} schemes loaded successfully.
          </div>
        )}

        {saveMessage && (
          <div
            className={
              saveMessage.type === "success"
                ? "ss-banner ss-banner--success"
                : "ss-banner ss-banner--error"
            }
          >
            {saveMessage.text}
          </div>
        )}

        <section id="scheme-profile" className="ss-section">
          <div className="ss-section-head">
            <h2>Tell us about you</h2>
            <p>
              Five short steps. We use this only to match schemes
              that fit your state, age, and business.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="ss-form">
            <div className="ss-field">
              <span className="ss-step">Step 1</span>
              <label htmlFor="state">
                Which state are you from?
              </label>
              <input
                id="state"
                type="text"
                name="state"
                value={form.state}
                onChange={handleChange}
                required
                placeholder="Example: Assam"
                className="ss-input"
              />
            </div>

            <div className="ss-field">
              <span className="ss-step">Step 2</span>
              <label htmlFor="age">
                What is your age?
              </label>
              <input
                id="age"
                type="number"
                name="age"
                value={form.age}
                onChange={handleChange}
                min="1"
                required
                placeholder="Enter your age"
                className="ss-input"
              />
            </div>

            <div className="ss-field">
              <span className="ss-step">Step 3</span>
              <label htmlFor="gender">
                What is your gender?
              </label>
              <select
                id="gender"
                name="gender"
                value={form.gender}
                onChange={handleChange}
                required
                className="ss-select"
              >
                <option value="">
                  Select gender
                </option>
                <option value="Woman">Woman</option>
                <option value="Man">Man</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="ss-field">
              <span className="ss-step">Step 4</span>
              <label htmlFor="socialCategory">
                What is your social category?
              </label>
              <select
                id="socialCategory"
                name="socialCategory"
                value={form.socialCategory}
                onChange={handleChange}
                required
                className="ss-select"
              >
                <option value="">
                  Select category
                </option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="OBC">OBC</option>
                <option value="General">General</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="ss-field">
              <span className="ss-step">Step 5</span>
              <label htmlFor="businessType">
                What type of business do you have?
              </label>
              <select
                id="businessType"
                name="businessType"
                value={form.businessType}
                onChange={handleChange}
                required
                className="ss-select"
              >
                <option value="">
                  Select business type
                </option>
                <option value="Manufacturing">
                  Manufacturing
                </option>
                <option value="Services">Services</option>
                <option value="Trading">Trading</option>
                <option value="Agriculture">
                  Agriculture
                </option>
                <option value="Technology">
                  Technology
                </option>
              </select>
            </div>

            <div className="ss-form-actions">
              <button
                type="submit"
                disabled={
                  loadingSchemes ||
                  schemes.length === 0
                }
                className="ss-btn ss-btn--primary"
              >
                Find my schemes
              </button>
            </div>
          </form>
        </section>

        {searched && (
          <section className="ss-section">
            <div className="ss-results-toolbar">
              <div className="ss-section-head">
                <h2>
                  Matching Schemes ({matches.length})
                </h2>
                <p>
                  Higher scores mean a closer fit to your profile.
                </p>
              </div>

              <div className="ss-field">
                <label htmlFor="explanation-language">
                  Explanation language
                </label>
                <select
                  id="explanation-language"
                  value={selectedLanguage}
                  onChange={(event) =>
                    setSelectedLanguage(event.target.value)
                  }
                  className="ss-select"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिन्दी)</option>
                  <option value="Bengali">Bengali (বাংলা)</option>
                  <option value="Marathi">Marathi (मराठी)</option>
                  <option value="Tamil">Tamil (தமிழ்)</option>
                  <option value="Assamese">Assamese (অসমীয়া)</option>
                </select>
              </div>
            </div>

            {matches.length === 0 ? (
              <div className="ss-empty">
                <h3>No matching scheme found</h3>
                <p>
                  No matching scheme found for this information.
                  Try another state spelling or business type.
                </p>
              </div>
            ) : (
              <div className="ss-scheme-list">
                {matches.map((scheme) => (
                  <article
                    key={scheme.id}
                    className="ss-scheme"
                  >
                    <div className="ss-scheme-top">
                      <h3>{scheme.name}</h3>
                      <div className="ss-score">
                        <span>Match score</span>
                        <strong>{scheme.matchScore}%</strong>
                      </div>
                    </div>

                    <div className="ss-why">
                      <h4>Why this matches</h4>
                      <ul>
                        {scheme.matchReasons.map(
                          (reason, index) => (
                            <li key={index}>
                              {reason}
                            </li>
                          )
                        )}
                      </ul>
                    </div>

                    <div className="ss-details">
                      <div className="ss-detail">
                        <h4>Benefit</h4>
                        <p>{scheme.benefit}</p>
                      </div>
                      <div className="ss-detail">
                        <h4>Eligibility</h4>
                        <p>{scheme.eligibility}</p>
                      </div>
                      <div className="ss-detail">
                        <h4>Documents</h4>
                        <p>{scheme.documents}</p>
                      </div>
                      <div className="ss-detail">
                        <h4>How to apply</h4>
                        <p>{scheme.howToApply}</p>
                      </div>
                    </div>

                    <div className="ss-scheme-actions">
                      {scheme.link !== "#" && (
                        <a
                          href={scheme.link}
                          target="_blank"
                          rel="noreferrer"
                          className="ss-btn ss-btn--ghost"
                        >
                          Visit Official Website
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          handleSaveScheme(scheme)
                        }
                        className="ss-btn ss-btn--gold"
                      >
                        Save This Scheme
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleExplainScheme(scheme)
                        }
                        disabled={
                          explanationLoading[scheme.id]
                        }
                        className="ss-btn ss-btn--primary"
                      >
                        Explain with AI
                      </button>
                    </div>

                    {explanationLoading[scheme.id] && (
                      <div className="ss-banner ss-banner--info">
                        Generating explanation...
                      </div>
                    )}

                    {explanationErrors[scheme.id] && (
                      <div className="ss-banner ss-banner--error">
                        {explanationErrors[scheme.id]}
                      </div>
                    )}

                    {explanations[scheme.id] && (
                      <div className="ss-explain">
                        <h4>
                          AI explanation ({selectedLanguage})
                        </h4>
                        <p>
                          {explanations[scheme.id]}
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
