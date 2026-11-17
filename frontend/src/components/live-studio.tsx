"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Card, ErrorMsg, btnCls, btnDanger, btnGhost, inputCls } from "@/components/ui";
import { API_URL, api } from "@/lib/api";

type Mode = "camera" | "screen" | "both";
type Phase = "idle" | "connecting" | "live";
type Dev = { id: string; label: string };

const W = 1280;
const H = 720;
const FPS = 30;

const pickMime = () =>
  ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";

/** setInterval that is not throttled when the tab is in the background (teachers share another window). */
function startTicker(fn: () => void, ms: number) {
  const src = `setInterval(()=>postMessage(0),${ms})`;
  const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  const w = new Worker(url);
  w.onmessage = fn;
  return () => {
    w.terminate();
    URL.revokeObjectURL(url);
  };
}

function wsUrl(id: string, ticket: string) {
  const base = API_URL.startsWith("http") ? API_URL.replace(/^http/, "ws") : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${API_URL}`;
  return `${base}/live/${id}/ingest?t=${ticket}`;
}

export function LiveStudio({ id, initialStatus, videoId, endsAt, onChange }: { id: string; initialStatus: string; videoId: string | null; endsAt: string | null; onChange: () => void }) {
  const [mode, setMode] = useState<Mode>("camera");
  const [cams, setCams] = useState<Dev[]>([]);
  const [mics, setMics] = useState<Dev[]>([]);
  const [camId, setCamId] = useState("");
  const [micId, setMicId] = useState("");
  const [devicesOn, setDevicesOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [level, setLevel] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);

  const [host, setHost] = useState("");
  const [full, setFull] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    // Wall clock for the "time left" banner; only known in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // The chat embed needs the page's own hostname; only known in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHost(location.hostname);
    const onFs = () => setFull(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen().catch(() => setError("ফুলস্ক্রিন চালু করা যায়নি"));
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camVideo = useRef<HTMLVideoElement>(null);
  const screenVideo = useRef<HTMLVideoElement>(null);
  const camStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const audio = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode; mic?: MediaStreamAudioSourceNode; micGain: GainNode; scr?: MediaStreamAudioSourceNode; analyser: AnalyserNode } | null>(null);
  const out = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const modeRef = useRef(mode);
  const camOffRef = useRef(camOff);
  useEffect(() => {
    modeRef.current = mode;
    camOffRef.current = camOff;
  }, [mode, camOff]);

  const supported = typeof window !== "undefined" && !!pickMime() && !!navigator.mediaDevices?.getUserMedia;

  // ---- canvas compositor: what is drawn here is exactly what the students see ----
  useEffect(() => {
    const c = canvasRef.current!;
    const g = c.getContext("2d")!;
    const contain = (v: HTMLVideoElement, x: number, y: number, w: number, h: number) => {
      if (!v.videoWidth) return;
      const r = Math.min(w / v.videoWidth, h / v.videoHeight);
      const dw = v.videoWidth * r;
      const dh = v.videoHeight * r;
      g.drawImage(v, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    };
    const draw = () => {
      g.fillStyle = "#0b1220";
      g.fillRect(0, 0, W, H);
      const m = modeRef.current;
      const cam = camVideo.current!;
      const scr = screenVideo.current!;
      const hasCam = !!camStream.current?.getVideoTracks().length && !camOffRef.current;
      if (m === "screen" || m === "both") {
        if (screenStream.current) contain(scr, 0, 0, W, H);
        else {
          g.fillStyle = "#94a3b8";
          g.font = "32px sans-serif";
          g.textAlign = "center";
          g.fillText("স্ক্রিন শেয়ার চালু করুন", W / 2, H / 2);
        }
        if (m === "both" && hasCam) {
          const pw = 320;
          const ph = 180;
          const px = W - pw - 24;
          const py = H - ph - 24;
          g.save();
          g.beginPath();
          g.roundRect(px, py, pw, ph, 16);
          g.clip();
          g.fillStyle = "#000";
          g.fillRect(px, py, pw, ph);
          contain(cam, px, py, pw, ph);
          g.restore();
          g.strokeStyle = "#fff";
          g.lineWidth = 3;
          g.beginPath();
          g.roundRect(px, py, pw, ph, 16);
          g.stroke();
        }
      } else if (hasCam) {
        contain(cam, 0, 0, W, H);
      } else {
        g.fillStyle = "#94a3b8";
        g.font = "32px sans-serif";
        g.textAlign = "center";
        g.fillText(camStream.current ? (camStream.current.getVideoTracks().length ? "ক্যামেরা বন্ধ" : "ক্যামেরা নেই — স্ক্রিন শেয়ার করুন") : "ক্যামেরা ও মাইক চালু করুন", W / 2, H / 2);
      }
    };
    draw();
    return startTicker(draw, 1000 / FPS);
  }, []);

  // ---- mic level meter ----
  useEffect(() => {
    const t = setInterval(() => {
      const a = audio.current?.analyser;
      if (!a) return setLevel(0);
      const buf = new Uint8Array(a.fftSize);
      a.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
    }, 80);
    return () => clearInterval(t);
  }, []);

  const ensureAudio = () => {
    if (audio.current) return audio.current;
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const micGain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    micGain.connect(analyser);
    micGain.connect(dest);
    audio.current = { ctx, dest, micGain, analyser };
    return audio.current;
  };

  const listDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    const f = (k: MediaDeviceKind) => all.filter((d) => d.kind === k).map((d, i) => ({ id: d.deviceId, label: d.label || `${k === "videoinput" ? "ক্যামেরা" : "মাইক"} ${i + 1}` }));
    setCams(f("videoinput"));
    setMics(f("audioinput"));
  }, []);

  /** Opens camera + mic (also used to switch device). A missing camera or mic is not fatal. */
  async function openDevices(cam = camId, mic = micId) {
    setError(null);
    setInfo(null);
    const gum = (c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c);
    const video = { ...(cam ? { deviceId: { exact: cam } } : {}), width: { ideal: W }, height: { ideal: H }, frameRate: { ideal: FPS } };
    const audioC = { ...(mic ? { deviceId: { exact: mic } } : {}), echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    try {
      camStream.current?.getTracks().forEach((t) => t.stop());
      let s: MediaStream | null = null;
      const missing: string[] = [];
      let first: unknown = null;
      try {
        s = await gum({ video, audio: audioC });
      } catch (e) {
        first = e;
        if ((e as DOMException).name === "NotAllowedError") throw e;
      }
      if (!s) {
        // Try each device on its own so a missing camera does not block the mic (and vice versa).
        const tracks: MediaStreamTrack[] = [];
        for (const [name, c] of [["ক্যামেরা", { video }], ["মাইক", { audio: audioC }]] as const) {
          try {
            tracks.push(...(await gum(c)).getTracks());
          } catch (e) {
            if ((e as DOMException).name === "NotAllowedError") throw e;
            missing.push(name);
          }
        }
        if (!tracks.length) throw first;
        s = new MediaStream(tracks);
      }
      camStream.current = s;
      const hasVideo = s.getVideoTracks().length > 0;
      const hasAudio = s.getAudioTracks().length > 0;
      camVideo.current!.srcObject = hasVideo ? s : null;
      if (hasVideo) await camVideo.current!.play().catch(() => undefined);
      const a = ensureAudio();
      await a.ctx.resume();
      a.mic?.disconnect();
      a.mic = undefined;
      if (hasAudio) {
        a.mic = a.ctx.createMediaStreamSource(new MediaStream(s.getAudioTracks()));
        a.mic.connect(a.micGain);
        a.micGain.gain.value = muted ? 0 : 1;
      }
      setCamId(s.getVideoTracks()[0]?.getSettings().deviceId ?? cam);
      setMicId(s.getAudioTracks()[0]?.getSettings().deviceId ?? mic);
      setDevicesOn(true);
      if (screenStream.current) setMode(hasVideo ? "both" : "screen");
      if (missing.length) setInfo(`${missing.join(" ও ")} পাওয়া যায়নি। ${hasVideo ? "ক্যামেরা দিয়ে চলবে, মাইক ছাড়া — শব্দ যাবে না।" : "স্ক্রিন শেয়ার করে মাইক দিয়ে ক্লাস নিতে পারবেন।"}`);
      await listDevices();
    } catch (e) {
      const n = (e as DOMException).name;
      setError(n === "NotAllowedError" ? "ব্রাউজারে ক্যামেরা/মাইকের অনুমতি দিন (অ্যাড্রেস বারের তালা আইকন)" : n === "NotFoundError" ? "কোনো ক্যামেরা বা মাইক পাওয়া যায়নি। কম্পিউটারে মাইক/ক্যামেরা লাগান বা সিস্টেম সেটিংসে চালু আছে কিনা দেখুন। শুধু স্ক্রিন শেয়ার করতে চাইলে নিচের ‘স্ক্রিন শেয়ার’ চাপুন।" : n === "NotReadableError" ? "ক্যামেরা/মাইক অন্য অ্যাপ ব্যবহার করছে (Zoom, Meet ইত্যাদি বন্ধ করুন)" : `ডিভাইস চালু করা যায়নি: ${(e as Error).message}`);
    }
  }

  async function startScreen() {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: FPS } }, audio: true });
      screenStream.current = s;
      screenVideo.current!.srcObject = s;
      await screenVideo.current!.play().catch(() => undefined);
      const a = ensureAudio();
      await a.ctx.resume();
      if (s.getAudioTracks().length) {
        a.scr = a.ctx.createMediaStreamSource(new MediaStream(s.getAudioTracks()));
        a.scr.connect(a.dest);
      }
      s.getVideoTracks()[0].onended = stopScreen;
      setScreenOn(true);
      setMode(camStream.current?.getVideoTracks().length ? "both" : "screen");
    } catch (e) {
      if ((e as DOMException).name !== "NotAllowedError") setError("স্ক্রিন শেয়ার শুরু করা যায়নি");
    }
  }

  function stopScreen() {
    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    audio.current?.scr?.disconnect();
    if (audio.current) audio.current.scr = undefined;
    setScreenOn(false);
    setMode("camera");
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (audio.current) audio.current.micGain.gain.value = next ? 0 : 1;
  }

  /** Records 4 seconds of the mic and plays it back so the teacher can hear themselves. */
  async function micTest() {
    const a = audio.current;
    if (!a) return;
    setHeard("recording");
    const r = new MediaRecorder(a.dest.stream);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => chunks.push(e.data);
    r.onstop = () => {
      setHeard(URL.createObjectURL(new Blob(chunks, { type: r.mimeType })));
    };
    r.start();
    setTimeout(() => r.stop(), 4000);
  }

  // ---- go live / stop ----
  async function goLive() {
    setError(null);
    setInfo(null);
    if (!devicesOn && !screenOn) return setError("আগে ক্যামেরা ও মাইক চালু করুন, অথবা স্ক্রিন শেয়ার করুন");
    if ((mode === "screen" || mode === "both") && !screenOn) return setError("স্ক্রিন শেয়ার চালু করুন");
    setPhase("connecting");
    try {
      const { ticket } = await api<{ ticket: string }>(`/live/${id}/ingest-ticket`, { method: "POST" });
      const sock = new WebSocket(wsUrl(id, ticket));
      sock.binaryType = "arraybuffer";
      ws.current = sock;
      await new Promise<void>((res, rej) => {
        sock.onmessage = (m) => {
          const j = JSON.parse(m.data as string);
          if (j.type === "ready") res();
          else if (j.type === "error") rej(new Error(j.message));
        };
        sock.onerror = () => rej(new Error("সার্ভারের সাথে সংযোগ হয়নি"));
        sock.onclose = () => rej(new Error("সংযোগ বন্ধ হয়ে গেছে"));
      });
      sock.onmessage = (m) => {
        const j = JSON.parse(m.data as string);
        if (j.type === "error") setError(j.message);
      };
      sock.onclose = () => {
        if (rec.current?.state === "recording") {
          rec.current.stop();
          setPhase("idle");
          setError("স্ট্রিম সংযোগ বিচ্ছিন্ন হয়েছে। আবার ‘লাইভ শুরু করুন’ চাপুন।");
        }
      };

      const stream = new MediaStream([...canvasRef.current!.captureStream(FPS).getVideoTracks(), ...audio.current!.dest.stream.getAudioTracks()]);
      out.current = stream;
      const r = new MediaRecorder(stream, { mimeType: pickMime(), videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 });
      // Chunks must reach ffmpeg in order, so each send waits for the previous one.
      let chain: Promise<void> = Promise.resolve();
      r.ondataavailable = (e) => {
        if (!e.data.size) return;
        chain = chain.then(async () => {
          const buf = await e.data.arrayBuffer();
          if (sock.readyState === WebSocket.OPEN) sock.send(buf);
        });
      };
      r.start(1000);
      rec.current = r;

      setInfo("YouTube এ ভিডিও পৌঁছানোর অপেক্ষা… (১০–৩০ সেকেন্ড)");
      await api(`/live/${id}/start`, { method: "POST" });
      setInfo(null);
      setPhase("live");
      onChange();
    } catch (e) {
      rec.current?.state === "recording" && rec.current.stop();
      ws.current?.close();
      setPhase("idle");
      setInfo(null);
      setError(e instanceof Error ? e.message : "শুরু করা যায়নি");
    }
  }

  async function endClass() {
    setError(null);
    try {
      rec.current?.state === "recording" && rec.current.stop();
      await api(`/live/${id}/end`, { method: "POST" });
      ws.current?.close();
      setPhase("idle");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "শেষ করা যায়নি");
    }
  }

  // The server ends the class at its end time: stop sending and release the devices.
  useEffect(() => {
    if (initialStatus !== "ENDED") return;
    rec.current?.state === "recording" && rec.current.stop();
    ws.current?.close();
    camStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current?.getTracks().forEach((t) => t.stop());
  }, [initialStatus]);

  async function extend(minutes: number) {
    setError(null);
    try {
      await api(`/live/${id}/extend`, { method: "POST", body: { minutes } });
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "সময় বাড়ানো যায়নি");
    }
  }

  // Leaving the page stops sending media but does not end the class (teacher can come back).
  useEffect(
    () => () => {
      rec.current?.state === "recording" && rec.current.stop();
      ws.current?.close();
      camStream.current?.getTracks().forEach((t) => t.stop());
      screenStream.current?.getTracks().forEach((t) => t.stop());
      audio.current?.ctx.close().catch(() => undefined);
    },
    [],
  );

  if (initialStatus === "ENDED") return <Card className="text-center text-sub">এই ক্লাস শেষ হয়ে গেছে। রেকর্ডিং “শিক্ষার্থীর ভিউ” ট্যাবে দেখুন।</Card>;
  if (!supported) return <Card className="text-danger">এই ব্রাউজারে লাইভ স্টুডিও চলে না। Chrome, Edge বা Firefox (কম্পিউটার) ব্যবহার করুন।</Card>;

  const live = phase === "live";
  const busy = phase === "connecting";
  const minsLeft = endsAt && now ? Math.ceil((new Date(endsAt).getTime() - now) / 60_000) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
    <div ref={stageRef} className={`space-y-3 ${full ? "flex flex-col justify-center overflow-auto bg-canvas p-4" : ""}`}>
      <div className="relative mx-auto w-full overflow-hidden rounded-xl bg-slate-900" style={full ? { maxWidth: "min(100%, calc((100vh - 170px) * 16 / 9))" } : undefined}>
        <canvas ref={canvasRef} width={W} height={H} className="aspect-video w-full" />
        <div className="absolute left-3 top-3 flex gap-2">
          {live ? <Badge tone="red">● LIVE</Badge> : <Badge tone="slate">প্রিভিউ (শিক্ষার্থীরা যা দেখবে)</Badge>}
          {muted && <Badge tone="amber">মাইক বন্ধ</Badge>}
        </div>
      </div>
      {/* Hidden sources drawn into the canvas. */}
      <video ref={camVideo} muted playsInline className="hidden" />
      <video ref={screenVideo} muted playsInline className="hidden" />
      <ErrorMsg error={error} />
      {info && <p className="rounded-lg bg-canvas p-3 text-sm text-sub">{info}</p>}
      {endsAt && minsLeft !== null && (
        <div className={`flex flex-wrap items-center gap-2 rounded-lg p-3 text-sm ${minsLeft <= 5 ? "bg-amber-50 text-amber-800" : "bg-canvas text-sub"}`}>
          <span>
            {minsLeft > 0 ? `ক্লাস স্বয়ংক্রিয়ভাবে শেষ হবে ${new Date(endsAt).toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit" })} এ (আর ${minsLeft.toLocaleString("bn-BD")} মিনিট)` : "শেষের সময় হয়ে গেছে, ক্লাস এখনই বন্ধ হবে"}
          </span>
          <button type="button" className={btnGhost} onClick={() => extend(15)}>
            +১৫ মিনিট
          </button>
          <button type="button" className={btnGhost} onClick={() => extend(30)}>
            +৩০ মিনিট
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!live ? (
          <button className={btnCls} disabled={busy || (!devicesOn && !screenOn)} onClick={goLive}>
            {busy ? "সংযোগ হচ্ছে…" : initialStatus === "LIVE" ? "স্ট্রিম পুনরায় সংযুক্ত করুন" : "● লাইভ শুরু করুন"}
          </button>
        ) : (
          <button className={btnDanger} onClick={endClass}>
            ক্লাস শেষ করুন
          </button>
        )}
        {!devicesOn && (
          <button className={btnGhost} onClick={() => openDevices()}>
            ক্যামেরা ও মাইক চালু করুন
          </button>
        )}
        {devicesOn && (
          <>
            <button className={btnGhost} onClick={toggleMute}>
              {muted ? "মাইক চালু" : "মাইক মিউট"}
            </button>
            <button className={btnGhost} onClick={() => setCamOff((v) => !v)}>
              {camOff ? "ক্যামেরা চালু" : "ক্যামেরা বন্ধ"}
            </button>
          </>
        )}
        <button className={btnGhost} onClick={toggleFull}>
          {full ? "ফুলস্ক্রিন বন্ধ" : "⛶ ফুলস্ক্রিন"}
        </button>
        {screenOn ? (
          <button className={btnGhost} onClick={stopScreen}>
            স্ক্রিন শেয়ার বন্ধ
          </button>
        ) : (
          <button className={btnGhost} onClick={startScreen}>
            স্ক্রিন শেয়ার
          </button>
        )}
        {devicesOn && (
          <div className="ml-1 flex items-center gap-2" title="মাইকের শব্দ">
            <span className="text-xs text-sub">মাইক</span>
            <div className="h-2.5 w-28 overflow-hidden rounded-full bg-canvas" role="meter" aria-label="মাইকের শব্দ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
              <div className={`h-full transition-[width] duration-75 ${level > 0.85 ? "bg-danger" : "bg-brand"}`} style={{ width: `${muted ? 0 : level * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {devicesOn && (
        <details className="rounded-lg border border-line bg-surface p-3 text-sm">
          <summary className="cursor-pointer font-medium">ডিভাইস বদলান ও মাইক টেস্ট</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block font-medium">
              ক্যামেরা
              <select className={`${inputCls} mt-1`} value={camId} onChange={(e) => openDevices(e.target.value, micId)}>
                {cams.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block font-medium">
              মাইক
              <select className={`${inputCls} mt-1`} value={micId} onChange={(e) => openDevices(camId, e.target.value)}>
                {mics.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className={btnGhost} onClick={micTest} disabled={heard === "recording"}>
              {heard === "recording" ? "রেকর্ড হচ্ছে… কথা বলুন" : "৪ সেকেন্ড রেকর্ড করে শুনুন"}
            </button>
            {heard && heard !== "recording" && <audio controls src={heard} className="h-10" />}
          </div>
        </details>
      )}
    </div>
    <div className="flex min-h-[480px] flex-col overflow-hidden rounded-xl border border-line bg-surface lg:max-h-[760px]">
      <p className="border-b border-line px-3 py-2 text-sm font-bold">লাইভ চ্যাট (শিক্ষার্থীদের মেসেজ)</p>
      {videoId && host ? (
        <iframe title="লাইভ চ্যাট" src={`https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${host}`} className="min-h-0 flex-1" />
      ) : (
        <p className="p-4 text-sm text-sub">চ্যাট লোড হচ্ছে…</p>
      )}
      <p className="border-t border-line px-3 py-2 text-xs text-sub">চ্যাটে উত্তর দিতে YouTube এ সাইন-ইন থাকতে হবে। লাইভ শুরু হলে মেসেজ আসবে।</p>
    </div>
    </div>
  );
}
