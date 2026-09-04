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
            language: "English"
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
      <div style={centerStyle}>
        <h2>Checking login...</h2>
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
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ color: "#173b67" }}>
              SchemeSaathi
            </h1>

            <p style={{ color: "#555" }}>
              Find government schemes that may support your business.
            </p>
          </div>

          <div style={headerButtonsStyle}>
            <button
              type="button"
              onClick={() => setView("saved")}
              style={savedButtonStyle}
            >
              Saved Schemes
            </button>

            <button
              type="button"
              onClick={handleLogout}
              style={logoutButtonStyle}
            >
              Logout
            </button>
          </div>
        </div>

        <p style={{ color: "#555" }}>
          Logged in as: {user.email}
        </p>

        {loadingSchemes && (
          <p>Loading schemes...</p>
        )}

        {schemeError && (
          <p style={{ color: "#c62828" }}>
            {schemeError}
          </p>
        )}

        {!loadingSchemes && !schemeError && (
          <p style={{ color: "#216e39" }}>
            {schemes.length} schemes loaded successfully.
          </p>
        )}

        {saveMessage && (
          <div
            style={{
              padding: "12px",
              marginBottom: "20px",
              borderRadius: "8px",
              backgroundColor:
                saveMessage.type === "success"
                  ? "#e8f5e9"
                  : "#ffebee",
              color:
                saveMessage.type === "success"
                  ? "#216e39"
                  : "#c62828"
            }}
          >
            {saveMessage.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label>
            <strong>
              Which state are you from?
            </strong>
          </label>

          <input
            type="text"
            name="state"
            value={form.state}
            onChange={handleChange}
            required
            placeholder="Example: Assam"
            style={inputStyle}
          />

          <label>
            <strong>
              What is your age?
            </strong>
          </label>

          <input
            type="number"
            name="age"
            value={form.age}
            onChange={handleChange}
            min="1"
            required
            placeholder="Enter your age"
            style={inputStyle}
          />

          <label>
            <strong>
              What is your gender?
            </strong>
          </label>

          <select
            name="gender"
            value={form.gender}
            onChange={handleChange}
            required
            style={selectStyle}
          >
            <option value="">
              Select gender
            </option>

            <option value="Woman">
              Woman
            </option>

            <option value="Man">
              Man
            </option>

            <option value="Other">
              Other
            </option>
          </select>

          <label>
            <strong>
              What is your social category?
            </strong>
          </label>

          <select
            name="socialCategory"
            value={form.socialCategory}
            onChange={handleChange}
            required
            style={selectStyle}
          >
            <option value="">
              Select category
            </option>

            <option value="SC">
              SC
            </option>

            <option value="ST">
              ST
            </option>

            <option value="OBC">
              OBC
            </option>

            <option value="General">
              General
            </option>

            <option value="Other">
              Other
            </option>
          </select>

          <label>
            <strong>
              What type of business do you have?
            </strong>
          </label>

          <select
            name="businessType"
            value={form.businessType}
            onChange={handleChange}
            required
            style={selectStyle}
          >
            <option value="">
              Select business type
            </option>

            <option value="Manufacturing">
              Manufacturing
            </option>

            <option value="Services">
              Services
            </option>

            <option value="Trading">
              Trading
            </option>

            <option value="Agriculture">
              Agriculture
            </option>

            <option value="Technology">
              Technology
            </option>
          </select>

          <button
            type="submit"
            disabled={
              loadingSchemes ||
              schemes.length === 0
            }
            style={buttonStyle}
          >
            Find Matching Schemes
          </button>
        </form>

        {searched && (
          <div style={{ marginTop: "30px" }}>
            <h2>
              Matching Schemes ({matches.length})
            </h2>

            {matches.length === 0 ? (
              <p>
                No matching scheme found for this information.
              </p>
            ) : (
              matches.map((scheme) => (
                <div
                  key={scheme.id}
                  style={schemeStyle}
                >
                  <h3 style={{ color: "#173b67" }}>
                    {scheme.name}
                  </h3>

                  <p
                    style={{
                      display: "inline-block",
                      padding: "8px 12px",
                      borderRadius: "20px",
                      backgroundColor: "#dff5e3",
                      color: "#216e39",
                      fontWeight: "bold"
                    }}
                  >
                    Match score: {scheme.matchScore}%
                  </p>

                  <h4>
                    Why this matches
                  </h4>

                  <ul>
                    {scheme.matchReasons.map(
                      (reason, index) => (
                        <li key={index}>
                          {reason}
                        </li>
                      )
                    )}
                  </ul>

                  <p>
                    <strong>
                      Benefit:
                    </strong>{" "}
                    {scheme.benefit}
                  </p>

                  <p>
                    <strong>
                      Eligibility:
                    </strong>{" "}
                    {scheme.eligibility}
                  </p>

                  <p>
                    <strong>
                      Documents:
                    </strong>{" "}
                    {scheme.documents}
                  </p>

                  <p>
                    <strong>
                      How to apply:
                    </strong>{" "}
                    {scheme.howToApply}
                  </p>

                  {scheme.link !== "#" && (
                    <a
                      href={scheme.link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Visit Official Website
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      handleSaveScheme(scheme)
                    }
                    style={saveSchemeButtonStyle}
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
                    style={explainButtonStyle}
                  >
                    Explain with AI
                  </button>

                  {explanationLoading[scheme.id] && (
                    <p style={{ color: "#555" }}>
                      Generating explanation...
                    </p>
                  )}

                  {explanationErrors[scheme.id] && (
                    <p style={{ color: "#c62828" }}>
                      {explanationErrors[scheme.id]}
                    </p>
                  )}

                  {explanations[scheme.id] && (
                    <div style={explanationBoxStyle}>
                      <h4>
                        AI explanation
                      </h4>
                      <p
                        style={{
                          whiteSpace: "pre-wrap"
                        }}
                      >
                        {explanations[scheme.id]}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const centerStyle = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontFamily: "Arial, sans-serif"
};

const pageStyle = {
  minHeight: "100vh",
  backgroundColor: "#f4f7fb",
  padding: "40px 20px",
  fontFamily: "Arial, sans-serif"
};

const cardStyle = {
  maxWidth: "750px",
  margin: "0 auto",
  backgroundColor: "white",
  padding: "32px",
  borderRadius: "16px",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)"
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px"
};

const headerButtonsStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap"
};

const selectStyle = {
  display: "block",
  width: "100%",
  padding: "12px",
  marginTop: "8px",
  marginBottom: "24px",
  borderRadius: "8px",
  border: "1px solid #bbb",
  fontSize: "16px",
  boxSizing: "border-box"
};

const inputStyle = {
  display: "block",
  width: "100%",
  padding: "12px",
  marginTop: "8px",
  marginBottom: "24px",
  borderRadius: "8px",
  border: "1px solid #bbb",
  fontSize: "16px",
  boxSizing: "border-box"
};

const buttonStyle = {
  width: "100%",
  padding: "14px",
  backgroundColor: "#1769aa",
  color: "white",
  border: "none",
  borderRadius: "8px",
  fontSize: "17px",
  cursor: "pointer"
};

const savedButtonStyle = {
  padding: "10px 14px",
  backgroundColor: "#1769aa",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

const logoutButtonStyle = {
  padding: "10px 14px",
  backgroundColor: "#eeeeee",
  color: "#333",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

const saveSchemeButtonStyle = {
  display: "block",
  marginTop: "15px",
  padding: "10px 16px",
  backgroundColor: "#f59e0b",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

const explainButtonStyle = {
  display: "block",
  marginTop: "10px",
  padding: "10px 16px",
  backgroundColor: "#1769aa",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

const explanationBoxStyle = {
  marginTop: "15px",
  padding: "14px",
  borderRadius: "8px",
  backgroundColor: "#ffffff",
  border: "1px solid #c5d9ec"
};

const schemeStyle = {
  border: "1px solid #b8d8f0",
  borderRadius: "10px",
  padding: "18px",
  marginTop: "15px",
  backgroundColor: "#eef7ff"
};

export default App;
