'use client'

const pixels = [
  { color: 'red', size: 'md', style: { top: '12%', left: '8%' }, delay: '0s' },
  { color: 'green', size: 'lg', style: { top: '25%', right: '12%' }, delay: '-4s' },
  { color: 'blue', size: 'sm', style: { top: '65%', left: '5%' }, delay: '-8s' },
  { color: 'amber', size: 'md', style: { top: '78%', right: '8%' }, delay: '-2s' },
  { color: 'green', size: 'sm', style: { top: '45%', left: '3%' }, delay: '-6s' },
  { color: 'red', size: 'sm', style: { top: '55%', right: '6%' }, delay: '-10s' },
  { color: 'blue', size: 'md', style: { top: '18%', left: '85%' }, delay: '-12s' },
  { color: 'amber', size: 'sm', style: { top: '88%', left: '15%' }, delay: '-3s' },
  { color: 'green', size: 'md', style: { top: '8%', left: '50%' }, delay: '-7s' },
  { color: 'blue', size: 'sm', style: { top: '35%', right: '20%' }, delay: '-9s' },
  { color: 'red', size: 'lg', style: { top: '70%', right: '25%' }, delay: '-5s' },
  { color: 'amber', size: 'md', style: { top: '92%', right: '40%' }, delay: '-11s' },
]

export function FloatingPixels() {
  return (
    <div className="pixels-container">
      {pixels.map((pixel, index) => (
        <div
          key={index}
          className={`pixel ${pixel.color} ${pixel.size}`}
          style={{
            ...pixel.style,
            animationDelay: pixel.delay,
          }}
        />
      ))}
    </div>
  )
}
