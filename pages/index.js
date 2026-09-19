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
  ] = useState("Starting");

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

  // ============================================================
  // KEEP STATE REFS CURRENT
  // ============================================================

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
  // AUDIO CONTEXT
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

  // ============================================================
  // TONES
  // ============================================================

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
        0.32,
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
      140
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
      680,
      85
    );

    setTimeout(() => {
      playTone(
        1100,
        115
      );
    }, 100);
  }

  function noSpeechCue() {
    playTone(
      420,
      100
    );

    setTimeout(() => {
      playTone(
        420,
        100
      );
    }, 135);
  }

  function errorCue() {
    playTone(
      500,
      130
    );

    setTimeout(() => {
      playTone(
        290,
        220
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

  // ============================================================
  // AUDIO PLAYBACK
  // ============================================================

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
    return new Promise(
      (resolve) => {
        if (
          !text ||
          typeof window ===
            "undefined" ||
          !window.speechSynthesis
        ) {
          resolve();

          return;
        }

        stopCurrentAudio();

        const utterance =
          new SpeechSynthesisUtterance(
            text
          );

        utterance.rate =
          1.06;

        utterance.pitch = 1;

        utterance.volume = 1;

        utterance.onend =
          () => resolve();

        utterance.onerror =
          () => resolve();

        window.speechSynthesis.speak(
          utterance
        );
      }
    );
  }

  function playElevenLabsAudio(
    audioBase64,
    fallbackText
  ) {
    return new Promise(
      (resolve) => {
        if (!audioBase64) {
          browserSpeak(
            fallbackText
          ).then(resolve);

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

          audio.onended =
            () => {
              currentAudioRef.current =
                null;

              resolve();
            };

          audio.onerror =
            () => {
              currentAudioRef.current =
                null;

              browserSpeak(
                fallbackText
              ).then(resolve);
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
                ).then(resolve);
              }
            );
        } catch (error) {
          console.error(
            "Audio playback error:",
            error
          );

          browserSpeak(
            fallbackText
          ).then(resolve);
        }
      }
    );
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
      await playElevenLabsAudio(
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

      await playElevenLabsAudio(
        data.audioBase64,
        text
      );
    } catch (error) {
      console.error(
        "App speech error:",
        error
      );

      await browserSpeak(
        text
      );
    }
  }

  // ============================================================
  // INTRODUCTION
  // ============================================================

  function speakWelcome() {
    speak(
      "What's This Photo. " +
        "Hold to ask a question, or tap Take Photo for a description. " +
        "Say repeat instructions anytime."
    );
  }

  // ============================================================
  // FULL INSTRUCTIONS
  // ============================================================

  function playInstructions() {
    speak(
      "What's This Photo helps describe what your camera sees. " +
        "On this website, hold the large Ask button while speaking, then release. " +
        "You can also hold the space bar. " +
        "If you don't want to speak, tap Take Photo for an automatic description. " +
        "On the physical What's This Photo camera, hold the camera button while asking a question, then release. " +
        "Press and release the camera button without speaking for an automatic description. " +
        "After you speak, I'll tell you what question I heard. " +
        "Say describe scene for an overview. " +
        "Say repeat to hear the last answer. " +
        "Say repeat instructions to hear these instructions again. " +
        "Visual answers can be wrong or incomplete, so do not rely on the camera alone for safety-critical decisions."
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
        }, 450);
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
    mode = "question",
    feedbackPromise = null
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
        "Camera could not capture"
      );

      errorCue();

      setTimeout(() => {
        speak(
          "I couldn't capture the image. Try again."
        );
      }, 350);

      return;
    }

    thinkingRef.current =
      true;

    setThinking(
      true
    );

    setTranscript(
      displayQuestion
    );

    setStatus(
      "Looking"
    );

    try {
      const startedAt =
        performance.now();

      const responsePromise =
        fetch(
          "/api/ask",
          {
            method:
              "POST",

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

      const response =
        await responsePromise;

      const data =
        await response.json();

      const totalMs =
        Math.round(
          performance.now() -
            startedAt
        );

      console.log(
        "[PERFORMANCE]",
        {
          totalMs,
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

      if (
        feedbackPromise
      ) {
        try {
          await feedbackPromise;
        } catch {}
      }

      setStatus(
        "Ready"
      );

      successCue();

      vibrate([
        45,
        30,
        70,
      ]);

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            150
          )
      );

      if (
        data.audioBase64
      ) {
        await playElevenLabsAudio(
          data.audioBase64,
          responseText
        );
      } else {
        await speak(
          responseText
        );
      }
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
          "Something went wrong. Please try again."
        );
      }, 350);
    } finally {
      thinkingRef.current =
        false;

      setThinking(
        false
      );
    }
  }

  // ============================================================
  // RECOGNIZED QUESTION
  // ============================================================

  function submitRecognizedQuestion(
    question
  ) {
    const cleanQuestion =
      question?.trim();

    if (!cleanQuestion) {
      submitImageOnly(
        true
      );

      return;
    }

    setTranscript(
      `Heard: ${cleanQuestion}`
    );

    setStatus(
      "Question heard"
    );

    const feedbackPromise =
      speak(
        `Heard: ${cleanQuestion}`
      );

    askAboutImage(
      cleanQuestion,
      `Heard: ${cleanQuestion}`,
      "question",
      feedbackPromise
    );
  }

  // ============================================================
  // IMAGE ONLY
  // ============================================================

  function submitImageOnly(
    cameFromSilence = false
  ) {
    if (
      thinkingRef.current ||
      !cameraReadyRef.current
    ) {
      return;
    }

    const feedbackText =
      cameFromSilence
        ? "No question heard. Describing."
        : "Photo taken. Describing.";

    setTranscript(
      cameFromSilence
        ? "No question heard"
        : "Photo only"
    );

    setStatus(
      "Describing"
    );

    if (
      cameFromSilence
    ) {
      noSpeechCue();
    }

    const feedbackPromise =
      speak(
        feedbackText
      );

    askAboutImage(
      "",
      cameFromSilence
        ? "No question heard — automatic description"
        : "Automatic description",
      "image-only",
      feedbackPromise
    );
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
      noSpeechCue();

      setTimeout(() => {
        speak(
          "There isn't a previous answer yet."
        );
      }, 250);

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
      speak(
        answer
      );
    }
  }

  // ============================================================
  // VOICE COMMAND ROUTING
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
      submitImageOnly(
        true
      );

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
        "whats around me",
        "what is around me",
        "tell me whats around me",
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
        "instructions",
        "instructions again",
        "say the instructions again",
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
          submitImageOnly(
            true
          );

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
          }, 300);

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
          }, 300);

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
        }, 300);
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
  // START LISTENING
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
      }, 250);

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
      }, 250);

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
      }, 250);
    }
  }

  // ============================================================
  // STOP LISTENING
  // ============================================================

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
      }, 250);
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
          "TEXTAREA" ||
        event.target
          ?.tagName ===
          "BUTTON"
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
          "TEXTAREA" ||
        event.target
          ?.tagName ===
          "BUTTON"
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
  // MANUAL TEXT FALLBACK
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
  // SCREEN STATUS
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
      ? "Hold Ask, or choose Take Photo."
      : "Getting the camera ready.";

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main
      style={
        styles.page
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
            What&apos;s This Photo
          </h1>

          <p
            style={
              styles.tagline
            }
          >
            Your surroundings,
            spoken.
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
            ? "READY"
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
        aria-label="What's This Photo controls"
      >
        {answer && (
          <div
            style={
              styles.answerCard
            }
            aria-live="off"
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
              ...styles.askButton,

              ...(listening
                ? styles.askButtonListening
                : {}),

              ...((thinking ||
              !cameraReady)
                ? styles.disabled
                : {}),
            }}
            aria-label={
              listening
                ? "Listening. Release to send your question."
                : "Hold this button while asking a question."
            }
            onPointerDown={(
              event
            ) => {
              event.preventDefault();

              startListening();
            }}
            onPointerUp={(
              event
            ) => {
              event.preventDefault();

              stopListening();
            }}
            onPointerCancel={(
              event
            ) => {
              event.preventDefault();

              stopListening();
            }}
          >
            <span
              style={
                styles.askIcon
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
                  styles.askTitle
                }
              >
                {listening
                  ? "Release to Ask"
                  : thinking
                  ? "Looking..."
                  : "Hold to Ask"}
              </span>

              <span
                style={
                  styles.askHelp
                }
              >
                {listening
                  ? "I’m listening"
                  : "Hold while speaking"}
              </span>
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
              Ask what the camera sees
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
                    event.target.value
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
          onClick={() =>
            submitImageOnly(
              false
            )
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
          aria-label="Take a photo and automatically describe what the camera sees. No speaking required."
        >
          <span
            style={
              styles.photoIcon
            }
            aria-hidden="true"
          >
            ◎
          </span>

          <span>
            <span
              style={
                styles.photoTitle
              }
            >
              Take Photo
            </span>

            <span
              style={
                styles.photoHelp
              }
            >
              No speaking required
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
            aria-label="Repeat the last answer"
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
                Repeat
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

          <button
            type="button"
            onClick={
              playInstructions
            }
            style={
              styles.secondaryButton
            }
            aria-label="Hear instructions"
          >
            <span
              style={
                styles.secondaryIcon
              }
              aria-hidden="true"
            >
              ?
            </span>

            <span>
              <strong
                style={
                  styles.secondaryTitle
                }
              >
                Instructions
              </strong>

              <span
                style={
                  styles.secondaryHelp
                }
              >
                Say “repeat instructions”
              </span>
            </span>
          </button>
        </div>

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
            ...styles.sceneButton,

            ...((thinking ||
            !cameraReady)
              ? styles.disabled
              : {}),
          }}
          aria-label="Describe the current scene"
        >
          Describe Scene
          <span
            style={
              styles.sceneHelp
            }
          >
            Say “describe scene”
          </span>
        </button>

        <p
          style={
            styles.keyboardHint
          }
        >
          Keyboard: hold Space to ask
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
      "linear-gradient(to bottom, rgba(0,0,0,.90) 0%, rgba(0,0,0,.22) 34%, rgba(0,0,0,.42) 54%, rgba(0,0,0,.99) 100%)",

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

    justifyContent:
      "space-between",

    alignItems:
      "flex-start",

    gap:
      "12px",

    padding:
      "max(22px, env(safe-area-inset-top)) 18px 16px",

    pointerEvents:
      "none",
  },

  logo: {
    margin: 0,

    color:
      "#fff",

    fontSize:
      "clamp(30px, 7vw, 42px)",

    fontWeight:
      900,

    lineHeight:
      0.98,

    letterSpacing:
      "-1.3px",

    textShadow:
      "0 3px 18px rgba(0,0,0,.75)",
  },

  tagline: {
    margin:
      "8px 0 0",

    color:
      "#fff",

    fontSize:
      "15px",

    lineHeight:
      1.25,

    fontWeight:
      700,

    textShadow:
      "0 2px 12px rgba(0,0,0,.9)",
  },

  readyBadge: {
    flexShrink: 0,

    padding:
      "8px 12px",

    border:
      "2px solid #fff",

    borderRadius:
      "999px",

    backgroundColor:
      "rgba(0,0,0,.78)",

    color:
      "#fff",

    fontSize:
      "10px",

    fontWeight:
      900,

    letterSpacing:
      "1.2px",
  },

  centerStatus: {
    position:
      "absolute",

    zIndex: 5,

    top:
      "20%",

    left:
      "50%",

    width:
      "min(90vw, 480px)",

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
      "72px",

    height:
      "72px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "4px solid #fff",

    borderRadius:
      "50%",

    backgroundColor:
      "rgba(0,0,0,.82)",

    color:
      "#fff",

    fontSize:
      "28px",

    fontWeight:
      900,

    boxShadow:
      "0 10px 35px rgba(0,0,0,.5)",
  },

  listeningCircle: {
    transform:
      "scale(1.08)",
  },

  thinkingCircle: {
    fontSize:
      "15px",

    letterSpacing:
      "4px",
  },

  statusTitle: {
    margin:
      "13px 0 0",

    color:
      "#fff",

    fontSize:
      "clamp(30px, 8vw, 43px)",

    fontWeight:
      900,

    lineHeight:
      1,

    textShadow:
      "0 3px 18px rgba(0,0,0,.85)",
  },

  statusMessage: {
    maxWidth:
      "360px",

    margin:
      "8px 0 0",

    color:
      "#fff",

    fontSize:
      "17px",

    fontWeight:
      700,

    lineHeight:
      1.35,

    textShadow:
      "0 2px 16px rgba(0,0,0,.9)",
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
      "14px 14px max(16px, env(safe-area-inset-bottom))",
  },

  answerCard: {
    width:
      "100%",

    maxWidth:
      "580px",

    boxSizing:
      "border-box",

    padding:
      "15px 17px",

    border:
      "3px solid #fff",

    borderRadius:
      "20px",

    backgroundColor:
      "rgba(0,0,0,.94)",

    boxShadow:
      "0 12px 35px rgba(0,0,0,.55)",
  },

  questionText: {
    margin:
      "0 0 7px",

    color:
      "rgba(255,255,255,.78)",

    fontSize:
      "14px",

    fontWeight:
      750,

    lineHeight:
      1.35,
  },

  answerText: {
    margin: 0,

    color:
      "#fff",

    fontSize:
      "clamp(21px, 5.5vw, 28px)",

    fontWeight:
      850,

    lineHeight:
      1.28,
  },

  askButton: {
    width:
      "100%",

    maxWidth:
      "580px",

    minHeight:
      "102px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    gap:
      "17px",

    padding:
      "15px 22px",

    boxSizing:
      "border-box",

    border:
      "4px solid #fff",

    borderRadius:
      "26px",

    backgroundColor:
      "#fff",

    color:
      "#000",

    cursor:
      "pointer",

    touchAction:
      "none",

    userSelect:
      "none",

    WebkitUserSelect:
      "none",

    boxShadow:
      "0 15px 40px rgba(0,0,0,.55)",
  },

  askButtonListening: {
    backgroundColor:
      "#111",

    color:
      "#fff",

    transform:
      "scale(.985)",
  },

  askIcon: {
    width:
      "54px",

    height:
      "54px",

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
      "25px",
  },

  askTitle: {
    display:
      "block",

    fontSize:
      "24px",

    fontWeight:
      900,

    lineHeight:
      1.05,

    textAlign:
      "left",
  },

  askHelp: {
    display:
      "block",

    marginTop:
      "6px",

    fontSize:
      "14px",

    fontWeight:
      700,

    opacity:
      0.7,

    textAlign:
      "left",
  },

  photoButton: {
    width:
      "100%",

    maxWidth:
      "580px",

    minHeight:
      "70px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    gap:
      "13px",

    boxSizing:
      "border-box",

    padding:
      "11px 18px",

    border:
      "3px solid #fff",

    borderRadius:
      "20px",

    backgroundColor:
      "rgba(0,0,0,.92)",

    color:
      "#fff",

    cursor:
      "pointer",

    textAlign:
      "left",

    boxShadow:
      "0 8px 24px rgba(0,0,0,.35)",
  },

  photoIcon: {
    flexShrink: 0,

    fontSize:
      "26px",
  },

  photoTitle: {
    display:
      "block",

    fontSize:
      "19px",

    fontWeight:
      900,
  },

  photoHelp: {
    display:
      "block",

    marginTop:
      "2px",

    color:
      "rgba(255,255,255,.78)",

    fontSize:
      "12px",

    fontWeight:
      700,
  },

  quickActions: {
    width:
      "100%",

    maxWidth:
      "580px",

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
      "2px solid rgba(255,255,255,.8)",

    borderRadius:
      "17px",

    backgroundColor:
      "rgba(0,0,0,.9)",

    color:
      "#fff",

    cursor:
      "pointer",

    textAlign:
      "left",
  },

  secondaryIcon: {
    flexShrink: 0,

    width:
      "26px",

    textAlign:
      "center",

    fontSize:
      "21px",

    fontWeight:
      900,
  },

  secondaryTitle: {
    display:
      "block",

    fontSize:
      "15px",

    fontWeight:
      900,
  },

  secondaryHelp: {
    display:
      "block",

    marginTop:
      "3px",

    color:
      "rgba(255,255,255,.75)",

    fontSize:
      "10px",

    fontWeight:
      700,

    lineHeight:
      1.2,
  },

  sceneButton: {
    width:
      "100%",

    maxWidth:
      "580px",

    minHeight:
      "48px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    gap:
      "8px",

    border:
      "2px solid rgba(255,255,255,.62)",

    borderRadius:
      "16px",

    backgroundColor:
      "rgba(0,0,0,.86)",

    color:
      "#fff",

    fontSize:
      "14px",

    fontWeight:
      850,

    cursor:
      "pointer",
  },

  sceneHelp: {
    color:
      "rgba(255,255,255,.7)",

    fontSize:
      "10px",

    fontWeight:
      700,
  },

  keyboardHint: {
    margin: 0,

    color:
      "rgba(255,255,255,.68)",

    fontSize:
      "10px",

    fontWeight:
      700,

    textAlign:
      "center",
  },

  disabled: {
    opacity:
      0.45,

    cursor:
      "default",
  },

  manualForm: {
    width:
      "100%",

    maxWidth:
      "580px",

    boxSizing:
      "border-box",

    padding:
      "15px",

    border:
      "3px solid #fff",

    borderRadius:
      "20px",

    backgroundColor:
      "rgba(0,0,0,.94)",
  },

  manualLabel: {
    display:
      "block",

    marginBottom:
      "9px",

    color:
      "#fff",

    fontSize:
      "16px",

    fontWeight:
      850,
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
      "76px",

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

    cursor:
      "pointer",
  },
};