import { useState, useRef } from "react";

const SYSTEM_PROMPT = `당신은 Series C 단계의 한국 핀테크 기업 MOIN(모인)의 IR 전문가입니다.
MOIN은 크로스보더 결제 및 해외송금 전문 기업으로, 연간 약 2.6조 KRW를 처리하며 35만 개인 고객과 9,300개 기업 고객을 보유하고 있습니다.

아래 [과거 Q&A 데이터베이스]를 참고하여, 투자자의 질문에 대한 답변 초안을 작성해주세요.

규칙:
1. 과거 답변의 핵심 논리와 수치를 최대한 활용할 것
2. 전문적이고 자신감 있는 톤으로 작성
3. 구체적인 수치와 근거를 포함할 것
4. 답변은 한국어로, 2~4문단 분량으로 작성
5. 마지막에 "📌 참고한 유사 질문:" 섹션에 DB에서 참고한 질문들을 간략히 나열할 것`;

const PLACEHOLDER_DATA = `카테고리\t질문\t답변
시장\t한국 해외송금 시장 규모가 어떻게 되나요?\t국내 해외송금 시장은 연간 약 55조원 규모이며, MOIN은 그 중 약 2.6조원을 처리하고 있습니다. 전통 은행 대비 평균 70% 낮은 수수료로 빠르게 점유율을 확대 중입니다.
재무\t현재 수익성은 어떻게 되나요?\t2024년 기준 영업이익 흑자 전환에 성공했으며, Take rate는 약 0.3~0.5% 수준입니다. B2B 거래액 증가로 마진이 지속 개선되고 있습니다.
경쟁\t Wise, 토스 등 경쟁사 대비 차별점은 무엇인가요?\tMOIN은 국내 유일하게 법정통화 + 블록체인 송금 모두 운영 경험을 보유하고 있으며, B2B 특화 및 일본·유럽 라이선스 취득으로 글로벌 확장 중입니다. Wise는 한국 로컬 규제 대응에 한계가 있어 기업 고객에서 MOIN이 우위입니다.
규제\t해외 라이선스 취득 현황과 타임라인은?\t일본 MTO 라이선스는 2025년 내 취득 목표이며, 유럽 EMI는 라트비아 법인을 통해 2026년 초 완료 예정입니다. 싱가포르 MPI는 이미 보유 중입니다.
성장\t향후 3년 성장 전략은 무엇인가요?\t① 일본·유럽 직접 진출을 통한 코리도 확장 ② MKRW 스테이블코인 발행으로 B2B 정산 혁신 ③ 선불전자 라이선스 기반 소비자 결제 서비스 확대를 3대 축으로 합니다.`;

export default function IRQATool() {
  const [qaData, setQaData] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1); // 1: upload, 2: ask
  const [parsedCount, setParsedCount] = useState(0);
  const textareaRef = useRef(null);

  const parseQA = (raw) => {
    const lines = raw.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) return [];
    const rows = [];
    // skip header
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split("\t");
      if (cols.length >= 3) {
        rows.push({ category: cols[0]?.trim(), question: cols[1]?.trim(), answer: cols[2]?.trim() });
      } else if (cols.length === 2) {
        rows.push({ category: "", question: cols[0]?.trim(), answer: cols[1]?.trim() });
      }
    }
    return rows.filter(r => r.question && r.answer);
  };

  const handleDataConfirm = () => {
    const parsed = parseQA(qaData);
    if (parsed.length === 0) {
      setError("Q&A 데이터를 인식할 수 없어요. 구글 시트에서 복사할 때 헤더 포함 전체 선택 후 붙여넣기 해주세요.");
      return;
    }
    setParsedCount(parsed.length);
    setError("");
    setStep(2);
  };

  const handleGenerate = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer("");
    setError("");

    const rows = parseQA(qaData);
    const dbText = rows.map((r, i) =>
      `[${i + 1}] 카테고리: ${r.category || "일반"}\n질문: ${r.question}\n답변: ${r.answer}`
    ).join("\n\n");

    const userMessage = `[과거 Q&A 데이터베이스]\n${dbText}\n\n---\n\n[투자자의 새 질문]\n${question}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }]
        })
      });
      const data = await res.json();
      if (data.content?.[0]?.text) {
        setAnswer(data.content[0].text);
      } else {
        setError("답변 생성에 실패했어요. 다시 시도해주세요.");
      }
    } catch (e) {
      setError("API 요청 중 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = () => {
    setQaData(PLACEHOLDER_DATA);
  };

  const copyAnswer = () => {
    navigator.clipboard.writeText(answer);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0e1a",
      fontFamily: "'DM Sans', 'Pretendard', system-ui, sans-serif",
      color: "#e8eaf0",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(255,255,255,0.02)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #4f8ef7, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#fff"
          }}>IR</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.3px" }}>IR Q&A 초안 생성기</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>MOIN Series C — Investor Relations</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2].map(s => (
            <div key={s} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 20,
              background: step === s ? "rgba(79,142,247,0.15)" : "transparent",
              border: `1px solid ${step === s ? "rgba(79,142,247,0.4)" : "rgba(255,255,255,0.08)"}`,
              fontSize: 12, color: step === s ? "#4f8ef7" : "#6b7280",
              cursor: "pointer", transition: "all 0.2s",
            }} onClick={() => step > s && setStep(s)}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%",
                background: step > s ? "#4f8ef7" : step === s ? "rgba(79,142,247,0.3)" : "rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: step > s ? "#fff" : step === s ? "#4f8ef7" : "#6b7280"
              }}>{step > s ? "✓" : s}</div>
              {s === 1 ? "DB 업로드" : "답변 생성"}
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 32px" }}>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 8 }}>
                Q&A 데이터베이스를 붙여넣어주세요
              </div>
              <div style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>
                구글 시트에서 <span style={{ color: "#4f8ef7", fontWeight: 600 }}>전체 선택(Ctrl+A) → 복사(Ctrl+C)</span> 후 아래에 붙여넣기 하세요.<br/>
                헤더 포함 탭 구분 형식을 인식합니다. (카테고리 / 질문 / 답변)
              </div>
            </div>

            {/* How-to */}
            <div style={{
              background: "rgba(79,142,247,0.06)",
              border: "1px solid rgba(79,142,247,0.2)",
              borderRadius: 12, padding: "16px 20px", marginBottom: 24,
              display: "flex", gap: 16, alignItems: "flex-start"
            }}>
              <div style={{ fontSize: 20, marginTop: 2 }}>📋</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#4f8ef7", marginBottom: 6 }}>구글 시트 복사 방법</div>
                <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.8 }}>
                  1. 구글 시트 열기 → 셀 A1 클릭<br/>
                  2. Ctrl+Shift+End로 마지막 셀까지 선택<br/>
                  3. Ctrl+C 복사 → 아래 박스에 Ctrl+V 붙여넣기
                </div>
              </div>
            </div>

            <div style={{ position: "relative", marginBottom: 16 }}>
              <textarea
                ref={textareaRef}
                value={qaData}
                onChange={e => { setQaData(e.target.value); setError(""); }}
                placeholder={"카테고리\t질문\t답변\n시장\t시장 규모가 어떻게 되나요?\t국내 해외송금 시장은..."}
                style={{
                  width: "100%", minHeight: 220,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 12, padding: "16px",
                  color: "#e8eaf0", fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  lineHeight: 1.6, resize: "vertical", outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = "rgba(79,142,247,0.5)"}
                onBlur={e => e.target.style.borderColor = error ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}
              />
              {qaData && (
                <div style={{
                  position: "absolute", bottom: 12, right: 12,
                  fontSize: 11, color: "#6b7280",
                  background: "rgba(10,14,26,0.9)", padding: "2px 8px", borderRadius: 6
                }}>
                  {parseQA(qaData).length}개 Q&A 인식됨
                </div>
              )}
            </div>

            {error && (
              <div style={{ fontSize: 13, color: "#ef4444", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button onClick={handleDataConfirm} disabled={!qaData.trim()}
                style={{
                  padding: "12px 28px", borderRadius: 10,
                  background: qaData.trim() ? "linear-gradient(135deg, #4f8ef7, #7c3aed)" : "rgba(255,255,255,0.05)",
                  border: "none", color: qaData.trim() ? "#fff" : "#6b7280",
                  fontSize: 14, fontWeight: 600, cursor: qaData.trim() ? "pointer" : "not-allowed",
                  transition: "all 0.2s", letterSpacing: "-0.2px"
                }}>
                DB 등록하기 →
              </button>
              <button onClick={handleLoadSample}
                style={{
                  padding: "12px 20px", borderRadius: 10,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#9ca3af", fontSize: 13, cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { e.target.style.borderColor = "rgba(255,255,255,0.25)"; e.target.style.color = "#e8eaf0"; }}
                onMouseLeave={e => { e.target.style.borderColor = "rgba(255,255,255,0.12)"; e.target.style.color = "#9ca3af"; }}
              >
                샘플 데이터로 먼저 해보기
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Ask */}
        {step === 2 && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 8 }}>
                  투자자 질문을 입력하세요
                </div>
                <div style={{ fontSize: 14, color: "#9ca3af" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "rgba(79,142,247,0.1)", border: "1px solid rgba(79,142,247,0.25)",
                    borderRadius: 20, padding: "2px 10px", fontSize: 12, color: "#4f8ef7"
                  }}>✓ DB {parsedCount}개 Q&A 로드됨</span>
                </div>
              </div>
              <button onClick={() => { setStep(1); setAnswer(""); }}
                style={{
                  padding: "8px 16px", borderRadius: 8,
                  background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#9ca3af", fontSize: 12, cursor: "pointer",
                }}>← DB 재업로드</button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleGenerate(); }}
                placeholder="예: MOIN의 일본 시장 진출 전략과 예상 타임라인이 어떻게 되나요?"
                style={{
                  width: "100%", minHeight: 100,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, padding: "16px",
                  color: "#e8eaf0", fontSize: 15,
                  fontFamily: "inherit",
                  lineHeight: 1.6, resize: "none", outline: "none",
                  boxSizing: "border-box", transition: "border-color 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = "rgba(79,142,247,0.5)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
              <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6, textAlign: "right" }}>
                ⌘+Enter로 바로 생성
              </div>
            </div>

            <button onClick={handleGenerate} disabled={loading || !question.trim()}
              style={{
                width: "100%", padding: "14px",
                borderRadius: 12,
                background: loading || !question.trim()
                  ? "rgba(255,255,255,0.05)"
                  : "linear-gradient(135deg, #4f8ef7, #7c3aed)",
                border: "none",
                color: loading || !question.trim() ? "#6b7280" : "#fff",
                fontSize: 15, fontWeight: 600, cursor: loading || !question.trim() ? "not-allowed" : "pointer",
                transition: "all 0.2s", letterSpacing: "-0.2px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8
              }}>
              {loading ? (
                <>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.2)",
                    borderTopColor: "#fff",
                    animation: "spin 0.8s linear infinite"
                  }} />
                  초안 생성 중...
                </>
              ) : "✦ 답변 초안 생성"}
            </button>

            {error && (
              <div style={{ fontSize: 13, color: "#ef4444", marginTop: 16, display: "flex", alignItems: "center", gap: 6 }}>
                ⚠️ {error}
              </div>
            )}

            {/* Answer */}
            {answer && (
              <div style={{
                marginTop: 32,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16, overflow: "hidden",
                animation: "slideUp 0.3s ease"
              }}>
                <div style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "rgba(255,255,255,0.02)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: "#22c55e",
                      boxShadow: "0 0 8px rgba(34,197,94,0.6)"
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af" }}>생성된 답변 초안</span>
                  </div>
                  <button onClick={copyAnswer}
                    style={{
                      padding: "6px 14px", borderRadius: 8,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#9ca3af", fontSize: 12, cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => { e.target.style.background = "rgba(255,255,255,0.1)"; e.target.style.color = "#e8eaf0"; }}
                    onMouseLeave={e => { e.target.style.background = "rgba(255,255,255,0.05)"; e.target.style.color = "#9ca3af"; }}
                  >
                    복사하기
                  </button>
                </div>
                <div style={{ padding: "24px 24px", fontSize: 14, lineHeight: 1.9, color: "#d1d5db", whiteSpace: "pre-wrap" }}>
                  {answer}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        textarea::placeholder { color: #374151; }
      `}</style>
    </div>
  );
}
