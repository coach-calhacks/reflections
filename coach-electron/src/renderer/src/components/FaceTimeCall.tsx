import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';

interface FaceTimeCallProps {
  onEndCall: () => void;
}

export const FaceTimeCall = ({ onEndCall }: FaceTimeCallProps) => {
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [userStream, setUserStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pickleAppFound, setPickleAppFound] = useState(false);

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
        const pickleSource = sources.find((source) =>
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
          <p className="text-white font-semibold">Coach</p>
          <p className="text-white/70 text-sm">FaceTime Call</p>
        </div>
      </div>
    </div>
  );
};

