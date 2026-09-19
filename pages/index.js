import Head from "next/head";

import {
  useEffect,
  useRef,
  useState,
} from "react";

const INTRO_TEXT =
  "What's This Photo. Your surroundings, spoken. " +
  "Hold the ask button or Space and ask a question now. " +
  "Release when you're done. " +
  "Tap without speaking for a description. " +
  "For full instructions, say instructions anytime.";

const FULL_INSTRUCTIONS_TEXT =
  "What's This Photo helps you understand what your camera sees. " +
  "Hold the ask button while asking a question, then release when you're done. " +
  "On the website, you can hold Space instead. " +
  "Tap the ask button without speaking for an automatic description. " +
  "On the website, a quick press of Space without speaking does the same. " +
  "A high tone means I'm listening. " +
  "A low tone means you've released the button and your input was submitted. " +
  "Two rising notes mean I heard a question, and I'll tell you exactly what I heard. " +
  "Three low pulses mean I did not hear a question, so I'll describe the image instead. " +
  "Three rising notes mean your answer is ready. " +
  "Falling tones mean something went wrong. " +
  "Say describe scene for an overview of your surroundings. " +
  "Say repeat to hear the last answer again. " +
  "Say instructions to hear these full instructions again. " +
  "Visual answers can be incomplete or wrong, so don't rely on What's This Photo alone for safety-critical decisions.";

export default function Home() {
  const videoRef =
    useRef(null);

  const canvasRef =
    useRef(null);

  const recognitionRef =
    useRef(null);

  const currentAudioRef =
    useRef(null);

  const audioContextRef =
    useRef(null);

  const listeningRef =
    useRef(false);

  const thinkingRef =
    useRef(false);

  const cameraReadyRef =
    useRef(false);

  const audioUnlockedRef =
    useRef(false);

  const answerRef =
    useRef("");

  const lastAudioBase64Ref =
    useRef(null);

  const interactionActiveRef =
    useRef(false);

  const stopRequestedRef =
    useRef(false);

  const waitingForRecognitionRef =
    useRef(false);

  const recognitionHadResultRef =
    useRef(false);

  const noSpeechHandledRef =
    useRef(false);

  const submittedCuePlayedRef =
    useRef(false);

  const suppressPrimaryClickRef =
    useRef(false);

  const fallbackSpaceDownRef =
    useRef(false);

  const speechCacheRef =
    useRef(
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
    "Starting"
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

  useEffect(() => {
    answerRef.current =
      answer;
  }, [answer]);

  function wait(ms) {
    return new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          ms
        )
    );
  }

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

    if (
      context.state !==
      "running"
    ) {
      return null;
    }

    return context;
  }

  // ============================================================
  // SOUND DESIGN
  // ============================================================

  async function playNote(
    frequency,
    duration = 80,
    volume = 0.22,
    type = "sine"
  ) {
    try {
      const context =
        await getAudioContext();

      if (!context) {
        return;
      }

      return new Promise(
        (resolve) => {
          const oscillator =
            context.createOscillator();

          const gain =
            context.createGain();

          oscillator.type =
            type;

          oscillator.frequency.setValueAtTime(
            frequency,
            context.currentTime
          );

          oscillator.connect(
            gain
          );

          gain.connect(
            context.destination
          );

          const now =
            context.currentTime;

          const end =
            now +
            duration / 1000;

          gain.gain.setValueAtTime(
            0.0001,
            now
          );

          gain.gain.exponentialRampToValueAtTime(
            volume,
            now + 0.008
          );

          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            end
          );

          oscillator.onended =
            () => resolve();

          oscillator.start(
            now
          );

          oscillator.stop(
            end
          );
        }
      );
    } catch (error) {
      console.error(
        "Tone error:",
        error
      );
    }
  }

  async function playSequence(
    notes
  ) {
    for (
      let index = 0;
      index < notes.length;
      index += 1
    ) {
      const note =
        notes[index];

      await playNote(
        note.frequency,
        note.duration,
        note.volume,
        note.type ||
          "sine"
      );

      if (
        note.gap
      ) {
        await wait(
          note.gap
        );
      }
    }
  }

  // Gentle two-note opening.
  async function startupCue() {
    await playSequence([
      {
        frequency:
          392.0,
        duration: 70,
        volume: 0.17,
        gap: 28,
      },
      {
        frequency:
          523.25,
        duration: 100,
        volume: 0.19,
      },
    ]);
  }

  // One crisp high note:
  // microphone is actively listening.
  async function listeningCue() {
    await playNote(
      880.0,
      75,
      0.24
    );
  }

  // One short lower note:
  // button released / input submitted.
  async function submittedCue() {
    await playNote(
      440.0,
      70,
      0.22
    );
  }

  // Two rising notes:
  // speech was recognized.
  async function heardCue() {
    await playSequence([
      {
        frequency:
          587.33,
        duration: 50,
        volume: 0.19,
        gap: 18,
      },
      {
        frequency:
          783.99,
        duration: 70,
        volume: 0.21,
      },
    ]);
  }

  // Three low pulses:
  // no spoken question was heard.
  async function noSpeechCue() {
    await playSequence([
      {
        frequency:
          349.23,
        duration: 48,
        volume: 0.18,
        gap: 28,
      },
      {
        frequency:
          349.23,
        duration: 48,
        volume: 0.18,
        gap: 28,
      },
      {
        frequency:
          349.23,
        duration: 75,
        volume: 0.19,
      },
    ]);
  }

  // Quick major arpeggio:
  // answer is ready to be spoken.
  async function answerReadyCue() {
    await playSequence([
      {
        frequency:
          523.25,
        duration: 42,
        volume: 0.17,
        gap: 14,
      },
      {
        frequency:
          659.25,
        duration: 42,
        volume: 0.18,
        gap: 14,
      },
      {
        frequency:
          783.99,
        duration: 65,
        volume: 0.2,
      },
    ]);
  }

  // Descending notes:
  // an actual system error occurred.
  async function errorCue() {
    await playSequence([
      {
        frequency:
          659.25,
        duration: 65,
        volume: 0.2,
        gap: 24,
      },
      {
        frequency:
          493.88,
        duration: 75,
        volume: 0.21,
        gap: 24,
      },
      {
        frequency:
          329.63,
        duration: 110,
        volume: 0.22,
      },
    ]);

    vibrate([
      180,
      80,
      260,
    ]);
  }

  function vibrate(
    pattern
  ) {
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

  function browserSpeak(
    text
  ) {
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
        if (
          !audioBase64
        ) {
          browserSpeak(
            fallbackText
          ).then(
            resolve
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
              ).then(
                resolve
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
                ).then(
                  resolve
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
          ).then(
            resolve
          );
        }
      }
    );
  }

  async function speak(
    text
  ) {
    if (!text) {
      return;
    }

    stopCurrentAudio();

    const cachedAudio =
      speechCacheRef.current.get(
        text
      );

    if (
      cachedAudio
    ) {
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
            method:
              "POST",

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
  // INTRO + FULL INSTRUCTIONS
  // ============================================================

  async function speakWelcome() {
    await startupCue();

    await wait(
      60
    );

    await speak(
      INTRO_TEXT
    );
  }

  async function playInstructions() {
    audioUnlockedRef.current =
      true;

    await speak(
      FULL_INSTRUCTIONS_TEXT
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

        cameraReadyRef.current =
          true;

        setCameraReady(
          true
        );

        setStatus(
          "Ready"
        );

        setTimeout(
          () => {
            if (
              !audioUnlockedRef.current
            ) {
              speakWelcome();
            }
          },
          450
        );
      } catch (error) {
        console.error(
          "Camera error:",
          error
        );

        cameraReadyRef.current =
          false;

        setCameraReady(
          false
        );

        setStatus(
          "Camera unavailable"
        );

        errorCue();
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

    if (
      !imageBase64
    ) {
      setStatus(
        "Camera could not capture"
      );

      await errorCue();

      await wait(
        80
      );

      speak(
        "I couldn't capture an image. Try again."
      );

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

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Request failed"
        );
      }

      const responseText =
        data.answer ||
        "I couldn't determine an answer.";

      answerRef.current =
        responseText;

      setAnswer(
        responseText
      );

      lastAudioBase64Ref.current =
        data.audioBase64 ||
        null;

      if (
        feedbackPromise
      ) {
        try {
          await feedbackPromise;
        } catch {}
      }

      thinkingRef.current =
        false;

      setThinking(
        false
      );

      setStatus(
        "Ready"
      );

      await answerReadyCue();

      vibrate([
        45,
        30,
        75,
      ]);

      await wait(
        45
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

      thinkingRef.current =
        false;

      setThinking(
        false
      );

      setStatus(
        "Something went wrong"
      );

      await errorCue();

      await wait(
        80
      );

      speak(
        "Something went wrong. Try again."
      );
    }
  }

  // ============================================================
  // NORMAL SPOKEN QUESTION
  // ============================================================

  function submitRecognizedQuestion(
    question
  ) {
    const cleanQuestion =
      question?.trim();

    if (
      !cleanQuestion
    ) {
      submitImageOnly();

      return;
    }

    setTranscript(
      `Heard: ${cleanQuestion}`
    );

    setStatus(
      "Question heard"
    );

    const feedbackPromise =
      (async () => {
        await heardCue();

        await wait(
          35
        );

        await speak(
          `Heard: ${cleanQuestion}`
        );
      })();

    askAboutImage(
      cleanQuestion,
      `Heard: ${cleanQuestion}`,
      "question",
      feedbackPromise
    );
  }

  // ============================================================
  // NO SPEECH = AUTOMATIC DESCRIPTION
  // ============================================================

  function submitImageOnly() {
    if (
      thinkingRef.current ||
      !cameraReadyRef.current
    ) {
      return;
    }

    audioUnlockedRef.current =
      true;

    setTranscript(
      "No question heard"
    );

    setStatus(
      "Describing"
    );

    const feedbackPromise =
      (async () => {
        await noSpeechCue();

        await wait(
          35
        );

        await speak(
          "No question heard. Describing."
        );
      })();

    askAboutImage(
      "",
      "No question heard",
      "image-only",
      feedbackPromise
    );
  }

  // ============================================================
  // DESCRIBE SCENE COMMAND
  // ============================================================

  function describeScene(
    feedbackPromise = null
  ) {
    if (
      thinkingRef.current ||
      !cameraReadyRef.current
    ) {
      return;
    }

    setTranscript(
      "Describe scene"
    );

    askAboutImage(
      "",
      "Describe scene",
      "scene",
      feedbackPromise
    );
  }

  // ============================================================
  // REPEAT
  // ============================================================

  function repeatAnswer() {
    const previousAnswer =
      answerRef.current;

    const previousAudio =
      lastAudioBase64Ref.current;

    if (
      !previousAnswer
    ) {
      noSpeechCue();

      setTimeout(
        () => {
          speak(
            "There isn't a previous answer yet."
          );
        },
        220
      );

      return;
    }

    if (
      previousAudio
    ) {
      playElevenLabsAudio(
        previousAudio,
        previousAnswer
      );
    } else {
      speak(
        previousAnswer
      );
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

  async function handleSpokenInput(
    rawQuestion
  ) {
    const question =
      rawQuestion?.trim();

    if (
      !question
    ) {
      submitImageOnly();

      return;
    }

    const command =
      normalizeCommand(
        question
      );

    const describeCommands = [
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
      const feedbackPromise =
        heardCue();

      describeScene(
        feedbackPromise
      );

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
      "again",
    ];

    if (
      repeatCommands.includes(
        command
      )
    ) {
      await heardCue();

      await wait(
        35
      );

      repeatAnswer();

      return;
    }

    const instructionCommands = [
      "instructions",
      "instruction",
      "give me instructions",
      "give me the instructions",
      "tell me the instructions",
      "what are the instructions",
      "how do i use this",
      "how does this work",

      // Old aliases remain supported,
      // but are no longer taught.
      "repeat instructions",
      "repeat the instructions",
    ];

    if (
      instructionCommands.includes(
        command
      )
    ) {
      await heardCue();

      await wait(
        35
      );

      playInstructions();

      return;
    }

    submitRecognizedQuestion(
      question
    );
  }

  // ============================================================
  // NO-SPEECH OUTCOME
  // ============================================================

  function finalizeNoSpeech() {
    if (
      noSpeechHandledRef.current ||
      recognitionHadResultRef.current ||
      !waitingForRecognitionRef.current
    ) {
      return;
    }

    noSpeechHandledRef.current =
      true;

    waitingForRecognitionRef.current =
      false;

    interactionActiveRef.current =
      false;

    listeningRef.current =
      false;

    setListening(
      false
    );

    submitImageOnly();
  }

  // ============================================================
  // SUBMIT CURRENT MICROPHONE SESSION
  // ============================================================

  function submitRecognitionStop() {
    if (
      !recognitionRef.current
    ) {
      return;
    }

    if (
      !submittedCuePlayedRef.current
    ) {
      submittedCuePlayedRef.current =
        true;

      submittedCue();

      vibrate([
        35,
        25,
        35,
      ]);
    }

    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.error(
        "Could not stop recognition:",
        error
      );

      finalizeNoSpeech();
    }
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

        listeningCue();

        vibrate(
          45
        );

        if (
          stopRequestedRef.current
        ) {
          setTimeout(
            () => {
              submitRecognitionStop();
            },
            90
          );
        }
      };

    recognition.onresult =
      (event) => {
        const question =
          event
            .results?.[0]?.[0]
            ?.transcript?.trim();

        recognitionHadResultRef.current =
          Boolean(
            question
          );

        waitingForRecognitionRef.current =
          false;

        interactionActiveRef.current =
          false;

        listeningRef.current =
          false;

        setListening(
          false
        );

        if (
          question
        ) {
          handleSpokenInput(
            question
          );
        } else {
          finalizeNoSpeech();
        }
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
          "no-speech"
        ) {
          finalizeNoSpeech();

          return;
        }

        if (
          event.error ===
          "aborted"
        ) {
          if (
            stopRequestedRef.current
          ) {
            finalizeNoSpeech();
          }

          return;
        }

        waitingForRecognitionRef.current =
          false;

        interactionActiveRef.current =
          false;

        if (
          event.error ===
          "not-allowed"
        ) {
          setStatus(
            "Microphone unavailable"
          );

          errorCue();

          setTimeout(
            () => {
              speak(
                "Microphone access is off. You can still activate the ask button without speaking for a description."
              );
            },
            300
          );

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

          setTimeout(
            () => {
              speak(
                "I can't access the microphone."
              );
            },
            300
          );

          return;
        }

        setStatus(
          "Microphone error"
        );

        errorCue();

        setTimeout(
          () => {
            speak(
              "I couldn't understand the microphone input. Try again."
            );
          },
          300
        );
      };

    recognition.onend =
      () => {
        listeningRef.current =
          false;

        setListening(
          false
        );

        interactionActiveRef.current =
          false;

        if (
          waitingForRecognitionRef.current &&
          !recognitionHadResultRef.current
        ) {
          setTimeout(
            () => {
              finalizeNoSpeech();
            },
            40
          );
        }
      };

    recognitionRef.current =
      recognition;

    return () => {
      try {
        recognition.abort();
      } catch {}
    };
  }, []);

  // ============================================================
  // START LISTENING
  // ============================================================

  async function startListening() {
    audioUnlockedRef.current =
      true;

    if (
      thinkingRef.current
    ) {
      await errorCue();

      return;
    }

    if (
      !cameraReadyRef.current
    ) {
      await errorCue();

      await wait(
        80
      );

      speak(
        "The camera is still starting."
      );

      return;
    }

    if (
      !recognitionRef.current
    ) {
      await errorCue();

      await wait(
        80
      );

      speak(
        "Voice recognition isn't available."
      );

      return;
    }

    if (
      interactionActiveRef.current ||
      listeningRef.current
    ) {
      return;
    }

    stopCurrentAudio();

    interactionActiveRef.current =
      true;

    stopRequestedRef.current =
      false;

    waitingForRecognitionRef.current =
      true;

    recognitionHadResultRef.current =
      false;

    noSpeechHandledRef.current =
      false;

    submittedCuePlayedRef.current =
      false;

    setTranscript("");

    setStatus(
      "Starting microphone"
    );

    await getAudioContext();

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error(
        "Could not start recognition:",
        error
      );

      interactionActiveRef.current =
        false;

      waitingForRecognitionRef.current =
        false;

      listeningRef.current =
        false;

      setListening(
        false
      );

      await errorCue();

      speak(
        "I couldn't start listening. Try again."
      );
    }
  }

  // ============================================================
  // RELEASE
  // ============================================================

  function stopListening() {
    if (
      !interactionActiveRef.current &&
      !listeningRef.current
    ) {
      return;
    }

    interactionActiveRef.current =
      false;

    stopRequestedRef.current =
      true;

    setStatus(
      "Processing"
    );

    if (
      listeningRef.current
    ) {
      submitRecognitionStop();
    }
  }

  // ============================================================
  // SPACE BAR
  // ============================================================

  useEffect(() => {
    function isInteractiveTarget(
      target
    ) {
      if (!target) {
        return false;
      }

      const tag =
        target.tagName;

      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      ) {
        return true;
      }

      if (
        typeof target.closest ===
        "function"
      ) {
        return Boolean(
          target.closest(
            "button, a, [role='button']"
          )
        );
      }

      return false;
    }

    function keyDown(
      event
    ) {
      if (
        event.code !==
          "Space" ||
        event.repeat ||
        isInteractiveTarget(
          event.target
        )
      ) {
        return;
      }

      event.preventDefault();

      if (
        speechSupported
      ) {
        startListening();
      } else {
        fallbackSpaceDownRef.current =
          true;
      }
    }

    function keyUp(
      event
    ) {
      if (
        event.code !==
          "Space" ||
        isInteractiveTarget(
          event.target
        )
      ) {
        return;
      }

      event.preventDefault();

      if (
        speechSupported
      ) {
        stopListening();
      } else if (
        fallbackSpaceDownRef.current
      ) {
        fallbackSpaceDownRef.current =
          false;

        submitImageOnly();
      }
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
  }, [
    speechSupported,
  ]);

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

    submitRecognizedQuestion(
      question
    );
  }

  // ============================================================
  // PRIMARY BUTTON
  // ============================================================

  function scheduleClickReset() {
    setTimeout(
      () => {
        suppressPrimaryClickRef.current =
          false;
      },
      500
    );
  }

  function handlePrimaryPointerDown(
    event
  ) {
    if (
      !speechSupported
    ) {
      return;
    }

    event.preventDefault();

    suppressPrimaryClickRef.current =
      true;

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    } catch {}

    startListening();
  }

  function handlePrimaryPointerUp(
    event
  ) {
    if (
      !speechSupported
    ) {
      return;
    }

    event.preventDefault();

    stopListening();

    scheduleClickReset();
  }

  function handlePrimaryPointerCancel(
    event
  ) {
    if (
      !speechSupported
    ) {
      return;
    }

    event.preventDefault();

    stopListening();

    scheduleClickReset();
  }

  function handlePrimaryKeyDown(
    event
  ) {
    if (
      !speechSupported ||
      event.repeat
    ) {
      return;
    }

    if (
      event.code !==
        "Space" &&
      event.code !==
        "Enter"
    ) {
      return;
    }

    event.preventDefault();

    suppressPrimaryClickRef.current =
      true;

    startListening();
  }

  function handlePrimaryKeyUp(
    event
  ) {
    if (
      !speechSupported
    ) {
      return;
    }

    if (
      event.code !==
        "Space" &&
      event.code !==
        "Enter"
    ) {
      return;
    }

    event.preventDefault();

    stopListening();

    scheduleClickReset();
  }

  function handlePrimaryClick() {
    if (
      suppressPrimaryClickRef.current
    ) {
      suppressPrimaryClickRef.current =
        false;

      return;
    }

    submitImageOnly();
  }

  // ============================================================
  // STATUS
  // ============================================================

  const statusTitle =
    listening
      ? "Listening"
      : thinking
      ? "Looking"
      : status;

  const statusMessage =
    listening
      ? "Ask your question. Release when finished."
      : thinking
      ? "Checking what the camera sees."
      : status ===
        "Camera unavailable"
      ? "Camera access is required."
      : status ===
        "Microphone unavailable"
      ? "Activate the ask button without speaking for a description."
      : status ===
        "Something went wrong"
      ? "Try again."
      : cameraReady
      ? "Hold to ask. Tap to describe."
      : "Getting the camera ready.";

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <>
      <Head>
        <title>
          What&apos;s This Photo
        </title>

        <meta
          name="description"
          content="What's This Photo — Your surroundings, spoken."
        />
      </Head>

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
        </header>

        <section
          style={
            styles.centerStatus
          }
          aria-hidden="true"
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
          <p
            id="ask-button-help"
            style={
              styles.srOnly
            }
          >
            Hold the ask button
            while speaking and
            release when finished.
            Activate it without
            speaking for an automatic
            description. You can also
            hold Space to ask.
          </p>

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

          <button
            type="button"
            disabled={
              thinking ||
              !cameraReady
            }
            aria-describedby="ask-button-help"
            aria-label={
              listening
                ? "Listening. Release to submit your question."
                : speechSupported
                ? "Ask. Hold while speaking, or activate without speaking for a description."
                : "Describe what the camera sees."
            }
            style={{
              ...styles.primaryButton,

              ...(listening
                ? styles.primaryButtonListening
                : {}),

              ...((thinking ||
              !cameraReady)
                ? styles.disabled
                : {}),
            }}
            onPointerDown={
              handlePrimaryPointerDown
            }
            onPointerUp={
              handlePrimaryPointerUp
            }
            onPointerCancel={
              handlePrimaryPointerCancel
            }
            onKeyDown={
              handlePrimaryKeyDown
            }
            onKeyUp={
              handlePrimaryKeyUp
            }
            onClick={
              handlePrimaryClick
            }
          >
            <span
              style={
                styles.primaryIcon
              }
              aria-hidden="true"
            >
              {listening
                ? "●"
                : "◎"}
            </span>

            <span>
              <span
                style={
                  styles.primaryTitle
                }
              >
                {listening
                  ? "Release When Finished"
                  : thinking
                  ? "Looking..."
                  : speechSupported
                  ? "Hold to Ask"
                  : "Describe View"}
              </span>

              <span
                style={
                  styles.primaryHelp
                }
              >
                {listening
                  ? "Listening now"
                  : speechSupported
                  ? "Tap without speaking to describe"
                  : "No speaking required"}
              </span>
            </span>
          </button>

          {!speechSupported && (
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
                Type a question
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
                  placeholder="Where is the chair?"
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
              aria-label="Hear full instructions"
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
                  Say “instructions”
                </span>
              </span>
            </button>
          </div>

          <p
            style={
              styles.voiceHint
            }
          >
            “describe scene” •
            “repeat” •
            “instructions”
          </p>

          <p
            style={
              styles.keyboardHint
            }
          >
            Space: hold to ask •
            tap to describe
          </p>
        </section>
      </main>
    </>
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
      "linear-gradient(to bottom, rgba(0,0,0,.9) 0%, rgba(0,0,0,.24) 36%, rgba(0,0,0,.46) 56%, rgba(0,0,0,.99) 100%)",

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

    padding:
      "max(23px, env(safe-area-inset-top)) 19px 18px",

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
      1,

    letterSpacing:
      "-1.4px",

    textShadow:
      "0 3px 20px rgba(0,0,0,.75)",
  },

  tagline: {
    margin:
      "8px 0 0",

    color:
      "#fff",

    fontSize:
      "15px",

    fontWeight:
      700,

    textShadow:
      "0 2px 14px rgba(0,0,0,.9)",
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
      "370px",

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
      "9px",

    padding:
      "14px 14px max(17px, env(safe-area-inset-bottom))",
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
      "rgba(255,255,255,.8)",

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

  primaryButton: {
    width:
      "100%",

    maxWidth:
      "580px",

    minHeight:
      "116px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    gap:
      "18px",

    boxSizing:
      "border-box",

    padding:
      "17px 22px",

    border:
      "5px solid #fff",

    borderRadius:
      "28px",

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
      "0 16px 42px rgba(0,0,0,.58)",
  },

  primaryButtonListening: {
    backgroundColor:
      "#111",

    color:
      "#fff",

    transform:
      "scale(.985)",
  },

  primaryIcon: {
    width:
      "58px",

    height:
      "58px",

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
      "27px",
  },

  primaryTitle: {
    display:
      "block",

    fontSize:
      "25px",

    fontWeight:
      900,

    lineHeight:
      1.05,

    textAlign:
      "left",
  },

  primaryHelp: {
    display:
      "block",

    marginTop:
      "6px",

    fontSize:
      "14px",

    fontWeight:
      700,

    opacity:
      0.72,

    textAlign:
      "left",
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
      "9px",
  },

  secondaryButton: {
    minHeight:
      "68px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "flex-start",

    gap:
      "10px",

    padding:
      "10px 13px",

    border:
      "2px solid rgba(255,255,255,.85)",

    borderRadius:
      "17px",

    backgroundColor:
      "rgba(0,0,0,.92)",

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
      "27px",

    textAlign:
      "center",

    fontSize:
      "22px",

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
      "rgba(255,255,255,.76)",

    fontSize:
      "10px",

    fontWeight:
      700,

    lineHeight:
      1.2,
  },

  voiceHint: {
    margin:
      "2px 0 0",

    color:
      "rgba(255,255,255,.8)",

    fontSize:
      "11px",

    fontWeight:
      700,

    textAlign:
      "center",
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

  srOnly: {
    position:
      "absolute",

    width:
      "1px",

    height:
      "1px",

    padding: 0,

    margin:
      "-1px",

    overflow:
      "hidden",

    clip:
      "rect(0, 0, 0, 0)",

    whiteSpace:
      "nowrap",

    border: 0,
  },
};