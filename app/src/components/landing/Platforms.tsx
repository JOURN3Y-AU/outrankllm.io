import Image from 'next/image'

export function Platforms() {
  return (
    <div className="flex flex-col items-center gap-3" style={{ marginBottom: '32px' }}>
      <span className="font-mono text-[0.65rem] text-[var(--text-dim)] uppercase tracking-widest">
        Tests your visibility on
      </span>
      <div className="flex gap-6">
        <div className="platform">
          <Image
            src="/images/ChatGPT-Logo.png"
            alt="ChatGPT"
            width={42}
            height={42}
            className="object-contain invert"
          />
          ChatGPT
        </div>
        <div className="platform">
          <Image
            src="/images/Claude_AI_symbol.svg.png"
            alt="Claude"
            width={20}
            height={20}
            className="object-contain"
          />
          Claude
        </div>
        <div className="platform">
          <Image
            src="/images/Google_Gemini_icon_2025.svg.png"
            alt="Gemini"
            width={20}
            height={20}
            className="object-contain"
          />
          Gemini
        </div>
        <div className="platform">
          <Image
            src="/images/perplexity-color.png"
            alt="Perplexity"
            width={20}
            height={20}
            className="object-contain"
          />
          Perplexity
        </div>
      </div>
    </div>
  )
}

export function WorksWith() {
  return (
    <div className="font-mono text-[0.7rem] text-[var(--text-dim)] text-center">
      Trusted by business owners, developers, vibe coders and agencies
    </div>
  )
}
