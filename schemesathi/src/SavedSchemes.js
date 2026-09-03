import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs
} from "firebase/firestore";
import { db } from "./firebase";

function SavedSchemes({ user, onBack }) {
  const [savedSchemes, setSavedSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSavedSchemes() {
      try {
        const savedCollection = collection(
          db,
          "users",
          user.uid,
          "savedSchemes"
        );

        const snapshot = await getDocs(
          savedCollection
        );

        const schemes = snapshot.docs.map(
          (savedDocument) => ({
            id: savedDocument.id,
            ...savedDocument.data()
          })
        );

        setSavedSchemes(schemes);
        setLoading(false);
      } catch (error) {
        console.error(
          "Load saved schemes error:",
          error
        );

        setError(
          "Saved schemes could not be loaded."
        );

        setLoading(false);
      }
    }

    loadSavedSchemes();
  }, [user.uid]);

  async function removeScheme(schemeId) {
    try {
      await deleteDoc(
        doc(
          db,
          "users",
          user.uid,
          "savedSchemes",
          schemeId
        )
      );

      setSavedSchemes((currentSchemes) =>
        currentSchemes.filter(
          (scheme) => scheme.id !== schemeId
        )
      );
    } catch (error) {
      console.error(
        "Delete saved scheme error:",
        error
      );

      setError(
        "The scheme could not be removed."
      );
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <button
          type="button"
          onClick={onBack}
          style={backButtonStyle}
        >
          ← Back to Scheme Matching
        </button>

        <h1 style={{ color: "#173b67" }}>
          My Saved Schemes
        </h1>

        <p style={{ color: "#555" }}>
          Schemes saved by: {user.email}
        </p>

        {loading && (
          <p>Loading saved schemes...</p>
        )}

        {error && (
          <p style={{ color: "#c62828" }}>
            {error}
          </p>
        )}

        {!loading &&
          !error &&
          savedSchemes.length === 0 && (
            <div style={emptyStyle}>
              <h3>No saved schemes yet</h3>

              <p>
                Search for schemes and click
                “Save This Scheme”.
              </p>
            </div>
          )}

        {!loading &&
          savedSchemes.map((scheme) => (
            <div
              key={scheme.id}
              style={schemeStyle}
            >
              <h2 style={{ color: "#173b67" }}>
                {scheme.name}
              </h2>

              <p>
                <strong>Benefit:</strong>{" "}
                {scheme.benefit}
              </p>

              {scheme.link &&
                scheme.link !== "#" && (
                  <a
                    href={scheme.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit Official Website
                  </a>
                )}

              <br />

              <button
                type="button"
                onClick={() =>
                  removeScheme(scheme.id)
                }
                style={removeButtonStyle}
              >
                Remove from Saved Schemes
              </button>
            </div>
          ))}
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
  maxWidth: "750px",
  margin: "0 auto",
  backgroundColor: "white",
  padding: "32px",
  borderRadius: "16px",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)"
};

const schemeStyle = {
  border: "1px solid #b8d8f0",
  borderRadius: "10px",
  padding: "18px",
  marginTop: "18px",
  backgroundColor: "#eef7ff"
};

const emptyStyle = {
  marginTop: "25px",
  padding: "20px",
  borderRadius: "10px",
  backgroundColor: "#f5f5f5",
  textAlign: "center"
};

const backButtonStyle = {
  padding: "10px 14px",
  backgroundColor: "#eeeeee",
  color: "#333",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

const removeButtonStyle = {
  marginTop: "15px",
  padding: "10px 14px",
  backgroundColor: "#c62828",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

export default SavedSchemes;