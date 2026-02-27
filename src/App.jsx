import { useState, useRef, useEffect } from "react";

const STORAGE_KEY = "ir-qa-database";
const PASSWORD_KEY = "ir-auth";
const CORRECT_PASSWORD = "moin2026ir!"; // ← 여기서 비밀번호 변경 가능

function parseTabSeparated(raw) {
  const lines = raw.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length >= 3) rows.push({ category: cols[0]?.trim(), question: cols[1]?.trim(), answer: cols[2]?.trim() });
    else if (cols.length === 2) rows.push({ category: "", question: cols[0]?.trim(), answer: cols[1]?.trim() });
  }
  return rows.filter(r => r.question && r.answer);
}

function parseCSV(raw) {
  const lines = raw.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/(".*?"|[^",\n]+)(?=\s*,|\s*$)/g)
      ?.map(c => c.replace(/^"|"$/g, "").trim()) || lines[i].split(",").map(c => c.trim());
    if (cols.length >= 3) rows.push({ category: cols[0], question: cols[1], answer: cols[2] });
    else if (cols.length === 2) rows.push({ category: "", question: cols[0], answer: cols[1] });
  }
  return rows.filter(r => r.question && r.answer);
}

// ── 로그인 화면 ──
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = () => {
    if (pw === CORRECT_PASSWORD) {
      sessionStorage.setItem(PASSWORD_KEY, "true");
      onLogin();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPw("");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Pretendard',system-ui,sans-serif" }}>
      <div style={{ animation: shake ? "shake 0.4s ease" : "fadeIn 0.4s ease", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "48px 40px", width: 360, textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#4f8ef7,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 auto 20px" }}>IR</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf0", marginBottom: 6, letterSpacing: "-0.4px" }}>IR Q&A 초안 생성기</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 32 }}>MOIN Series C — 관계자 전용</div>

        <input
          type="password"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(false); }}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          placeholder="비밀번호를 입력하세요"
          autoFocus
          style={{ width: "100%", padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`, color: "#e8eaf0", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8, transition: "border-color 0.2s", textAlign: "center", letterSpacing: 4 }}
          onFocus={e => !error && (e.target.style.borderColor = "rgba(79,142,247,0.5)")}
          onBlur={e => !error && (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
        />
        {error && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 12, animation: "fadeIn 0.2s" }}>비밀번호가 올바르지 않아요</div>}
        {!error && <div style={{ marginBottom: 12 }} />}

        <button onClick={handleSubmit} style={{ width: "100%", padding: "12px", borderRadius: 10, background: "linear-gradient(135deg,#4f8ef7,#7c3aed)", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          입장하기
        </button>
        <div style={{ fontSize: 11, color: "#374151", marginTop: 20 }}>접근 권한이 없다면 IR팀에 문의하세요</div>
      </div>
      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

// ── 메인 앱 ──
export default function IRQATool() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(PASSWORD_KEY) === "true");
  const [db, setDb] = useState([]);
  const [pasteData, setPasteData] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("ask");
  const [feedback, setFeedback] = useState("");
  const [storageLoading, setStorageLoading] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (result?.value) setDb(JSON.parse(result.value));
      } catch {}
      finally { setStorageLoading(false); }
    })();
  }, [authed]);

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  const saveDb = async (newDb) => {
    try { await window.storage.set(STORAGE_KEY, JSON.stringify(newDb)); } catch {}
  };

  const addRows = async (newRows) => {
    if (!newRows.length) return 0;
    const existing = new Set(db.map(r => r.question));
    const unique = newRows.filter(r => !existing.has(r.question));
    const updated = [...db, ...unique];
    setDb(updated); await saveDb(updated);
    return unique.length;
  };

  const showFeedback = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(""), 3500); };

  const handlePasteAdd = async () => {
    const rows = parseTabSeparated(pasteData);
    if (!rows.length) { showFeedback("❌ 인식 불가. 헤더 포함 복사해주세요."); return; }
    const added = await addRows(rows);
    setPasteData("");
    showFeedback(`✅ ${added}개 추가 (중복 ${rows.length - added}개 제외)`);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const rows = file.name.endsWith(".csv") ? parseCSV(ev.target.result) : parseTabSeparated(ev.target.result);
      if (!rows.length) { showFeedback("❌ Q&A를 인식하지 못했어요."); return; }
      const added = await addRows(rows);
      showFeedback(`✅ ${file.name} — ${added}개 추가 (중복 ${rows.length - added}개 제외)`);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleDeleteRow = async (idx) => {
    const updated = db.filter((_, i) => i !== idx);
    setDb(updated); await saveDb(updated);
  };

  const handleClearAll = async () => {
    if (!window.confirm(`DB 전체(${db.length}개)를 삭제할까요?`)) return;
    setDb([]);
    try { await window.storage.delete(STORAGE_KEY); } catch {}
  };

  const handleGenerate = async () => {
    if (!question.trim() || !db.length) return;
    setLoading(true); setAnswer(""); setError("");
    const dbText = db.map((r, i) =>
      `[${i+1}] 카테고리: ${r.category||"일반"}\n질문: ${r.question}\n답변: ${r.answer}`
    ).join("\n\n");
    try {
      // Vercel 배포 시 /api/generate 엔드포인트 사용 (API 키 서버에서 관리)
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dbText,
          dbCount: db.length,
          question
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.answer) setAnswer(data.answer);
      else setError("생성 실패. 다시 시도해주세요.");
    } catch (e) {
      setError(`오류: ${e.message}. API 설정을 확인해주세요.`);
    }
    finally { setLoading(false); }
  };

  const categories = [...new Set(db.map(r => r.category || "일반"))];

  if (storageLoading) return (
    <div style={{ minHeight:"100vh", background:"#0a0e1a", display:"flex", alignItems:"center", justifyContent:"center", color:"#6b7280", fontSize:14 }}>로딩 중...</div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#0a0e1a", fontFamily:"'DM Sans','Pretendard',system-ui,sans-serif", color:"#e8eaf0" }}>
      <div style={{ borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"16px 32px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(255,255,255,0.02)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:"linear-gradient(135deg,#4f8ef7,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff" }}>IR</div>
          <div>
            <div style={{ fontSize:15, fontWeight:600, letterSpacing:"-0.3px" }}>IR Q&A 초안 생성기</div>
            <div style={{ fontSize:11, color:"#6b7280", marginTop:1 }}>MOIN Series C</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, background: db.length>0?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.05)", border:`1px solid ${db.length>0?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.1)"}`, borderRadius:20, padding:"4px 12px", fontSize:12 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background: db.length>0?"#22c55e":"#6b7280", boxShadow: db.length>0?"0 0 6px rgba(34,197,94,0.6)":"none" }} />
            <span style={{ color: db.length>0?"#86efac":"#6b7280" }}>DB {db.length}개</span>
          </div>
          <button onClick={() => { sessionStorage.removeItem(PASSWORD_KEY); setAuthed(false); }}
            style={{ padding:"4px 12px", borderRadius:20, background:"transparent", border:"1px solid rgba(255,255,255,0.08)", color:"#6b7280", fontSize:11, cursor:"pointer" }}>
            로그아웃
          </button>
        </div>
      </div>

      <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"0 32px" }}>
        {[{id:"ask",label:"✦ 답변 생성"},{id:"manage",label:"⊕ DB 관리"}].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding:"12px 20px", background:"transparent", border:"none", borderBottom:`2px solid ${activeTab===tab.id?"#4f8ef7":"transparent"}`, color: activeTab===tab.id?"#4f8ef7":"#6b7280", fontSize:13, fontWeight: activeTab===tab.id?600:400, cursor:"pointer", marginBottom:-1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:800, margin:"0 auto", padding:"36px 32px" }}>
        {activeTab === "ask" && (
          db.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 0" }}>
              <div style={{ fontSize:40, marginBottom:16 }}>📭</div>
              <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>DB가 비어있어요</div>
              <div style={{ fontSize:13, color:"#6b7280", marginBottom:24 }}>먼저 "DB 관리" 탭에서 Q&A를 추가해주세요</div>
              <button onClick={() => setActiveTab("manage")} style={{ padding:"10px 24px", borderRadius:10, background:"linear-gradient(135deg,#4f8ef7,#7c3aed)", border:"none", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>DB 추가하러 가기 →</button>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:20, fontWeight:700, letterSpacing:"-0.4px", marginBottom:6 }}>투자자 질문을 입력하세요</div>
                <div style={{ fontSize:13, color:"#6b7280" }}>DB가 많을수록 더 정확한 초안이 생성돼요</div>
              </div>
              <textarea value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if(e.key==="Enter"&&e.metaKey) handleGenerate(); }}
                placeholder="예: 일본 시장 진출 전략과 예상 타임라인이 어떻게 되나요?"
                style={{ width:"100%", minHeight:100, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:16, color:"#e8eaf0", fontSize:15, fontFamily:"inherit", lineHeight:1.6, resize:"none", outline:"none", boxSizing:"border-box" }}
                onFocus={e => e.target.style.borderColor="rgba(79,142,247,0.5)"}
                onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.1)"} />
              <div style={{ fontSize:11, color:"#4b5563", textAlign:"right", marginTop:4, marginBottom:16 }}>⌘+Enter로 바로 생성</div>
              <button onClick={handleGenerate} disabled={loading||!question.trim()}
                style={{ width:"100%", padding:14, borderRadius:12, background: loading||!question.trim()?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#4f8ef7,#7c3aed)", border:"none", color: loading||!question.trim()?"#6b7280":"#fff", fontSize:15, fontWeight:600, cursor: loading||!question.trim()?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                {loading ? (<><div style={{ width:16, height:16, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.2)", borderTopColor:"#fff", animation:"spin 0.8s linear infinite" }} />초안 생성 중...</>) : "✦ 답변 초안 생성"}
              </button>
              {error && <div style={{ fontSize:13, color:"#ef4444", marginTop:12 }}>⚠️ {error}</div>}
              {answer && (
                <div style={{ marginTop:28, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, overflow:"hidden", animation:"slideUp 0.3s ease" }}>
                  <div style={{ padding:"12px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(255,255,255,0.02)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 8px rgba(34,197,94,0.6)" }} />
                      <span style={{ fontSize:13, fontWeight:600, color:"#9ca3af" }}>생성된 답변 초안</span>
                      <span style={{ fontSize:11, color:"#4b5563" }}>DB {db.length}개 참고</span>
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(answer)} style={{ padding:"5px 14px", borderRadius:8, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af", fontSize:12, cursor:"pointer" }}>복사하기</button>
                  </div>
                  <div style={{ padding:"22px 24px", fontSize:14, lineHeight:1.9, color:"#d1d5db", whiteSpace:"pre-wrap" }}>{answer}</div>
                </div>
              )}
            </div>
          )
        )}

        {activeTab === "manage" && (
          <div>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:20, fontWeight:700, letterSpacing:"-0.4px", marginBottom:6 }}>Q&A 데이터베이스</div>
              <div style={{ fontSize:13, color:"#6b7280" }}>추가할수록 답변 품질이 높아져요. 새 데이터는 기존에 누적돼요.</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
              <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:20 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>📁 파일 업로드</div>
                <div style={{ fontSize:12, color:"#6b7280", marginBottom:14, lineHeight:1.6 }}>구글 시트 → 파일 → 다운로드 → CSV로 저장 후 업로드</div>
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ width:"100%", padding:"10px", borderRadius:10, background:"rgba(79,142,247,0.1)", border:"1px solid rgba(79,142,247,0.3)", color:"#4f8ef7", fontSize:13, fontWeight:600, cursor:"pointer" }}
                  onMouseEnter={e => e.target.style.background="rgba(79,142,247,0.2)"}
                  onMouseLeave={e => e.target.style.background="rgba(79,142,247,0.1)"}>
                  CSV 파일 선택
                </button>
                <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} style={{ display:"none" }} />
              </div>
              <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:20 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>📋 복사/붙여넣기</div>
                <div style={{ fontSize:12, color:"#6b7280", marginBottom:10, lineHeight:1.6 }}>구글 시트에서 Ctrl+A → Ctrl+C 후 붙여넣기</div>
                <textarea value={pasteData} onChange={e => setPasteData(e.target.value)}
                  placeholder={"카테고리\t질문\t답변\n..."}
                  style={{ width:"100%", height:72, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"8px 10px", color:"#e8eaf0", fontSize:12, fontFamily:"monospace", resize:"none", outline:"none", boxSizing:"border-box", marginBottom:8 }} />
                <button onClick={handlePasteAdd} disabled={!pasteData.trim()}
                  style={{ width:"100%", padding:"10px", borderRadius:10, background: pasteData.trim()?"rgba(79,142,247,0.1)":"rgba(255,255,255,0.03)", border:`1px solid ${pasteData.trim()?"rgba(79,142,247,0.3)":"rgba(255,255,255,0.08)"}`, color: pasteData.trim()?"#4f8ef7":"#4b5563", fontSize:13, fontWeight:600, cursor: pasteData.trim()?"pointer":"not-allowed" }}>
                  DB에 추가
                </button>
              </div>
            </div>
            {feedback && (
              <div style={{ padding:"10px 16px", borderRadius:10, background: feedback.startsWith("✅")?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)", border:`1px solid ${feedback.startsWith("✅")?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`, fontSize:13, color: feedback.startsWith("✅")?"#86efac":"#fca5a5", marginBottom:20 }}>
                {feedback}
              </div>
            )}
            {db.length > 0 ? (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#9ca3af" }}>저장된 Q&A — {db.length}개</div>
                  <button onClick={handleClearAll} style={{ padding:"5px 12px", borderRadius:8, background:"transparent", border:"1px solid rgba(239,68,68,0.3)", color:"#ef4444", fontSize:12, cursor:"pointer" }}>전체 삭제</button>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:420, overflowY:"auto", paddingRight:4 }}>
                  {db.map((row, i) => (
                    <div key={i} style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:"12px 16px", display:"flex", gap:12, alignItems:"flex-start" }}>
                      <div style={{ flexShrink:0, padding:"2px 8px", borderRadius:6, background:"rgba(79,142,247,0.1)", border:"1px solid rgba(79,142,247,0.2)", fontSize:11, color:"#4f8ef7", whiteSpace:"nowrap" }}>{row.category||"일반"}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{row.question}</div>
                        <div style={{ fontSize:12, color:"#6b7280", lineHeight:1.5, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{row.answer}</div>
                      </div>
                      <button onClick={() => handleDeleteRow(i)}
                        style={{ flexShrink:0, width:24, height:24, borderRadius:6, background:"transparent", border:"none", color:"#4b5563", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                        onMouseEnter={e => { e.currentTarget.style.color="#ef4444"; e.currentTarget.style.background="rgba(239,68,68,0.1)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color="#4b5563"; e.currentTarget.style.background="transparent"; }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign:"center", padding:"40px 0", color:"#4b5563", fontSize:13 }}>아직 Q&A가 없어요. 위에서 추가해주세요.</div>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        * { box-sizing:border-box; }
        textarea::placeholder { color:#2d3748; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:4px; }
      `}</style>
    </div>
  );
}
