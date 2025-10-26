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
  agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID || "",
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

  // Setup audio routing with BlackHole
  /**
   * BlackHole Audio Routing Setup:
   *
   * This function sets up audio routing so that:
   * 1. ElevenLabs voice output plays through DEFAULT SPEAKERS (user hears it)
   * 2. Same audio is DUPLICATED and routed to BlackHole virtual audio device
   * 3. Pickle app can listen to BlackHole device for lip sync animation
   *
   * Prerequisites:
   * - Install BlackHole: https://github.com/ExistentialAudio/BlackHole
   * - Configure macOS Audio MIDI Setup to create a Multi-Output Device:
   *   a. Open "Audio MIDI Setup" app
   *   b. Click "+" and create "Multi-Output Device"
   *   c. Check BOTH: Built-in Output (speakers) AND BlackHole 2ch
   *   d. This ensures audio plays through speakers AND routes to BlackHole
   *
   * - Configure Pickle app to use BlackHole as audio input source
   *
   * The ElevenLabs WebRTC connection automatically handles audio output.
   * We just need to ensure the system is configured to duplicate it.
   */
  const setupAudioRouting = useCallback(async () => {
    try {
      // Create audio context for routing
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Create destination node for BlackHole routing
      const destination = audioContext.createMediaStreamDestination();
      audioDestinationRef.current = destination;

      // The audio from ElevenLabs will be automatically played through the system's
      // default output device via WebRTC. If you've configured a Multi-Output Device
      // in macOS Audio MIDI Setup that includes both speakers and BlackHole,
      // the audio will be duplicated to both destinations.

      console.log("Audio routing setup complete");
      console.log("✓ ElevenLabs audio will play through default speakers");
      console.log("✓ Audio will also route to BlackHole (if Multi-Output Device is configured)");
      console.log("✓ Pickle can listen to BlackHole for lip sync animation");
      console.log("");
      console.log("⚠️  Make sure you have:");
      console.log("  1. Installed BlackHole (https://github.com/ExistentialAudio/BlackHole)");
      console.log("  2. Created a Multi-Output Device in Audio MIDI Setup");
      console.log("  3. Configured Pickle to use BlackHole as audio input");
    } catch (error) {
      console.error("Error setting up audio routing:", error);
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

