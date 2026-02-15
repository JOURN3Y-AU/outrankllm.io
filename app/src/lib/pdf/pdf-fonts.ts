/**
 * PDF Font Registration
 * Loads Outfit and Source Sans 3 into jsPDF's virtual filesystem
 */

import type { jsPDF } from 'jspdf'
import { outfit_regular } from './fonts/Outfit-Regular'
import { outfit_bold } from './fonts/Outfit-Bold'
import { sourcesans3_regular } from './fonts/SourceSans3-Regular'
import { sourcesans3_bold } from './fonts/SourceSans3-Bold'

export function registerFonts(doc: jsPDF) {
  // Outfit (display font)
  doc.addFileToVFS('Outfit-Regular.ttf', outfit_regular)
  doc.addFont('Outfit-Regular.ttf', 'Outfit', 'normal')
  doc.addFileToVFS('Outfit-Bold.ttf', outfit_bold)
  doc.addFont('Outfit-Bold.ttf', 'Outfit', 'bold')

  // Source Sans 3 (body font)
  doc.addFileToVFS('SourceSans3-Regular.ttf', sourcesans3_regular)
  doc.addFont('SourceSans3-Regular.ttf', 'SourceSans3', 'normal')
  doc.addFileToVFS('SourceSans3-Bold.ttf', sourcesans3_bold)
  doc.addFont('SourceSans3-Bold.ttf', 'SourceSans3', 'bold')
}
