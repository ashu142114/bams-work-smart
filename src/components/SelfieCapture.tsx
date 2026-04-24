import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
}

export function SelfieCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera access denied");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const snap = async () => {
    if (!videoRef.current) return;
    setBusy(true);
    const video = videoRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.85,
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-base font-semibold">Take selfie</h2>
        <button onClick={onCancel} className="p-2 rounded-full hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        {error ? (
          <div className="text-center text-white/80 max-w-xs">
            <p className="text-sm">{error}</p>
            <p className="text-xs mt-2 opacity-70">Please allow camera access in your browser settings.</p>
          </div>
        ) : (
          <div className="relative w-full max-w-sm aspect-square rounded-3xl overflow-hidden bg-black/40 ring-1 ring-white/10">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center text-white/80">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-6 safe-bottom flex justify-center">
        <Button
          onClick={snap}
          disabled={!ready || busy || !!error}
          className="h-16 w-16 rounded-full p-0 bg-white text-black hover:bg-white/90"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
        </Button>
      </div>
    </div>
  );
}
