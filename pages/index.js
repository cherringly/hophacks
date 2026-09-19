import { useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);

  const [status, setStatus] = useState("Starting camera...");
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [manualText, setManualText] = useState("");

  // Start camera on load
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStatus("Ready. Hold the button and ask your question.");
        }
      } catch (err) {
        console.error(err);
        setStatus(
          "Camera access failed. Check permissions and reload (HTTPS required)."
        );
      }
    }
    startCamera();
  }, []);

  // Set up speech recognition once
  useEffect(() => {
    const SR =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setSpeechSupported(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      captureAndAsk(text);
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setStatus(`Mic error: ${event.error}. Try again.`);
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  function startListening() {
    if (!recognitionRef.current) return;
    setAnswer("");
    setTranscript("");
    setStatus("Listening...");
    setListening(true);
    try {
      recognitionRef.current.start();
    } catch (e) {
      // start() throws if already started; ignore
    }
  }

  function stopListening() {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
  }

  function capturePhotoBase64() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    return dataUrl.split(",")[1]; // strip the data:image/jpeg;base64, prefix
  }

  async function captureAndAsk(question) {
    const imageBase64 = capturePhotoBase64();
    if (!imageBase64) {
      setStatus("Could not capture photo. Try again.");
      return;
    }

    setStatus("Thinking...");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, imageBase64 }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus(data.error || "Something went wrong.");
        speak("Sorry, something went wrong.");
        return;
      }

      setAnswer(data.answer);
      setStatus("Ready. Hold the button and ask your question.");

      if (data.audioBase64) {
        playAudio(data.audioBase64);
      } else {
        speak(data.answer);
      }
    } catch (err) {
      console.error(err);
      setStatus("Network error reaching the server.");
      speak("Sorry, I could not reach the server.");
    }
  }

  function playAudio(base64) {
    try {
      const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
      audio.play().catch((err) => {
        console.error("Audio playback failed, falling back to TTS:", err);
        speak(answer);
      });
    } catch (err) {
      console.error("Could not play ElevenLabs audio:", err);
      speak(answer);
    }
  }

  function speak(text) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (!manualText.trim()) return;
    setTranscript(manualText);
    captureAndAsk(manualText);
  }

  return (
    <div style={styles.page}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={styles.video}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div style={styles.overlay}>
        <p style={styles.status}>{status}</p>

        {transcript && <p style={styles.transcript}>You asked: "{transcript}"</p>}
        {answer && <p style={styles.answer}>{answer}</p>}

        {speechSupported ? (
          <button
            style={{
              ...styles.talkButton,
              backgroundColor: listening ? "#e74c3c" : "#2ecc71",
            }}
            onMouseDown={startListening}
            onMouseUp={stopListening}
            onTouchStart={(e) => {
              e.preventDefault();
              startListening();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              stopListening();
            }}
          >
            {listening ? "Listening... release to send" : "Hold to Ask"}
          </button>
        ) : (
          <form onSubmit={handleManualSubmit} style={styles.form}>
            <p style={styles.fallbackNote}>
              Voice input isn't supported in this browser (try Chrome). Type
              your question instead:
            </p>
            <input
              style={styles.input}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="e.g. Where is the door?"
            />
            <button style={styles.submitButton} type="submit">
              Ask
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    position: "relative",
    width: "100vw",
    height: "100vh",
    backgroundColor: "#000",
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "20px",
    background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },
  status: {
    color: "#fff",
    fontSize: "16px",
    textAlign: "center",
    margin: 0,
  },
  transcript: {
    color: "#ccc",
    fontSize: "14px",
    textAlign: "center",
    margin: 0,
  },
  answer: {
    color: "#fff",
    fontSize: "20px",
    fontWeight: "bold",
    textAlign: "center",
    margin: 0,
  },
  talkButton: {
    width: "100%",
    maxWidth: "400px",
    padding: "20px",
    fontSize: "18px",
    fontWeight: "bold",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    userSelect: "none",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    width: "100%",
    maxWidth: "400px",
  },
  fallbackNote: {
    color: "#ccc",
    fontSize: "13px",
    margin: 0,
  },
  input: {
    padding: "12px",
    fontSize: "16px",
    borderRadius: "8px",
    border: "none",
  },
  submitButton: {
    padding: "12px",
    fontSize: "16px",
    fontWeight: "bold",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#2ecc71",
    color: "#fff",
    cursor: "pointer",
  },
};