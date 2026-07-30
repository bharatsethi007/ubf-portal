import { Font } from '@react-pdf/renderer'
let registered = false
export function registerQuoteFonts() {
  if (registered) return
  registered = true
  Font.register({ family: 'General Sans', fonts: [
    { src: '/fonts/pdf/GeneralSans-400.ttf', fontWeight: 400 },
    { src: '/fonts/pdf/GeneralSans-500.ttf', fontWeight: 500 },
    { src: '/fonts/pdf/GeneralSans-600.ttf', fontWeight: 600 },
    { src: '/fonts/pdf/GeneralSans-700.ttf', fontWeight: 700 },
  ]})
  Font.registerHyphenationCallback((w) => [w])
}
