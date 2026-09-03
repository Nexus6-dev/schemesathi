import { useEffect, useState } from "react";
import Papa from "papaparse";

function parseMinimumAge(value) {
  const text = String(value || "");
  const number = text.match(/\d+/);

  return number ? Number(number[0]) : 0;
}

function getStates(value) {
  const text = String(value || "").toLowerCase();

  if (
    text.includes("india") ||
    text.includes("all") ||
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
    text.includes("any") ||
    text.includes("all") ||
    text.includes("all type")
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
    name: row["Scheme Name"] || "Unnamed Scheme",
    minimumAge: parseMinimumAge(row["Minimum Age"]),
    states: getStates(row["Target Location"]),
    businessTypes: getBusinessTypes(
      row["Business Type / Industry"]
    ),
    targetGender: String(row["Target Gender"] || "").toLowerCase(),
    targetCommunity: String(
      row["Target Community / Category"] || ""
    ).toLowerCase(),
    benefit: row["Financial Benefit"] || "Benefit information unavailable",
    eligibility:
      row["Plain-Text Eligibility Summary"] ||
      "Eligibility information unavailable",
    documents:
      row["Documents Required"] ||
      "Document information unavailable",
    howToApply:
      row["How to Apply"] ||
      "Application information unavailable",
    link: row["Official Link"] || "#"
  };
}

function genderMatches(form, scheme) {
  const text = scheme.targetGender;

  if (!text || text.includes("any") || text.includes("all")) {
    return true;
  }

  if (
    form.gender === "Woman" &&
    (text.includes("woman") ||
      text.includes("women") ||
      text.includes("female"))
  ) {
    return true;
  }

  if (
    form.gender === "Man" &&
    (text.includes("man") ||
      text.includes("men") ||
      text.includes("male"))
  ) {
    return true;
  }

  return false;
}

function categoryMatches(form, scheme) {
  const text = scheme.targetCommunity;

  if (!text || text.includes("any") || text.includes("all")) {
    return true;
  }

  if (
    form.socialCategory === "SC" &&
    (text.includes("sc") || text.includes("scheduled caste"))
  ) {
    return true;
  }

  if (
    form.socialCategory === "ST" &&
    (text.includes("st") || text.includes("scheduled tribe"))
  ) {
    return true;
  }

  if (
    form.socialCategory === "OBC" &&
    (text.includes("obc") || text.includes("backward"))
  ) {
    return true;
  }

  if (
    form.socialCategory === "General" &&
    text.includes("general")
  ) {
    return true;
  }

  if (
    form.gender === "Woman" &&
    (text.includes("woman") || text.includes("women"))
  ) {
    return true;
  }

  return false;
}

function schemeMatches(form, scheme) {
  const selectedState = form.state.toLowerCase();

  const stateMatches =
    scheme.states.includes("ALL") ||
    scheme.states.includes(selectedState);

  const ageMatches =
    Number(form.age) >= scheme.minimumAge;

  const businessTypeMatches =
    scheme.businessTypes.includes("ALL") ||
    scheme.businessTypes.includes(form.businessType);

  const genderIsRelevant = scheme.targetGender.length > 0;
  const communityIsRelevant = scheme.targetCommunity.length > 0;

  const genderIsMatch =
    !genderIsRelevant || genderMatches(form, scheme);

  const categoryIsMatch =
    !communityIsRelevant || categoryMatches(form, scheme);

  return (
    stateMatches &&
    ageMatches &&
    businessTypeMatches &&
    genderIsMatch &&
    categoryIsMatch
  );
}

function App() {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
            const convertedSchemes = result.data
              .map((row, index) => convertCsvRow(row, index))
              .filter((scheme) => scheme.name !== "Unnamed Scheme");

            setSchemes(convertedSchemes);
            setLoading(false);
          }
        });
      })
      .catch((error) => {
        console.error(error);
        setError(
          "The scheme file could not be loaded. Check public/data/schemes.csv."
        );
        setLoading(false);
      });
  }, []);

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value
    });
  }

  function handleSubmit(event) {
    event.preventDefault();

    const matchingSchemes = schemes.filter((scheme) =>
      schemeMatches(form, scheme)
    );

    setMatches(matchingSchemes);
    setSearched(true);
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ color: "#173b67" }}>
          SchemeSaathi
        </h1>

        <p style={{ color: "#555", fontSize: "18px" }}>
          Find government schemes that may support your business.
        </p>

        {loading && <p>Loading schemes...</p>}

        {error && (
          <p style={{ color: "red" }}>
            {error}
          </p>
        )}

        {!loading && !error && (
          <p style={{ color: "#216e39" }}>
            {schemes.length} schemes loaded successfully.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label>
            <strong>Which state are you from?</strong>
          </label>

          <select
            name="state"
            value={form.state}
            onChange={handleChange}
            required
            style={selectStyle}
          >
            <option value="">Select your state</option>
            <option value="Assam">Assam</option>
            <option value="Bihar">Bihar</option>
            <option value="Maharashtra">Maharashtra</option>
            <option value="Uttar Pradesh">Uttar Pradesh</option>
            <option value="West Bengal">West Bengal</option>
          </select>

          <label>
            <strong>What is your age?</strong>
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
            <strong>What is your gender?</strong>
          </label>

          <select
            name="gender"
            value={form.gender}
            onChange={handleChange}
            required
            style={selectStyle}
          >
            <option value="">Select gender</option>
            <option value="Woman">Woman</option>
            <option value="Man">Man</option>
            <option value="Other">Other</option>
          </select>

          <label>
            <strong>What is your social category?</strong>
          </label>

          <select
            name="socialCategory"
            value={form.socialCategory}
            onChange={handleChange}
            required
            style={selectStyle}
          >
            <option value="">Select category</option>
            <option value="SC">SC</option>
            <option value="ST">ST</option>
            <option value="OBC">OBC</option>
            <option value="General">General</option>
            <option value="Other">Other</option>
          </select>

          <label>
            <strong>What type of business do you have?</strong>
          </label>

          <select
            name="businessType"
            value={form.businessType}
            onChange={handleChange}
            required
            style={selectStyle}
          >
            <option value="">Select business type</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="Services">Services</option>
            <option value="Trading">Trading</option>
            <option value="Agriculture">Agriculture</option>
            <option value="Technology">Technology</option>
          </select>

          <button
            type="submit"
            disabled={loading || schemes.length === 0}
            style={buttonStyle}
          >
            Find Matching Schemes
          </button>
        </form>

        {searched && (
          <div style={{ marginTop: "30px" }}>
            <h2>Matching Schemes</h2>

            {matches.length === 0 ? (
              <p>
                No matching scheme found for this information.
              </p>
            ) : (
              matches.map((scheme) => (
                <div key={scheme.id} style={schemeStyle}>
                  <h3 style={{ color: "#173b67" }}>
                    {scheme.name}
                  </h3>

                  <p>
                    <strong>Benefit:</strong> {scheme.benefit}
                  </p>

                  <p>
                    <strong>Eligibility summary:</strong>{" "}
                    {scheme.eligibility}
                  </p>

                  <p>
                    <strong>Documents:</strong>{" "}
                    {scheme.documents}
                  </p>

                  <a
                    href={scheme.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit Official Website
                  </a>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  backgroundColor: "#f4f7fb",
  padding: "40px 20px",
  fontFamily: "Arial, sans-serif"
};

const cardStyle = {
  maxWidth: "700px",
  margin: "0 auto",
  backgroundColor: "white",
  padding: "32px",
  borderRadius: "16px",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)"
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

const schemeStyle = {
  border: "1px solid #b8d8f0",
  borderRadius: "10px",
  padding: "18px",
  marginTop: "15px",
  backgroundColor: "#eef7ff"
};

export default App;