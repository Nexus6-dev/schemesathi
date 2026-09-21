import {
    useEffect,
    useRef,
    useState
  } from "react";
  
  const speechLanguages = {
    English: "en-IN",
    Hindi: "hi-IN",
    Bengali: "bn-IN",
    Marathi: "mr-IN",
    Tamil: "ta-IN",
    Assamese: "as-IN",
    Gujarati: "gu-IN",
    Telugu: "te-IN",
    Kannada: "kn-IN",
    Malayalam: "ml-IN",
    Punjabi: "pa-IN",
    Urdu: "ur-IN",
    Odia: "or-IN"
  };
  
  function cleanTextForSpeech(value) {
    let text = String(value || "");
  
    // Remove code blocks
    text = text.replace(/```[\s\S]*?```/g, " ");
  
    // Keep only the visible text from Markdown links
    text = text.replace(
      /\[([^\]]+)\]\([^)]+\)/g,
      "$1"
    );
  
    // Remove URLs
    text = text.replace(
      /https?:\/\/\S+/gi,
      " "
    );
  
    // Remove HTML
    text = text.replace(/<[^>]*>/g, " ");
  
    // Remove Markdown headings and list markers
    text = text.replace(
      /^\s*#{1,6}\s*/gm,
      ""
    );
  
    text = text.replace(
      /^\s*[-*+•●▪]\s*/gm,
      ""
    );
  
    // Convert symbols into words before removing symbols
    text = text.replace(
      /₹\s*([\d,]+)/g,
      "$1 rupees"
    );
  
    text = text.replace(
      /(\d+)\s*%/g,
      "$1 percent"
    );
  
    text = text.replace(/&/g, " and ");
  
    // Convert separators into pauses
    text = text.replace(/[:;]/g, ". ");
  
    // Strict allowlist:
    // keeps letters from Indian languages, numbers,
    // spaces, and natural sentence punctuation only
    text = text.replace(
      /[^\p{L}\p{N}\s.,!?]/gu,
      " "
    );
  
    return text
      .replace(/\s+/g, " ")
      .trim();
  }
  
  function splitIntoChunks(text, maxLength = 220) {
    const sentences =
      text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ||
      [text];
  
    const chunks = [];
    let current = "";
  
    for (const sentence of sentences) {
      const cleanSentence = sentence.trim();
  
      if (!cleanSentence) {
        continue;
      }
  
      const combined = current
        ? `${current} ${cleanSentence}`
        : cleanSentence;
  
      if (combined.length <= maxLength) {
        current = combined;
      } else {
        if (current) {
          chunks.push(current);
        }
  
        current = cleanSentence;
      }
    }
  
    if (current) {
      chunks.push(current);
    }
  
    return chunks;
  }
  
  function chooseVoice(voices, language) {
    const targetLanguage =
      speechLanguages[language] || "en-IN";
  
    const languagePrefix =
      targetLanguage.split("-")[0];
  
    const naturalVoicePattern =
      /natural|neural|enhanced|premium|google|microsoft|siri/i;
  
    const exactLanguageVoices = voices.filter(
      (voice) =>
        voice.lang.toLowerCase() ===
        targetLanguage.toLowerCase()
    );
  
    const sameLanguageVoices = voices.filter(
      (voice) =>
        voice.lang
          .toLowerCase()
          .startsWith(languagePrefix)
    );
  
    return (
      exactLanguageVoices.find((voice) =>
        naturalVoicePattern.test(voice.name)
      ) ||
      exactLanguageVoices[0] ||
      sameLanguageVoices.find((voice) =>
        naturalVoicePattern.test(voice.name)
      ) ||
      sameLanguageVoices[0] ||
      null
    );
  }
  
  function SpeakButton({
    text,
    language = "English"
  }) {
    const [voices, setVoices] = useState([]);
    const [speaking, setSpeaking] = useState(false);
  
    const sessionRef = useRef(0);
  
    useEffect(() => {
      if (!("speechSynthesis" in window)) {
        return undefined;
      }
  
      function loadVoices() {
        const availableVoices =
          window.speechSynthesis.getVoices();
  
        setVoices(availableVoices);
      }
  
      loadVoices();
  
      window.speechSynthesis.addEventListener(
        "voiceschanged",
        loadVoices
      );
  
      return () => {
        window.speechSynthesis.removeEventListener(
          "voiceschanged",
          loadVoices
        );
      };
    }, []);
  
    function stopSpeaking() {
      sessionRef.current += 1;
  
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  
    function speakNext(
      chunks,
      index,
      voice,
      sessionId,
      languageCode
    ) {
      if (
        sessionId !== sessionRef.current ||
        index >= chunks.length
      ) {
        setSpeaking(false);
        return;
      }
  
      const utterance =
        new SpeechSynthesisUtterance(
          chunks[index]
        );
  
      utterance.voice = voice;
      utterance.lang = languageCode;
  
      // Slightly slower and more natural
      utterance.rate = 0.9;
      utterance.pitch = 1.02;
      utterance.volume = 1;
  
      utterance.onend = () => {
        window.setTimeout(() => {
          speakNext(
            chunks,
            index + 1,
            voice,
            sessionId,
            languageCode
          );
        }, 150);
      };
  
      utterance.onerror = () => {
        setSpeaking(false);
      };
  
      window.speechSynthesis.speak(utterance);
    }
  
    function handleSpeak() {
      if (
        !("speechSynthesis" in window)
      ) {
        window.alert(
          "Speech is not supported in this browser."
        );
        return;
      }
  
      if (speaking) {
        stopSpeaking();
        return;
      }
  
      const spokenText =
        cleanTextForSpeech(text);
  
      if (!spokenText) {
        return;
      }
  
      const currentVoices =
        voices.length > 0
          ? voices
          : window.speechSynthesis.getVoices();
  
      const voice = chooseVoice(
        currentVoices,
        language
      );
  
      if (!voice) {
        window.alert(
          `No ${language} voice is installed. Install the ${language} speech pack in your computer's language settings.`
        );
        return;
      }
  
      const chunks =
        splitIntoChunks(spokenText);
  
      const languageCode =
        speechLanguages[language] || "en-IN";
  
      window.speechSynthesis.cancel();
  
      const newSession =
        sessionRef.current + 1;
  
      sessionRef.current = newSession;
      setSpeaking(true);
  
      speakNext(
        chunks,
        0,
        voice,
        newSession,
        languageCode
      );
    }
  
    return (
      <button
        type="button"
        className="ss-speak-button"
        onClick={handleSpeak}
        aria-pressed={speaking}
      >
        {speaking
          ? "Stop speaking"
          : "🔊 Listen"}
      </button>
    );
  }
  
  export default SpeakButton;