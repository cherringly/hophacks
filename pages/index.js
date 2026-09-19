import { useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const currentAudioRef = useRef(null);
  const audioContextRef = useRef(null);

  const listeningRef = useRef(false);
  const thinkingRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const audioUnlockedRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);

  const [status, setStatus] = useState("Starting camera");
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");

  const [speechSupported, setSpeechSupported] = useState(true);
  const [manualText, setManualText] = useState("");
  const [lastAudioBase64, setLastAudioBase64] = useState(null);

  // ============================================================
  // KEEP REFS SYNCHRONIZED
  // ============================================================

  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  useEffect(() => {
    thinkingRef.current = thinking;
  }, [thinking]);

  useEffect(() => {
    cameraReadyRef.current = cameraReady;
  }, [cameraReady]);

  // ============================================================
  // AUDIO ENGINE
  // ============================================================

  async function getAudioContext() {
    if (typeof window === "undefined") return null;

    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const context = audioContextRef.current;

    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch (error) {
        console.error("Could not resume audio:", error);
      }
    }

    return context;
  }

  async function playTone(frequency = 700, duration = 120) {
    try {
      const context = await getAudioContext();

      if (!context) return;

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.type = "sine";

      oscillator.frequency.setValueAtTime(
        frequency,
        context.currentTime
      );

      gain.gain.setValueAtTime(
        0.4,
        context.currentTime
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        context.currentTime + duration / 1000
      );

      oscillator.start(context.currentTime);

      oscillator.stop(
        context.currentTime + duration / 1000
      );
    } catch (error) {
      console.error("Tone error:", error);
    }
  }

  // ============================================================
  // AUDIO CUES
  //
  // HIGH = START SPEAKING
  // LOW = STOP / PROCESSING
  // RISING PAIR = SUCCESS
  // THREE LOW = NOTHING CAPTURED
  // FALLING PAIR = SYSTEM ERROR
  // ============================================================

  function listeningCue() {
    playTone(1050, 190);
  }

  function submittedCue() {
    playTone(520, 190);
  }

  function successCue() {
    playTone(650, 120);

    setTimeout(() => {
      playTone(1100, 190);
    }, 150);
  }

  function failureCue() {
    playTone(260, 180);

    setTimeout(() => {
      playTone(260, 180);
    }, 230);

    setTimeout(() => {
      playTone(260, 260);
    }, 460);

    vibrate([150, 80, 150, 80, 250]);
  }

  function errorCue() {
    playTone(500, 160);

    setTimeout(() => {
      playTone(300, 260);
    }, 190);

    vibrate([200, 100, 300]);
  }

  function vibrate(pattern) {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      navigator.vibrate(pattern);
    }
  }

  // ============================================================
  // STOP CURRENT SPEECH / AUDIO
  // ============================================================

  function stopCurrentAudio() {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch {}

      currentAudioRef.current = null;
    }

    if (
      typeof window !== "undefined" &&
      window.speechSynthesis
    ) {
      window.speechSynthesis.cancel();
    }
  }

  // ============================================================
  // BROWSER TEXT TO SPEECH
  // ============================================================

  function speak(text) {
    if (
      !text ||
      typeof window === "undefined" ||
      !window.speechSynthesis
    ) {
      return;
    }

    stopCurrentAudio();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = 1.03;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  }

  // ============================================================
  // ELEVENLABS AUDIO
  // ============================================================

  function playElevenLabsAudio(audioBase64, fallbackText) {
    if (!audioBase64) {
      speak(fallbackText);
      return;
    }

    try {
      stopCurrentAudio();

      const audio = new Audio(
        `data:audio/mpeg;base64,${audioBase64}`
      );

      currentAudioRef.current = audio;

      audio.onended = () => {
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        currentAudioRef.current = null;
        speak(fallbackText);
      };

      audio.play().catch((error) => {
        console.error("ElevenLabs playback failed:", error);

        currentAudioRef.current = null;

        speak(fallbackText);
      });
    } catch (error) {
      console.error("Audio playback error:", error);

      speak(fallbackText);
    }
  }

  // ============================================================
  // SPOKEN WELCOME
  // ============================================================

  function speakWelcome() {
    speak(
      "Welcome to What's This Photo. " +
        "Hold anywhere on the screen, or hold the space bar, and ask a question. " +
        "Release when you're finished speaking. " +
        "Your answer will be spoken automatically. " +
        "You can also say describe scene, repeat, or help."
    );
  }

  // ============================================================
  // SPOKEN HELP
  // ============================================================

  function playHelp() {
    speak(
      "What's This Photo helps you understand what's around you. " +
        "Hold anywhere on the screen, or hold the space bar, while you speak. " +
        "Release when you're finished. " +
        "Ask any question about what the camera sees. " +
        "Say describe scene for a description of your surroundings. " +
        "Say repeat to hear the previous answer. " +
        "Say help to hear these instructions again."
    );
  }

  // ============================================================
  // CAMERA
  // ============================================================

  useEffect(() => {
    let stream;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment",
            },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setCameraReady(true);
        cameraReadyRef.current = true;

        setStatus("Ready");

        // Try to announce automatically.
        // Browser autoplay rules may prevent this before interaction.
        setTimeout(() => {
          if (!audioUnlockedRef.current) {
            speakWelcome();
          }
        }, 700);
      } catch (error) {
        console.error("Camera error:", error);

        setCameraReady(false);
        cameraReadyRef.current = false;

        setStatus("Camera unavailable");
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // ============================================================
  // CAPTURE CAMERA IMAGE
  // ============================================================

  function capturePhotoBase64() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return null;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      return null;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.drawImage(
      video,
      0,
      0,
      width,
      height
    );

    const dataUrl = canvas.toDataURL(
      "image/jpeg",
      0.72
    );

    return dataUrl.split(",")[1];
  }

  // ============================================================
  // AI REQUEST
  // ============================================================

  async function askAboutImage(
    question,
    displayQuestion = question
  ) {
    if (!question || thinkingRef.current) {
      return;
    }

    const imageBase64 = capturePhotoBase64();

    if (!imageBase64) {
      setStatus("No image captured");

      failureCue();

      setTimeout(() => {
        speak(
          "I couldn't capture an image. Please hold and try again."
        );
      }, 850);

      return;
    }

    thinkingRef.current = true;
    setThinking(true);

    setTranscript(displayQuestion);
    setStatus("Looking");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          question,
          imageBase64,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Request failed"
        );
      }

      const responseText =
        data.answer ||
        "I couldn't determine an answer.";

      setAnswer(responseText);

      setLastAudioBase64(
        data.audioBase64 || null
      );

      setStatus("Ready");

      successCue();

      vibrate([60, 40, 100]);

      setTimeout(() => {
        if (data.audioBase64) {
          playElevenLabsAudio(
            data.audioBase64,
            responseText
          );
        } else {
          speak(responseText);
        }
      }, 380);
    } catch (error) {
      console.error("Ask error:", error);

      setStatus("Something went wrong");

      errorCue();

      setTimeout(() => {
        speak(
          "Sorry, something went wrong. Please try again."
        );
      }, 600);
    } finally {
      thinkingRef.current = false;
      setThinking(false);
    }
  }

  // ============================================================
  // DESCRIBE SCENE
  // ============================================================

  function describeScene() {
    if (
      thinkingRef.current ||
      !cameraReadyRef.current
    ) {
      return;
    }

    stopCurrentAudio();

    const accessibilityPrompt = `
Describe what the camera currently shows for a blind or low-vision user.

The response will be heard rather than read.

Be concise, practical, and conversational.

Put the most useful information first.

Prioritize:
1. Immediate visible obstacles or potential hazards.
2. Useful spatial orientation.
3. Doors, entrances, exits, stairs, curbs, pathways, and changes in level.
4. People and their approximate positions.
5. Important nearby objects.
6. Readable signs, labels, or text.
7. Other useful context.

Use simple directional language such as:
"directly ahead,"
"slightly to your left,"
"slightly to your right,"
or clock positions when useful.

Avoid unnecessary decorative visual details.

Do not claim that an area is definitely safe based on a single camera image.

Say "I don't see an obstacle directly ahead" instead of "the path is safe."

If something important is uncertain or outside the camera view, say so briefly.
`.trim();

    askAboutImage(
      accessibilityPrompt,
      "Describe what's around me."
    );
  }

  // ============================================================
  // REPEAT ANSWER
  // ============================================================

  function repeatAnswer() {
    if (!answer) {
      failureCue();

      setTimeout(() => {
        speak(
          "There is no previous answer yet."
        );
      }, 800);

      return;
    }

    if (lastAudioBase64) {
      playElevenLabsAudio(
        lastAudioBase64,
        answer
      );
    } else {
      speak(answer);
    }
  }

  // ============================================================
  // VOICE COMMAND ROUTER
  // ============================================================

  function handleSpokenInput(rawQuestion) {
    const question = rawQuestion?.trim();

    if (!question) {
      setStatus("No speech detected");

      failureCue();

      setTimeout(() => {
        speak(
          "I didn't hear anything. Hold and speak again."
        );
      }, 850);

      return;
    }

    const command = question
      .toLowerCase()
      .replace(/[.,!?]/g, "")
      .trim();

    const describeCommands = [
      "describe scene",
      "describe the scene",
      "describe my surroundings",
      "describe surroundings",
      "describe what's around me",
      "describe whats around me",
      "what's around me",
      "whats around me",
      "what is around me",
    ];

    if (describeCommands.includes(command)) {
      describeScene();
      return;
    }

    const repeatCommands = [
      "repeat",
      "repeat answer",
      "repeat the answer",
      "repeat that",
      "say that again",
      "say it again",
      "what did you say",
    ];

    if (repeatCommands.includes(command)) {
      repeatAnswer();
      return;
    }

    const helpCommands = [
      "help",
      "help me",
      "instructions",
      "give me instructions",
      "what can i say",
      "what can i do",
      "how do i use this",
      "how does this work",
    ];

    if (helpCommands.includes(command)) {
      playHelp();
      return;
    }

    askAboutImage(
      question,
      question
    );
  }

  // ============================================================
  // SPEECH RECOGNITION
  // ============================================================

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listeningRef.current = true;
      setListening(true);
      setStatus("Listening");
    };

    recognition.onresult = (event) => {
      const question =
        event.results?.[0]?.[0]?.transcript?.trim();

      listeningRef.current = false;
      setListening(false);

      handleSpokenInput(question);
    };

    recognition.onerror = (event) => {
      console.error(
        "Speech recognition error:",
        event.error
      );

      listeningRef.current = false;
      setListening(false);

      if (event.error === "aborted") {
        return;
      }

      if (event.error === "no-speech") {
        setStatus("No speech detected");

        failureCue();

        setTimeout(() => {
          speak(
            "I didn't hear anything. Hold and speak again."
          );
        }, 850);

        return;
      }

      if (event.error === "not-allowed") {
        setStatus("Microphone unavailable");

        errorCue();

        setTimeout(() => {
          speak(
            "Microphone access is unavailable. Please allow microphone access."
          );
        }, 600);

        return;
      }

      if (event.error === "audio-capture") {
        setStatus("Microphone unavailable");

        errorCue();

        setTimeout(() => {
          speak(
            "I can't access the microphone. Please check your microphone and try again."
          );
        }, 600);

        return;
      }

      setStatus("Microphone error");

      errorCue();

      setTimeout(() => {
        speak(
          "I couldn't hear your question. Please try again."
        );
      }, 600);
    };

    recognition.onend = () => {
      listeningRef.current = false;
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {}
    };
  }, [answer, lastAudioBase64]);

  // ============================================================
  // START LISTENING
  //
  // Browser:
  // pointer down / Space down
  //
  // Future Raspberry Pi:
  // physical GPIO button down
  // ============================================================

  async function startListening() {
    // This is intentionally first.
    // The user's press should unlock browser audio.
    await getAudioContext();

    audioUnlockedRef.current = true;

    if (thinkingRef.current) {
      errorCue();

      return;
    }

    if (!cameraReadyRef.current) {
      errorCue();

      setTimeout(() => {
        speak(
          "The camera is still starting. Please try again in a moment."
        );
      }, 600);

      return;
    }

    if (!recognitionRef.current) {
      errorCue();

      setTimeout(() => {
        speak(
          "Voice recognition is unavailable in this browser."
        );
      }, 600);

      return;
    }

    if (listeningRef.current) {
      return;
    }

    stopCurrentAudio();

    listeningRef.current = true;
    setListening(true);

    setTranscript("");
    setStatus("Listening");

    // USER NOW KNOWS TO START SPEAKING.
    listeningCue();

    vibrate(60);

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error(
        "Could not start recognition:",
        error
      );

      listeningRef.current = false;
      setListening(false);

      errorCue();

      setTimeout(() => {
        speak(
          "I couldn't start listening. Please try again."
        );
      }, 600);
    }
  }

  // ============================================================
  // STOP LISTENING
  //
  // Browser:
  // pointer up / Space up
  //
  // Future Raspberry Pi:
  // physical GPIO button up
  // ============================================================

  function stopListening() {
    if (
      !recognitionRef.current ||
      !listeningRef.current
    ) {
      return;
    }

    setStatus("Processing question");

    // USER NOW KNOWS THEY CAN STOP SPEAKING.
    submittedCue();

    vibrate([40, 40, 40]);

    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.error(
        "Could not stop recognition:",
        error
      );

      listeningRef.current = false;
      setListening(false);

      errorCue();

      setTimeout(() => {
        speak(
          "Something went wrong. Please hold and speak again."
        );
      }, 600);
    }
  }

  // ============================================================
  // KEYBOARD / FUTURE PI BUTTON SIMULATOR
  // ============================================================

  useEffect(() => {
    function keyDown(event) {
      if (
        event.code !== "Space" ||
        event.repeat ||
        event.target?.tagName === "INPUT" ||
        event.target?.tagName === "TEXTAREA"
      ) {
        return;
      }

      event.preventDefault();

      startListening();
    }

    function keyUp(event) {
      if (
        event.code !== "Space" ||
        event.target?.tagName === "INPUT" ||
        event.target?.tagName === "TEXTAREA"
      ) {
        return;
      }

      event.preventDefault();

      stopListening();
    }

    window.addEventListener(
      "keydown",
      keyDown
    );

    window.addEventListener(
      "keyup",
      keyUp
    );

    return () => {
      window.removeEventListener(
        "keydown",
        keyDown
      );

      window.removeEventListener(
        "keyup",
        keyUp
      );
    };
  });

  // ============================================================
  // MANUAL FALLBACK
  // ============================================================

  function handleManualSubmit(event) {
    event.preventDefault();

    const question = manualText.trim();

    if (
      !question ||
      thinkingRef.current
    ) {
      return;
    }

    setManualText("");

    handleSpokenInput(question);
  }

  // ============================================================
  // FULL-SCREEN HOLD INTERACTION
  // ============================================================

  function isInteractiveElement(target) {
    if (!target?.closest) return false;

    return Boolean(
      target.closest(
        "button, input, textarea, select, a, form"
      )
    );
  }

  function handleScreenPointerDown(event) {
    if (
      isInteractiveElement(event.target)
    ) {
      return;
    }

    startListening();
  }

  function handleScreenPointerUp(event) {
    if (
      isInteractiveElement(event.target)
    ) {
      return;
    }

    stopListening();
  }

  // ============================================================
  // VISUAL STATUS
  // ============================================================

  const statusTitle = listening
    ? "Listening"
    : thinking
    ? "Looking"
    : cameraReady
    ? "Ready"
    : "Starting";

  const statusMessage = listening
    ? "Speak now. Release when finished."
    : thinking
    ? "Analyzing what the camera sees."
    : cameraReady
    ? "Hold anywhere and ask what's around you."
    : "Getting the camera ready.";

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main
      style={styles.page}
      onPointerDown={
        handleScreenPointerDown
      }
      onPointerUp={
        handleScreenPointerUp
      }
      onPointerCancel={
        handleScreenPointerUp
      }
    >
      {/* CAMERA */}

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={styles.video}
        aria-hidden="true"
      />

      <canvas
        ref={canvasRef}
        style={{
          display: "none",
        }}
        aria-hidden="true"
      />

      <div
        style={styles.gradient}
        aria-hidden="true"
      />

      {/* HEADER */}

      <header style={styles.header}>
        <div>
          <h1 style={styles.logo}>
            What&apos;s This Photo
          </h1>

          <p style={styles.tagline}>
            Your surroundings, spoken.
          </p>
        </div>

        <div
          style={styles.demoBadge}
          aria-label="Website demo mode"
        >
          WEB DEMO
        </div>
      </header>

      {/* STATUS */}

      <section
        style={styles.centerStatus}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div
          style={{
            ...styles.statusCircle,

            ...(listening
              ? styles.listeningCircle
              : {}),

            ...(thinking
              ? styles.thinkingCircle
              : {}),
          }}
          aria-hidden="true"
        >
          {listening
            ? "●"
            : thinking
            ? "•••"
            : "✓"}
        </div>

        <h2 style={styles.statusTitle}>
          {statusTitle}
        </h2>

        <p style={styles.statusMessage}>
          {statusMessage}
        </p>
      </section>

      {/* CONTROLS */}

      <section
        style={styles.controls}
        aria-label="What's This Photo controls"
      >
        {/* ANSWER */}

        {answer && (
          <div style={styles.answerCard}>
            {transcript && (
              <p style={styles.questionText}>
                {transcript}
              </p>
            )}

            <p style={styles.answerText}>
              {answer}
            </p>
          </div>
        )}

        {/* MAIN HOLD BUTTON */}

        {speechSupported ? (
          <button
            type="button"
            disabled={
              thinking ||
              !cameraReady
            }
            style={{
              ...styles.mainButton,

              ...(listening
                ? styles.mainButtonActive
                : {}),

              ...((thinking ||
              !cameraReady)
                ? styles.disabled
                : {}),
            }}
            aria-label={
              listening
                ? "Release to submit your spoken question"
                : "Hold to ask a question about what the camera sees"
            }
            onPointerDown={(event) => {
              event.stopPropagation();
              startListening();
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              stopListening();
            }}
            onPointerCancel={(event) => {
              event.stopPropagation();
              stopListening();
            }}
          >
            <span
              style={styles.buttonIcon}
              aria-hidden="true"
            >
              {listening
                ? "●"
                : "🎙"}
            </span>

            <span>
              <span
                style={styles.buttonTitle}
              >
                {listening
                  ? "Release When Finished"
                  : thinking
                  ? "Looking..."
                  : "Hold Anywhere to Ask"}
              </span>

              {!listening &&
                !thinking && (
                  <span
                    style={
                      styles.buttonHelp
                    }
                  >
                    Or hold Space
                  </span>
                )}
            </span>
          </button>
        ) : (
          <form
            style={styles.manualForm}
            onSubmit={
              handleManualSubmit
            }
          >
            <label
              htmlFor="question"
              style={styles.manualLabel}
            >
              Ask what&apos;s around you
            </label>

            <div
              style={styles.manualRow}
            >
              <input
                id="question"
                value={manualText}
                onChange={(event) =>
                  setManualText(
                    event.target.value
                  )
                }
                placeholder="What is in front of me?"
                style={styles.input}
              />

              <button
                type="submit"
                style={styles.smallButton}
              >
                Ask
              </button>
            </div>
          </form>
        )}

        {/* OPTIONAL VISUAL CONTROLS */}

        <div
          style={styles.quickActions}
        >
          <button
            type="button"
            onClick={describeScene}
            disabled={
              thinking ||
              !cameraReady
            }
            style={{
              ...styles.secondaryButton,

              ...((thinking ||
              !cameraReady)
                ? styles.disabled
                : {}),
            }}
            aria-label="Describe the scene. You can also hold and say describe scene."
          >
            <span
              style={
                styles.secondaryIcon
              }
              aria-hidden="true"
            >
              ◎
            </span>

            <span>
              <strong
                style={
                  styles.secondaryTitle
                }
              >
                Describe Scene
              </strong>

              <span
                style={
                  styles.secondaryHelp
                }
              >
                Say “describe scene”
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={repeatAnswer}
            disabled={
              !answer ||
              thinking
            }
            style={{
              ...styles.secondaryButton,

              ...((!answer ||
              thinking)
                ? styles.disabled
                : {}),
            }}
            aria-label="Repeat the last answer. You can also hold and say repeat."
          >
            <span
              style={
                styles.secondaryIcon
              }
              aria-hidden="true"
            >
              ↻
            </span>

            <span>
              <strong
                style={
                  styles.secondaryTitle
                }
              >
                Repeat Answer
              </strong>

              <span
                style={
                  styles.secondaryHelp
                }
              >
                Say “repeat”
              </span>
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={playHelp}
          style={styles.helpButton}
          aria-label="Hear instructions. You can also hold and say help."
        >
          🔊 Hear Instructions
        </button>

        <p style={styles.voiceHint}>
          Say “describe scene” • “repeat” • “help”
        </p>
      </section>
    </main>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = {
  page: {
    position: "relative",

    width: "100vw",
    height: "100dvh",
    minHeight: "100vh",

    overflow: "hidden",

    backgroundColor: "#000",

    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",

    cursor: "pointer",

    touchAction: "none",
  },

  video: {
    position: "absolute",

    inset: 0,

    width: "100%",
    height: "100%",

    objectFit: "cover",

    pointerEvents: "none",
  },

  gradient: {
    position: "absolute",

    inset: 0,

    background:
      "linear-gradient(to bottom, rgba(0,0,0,.84) 0%, rgba(0,0,0,.28) 35%, rgba(0,0,0,.32) 53%, rgba(0,0,0,.98) 100%)",

    pointerEvents: "none",
  },

  header: {
    position: "absolute",

    zIndex: 10,

    top: 0,
    left: 0,
    right: 0,

    display: "flex",

    alignItems: "flex-start",

    justifyContent: "space-between",

    gap: "12px",

    padding:
      "max(22px, env(safe-area-inset-top)) 20px 20px",

    pointerEvents: "none",
  },

  logo: {
    margin: 0,

    color: "#fff",

    fontSize:
      "clamp(29px, 7vw, 40px)",

    fontWeight: 900,

    lineHeight: 1,

    letterSpacing: "-1.4px",

    textShadow:
      "0 3px 20px rgba(0,0,0,.55)",
  },

  tagline: {
    margin: "8px 0 0",

    color:
      "rgba(255,255,255,.9)",

    fontSize: "15px",

    fontWeight: 700,
  },

  demoBadge: {
    flexShrink: 0,

    padding: "8px 11px",

    border:
      "2px solid rgba(255,255,255,.7)",

    borderRadius: "999px",

    backgroundColor:
      "rgba(0,0,0,.7)",

    color: "#fff",

    fontSize: "10px",

    fontWeight: 900,

    letterSpacing: "1px",
  },

  centerStatus: {
    position: "absolute",

    zIndex: 5,

    top: "20%",

    left: "50%",

    width: "min(88vw, 460px)",

    transform:
      "translateX(-50%)",

    display: "flex",

    flexDirection: "column",

    alignItems: "center",

    textAlign: "center",

    pointerEvents: "none",
  },

  statusCircle: {
    width: "72px",

    height: "72px",

    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    border: "3px solid #fff",

    borderRadius: "50%",

    backgroundColor:
      "rgba(0,0,0,.75)",

    color: "#fff",

    fontSize: "28px",

    fontWeight: 900,

    boxShadow:
      "0 8px 30px rgba(0,0,0,.4)",
  },

  listeningCircle: {
    transform: "scale(1.08)",
  },

  thinkingCircle: {
    fontSize: "16px",

    letterSpacing: "3px",
  },

  statusTitle: {
    margin: "13px 0 0",

    color: "#fff",

    fontSize:
      "clamp(29px, 7vw, 41px)",

    fontWeight: 900,

    letterSpacing: "-.8px",

    textShadow:
      "0 3px 18px rgba(0,0,0,.7)",
  },

  statusMessage: {
    maxWidth: "350px",

    margin: "7px 0 0",

    color:
      "rgba(255,255,255,.95)",

    fontSize: "16px",

    fontWeight: 700,

    lineHeight: 1.4,

    textShadow:
      "0 2px 14px rgba(0,0,0,.8)",
  },

  controls: {
    position: "absolute",

    zIndex: 20,

    left: 0,
    right: 0,
    bottom: 0,

    display: "flex",

    flexDirection: "column",

    alignItems: "center",

    gap: "9px",

    padding:
      "18px 16px max(20px, env(safe-area-inset-bottom))",
  },

  answerCard: {
    width: "100%",

    maxWidth: "560px",

    boxSizing: "border-box",

    padding: "16px 18px",

    border:
      "2px solid rgba(255,255,255,.45)",

    borderRadius: "20px",

    backgroundColor:
      "rgba(0,0,0,.9)",

    backdropFilter: "blur(18px)",

    boxShadow:
      "0 12px 35px rgba(0,0,0,.4)",

    pointerEvents: "none",
  },

  questionText: {
    margin: "0 0 7px",

    color:
      "rgba(255,255,255,.72)",

    fontSize: "13px",

    fontWeight: 700,

    lineHeight: 1.35,
  },

  answerText: {
    margin: 0,

    color: "#fff",

    fontSize:
      "clamp(20px, 5.4vw, 27px)",

    fontWeight: 850,

    lineHeight: 1.28,

    letterSpacing: "-.2px",
  },

  mainButton: {
    width: "100%",

    maxWidth: "560px",

    minHeight: "94px",

    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    gap: "16px",

    boxSizing: "border-box",

    padding: "16px 22px",

    border: "4px solid #fff",

    borderRadius: "25px",

    backgroundColor: "#fff",

    color: "#000",

    cursor: "pointer",

    userSelect: "none",

    WebkitUserSelect: "none",

    touchAction: "none",

    boxShadow:
      "0 14px 38px rgba(0,0,0,.45)",
  },

  mainButtonActive: {
    backgroundColor: "#111",

    color: "#fff",

    transform: "scale(.985)",
  },

  buttonIcon: {
    width: "52px",

    height: "52px",

    flexShrink: 0,

    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    borderRadius: "50%",

    backgroundColor: "#111",

    color: "#fff",

    fontSize: "24px",
  },

  buttonTitle: {
    display: "block",

    fontSize: "22px",

    fontWeight: 900,

    lineHeight: 1.1,

    textAlign: "left",
  },

  buttonHelp: {
    display: "block",

    marginTop: "5px",

    fontSize: "13px",

    fontWeight: 650,

    opacity: 0.65,

    textAlign: "left",
  },

  quickActions: {
    width: "100%",

    maxWidth: "560px",

    display: "grid",

    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",

    gap: "9px",
  },

  secondaryButton: {
    minHeight: "68px",

    display: "flex",

    alignItems: "center",

    justifyContent: "flex-start",

    gap: "10px",

    padding: "10px 13px",

    border:
      "2px solid rgba(255,255,255,.55)",

    borderRadius: "17px",

    backgroundColor:
      "rgba(10,10,10,.92)",

    color: "#fff",

    cursor: "pointer",

    textAlign: "left",
  },

  secondaryIcon: {
    flexShrink: 0,

    fontSize: "23px",
  },

  secondaryTitle: {
    display: "block",

    fontSize: "14px",

    fontWeight: 850,
  },

  secondaryHelp: {
    display: "block",

    marginTop: "3px",

    color:
      "rgba(255,255,255,.72)",

    fontSize: "10px",

    fontWeight: 650,

    lineHeight: 1.2,
  },

  helpButton: {
    minHeight: "45px",

    padding: "8px 18px",

    border:
      "2px solid rgba(255,255,255,.5)",

    borderRadius: "999px",

    backgroundColor:
      "rgba(0,0,0,.84)",

    color: "#fff",

    fontSize: "13px",

    fontWeight: 800,

    cursor: "pointer",
  },

  voiceHint: {
    margin: 0,

    color:
      "rgba(255,255,255,.72)",

    fontSize: "11px",

    fontWeight: 700,

    textAlign: "center",

    pointerEvents: "none",
  },

  disabled: {
    opacity: 0.48,

    cursor: "default",
  },

  manualForm: {
    width: "100%",

    maxWidth: "560px",

    boxSizing: "border-box",

    padding: "15px",

    border:
      "2px solid rgba(255,255,255,.5)",

    borderRadius: "19px",

    backgroundColor:
      "rgba(0,0,0,.9)",
  },

  manualLabel: {
    display: "block",

    marginBottom: "9px",

    color: "#fff",

    fontSize: "15px",

    fontWeight: 800,
  },

  manualRow: {
    display: "flex",

    gap: "8px",
  },

  input: {
    flex: 1,

    minWidth: 0,

    padding: "15px",

    border: "2px solid #fff",

    borderRadius: "12px",

    backgroundColor: "#111",

    color: "#fff",

    fontSize: "16px",
  },

  smallButton: {
    minWidth: "74px",

    border: 0,

    borderRadius: "12px",

    backgroundColor: "#fff",

    color: "#000",

    fontSize: "16px",

    fontWeight: 900,
  },
};