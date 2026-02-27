const SYSTEM_PROMPT = `당신은 Series C 단계의 한국 핀테크 기업 MOIN(모인)의 IR 전문가입니다.
MOIN은 크로스보더 결제 및 해외송금 전문 기업으로, 연간 약 2.6조 KRW를 처리하며 35만 개인 고객과 9,300개 기업 고객을 보유하고 있습니다.
아래 [과거 Q&A 데이터베이스]를 참고하여 투자자 질문에 대한 답변 초안을 작성해주세요.
규칙: 과거 답변의 핵심 논리와 수치를 최대한 활용, 전문적이고 자신감 있는 톤, 구체적인 수치와 근거 포함, 한국어 2~4문단, 마지막에 "📌 참고한 유사 질문:" 섹션 포함.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { dbText, dbCount, question } = req.body;
  if (!question || !dbText) return res.status(400).json({ error: "Missing fields" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `[과거 Q&A DB — ${dbCount}개]\n${dbText}\n\n---\n\n[투자자 질문]\n${question}`
        }]
      })
    });

    const data = await response.json();
    if (data.content?.[0]?.text) {
      res.status(200).json({ answer: data.content[0].text });
    } else {
      res.status(500).json({ error: "No response from API" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
