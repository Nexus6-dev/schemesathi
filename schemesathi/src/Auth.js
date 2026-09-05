import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

function Auth({ onLogin }) {
  const [isSignup, setIsSignup] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function handleSubmit(event) {
    event.preventDefault(); setError("");
    try { const result = isSignup ? await createUserWithEmailAndPassword(auth, email, password) : await signInWithEmailAndPassword(auth, email, password); onLogin(result.user); }
    catch (error) { if (error.code === "auth/email-already-in-use") setError("This email is already registered. Try logging in."); else if (error.code === "auth/invalid-credential") setError("Incorrect email or password."); else if (error.code === "auth/weak-password") setError("Password must contain at least 6 characters."); else if (error.code === "auth/invalid-email") setError("Please enter a valid email address."); else setError("Something went wrong. Please try again."); }
  }
  return <main className="ss-auth-page"><div className="ss-auth-card"><span className="ss-eyebrow"><span className="ss-eyebrow-dot" /> A private corner</span><div className="ss-auth-brand"><span className="ss-mark">S</span><span><strong>SchemeSathi</strong><small>Your next step, made clearer</small></span></div><h1>{isSignup ? "A clearer start is waiting." : "Welcome back."}</h1><p className="ss-auth-copy">{isSignup ? "Create an account to find and save support made for your work." : "Sign in to continue finding useful schemes."}</p><form className="ss-auth-form" onSubmit={handleSubmit}><label className="ss-auth-label">Email address<input className="ss-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" data-testid="input-email" /></label><label className="ss-auth-label">Password<input className="ss-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength="6" placeholder="At least 6 characters" data-testid="input-password" /></label>{error && <div className="ss-alert error" data-testid="status-auth-error"><span>!</span>{error}</div>}<button type="submit" className="ss-pill-button primary" data-testid="button-auth-submit">{isSignup ? "Create account →" : "Log in →"}</button></form><button className="ss-auth-switch" type="button" onClick={() => { setIsSignup(!isSignup); setError(""); }} data-testid="button-auth-switch">{isSignup ? "Already have an account? Log in" : "New here? Create an account"}</button></div></main>;
}
export default Auth;
