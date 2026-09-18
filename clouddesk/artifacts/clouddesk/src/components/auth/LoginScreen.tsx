import { useState, useEffect, useRef } from "react";
import { login } from "@/lib/auth";
import { Terminal, AlertTriangle } from "lucide-react";

const ASCII_BANNER = [
  "   ██████  ██       ██████  ██    ██ ██████  ██████  ███████ ███████ ██   ██ ",
  "  ██      ██       ██   ██ ██ ██ ██ ██   ██ ██   ██ ██      ██      ██  ██  ",
  "  ██      ██       ██   ██ ████████ ██   ██ ██   ██ █████   █████   █████   ",
  "  ██      ██       ██   ██ ██ ██ ██ ██   ██ ██   ██ ██      ██      ██  ██  ",
  "   ██████ ███████  ██████  ██    ██ ██████  ██████  ███████ ███████ ██   ██ ",
];

export default function LoginScreen({ onSuccess }: { onSuccess: (username: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const bootIndex = useRef(0);

  const BOOT_SEQUENCE = [
    "> INITIALIZING SECURE KERNEL ...................... OK",
    "> LOADING ENCRYPTION MODULE (AES-256) .............. OK",
    "> MOUNTING REMOTE AGENT NETWORK .................... OK",
    "> ESTABLISHING EMERGENCY CHANNEL ................... OK",
    "> ACCESS RESTRICTED - AUTHORIZATION REQUIRED",
  ];

  useEffect(() => {
    const t = setInterval(() => {
      if (bootIndex.current < BOOT_SEQUENCE.length) {
        setLines((l) => [...l, BOOT_SEQUENCE[bootIndex.current]]);
        bootIndex.current += 1;
      }
    }, 350);
    return () => clearInterval(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const me = await login(username, password);
      setLines((l) => [...l, "> AUTHENTICATION .......................... ACCEPTED"]);
      setTimeout(() => onSuccess(me.username), 600);
    } catch {
      setError("ACCESS DENIED - INVALID CREDENTIALS");
      setLines((l) => [...l, "> AUTHENTICATION .......................... REJECTED"]);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#000a05] text-[#00ff41] flex items-center justify-center p-4 relative overflow-hidden">
      {/* backdrop grid */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,255,65,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.8) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* terminal window */}
      <div className="w-full max-w-lg relative bg-[#000d06] border border-[#00ff41]/40 shadow-[0_0_40px_rgba(0,255,65,0.15)] rounded-sm backdrop-blur-sm">
        {/* title bar */}
        <div className="flex items-center gap-2 border-b border-[#00ff41]/30 px-4 py-2 bg-[#00150a]">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          <span className="ml-3 text-xs font-mono text-[#00ff41]/70">root@clouddesk:~# secure_access</span>
        </div>

        {/* body */}
        <div className="p-6">
          <div className="flex gap-3 items-center mb-5">
            <Terminal size={28} className="text-[#00ff41] animate-pulse" />
            <span className="text-[10px] font-mono tracking-[0.3em] text-[#00ff41]/60">CLOUDDESK SECURE CONSOLE v2.4.1</span>
          </div>

          <pre className="text-[9px] leading-[1.15] font-mono text-[#00ff41] mb-5 hidden sm:block">
            {ASCII_BANNER.join("\n")}
          </pre>

          {/* boot log */}
          <div className="h-24 overflow-hidden font-mono text-[11px] space-y-0.5 mb-5">
            {lines.map((l, i) => (
              <div key={i} className={l.includes("REJECTED") || l.includes("DENIED") ? "text-red-500" : "text-[#00ff41]/90"}>
                {l}
              </div>
            ))}
            <span className="inline-block w-2.5 h-4 bg-[#00ff41] animate-pulse align-middle" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="font-mono text-xs space-y-1">
              <label className="text-[#00ff41]/70 block mb-1">&gt; username:</label>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/60 border border-[#00ff41]/30 rounded-sm px-3 py-2 text-sm text-[#00ff41] font-mono focus:outline-none focus:border-[#00ff41] focus:shadow-[0_0_10px_rgba(0,255,65,0.4)]"
                placeholder="admin"
                autoComplete="username"
              />
            </div>

            <div className="font-mono text-xs space-y-1">
              <label className="text-[#00ff41]/70 block mb-1">&gt; password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/60 border border-[#00ff41]/30 rounded-sm px-3 py-2 text-sm text-[#00ff41] font-mono focus:outline-none focus:border-[#00ff41] focus:shadow-[0_0_10px_rgba(0,255,65,0.4)]"
                placeholder="********"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 font-mono text-xs animate-pulse">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full bg-[#00ff41] text-black font-mono text-sm font-bold py-2.5 rounded-sm hover:bg-[#00ff41]/90 active:bg-[#00ff41]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed tracking-widest"
            >
              {loading ? "VALIDATING ..." : ">>> AUTHENTICATE"}
            </button>
          </form>

          <div className="mt-5 pt-3 border-t border-[#00ff41]/20 flex justify-between font-mono text-[10px] text-[#00ff41]/50">
            <span>UID: {String(Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}</span>
            <span>ENCRYPTED CHANNEL: ACTIVE</span>
            <span>IPSEC://{window.location.host}</span>
          </div>
        </div>
      </div>
    </div>
  );
}