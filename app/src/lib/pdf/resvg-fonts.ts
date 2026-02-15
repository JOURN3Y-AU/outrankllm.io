/**
 * Shared font loading for resvg-js SVG→PNG rendering
 * Writes embedded TTF fonts to temp files (resvg-js requires file paths)
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { outfit_bold } from '@/lib/pdf/fonts/Outfit-Bold'
import { outfit_regular } from '@/lib/pdf/fonts/Outfit-Regular'
import { sourcesans3_regular } from '@/lib/pdf/fonts/SourceSans3-Regular'
import { sourcesans3_bold } from '@/lib/pdf/fonts/SourceSans3-Bold'

let fontFilePaths: string[] | null = null

export function getResvgFontFiles(): string[] {
  if (fontFilePaths) return fontFilePaths

  const tmpDir = path.join(os.tmpdir(), 'hb-fonts')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

  const fonts = [
    { name: 'Outfit-Regular.ttf', data: outfit_regular },
    { name: 'Outfit-Bold.ttf', data: outfit_bold },
    { name: 'SourceSans3-Regular.ttf', data: sourcesans3_regular },
    { name: 'SourceSans3-Bold.ttf', data: sourcesans3_bold },
  ]

  fontFilePaths = fonts.map(f => {
    const filePath = path.join(tmpDir, f.name)
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, Buffer.from(f.data, 'base64'))
    }
    return filePath
  })

  return fontFilePaths
}

export const RESVG_FONT_OPTS = {
  get font() {
    return {
      fontFiles: getResvgFontFiles(),
      loadSystemFonts: false,
      defaultFontFamily: 'Outfit',
    }
  },
}
