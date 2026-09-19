import {
  useEffect,
  useRef,
  useState,
} from "react";

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

  const speechCacheRef = useRef(
    new Map()
  );

  const [
    cameraReady,
    setCameraReady,
  ] = useState(false);

  const [
    listening,
    setListening,
  ] = useState(false);

  const [
    thinking,
    setThinking,
  ] = useState(false);

  const [
    status,
    setStatus,
  ] = useState(
    "Starting camera"
  );

  const [
    transcript,
    setTranscript,
  ] = useState("");

  const [
    answer,
    setAnswer,
  ] = useState("");

  const [
    speechSupported,
    setSpeechSupported,
  ] = useState(true);

  const [
    manualText,
    setManualText,
  ] = useState("");

  const [
    lastAudioBase64,
    setLastAudioBase64,
  ] = useState(null);

  useEffect(() => {
    listeningRef.current =
      listening;
  }, [listening]);

  useEffect(() => {
    thinkingRef.current =
      thinking;
  }, [thinking]);

  useEffect(() => {
    cameraReadyRef.current =
      cameraReady;
  }, [cameraReady]);

  // ============================================================
  // AUDIO
  // ============================================================

  async function getAudioContext() {
    if (
      typeof window ===
      "undefined"
    ) {
      return null;
    }

    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      return null;
    }

    if (
      !audioContextRef.current
    ) {
      audioContextRef.current =
        new AudioContext();
    }

    const context =
      audioContextRef.current;

    if (
      context.state ===
      "suspended"
    ) {
      try {
        await context.resume();
      } catch (error) {
        console.error(
          "Could not resume audio:",
          error
        );
      }
    }

    return context;
  }

  async function playTone(
    frequency = 700,
    duration = 120
  ) {
    try {
      const context =
        await getAudioContext();

      if (!context) {
        return;
      }

      const oscillator =
        context.createOscillator();

      const gain =
        context.createGain();

      oscillator.connect(gain);

      gain.connect(
        context.destination
      );

      oscillator.type =
        "sine";

      oscillator.frequency.setValueAtTime(
        frequency,
        context.currentTime
      );

      gain.gain.setValueAtTime(
        0.35,
        context.currentTime
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        context.currentTime +
          duration / 1000
      );

      oscillator.start(
        context.currentTime
      );

      oscillator.stop(
        context.currentTime +
          duration / 1000
      );
    } catch (error) {
      console.error(
        "Tone error:",
        error
      );
    }
  }

  function listeningCue() {
    playTone(
      1050,
      150
    );
  }

  function submittedCue() {
    playTone(
      520,
      130
    );
  }

  function successCue() {
    playTone(
      650,
      90
    );

    setTimeout(() => {
      playTone(
        1100,
        120
      );
    }, 105);
  }

  function failureCue() {
    playTone(
      260,
      150
    );

    setTimeout(() => {
      playTone(
        260,
        150
      );
    }, 190);

    setTimeout(() => {
      playTone(
        260,
        210
      );
    }, 380);

    vibrate([
      120,
      70,
      120,
      70,
      200,
    ]);
  }

  function errorCue() {
    playTone(
      500,
      130
    );

    setTimeout(() => {
      playTone(
        300,
        210
      );
    }, 150);

    vibrate([
      180,
      80,
      250,
    ]);
  }

  function vibrate(pattern) {
    if (
      typeof navigator !==
        "undefined" &&
      typeof navigator.vibrate ===
        "function"
    ) {
      navigator.vibrate(
        pattern
      );
    }
  }

  function stopCurrentAudio() {
    if (
      currentAudioRef.current
    ) {
      try {
        currentAudioRef.current.pause();

        currentAudioRef.current.currentTime =
          0;
      } catch {}

      currentAudioRef.current =
        null;
    }

    if (
      typeof window !==
        "undefined" &&
      window.speechSynthesis
    ) {
      window.speechSynthesis.cancel();
    }
  }

  function browserSpeak(text) {
    if (
      !text ||
      typeof window ===
        "undefined" ||
      !window.speechSynthesis
    ) {
      return;
    }

    stopCurrentAudio();

    const utterance =
      new SpeechSynthesisUtterance(
        text
      );

    utterance.rate =
      1.05;

    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(
      utterance
    );
  }

  function playElevenLabsAudio(
    audioBase64,
    fallbackText
  ) {
    if (!audioBase64) {
      browserSpeak(
        fallbackText
      );

      return;
    }

    try {
      stopCurrentAudio();

      const audio =
        new Audio(
          `data:audio/mpeg;base64,${audioBase64}`
        );

      currentAudioRef.current =
        audio;

      audio.onended = () => {
        currentAudioRef.current =
          null;
      };

      audio.onerror = () => {
        currentAudioRef.current =
          null;

        browserSpeak(
          fallbackText
        );
      };

      audio
        .play()
        .catch(
          (error) => {
            console.error(
              "ElevenLabs playback failed:",
              error
            );

            currentAudioRef.current =
              null;

            browserSpeak(
              fallbackText
            );
          }
        );
    } catch (error) {
      console.error(
        "Audio playback error:",
        error
      );

      browserSpeak(
        fallbackText
      );
    }
  }

  async function speak(text) {
    if (!text) {
      return;
    }

    stopCurrentAudio();

    const cachedAudio =
      speechCacheRef.current.get(
        text
      );

    if (cachedAudio) {
      playElevenLabsAudio(
        cachedAudio,
        text
      );

      return;
    }

    try {
      const response =
        await fetch(
          "/api/speak",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                text,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.audioBase64
      ) {
        throw new Error(
          data.error ||
            "Speech failed"
        );
      }

      speechCacheRef.current.set(
        text,
        data.audioBase64
      );

      playElevenLabsAudio(
        data.audioBase64,
        text
      );
    } catch (error) {
      console.error(
        "App speech error:",
        error
      );

      browserSpeak(text);
    }
  }

  // ============================================================
  // INTRO / INSTRUCTIONS
  // ============================================================

  function speakWelcome() {
    speak(
      "What's This Camera. " +
        "Press the camera button and ask a question now. " +
        "On the website, hold anywhere to ask. " +
        "Say repeat instructions anytime."
    );
  }

  function playInstructions() {
    speak(
      "What's This Camera helps you understand what the camera sees. " +
        "On the camera device, hold the camera button while you ask a question, then release. " +
        "Press and release without asking a question for an automatic description. " +
        "On the website, hold anywhere on the screen, or hold the space bar, while you ask a question, then release. " +
        "You can also use the Take Photo button without speaking. " +
        "Say describe scene for an overview. " +
        "Say repeat to hear the last answer again. " +
        "Say repeat instructions to hear these instructions again. " +
        "Camera answers can be wrong, so use your own judgment for safety-critical decisions."
    );
  }

  // ============================================================
  // CAMERA
  // ============================================================

  useEffect(() => {
    let stream;

    async function startCamera() {
      try {
        stream =
          await navigator.mediaDevices.getUserMedia(
            {
              video: {
                facingMode: {
                  ideal:
                    "environment",
                },

                width: {
                  ideal:
                    1280,
                },

                height: {
                  ideal:
                    720,
                },
              },

              audio: false,
            }
          );

        if (
          videoRef.current
        ) {
          videoRef.current.srcObject =
            stream;
        }

        setCameraReady(
          true
        );

        cameraReadyRef.current =
          true;

        setStatus(
          "Ready"
        );

        setTimeout(() => {
          if (
            !audioUnlockedRef.current
          ) {
            speakWelcome();
          }
        }, 500);
      } catch (error) {
        console.error(
          "Camera error:",
          error
        );

        setCameraReady(
          false
        );

        cameraReadyRef.current =
          false;

        setStatus(
          "Camera unavailable"
        );
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );
      }
    };
  }, []);

  // ============================================================
  // IMAGE CAPTURE
  // ============================================================

  function capturePhotoBase64() {
    const video =
      videoRef.current;

    const canvas =
      canvasRef.current;

    if (
      !video ||
      !canvas
    ) {
      return null;
    }

    const originalWidth =
      video.videoWidth;

    const originalHeight =
      video.videoHeight;

    if (
      !originalWidth ||
      !originalHeight
    ) {
      return null;
    }

    const maxDimension =
      1100;

    let width =
      originalWidth;

    let height =
      originalHeight;

    if (
      width >
        maxDimension ||
      height >
        maxDimension
    ) {
      const scale =
        Math.min(
          maxDimension /
            width,
          maxDimension /
            height
        );

      width =
        Math.round(
          width * scale
        );

      height =
        Math.round(
          height * scale
        );
    }

    canvas.width =
      width;

    canvas.height =
      height;

    const context =
      canvas.getContext(
        "2d"
      );

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

    const dataUrl =
      canvas.toDataURL(
        "image/jpeg",
        0.66
      );

    return dataUrl.split(
      ","
    )[1];
  }

  // ============================================================
  // AI REQUEST
  // ============================================================

  async function askAboutImage(
    question = "",
    displayQuestion = "",
    mode = "question"
  ) {
    if (
      thinkingRef.current
    ) {
      return;
    }

    const imageBase64 =
      capturePhotoBase64();

    if (!imageBase64) {
      setStatus(
        "No image captured"
      );

      failureCue();

      setTimeout(() => {
        speak(
          "I couldn't capture an image. Try again."
        );
      }, 500);

      return;
    }

    thinkingRef.current =
      true;

    setThinking(true);

    setTranscript(
      displayQuestion
    );

    setStatus(
      "Looking"
    );

    try {
      const startedAt =
        performance.now();

      const response =
        await fetch(
          "/api/ask",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                question,
                imageBase64,
                mode,
              }),
          }
        );

      const data =
        await response.json();

      const totalTime =
        Math.round(
          performance.now() -
            startedAt
        );

      console.log(
        "[PERFORMANCE]",
        {
          totalMs:
            totalTime,

          serverTiming:
            data.timing,
        }
      );

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Request failed"
        );
      }

      const responseText =
        data.answer ||
        "I couldn't determine an answer.";

      setAnswer(
        responseText
      );

      setLastAudioBase64(
        data.audioBase64 ||
          null
      );

      setStatus(
        "Ready"
      );

      successCue();

      vibrate([
        45,
        30,
        70,
      ]);

      setTimeout(() => {
        if (
          data.audioBase64
        ) {
          playElevenLabsAudio(
            data.audioBase64,
            responseText
          );
        } else {
          speak(
            responseText
          );
        }
      }, 180);
    } catch (error) {
      console.error(
        "Ask error:",
        error
      );

      setStatus(
        "Something went wrong"
      );

      errorCue();

      setTimeout(() => {
        speak(
          "Something went wrong. Try again."
        );
      }, 400);
    } finally {
      thinkingRef.current =
        false;

      setThinking(false);
    }
  }

  // ============================================================
  // QUESTION CONFIRMATION
  // ============================================================

  function submitRecognizedQuestion(
    question
  ) {
    const cleanQuestion =
      question?.trim();

    if (!cleanQuestion) {
      submitImageOnly();

      return;
    }

    setTranscript(
      cleanQuestion
    );

    setStatus(
      "Question heard"
    );

    speak(
      `Heard: ${cleanQuestion}`
    );

    askAboutImage(
      cleanQuestion,
      cleanQuestion,
      "question"
    );
  }

  function submitImageOnly() {
    if (
      thinkingRef.current ||
      !cameraReadyRef.current
    ) {
      return;
    }

    setTranscript(
      "No question — automatic description"
    );

    setStatus(
      "Describing"
    );

    speak(
      "No question heard. Describing."
    );

    askAboutImage(
      "",
      "Automatic description",
      "image-only"
    );
  }

  // ============================================================
  // SCENE DESCRIPTION
  // ============================================================

  function describeScene() {
    if (
      thinkingRef.current ||
      !cameraReadyRef.current
    ) {
      return;
    }

    stopCurrentAudio();

    setTranscript(
      "Describe scene"
    );

    askAboutImage(
      "",
      "Describe scene",
      "scene"
    );
  }

  // ============================================================
  // REPEAT
  // ============================================================

  function repeatAnswer() {
    if (!answer) {
      failureCue();

      setTimeout(() => {
        speak(
          "There isn't a previous answer yet."
        );
      }, 500);

      return;
    }

    if (
      lastAudioBase64
    ) {
      playElevenLabsAudio(
        lastAudioBase64,
        answer
      );
    } else {
      speak(answer);
    }
  }

  // ============================================================
  // VOICE COMMANDS
  // ============================================================

  function normalizeCommand(
    value
  ) {
    return value
      .toLowerCase()
      .replace(
        /[.,!?']/g,
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function handleSpokenInput(
    rawQuestion
  ) {
    const question =
      rawQuestion?.trim();

    if (!question) {
      submitImageOnly();

      return;
    }

    const command =
      normalizeCommand(
        question
      );

    const describeCommands =
      [
        "describe scene",
        "describe the scene",
        "describe my surroundings",
        "describe surroundings",
        "describe whats around me",
        "what is around me",
        "whats around me",
        "tell me whats around me",
        "describe around me",
      ];

    if (
      describeCommands.includes(
        command
      )
    ) {
      describeScene();

      return;
    }

    const repeatCommands =
      [
        "repeat",
        "repeat answer",
        "repeat the answer",
        "repeat that",
        "say that again",
        "say it again",
        "what did you say",
        "again",
      ];

    if (
      repeatCommands.includes(
        command
      )
    ) {
      repeatAnswer();

      return;
    }

    const instructionCommands =
      [
        "repeat instructions",
        "repeat the instructions",
        "say the instructions again",
        "instructions again",
        "give me the instructions",
        "tell me the instructions",
        "what are the instructions",
        "how do i use this",
        "how does this work",
      ];

    if (
      instructionCommands.includes(
        command
      )
    ) {
      playInstructions();

      return;
    }

    submitRecognizedQuestion(
      question
    );
  }

  // ============================================================
  // SPEECH RECOGNITION
  // ============================================================

  useEffect(() => {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (
      !SpeechRecognition
    ) {
      setSpeechSupported(
        false
      );

      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang =
      "en-US";

    recognition.interimResults =
      false;

    recognition.continuous =
      false;

    recognition.maxAlternatives =
      1;

    recognition.onstart =
      () => {
        listeningRef.current =
          true;

        setListening(
          true
        );

        setStatus(
          "Listening"
        );
      };

    recognition.onresult =
      (event) => {
        const question =
          event
            .results?.[0]?.[0]
            ?.transcript?.trim();

        listeningRef.current =
          false;

        setListening(
          false
        );

        handleSpokenInput(
          question
        );
      };

    recognition.onerror =
      (event) => {
        console.error(
          "Speech recognition error:",
          event.error
        );

        listeningRef.current =
          false;

        setListening(
          false
        );

        if (
          event.error ===
          "aborted"
        ) {
          return;
        }

        if (
          event.error ===
          "no-speech"
        ) {
          submitImageOnly();

          return;
        }

        if (
          event.error ===
          "not-allowed"
        ) {
          setStatus(
            "Microphone unavailable"
          );

          errorCue();

          setTimeout(() => {
            speak(
              "Microphone access is off. You can still use Take Photo."
            );
          }, 400);

          return;
        }

        if (
          event.error ===
          "audio-capture"
        ) {
          setStatus(
            "Microphone unavailable"
          );

          errorCue();

          setTimeout(() => {
            speak(
              "I can't access the microphone. You can still use Take Photo."
            );
          }, 400);

          return;
        }

        setStatus(
          "Microphone error"
        );

        errorCue();

        setTimeout(() => {
          speak(
            "I couldn't understand the microphone input. Try again, or use Take Photo."
          );
        }, 400);
      };

    recognition.onend =
      () => {
        listeningRef.current =
          false;

        setListening(
          false
        );
      };

    recognitionRef.current =
      recognition;

    return () => {
      try {
        recognition.abort();
      } catch {}
    };
  }, [
    answer,
    lastAudioBase64,
  ]);

  // ============================================================
  // START / STOP LISTENING
  // ============================================================

  async function startListening() {
    await getAudioContext();

    audioUnlockedRef.current =
      true;

    if (
      thinkingRef.current
    ) {
      errorCue();

      return;
    }

    if (
      !cameraReadyRef.current
    ) {
      errorCue();

      setTimeout(() => {
        speak(
          "The camera is still starting."
        );
      }, 350);

      return;
    }

    if (
      !recognitionRef.current
    ) {
      errorCue();

      setTimeout(() => {
        speak(
          "Voice recognition isn't available. Use Take Photo instead."
        );
      }, 350);

      return;
    }

    if (
      listeningRef.current
    ) {
      return;
    }

    stopCurrentAudio();

    listeningRef.current =
      true;

    setListening(
      true
    );

    setTranscript("");

    setStatus(
      "Listening"
    );

    listeningCue();

    vibrate(45);

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error(
        "Could not start recognition:",
        error
      );

      listeningRef.current =
        false;

      setListening(
        false
      );

      errorCue();

      setTimeout(() => {
        speak(
          "I couldn't start listening. Try again, or use Take Photo."
        );
      }, 350);
    }
  }

  function stopListening() {
    if (
      !recognitionRef.current ||
      !listeningRef.current
    ) {
      return;
    }

    setStatus(
      "Processing"
    );

    submittedCue();

    vibrate([
      35,
      25,
      35,
    ]);

    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.error(
        "Could not stop recognition:",
        error
      );

      listeningRef.current =
        false;

      setListening(
        false
      );

      errorCue();

      setTimeout(() => {
        speak(
          "Something went wrong. Try again."
        );
      }, 350);
    }
  }

  // ============================================================
  // SPACE BAR
  // ============================================================

  useEffect(() => {
    function keyDown(
      event
    ) {
      if (
        event.code !==
          "Space" ||
        event.repeat ||
        event.target
          ?.tagName ===
          "INPUT" ||
        event.target
          ?.tagName ===
          "TEXTAREA"
      ) {
        return;
      }

      event.preventDefault();

      startListening();
    }

    function keyUp(
      event
    ) {
      if (
        event.code !==
          "Space" ||
        event.target
          ?.tagName ===
          "INPUT" ||
        event.target
          ?.tagName ===
          "TEXTAREA"
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
  // MANUAL TEXT
  // ============================================================

  function handleManualSubmit(
    event
  ) {
    event.preventDefault();

    const question =
      manualText.trim();

    if (
      !question ||
      thinkingRef.current
    ) {
      return;
    }

    setManualText("");

    handleSpokenInput(
      question
    );
  }

  // ============================================================
  // FULL SCREEN HOLD
  // ============================================================

  function isInteractiveElement(
    target
  ) {
    if (!target?.closest) {
      return false;
    }

    return Boolean(
      target.closest(
        "button, input, textarea, select, a, form"
      )
    );
  }

  function handleScreenPointerDown(
    event
  ) {
    if (
      isInteractiveElement(
        event.target
      )
    ) {
      return;
    }

    startListening();
  }

  function handleScreenPointerUp(
    event
  ) {
    if (
      isInteractiveElement(
        event.target
      )
    ) {
      return;
    }

    stopListening();
  }

  // ============================================================
  // STATUS
  // ============================================================

  const statusTitle =
    listening
      ? "Listening"
      : thinking
      ? "Looking"
      : cameraReady
      ? "Ready"
      : "Starting";

  const statusMessage =
    listening
      ? "Ask your question. Release when finished."
      : thinking
      ? "Checking what the camera sees."
      : cameraReady
      ? "Hold to ask, or take a photo without speaking."
      : "Getting the camera ready.";

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main
      style={
        styles.page
      }
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
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={
          styles.video
        }
        aria-hidden="true"
      />

      <canvas
        ref={canvasRef}
        style={{
          display:
            "none",
        }}
        aria-hidden="true"
      />

      <div
        style={
          styles.gradient
        }
        aria-hidden="true"
      />

      <header
        style={
          styles.header
        }
      >
        <div>
          <h1
            style={
              styles.logo
            }
          >
            What&apos;s This Camera
          </h1>

          <p
            style={
              styles.tagline
            }
          >
            See what&apos;s around you.
            Ask naturally.
          </p>
        </div>

        <div
          style={
            styles.readyBadge
          }
          aria-label={
            cameraReady
              ? "Camera ready"
              : "Camera starting"
          }
        >
          {cameraReady
            ? "CAMERA READY"
            : "STARTING"}
        </div>
      </header>

      <section
        style={
          styles.centerStatus
        }
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

        <h2
          style={
            styles.statusTitle
          }
        >
          {statusTitle}
        </h2>

        <p
          style={
            styles.statusMessage
          }
        >
          {statusMessage}
        </p>
      </section>

      <section
        style={
          styles.controls
        }
        aria-label="What's This Camera controls"
      >
        {answer && (
          <div
            style={
              styles.answerCard
            }
          >
            {transcript && (
              <p
                style={
                  styles.questionText
                }
              >
                {transcript}
              </p>
            )}

            <p
              style={
                styles.answerText
              }
            >
              {answer}
            </p>
          </div>
        )}

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
                ? "Release when finished asking your question"
                : "Hold to ask a question"
            }
            onPointerDown={(
              event
            ) => {
              event.stopPropagation();

              startListening();
            }}
            onPointerUp={(
              event
            ) => {
              event.stopPropagation();

              stopListening();
            }}
            onPointerCancel={(
              event
            ) => {
              event.stopPropagation();

              stopListening();
            }}
          >
            <span
              style={
                styles.buttonIcon
              }
              aria-hidden="true"
            >
              {listening
                ? "●"
                : "🎙"}
            </span>

            <span>
              <span
                style={
                  styles.buttonTitle
                }
              >
                {listening
                  ? "Release When Finished"
                  : thinking
                  ? "Looking..."
                  : "Hold & Ask"}
              </span>

              {!listening &&
                !thinking && (
                  <span
                    style={
                      styles.buttonHelp
                    }
                  >
                    Hold anywhere or Space
                  </span>
                )}
            </span>
          </button>
        ) : (
          <form
            style={
              styles.manualForm
            }
            onSubmit={
              handleManualSubmit
            }
          >
            <label
              htmlFor="question"
              style={
                styles.manualLabel
              }
            >
              Ask about what the camera sees
            </label>

            <div
              style={
                styles.manualRow
              }
            >
              <input
                id="question"
                value={
                  manualText
                }
                onChange={(
                  event
                ) =>
                  setManualText(
                    event.target
                      .value
                  )
                }
                placeholder="What is in front of me?"
                style={
                  styles.input
                }
              />

              <button
                type="submit"
                style={
                  styles.smallButton
                }
              >
                Ask
              </button>
            </div>
          </form>
        )}

        <button
          type="button"
          onClick={
            submitImageOnly
          }
          disabled={
            thinking ||
            !cameraReady
          }
          style={{
            ...styles.photoButton,

            ...((thinking ||
            !cameraReady)
              ? styles.disabled
              : {}),
          }}
          aria-label="Take a photo and describe it without asking a question"
        >
          <span
            style={
              styles.photoIcon
            }
            aria-hidden="true"
          >
            ◉
          </span>

          <span>
            <strong
              style={
                styles.photoTitle
              }
            >
              Take Photo
            </strong>

            <span
              style={
                styles.photoHelp
              }
            >
              No question needed
            </span>
          </span>
        </button>

        <div
          style={
            styles.quickActions
          }
        >
          <button
            type="button"
            onClick={
              describeScene
            }
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
            aria-label="Describe scene"
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
            onClick={
              repeatAnswer
            }
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
            aria-label="Repeat answer"
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
          onClick={
            playInstructions
          }
          style={
            styles.instructionsButton
          }
          aria-label="Hear full instructions"
        >
          🔊 Hear Instructions
        </button>

        <p
          style={
            styles.voiceHint
          }
        >
          “describe scene” •
          “repeat” •
          “repeat instructions”
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
    position:
      "relative",

    width:
      "100vw",

    height:
      "100dvh",

    minHeight:
      "100vh",

    overflow:
      "hidden",

    backgroundColor:
      "#000",

    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",

    cursor:
      "pointer",

    touchAction:
      "none",
  },

  video: {
    position:
      "absolute",

    inset: 0,

    width:
      "100%",

    height:
      "100%",

    objectFit:
      "cover",

    pointerEvents:
      "none",
  },

  gradient: {
    position:
      "absolute",

    inset: 0,

    background:
      "linear-gradient(to bottom, rgba(0,0,0,.88) 0%, rgba(0,0,0,.3) 35%, rgba(0,0,0,.38) 52%, rgba(0,0,0,.98) 100%)",

    pointerEvents:
      "none",
  },

  header: {
    position:
      "absolute",

    zIndex: 10,

    top: 0,
    left: 0,
    right: 0,

    display:
      "flex",

    alignItems:
      "flex-start",

    justifyContent:
      "space-between",

    gap:
      "12px",

    padding:
      "max(22px, env(safe-area-inset-top)) 20px 20px",

    pointerEvents:
      "none",
  },

  logo: {
    margin: 0,

    color:
      "#fff",

    fontSize:
      "clamp(28px, 7vw, 40px)",

    fontWeight:
      900,

    lineHeight:
      1,

    letterSpacing:
      "-1.4px",

    textShadow:
      "0 3px 20px rgba(0,0,0,.55)",
  },

  tagline: {
    margin:
      "8px 0 0",

    maxWidth:
      "260px",

    color:
      "rgba(255,255,255,.92)",

    fontSize:
      "15px",

    fontWeight:
      700,

    lineHeight:
      1.3,
  },

  readyBadge: {
    flexShrink: 0,

    padding:
      "8px 11px",

    border:
      "2px solid rgba(255,255,255,.7)",

    borderRadius:
      "999px",

    backgroundColor:
      "rgba(0,0,0,.72)",

    color:
      "#fff",

    fontSize:
      "10px",

    fontWeight:
      900,

    letterSpacing:
      "1px",
  },

  centerStatus: {
    position:
      "absolute",

    zIndex: 5,

    top:
      "19%",

    left:
      "50%",

    width:
      "min(88vw, 460px)",

    transform:
      "translateX(-50%)",

    display:
      "flex",

    flexDirection:
      "column",

    alignItems:
      "center",

    textAlign:
      "center",

    pointerEvents:
      "none",
  },

  statusCircle: {
    width:
      "68px",

    height:
      "68px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "3px solid #fff",

    borderRadius:
      "50%",

    backgroundColor:
      "rgba(0,0,0,.75)",

    color:
      "#fff",

    fontSize:
      "27px",

    fontWeight:
      900,

    boxShadow:
      "0 8px 30px rgba(0,0,0,.4)",
  },

  listeningCircle: {
    transform:
      "scale(1.08)",
  },

  thinkingCircle: {
    fontSize:
      "16px",

    letterSpacing:
      "3px",
  },

  statusTitle: {
    margin:
      "12px 0 0",

    color:
      "#fff",

    fontSize:
      "clamp(29px, 7vw, 41px)",

    fontWeight:
      900,

    letterSpacing:
      "-.8px",

    textShadow:
      "0 3px 18px rgba(0,0,0,.7)",
  },

  statusMessage: {
    maxWidth:
      "370px",

    margin:
      "7px 0 0",

    color:
      "rgba(255,255,255,.95)",

    fontSize:
      "16px",

    fontWeight:
      700,

    lineHeight:
      1.4,

    textShadow:
      "0 2px 14px rgba(0,0,0,.8)",
  },

  controls: {
    position:
      "absolute",

    zIndex: 20,

    left: 0,
    right: 0,
    bottom: 0,

    display:
      "flex",

    flexDirection:
      "column",

    alignItems:
      "center",

    gap:
      "8px",

    padding:
      "16px 16px max(18px, env(safe-area-inset-bottom))",
  },

  answerCard: {
    width:
      "100%",

    maxWidth:
      "560px",

    boxSizing:
      "border-box",

    padding:
      "15px 18px",

    border:
      "2px solid rgba(255,255,255,.45)",

    borderRadius:
      "20px",

    backgroundColor:
      "rgba(0,0,0,.92)",

    backdropFilter:
      "blur(18px)",

    boxShadow:
      "0 12px 35px rgba(0,0,0,.4)",

    pointerEvents:
      "none",
  },

  questionText: {
    margin:
      "0 0 7px",

    color:
      "rgba(255,255,255,.72)",

    fontSize:
      "13px",

    fontWeight:
      700,

    lineHeight:
      1.35,
  },

  answerText: {
    margin: 0,

    color:
      "#fff",

    fontSize:
      "clamp(20px, 5.4vw, 27px)",

    fontWeight:
      850,

    lineHeight:
      1.28,

    letterSpacing:
      "-.2px",
  },

  mainButton: {
    width:
      "100%",

    maxWidth:
      "560px",

    minHeight:
      "88px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    gap:
      "16px",

    boxSizing:
      "border-box",

    padding:
      "14px 22px",

    border:
      "4px solid #fff",

    borderRadius:
      "24px",

    backgroundColor:
      "#fff",

    color:
      "#000",

    cursor:
      "pointer",

    userSelect:
      "none",

    WebkitUserSelect:
      "none",

    touchAction:
      "none",

    boxShadow:
      "0 14px 38px rgba(0,0,0,.45)",
  },

  mainButtonActive: {
    backgroundColor:
      "#111",

    color:
      "#fff",

    transform:
      "scale(.985)",
  },

  buttonIcon: {
    width:
      "50px",

    height:
      "50px",

    flexShrink: 0,

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderRadius:
      "50%",

    backgroundColor:
      "#111",

    color:
      "#fff",

    fontSize:
      "23px",
  },

  buttonTitle: {
    display:
      "block",

    fontSize:
      "22px",

    fontWeight:
      900,

    lineHeight:
      1.1,

    textAlign:
      "left",
  },

  buttonHelp: {
    display:
      "block",

    marginTop:
      "5px",

    fontSize:
      "13px",

    fontWeight:
      650,

    opacity:
      0.65,

    textAlign:
      "left",
  },

  photoButton: {
    width:
      "100%",

    maxWidth:
      "560px",

    minHeight:
      "62px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    gap:
      "12px",

    boxSizing:
      "border-box",

    padding:
      "10px 18px",

    border:
      "3px solid #fff",

    borderRadius:
      "18px",

    backgroundColor:
      "rgba(0,0,0,.88)",

    color:
      "#fff",

    cursor:
      "pointer",

    textAlign:
      "left",
  },

  photoIcon: {
    fontSize:
      "25px",

    flexShrink: 0,
  },

  photoTitle: {
    display:
      "block",

    fontSize:
      "17px",

    fontWeight:
      900,
  },

  photoHelp: {
    display:
      "block",

    marginTop:
      "2px",

    color:
      "rgba(255,255,255,.72)",

    fontSize:
      "11px",

    fontWeight:
      650,
  },

  quickActions: {
    width:
      "100%",

    maxWidth:
      "560px",

    display:
      "grid",

    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",

    gap:
      "8px",
  },

  secondaryButton: {
    minHeight:
      "64px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "flex-start",

    gap:
      "10px",

    padding:
      "9px 12px",

    border:
      "2px solid rgba(255,255,255,.55)",

    borderRadius:
      "17px",

    backgroundColor:
      "rgba(10,10,10,.92)",

    color:
      "#fff",

    cursor:
      "pointer",

    textAlign:
      "left",
  },

  secondaryIcon: {
    flexShrink: 0,

    fontSize:
      "22px",
  },

  secondaryTitle: {
    display:
      "block",

    fontSize:
      "14px",

    fontWeight:
      850,
  },

  secondaryHelp: {
    display:
      "block",

    marginTop:
      "3px",

    color:
      "rgba(255,255,255,.72)",

    fontSize:
      "10px",

    fontWeight:
      650,

    lineHeight:
      1.2,
  },

  instructionsButton: {
    minHeight:
      "43px",

    padding:
      "8px 18px",

    border:
      "2px solid rgba(255,255,255,.5)",

    borderRadius:
      "999px",

    backgroundColor:
      "rgba(0,0,0,.84)",

    color:
      "#fff",

    fontSize:
      "13px",

    fontWeight:
      800,

    cursor:
      "pointer",
  },

  voiceHint: {
    margin: 0,

    color:
      "rgba(255,255,255,.72)",

    fontSize:
      "11px",

    fontWeight:
      700,

    textAlign:
      "center",

    pointerEvents:
      "none",
  },

  disabled: {
    opacity:
      0.48,

    cursor:
      "default",
  },

  manualForm: {
    width:
      "100%",

    maxWidth:
      "560px",

    boxSizing:
      "border-box",

    padding:
      "15px",

    border:
      "2px solid rgba(255,255,255,.5)",

    borderRadius:
      "19px",

    backgroundColor:
      "rgba(0,0,0,.9)",
  },

  manualLabel: {
    display:
      "block",

    marginBottom:
      "9px",

    color:
      "#fff",

    fontSize:
      "15px",

    fontWeight:
      800,
  },

  manualRow: {
    display:
      "flex",

    gap:
      "8px",
  },

  input: {
    flex: 1,

    minWidth: 0,

    padding:
      "15px",

    border:
      "2px solid #fff",

    borderRadius:
      "12px",

    backgroundColor:
      "#111",

    color:
      "#fff",

    fontSize:
      "16px",
  },

  smallButton: {
    minWidth:
      "74px",

    border: 0,

    borderRadius:
      "12px",

    backgroundColor:
      "#fff",

    color:
      "#000",

    fontSize:
      "16px",

    fontWeight:
      900,
  },
};