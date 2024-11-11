/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { RealtimeClient } from "@openai/realtime-api-beta";
import { ItemType } from "@openai/realtime-api-beta/dist/lib/client.js";
import { WavRecorder, WavStreamPlayer } from "../lib/wavtools/index.js";
import { instructions } from "../utils/conversation_config.js";
import { WavRenderer } from "../utils/wav_renderer";
import { X, Zap } from "react-feather";

interface RealtimeEvent {
  time: string;
  source: "client" | "server";
  count?: number;
  event: { [key: string]: any };
}

export default function ConsolePage() {
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient({
      url:
        process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || "http://localhost:8081",
    })
  );

  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [, setMemoryKv] = useState<{ [key: string]: any }>({});

  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    await wavRecorder.begin();
    await wavStreamPlayer.connect();
    await client.connect();
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello!`,
      },
    ]);

    client.updateSession({
      turn_detection: { type: "server_vad" },
      voice: "shimmer",
    });

    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  }, []);

  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);

  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll("[data-conversation-content]")
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width =
              clientCanvas.offsetWidth * window.devicePixelRatio;
            clientCanvas.height =
              clientCanvas.offsetHeight * window.devicePixelRatio;
          }
          clientCtx = clientCtx || clientCanvas.getContext("2d");
          if (clientCtx) {
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies("voice")
              : { values: new Float32Array([0]) };
            WavRenderer.drawModernWave(
              clientCanvas,
              clientCtx,
              result.values,
              "#3b82f6"
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width =
              serverCanvas.offsetWidth * window.devicePixelRatio;
            serverCanvas.height =
              serverCanvas.offsetHeight * window.devicePixelRatio;
          }
          serverCtx = serverCtx || serverCanvas.getContext("2d");
          if (serverCtx) {
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies("voice")
              : { values: new Float32Array([0]) };
            WavRenderer.drawModernWave(
              serverCanvas,
              serverCtx,
              result.values,
              "#10b981"
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  useEffect(() => {
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    client.updateSession({ instructions: instructions });
    client.updateSession({ input_audio_transcription: { model: "whisper-1" } });

    client.addTool(
      {
        name: "set_memory",
        description: "Saves important data about the user into memory.",
        parameters: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description:
                "The key of the memory value. Always use lowercase and underscores, no other characters.",
            },
            value: {
              type: "string",
              description: "Value can be anything represented as a string",
            },
          },
          required: ["key", "value"],
        },
      },
      async ({ key, value }: { [key: string]: any }) => {
        setMemoryKv((memoryKv) => {
          const newKv = { ...memoryKv };
          newKv[key] = value;
          return newKv;
        });
        return { ok: true };
      }
    );

    client.on("realtime.event", (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });
    client.on("error", (event: any) => console.error(event));
    client.on("conversation.interrupted", async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on("conversation.updated", async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === "completed" && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      client.reset();
    };
  }, []);

  return (
    <div data-component="ConsolePage" className="h-screen w-screen bg-gray-900">
      <div className="relative h-full">
        {/* Canvas Container */}
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="w-full max-w-5xl h-64 flex gap-8">
            <div className="flex-1 relative overflow-hidden rounded-2xl bg-gray-800/20 backdrop-blur-lg">
              <canvas ref={clientCanvasRef} className="w-full h-full" />
            </div>
            <div className="flex-1 relative overflow-hidden rounded-2xl bg-gray-800/20 backdrop-blur-lg">
              <canvas ref={serverCanvasRef} className="w-full h-full" />
            </div>
          </div>
        </div>

        {/* Button Container */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <button
            onClick={isConnected ? disconnectConversation : connectConversation}
            className={`
              px-6 py-3 rounded-full font-semibold
              transform transition-all duration-300
              hover:scale-105 active:scale-95
              flex items-center gap-2
              ${
                isConnected
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }
              shadow-lg hover:shadow-xl
            `}
          >
            {!isConnected && <Zap className="w-5 h-5 animate-pulse" />}
            {isConnected ? "Disconnect" : "Connect"}
            {isConnected && <X className="w-5 h-5 ml-1" />}
          </button>
        </div>
      </div>
    </div>
  );
}
