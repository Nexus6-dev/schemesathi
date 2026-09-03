import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { auth } from "./firebase";

function Auth({ onLogin }) {
  const [isSignup, setIsSignup] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      let result;

      if (isSignup) {
        result = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
      } else {
        result = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
      }

      onLogin(result.user);
    } catch (error) {
        console.error("Firebase error code:", error.code);
console.error("Firebase error message:", error.message);

      if (error.code === "auth/email-already-in-use") {
        setError("This email is already registered. Try logging in.");
      } else if (error.code === "auth/invalid-credential") {
        setError("Incorrect email or password.");
      } else if (error.code === "auth/weak-password") {
        setError("Password must contain at least 6 characters.");
      } else if (error.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f4f7fb",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "white",
          padding: "32px",
          borderRadius: "16px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)"
        }}
      >
        <h1 style={{ color: "#173b67" }}>
          SchemeSaathi
        </h1>

        <h2>
          {isSignup ? "Create your account" : "Login"}
        </h2>

        <p style={{ color: "#555" }}>
          {isSignup
            ? "Create an account to find and save useful schemes."
            : "Login to continue finding schemes."}
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            <strong>Email address</strong>
          </label>

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="Enter your email"
            style={inputStyle}
          />

          <label>
            <strong>Password</strong>
          </label>

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength="6"
            placeholder="At least 6 characters"
            style={inputStyle}
          />

          <button type="submit" style={buttonStyle}>
            {isSignup ? "Create Account" : "Login"}
          </button>
        </form>

        {error && (
          <p style={{ color: "#c62828", marginTop: "16px" }}>
            {error}
          </p>
        )}

        <button
          onClick={() => {
            setIsSignup(!isSignup);
            setError("");
          }}
          style={switchButtonStyle}
        >
          {isSignup
            ? "Already have an account? Login"
            : "New user? Create an account"}
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  display: "block",
  width: "100%",
  padding: "12px",
  marginTop: "8px",
  marginBottom: "20px",
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

const switchButtonStyle = {
  marginTop: "20px",
  backgroundColor: "transparent",
  color: "#1769aa",
  border: "none",
  cursor: "pointer",
  fontSize: "14px"
};

export default Auth;
