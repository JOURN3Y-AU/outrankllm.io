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

export function Journ3yAttribution() {
  return (
    <div className="flex flex-col items-center" style={{ marginTop: '48px', gap: '1px' }}>
      <span className="font-mono text-[0.6rem] text-[var(--text-dim)] uppercase tracking-widest">
        Designed and Developed by JOURN3Y Pty Ltd
      </span>
      <a
        href="https://journ3y.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center opacity-80 hover:opacity-100 transition-opacity"
      >
        <Image
          src="/images/JOURN3Y_SQUARE_PNG.png"
          alt="JOURN3Y"
          width={21}
          height={21}
          className="object-contain"
        />
        <Image
          src="/images/JOURN3Y_WHITE LOGO_PNG.png"
          alt="JOURN3Y Pty Ltd"
          width={125}
          height={35}
          className="object-contain"
          style={{ marginLeft: '-16px' }}
        />
      </a>
    </div>
  )
}
