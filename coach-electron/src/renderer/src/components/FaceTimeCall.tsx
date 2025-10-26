import { useCallback, useEffect, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import { Button } from './ui/button';

interface FaceTimeCallProps {
  onEndCall: () => void;
  userInfo?: {
    name: string;
    email: string;
  };
}

const DEFAULT_AGENT = {
  agentId: import.meta.env.VITE_ELEVENLABS_DEFAULT_AGENT_ID || "",
}

export const FaceTimeCall = ({ onEndCall, userInfo }: FaceTimeCallProps) => {
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [userStream, setUserStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pickleAppFound, setPickleAppFound] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const blackHoleStreamRef = useRef<MediaStream | null>(null);

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log("ElevenLabs voice connected");
      setVoiceConnected(true);
    },
    onDisconnect: () => {
      console.log("ElevenLabs voice disconnected");
      setVoiceConnected(false);
    },
    onMessage: (message) => console.log("ElevenLabs message:", message),
    onError: (error) => {
      console.error("ElevenLabs error:", error);
      setVoiceConnected(false);
    },
  });

  // Start ElevenLabs voice conversation with audio routing
  const startVoiceConversation = useCallback(async () => {
    try {
      // Request microphone permissions
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Fetch prompt configuration from Supabase
      let promptConfig;
      if (userInfo?.email) {
        try {
          promptConfig = await window.context.getPromptConfig(userInfo.email);
          console.log("Loaded prompt config from Supabase:", promptConfig);
        } catch (err) {
          console.warn("Failed to fetch prompt config, using default:", err);
        }
      }

      const dynamicVariables = {
        "first-name": userInfo?.name || "User",
        "user-background": userInfo?.email || "",
        "warning-prompt": promptConfig?.prompt || "You are Pickle, a friendly AI coach. Your job is to warn the user about what they should be looking for during this session. Keep your message brief and encouraging.",
      };

      // Start ElevenLabs session with WebRTC for voice
      await conversation.startSession({
        agentId: DEFAULT_AGENT.agentId,
        connectionType: "webrtc",
        dynamicVariables: dynamicVariables,
        onStatusChange: (status) => {
          console.log("ElevenLabs status:", status.status);
          if (status.status === "connected") {
            setVoiceConnected(true);
          }
        },
      });

      console.log("ElevenLabs voice session started");
    } catch (error) {
      console.error("Error starting voice conversation:", error);
      setError(error instanceof Error ? error.message : 'Failed to start voice');
    }
  }, [conversation, userInfo]);

  // Setup audio routing with BlackHole using Web Audio API
  /**
   * BlackHole Audio Routing Setup - UPDATED APPROACH
   *
   * This creates an isolated audio path where:
   * 1. YOUR MICROPHONE → ElevenLabs (Pickle does NOT hear you)
   * 2. ElevenLabs output → Your Speakers + BlackHole (Pickle ONLY hears AI voice)
   *
   * How it works:
   * - We create a Multi-Output Device in macOS that includes:
   *   a. Built-in Output (your speakers)
   *   b. BlackHole 2ch (virtual audio device)
   * - The ElevenLabs WebRTC stream is set to output to this Multi-Output Device
   * - This ensures the AI voice goes to BOTH destinations simultaneously
   * - Pickle listens to BlackHole 2ch as input (receives ONLY AI voice, not your mic)
   *
   * Prerequisites:
   * 1. Install BlackHole: brew install blackhole-2ch
   * 2. Create Multi-Output Device in Audio MIDI Setup:
   *    - Open "Audio MIDI Setup" app
   *    - Click "+" → "Create Multi-Output Device"
   *    - Check: Built-in Output + BlackHole 2ch
   *    - Set Built-in Output as master clock
   * 3. Set this Multi-Output Device as system output during calls
   * 4. Set Pickle input to "BlackHole 2ch"
   */
  const setupAudioRouting = useCallback(async () => {
    try {
      console.log("🎵 Setting up audio routing...");

      // Create audio context
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Request access to BlackHole as an audio output device
      // We'll enumerate devices and try to select BlackHole
      const devices = await navigator.mediaDevices.enumerateDevices();
      const blackHoleDevice = devices.find(device =>
        device.kind === 'audiooutput' &&
        device.label.toLowerCase().includes('blackhole')
      );

      if (blackHoleDevice) {
        console.log("✓ Found BlackHole device:", blackHoleDevice.label);
      } else {
        console.warn("⚠️  BlackHole device not found. Make sure it's installed.");
        console.warn("   Install with: brew install blackhole-2ch");
      }

      // Create a destination node that we can route to BlackHole
      const destination = audioContext.createMediaStreamDestination();
      audioDestinationRef.current = destination;
      blackHoleStreamRef.current = destination.stream;

      console.log("✓ Audio routing initialized");
      console.log("✓ ElevenLabs output will route to Multi-Output Device");
      console.log("✓ Audio plays through: Speakers + BlackHole");
      console.log("✓ Pickle receives audio from: BlackHole only (not your microphone)");
      console.log("");
      console.log("📋 Setup checklist:");
      console.log("  [1] BlackHole installed: brew install blackhole-2ch");
      console.log("  [2] Multi-Output Device created (Speakers + BlackHole)");
      console.log("  [3] System audio output set to Multi-Output Device");
      console.log("  [4] Pickle audio input set to BlackHole 2ch");

      return audioContext;
    } catch (error) {
      console.error("❌ Error setting up audio routing:", error);
      throw error;
    }
  }, []);

  // Check audio device setup and provide helpful feedback
  const checkAudioSetup = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
      const audioInputs = devices.filter(d => d.kind === 'audioinput');

      const hasBlackHole = devices.some(d =>
        d.label.toLowerCase().includes('blackhole')
      );

      const hasMultiOutput = devices.some(d =>
        d.label.toLowerCase().includes('multi-output')
      );

      console.log("\n🔊 Audio Device Check:");
      console.log("=".repeat(50));
      console.log("Available Output Devices:");
      audioOutputs.forEach((device, i) => {
        const indicator = device.label.toLowerCase().includes('blackhole') ? '✓' : ' ';
        console.log(`  [${indicator}] ${i + 1}. ${device.label || 'Unknown Device'}`);
      });

      console.log("\nAvailable Input Devices:");
      audioInputs.forEach((device, i) => {
        const indicator = device.label.toLowerCase().includes('blackhole') ? '✓' : ' ';
        console.log(`  [${indicator}] ${i + 1}. ${device.label || 'Unknown Device'}`);
      });

      console.log("\n📊 Setup Status:");
      console.log(`  BlackHole Detected: ${hasBlackHole ? '✓ YES' : '✗ NO - Install with: brew install blackhole-2ch'}`);
      console.log(`  Multi-Output Device: ${hasMultiOutput ? '✓ YES' : '⚠️  NOT FOUND - Create in Audio MIDI Setup'}`);
      console.log("=".repeat(50) + "\n");

      if (!hasBlackHole) {
        setError("BlackHole not detected. Please install: brew install blackhole-2ch");
      }

      return { hasBlackHole, hasMultiOutput };
    } catch (error) {
      console.error("Error checking audio setup:", error);
      return { hasBlackHole: false, hasMultiOutput: false };
    }
  }, []);

  // Get audio output volume for Pickle lip sync animation
  // This can be read by Pickle app through BlackHole audio input
  const getOutputVolume = useCallback(() => {
    const rawValue = conversation.getOutputVolume?.() ?? 0;
    // Normalize and amplify the volume for better animation
    return Math.min(1.0, Math.pow(rawValue, 0.5) * 2.5);
  }, [conversation]);

  // Log volume periodically for debugging
  useEffect(() => {
    if (!voiceConnected) return;

    const volumeInterval = setInterval(() => {
      const volume = getOutputVolume();
      if (volume > 0.1) {
        console.log("ElevenLabs output volume:", volume.toFixed(2));
      }
    }, 100);

    return () => clearInterval(volumeInterval);
  }, [voiceConnected, getOutputVolume]);

  useEffect(() => {
    let mounted = true;

    // Notify main process that FaceTime call is active
    window.context.setFaceTimeCallActive(true);

    const startCall = async () => {
      try {
        // Get desktop sources from main process
        const sources = await window.context.getDesktopSources();

        if (!mounted) return;

        // Find the Pickle app
        const pickleSource = sources.find((source: { name: string }) =>
          source.name.toLowerCase().includes('pickle')
        );

        if (pickleSource) {
          setPickleAppFound(true);

          // Capture the Pickle app window
          const screenStreamResult = await (navigator.mediaDevices as any).getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: pickleSource.id,
              },
            },
          });

          if (!mounted) {
            screenStreamResult.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            return;
          }

          setScreenStream(screenStreamResult);
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = screenStreamResult;
          }
        } else {
          // If Pickle app not found, just capture the entire screen
          console.warn('Pickle app not found, capturing first available source');
          if (sources.length > 0) {
            const firstSource = sources[0];
            const screenStreamResult = await (navigator.mediaDevices as any).getUserMedia({
              audio: false,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: firstSource.id,
                },
              },
            });

            if (!mounted) {
              screenStreamResult.getTracks().forEach((track: MediaStreamTrack) => track.stop());
              return;
            }

            setScreenStream(screenStreamResult);
            if (screenVideoRef.current) {
              screenVideoRef.current.srcObject = screenStreamResult;
            }
          }
        }

        // Get user's webcam
        const userStreamResult = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (!mounted) {
          userStreamResult.getTracks().forEach((track) => track.stop());
          return;
        }

        setUserStream(userStreamResult);
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = userStreamResult;
        }

        // Check audio device setup first
        await checkAudioSetup();

        // Setup audio routing for BlackHole
        await setupAudioRouting();

        // Start ElevenLabs voice conversation
        await startVoiceConversation();

        setIsLoading(false);
      } catch (err) {
        console.error('Error starting call:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to start call');
          setIsLoading(false);
        }
      }
    };

    startCall();

    // Cleanup function
    return () => {
      mounted = false;

      // Notify main process that FaceTime call is no longer active
      window.context.setFaceTimeCallActive(false);

      // End ElevenLabs session
      if (conversation) {
        conversation.endSession();
      }

      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      // Stop all tracks
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
      }
      if (userStream) {
        userStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleEndCall = () => {
    // Notify main process that FaceTime call is no longer active
    window.context.setFaceTimeCallActive(false);

    // End ElevenLabs voice session
    conversation.endSession();
    console.log("ElevenLabs session ended");

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop all streams
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }
    if (userStream) {
      userStream.getTracks().forEach((track) => track.stop());
    }

    onEndCall();
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Error: {error}</p>
          <Button onClick={onEndCall} variant="destructive">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      {/* Screen capture - main content */}
      <video
        ref={screenVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />

      {/* User webcam - picture-in-picture (bottom-right) */}
      <div className="absolute bottom-6 right-6 w-[280px] h-[210px] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-black">
        <video
          ref={userVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <p className="text-white text-lg">Starting call...</p>
        </div>
      )}

      {/* Status indicator */}
      {!pickleAppFound && !isLoading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500/80 text-black px-4 py-2 rounded-lg text-sm">
          Pickle app not found - showing alternative source
        </div>
      )}

      {/* End call button */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
        <Button
          onClick={handleEndCall}
          size="lg"
          className="bg-red-500 hover:bg-red-600 rounded-full px-8 py-6 text-white font-semibold shadow-lg"
        >
          End Call
        </Button>
      </div>

      {/* Call info */}
      <div className="absolute top-6 left-6">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-3">
          <p className="text-white font-semibold">Coach - Pickle</p>
          <p className="text-white/70 text-sm">FaceTime Call</p>
          {voiceConnected && (
            <div className="flex items-center gap-2 mt-1">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <p className="text-green-400 text-xs">Voice Connected</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

