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
      </div>
    </div>
  )
}

export function WorksWith() {
  return (
    <div className="flex items-center gap-4 font-mono text-[0.7rem] text-[var(--text-dim)]">
      Works with{' '}
      <span className="text-[var(--text-mid)]">Bolt.new</span>
      <span>·</span>
      <span className="text-[var(--text-mid)]">Lovable</span>
      <span>·</span>
      <span className="text-[var(--text-mid)]">Cursor</span>
      <span>·</span>
      <span className="text-[var(--text-mid)]">Replit</span>
      <span>·</span>
      <span className="text-[var(--text-mid)]">v0</span>
    </div>
  )
}
