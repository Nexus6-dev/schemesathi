import {
    useEffect,
    useMemo,
    useState
  } from "react";
  import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc
  } from "firebase/firestore";
  import { db } from "./firebase";
  
  function getSafeSchemeId(schemeId) {
    return String(schemeId).replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    );
  }
  
  function ApplicationChecklist({ scheme, user }) {
    const documents = useMemo(() => {
      return String(scheme.documents || "")
        .split(";")
        .map((document) => document.trim())
        .filter(Boolean);
    }, [scheme.documents]);
  
    const [completed, setCompleted] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
  
    useEffect(() => {
      let active = true;
  
      async function loadChecklist() {
        if (!user || !user.uid) {
          setLoading(false);
          return;
        }
  
        try {
          const safeSchemeId = getSafeSchemeId(
            scheme.id
          );
  
          const checklistRef = doc(
            db,
            "users",
            user.uid,
            "applicationChecklists",
            safeSchemeId
          );
  
          const snapshot = await getDoc(checklistRef);
  
          if (active && snapshot.exists()) {
            const data = snapshot.data();
  
            setCompleted(
              data.completedItems || {}
            );
          }
        } catch (loadError) {
          console.error(
            "Checklist loading error:",
            loadError
          );
  
          if (active) {
            setError(
              "Your saved checklist could not be loaded."
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }
  
      loadChecklist();
  
      return () => {
        active = false;
      };
    }, [scheme.id, user]);
  
    async function toggleDocument(index) {
      const nextCompleted = {
        ...completed,
        [index]: !completed[index]
      };
  
      setCompleted(nextCompleted);
      setSaving(true);
      setError("");
  
      try {
        const safeSchemeId = getSafeSchemeId(
          scheme.id
        );
  
        await setDoc(
          doc(
            db,
            "users",
            user.uid,
            "applicationChecklists",
            safeSchemeId
          ),
          {
            schemeId: scheme.id,
            schemeName: scheme.name,
            completedItems: nextCompleted,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      } catch (saveError) {
        console.error(
          "Checklist saving error:",
          saveError
        );
  
        setError(
          "The checklist change could not be saved."
        );
      } finally {
        setSaving(false);
      }
    }
  
    const completedCount = documents.filter(
      (_, index) => completed[index]
    ).length;
  
    if (documents.length === 0) {
      return (
        <div className="ss-checklist">
          <h4>Application checklist</h4>
          <p>
            Document information is not available for
            this scheme yet.
          </p>
        </div>
      );
    }
  
    return (
      <div className="ss-checklist">
        <div className="ss-checklist-header">
          <div>
            <h4>Application checklist</h4>
            <p>
              Mark each document when you have it ready.
            </p>
          </div>
  
          <strong>
            {completedCount}/{documents.length}
          </strong>
        </div>
  
        <div className="ss-checklist-progress">
          <span
            style={{
              width:
                (completedCount / documents.length) * 100 +
                "%"
            }}
          />
        </div>
  
        {loading && (
          <p className="ss-checklist-status">
            Loading your saved checklist...
          </p>
        )}
  
        {saving && (
          <p className="ss-checklist-status">
            Saving...
          </p>
        )}
  
        {error && (
          <p className="ss-checklist-error">
            {error}
          </p>
        )}
  
        <div className="ss-checklist-items">
          {documents.map((document, index) => (
            <label
              className={
                "ss-checklist-item " +
                (completed[index] ? "completed" : "")
              }
              key={index}
            >
              <input
                type="checkbox"
                checked={Boolean(completed[index])}
                onChange={() =>
                  toggleDocument(index)
                }
                disabled={loading || saving}
              />
  
              <span>{document}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
  
  export default ApplicationChecklist;