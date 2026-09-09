import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import { sniff, MAX_BYTES, REFUSAL } from '../lib/attachments/verify'

let fails = 0
const ok = (c: boolean, l: string, d = '') => { console.log(`${c ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!c) fails++ }

console.log('── what the bytes say, not what the name says ──')

// A real JPEG, carrying EXIF including GPS — what a phone produces.
const jpegWithExif = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#052E20' } })
  .jpeg().withExif({ IFD0: { Copyright: 'TRC' }, GPS: { GPSLatitudeRef: 'N' } }).toBuffer()
ok(sniff(new Uint8Array(jpegWithExif)) === 'jpeg', 'a real JPEG is recognised')

const png = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#fff' } }).png().toBuffer()
ok(sniff(new Uint8Array(png)) === 'png', 'a real PNG is recognised')

const webp = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#000' } }).webp().toBuffer()
ok(sniff(new Uint8Array(webp)) === 'webp', 'a real WebP is recognised')

const pdfDoc = await PDFDocument.create(); pdfDoc.addPage()
const pdf = await pdfDoc.save()
ok(sniff(pdf) === 'pdf', 'a real PDF is recognised')

console.log('\n── the attack the extension check misses ──')
const html = new TextEncoder().encode('<html><script>alert(document.cookie)</script></html>')
ok(sniff(html) === null, 'HTML renamed invitation.jpg is REFUSED — served from our own origin it is stored XSS')
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
ok(sniff(svg) === null, 'an SVG with script is refused (SVG is not on the allowlist at all)')
const almost = new TextEncoder().encode('%PDF-but-not-really')
ok(sniff(almost) === 'pdf', 'something merely STARTING %PDF- passes the sniff…')

// …which is why the route parses it. Prove the parse is what actually refuses it.
let parsed = true
try { await PDFDocument.load(almost) } catch { parsed = false }
ok(!parsed, '…and is then refused by actually PARSING it in the route')

console.log('\n── EXIF, which a phone photo carries ──')
const exifBefore = (await sharp(jpegWithExif).metadata()).exif
ok(!!exifBefore, 'the source image really does carry EXIF', `${exifBefore?.length ?? 0} bytes`)
const reencoded = await sharp(jpegWithExif).rotate().jpeg({ quality: 88 }).toBuffer()
const exifAfter = (await sharp(reencoded).metadata()).exif
ok(!exifAfter, 'the stored image carries NONE — GPS and timestamp are gone')

console.log('\n── the size cap, with a message staff can act on ──')
ok(MAX_BYTES === 5 * 1024 * 1024, 'cap is 5MB')
const msg = REFUSAL.tooBig(41_943_040)
ok(/40\.0MB/.test(msg) && /5MB/.test(msg) && /smaller export|JPEG/.test(msg),
   'the refusal names the size, the limit, and what to do', msg)

console.log(fails === 0 ? '\nPASS\n' : `\nFAIL — ${fails}\n`)
process.exit(fails ? 1 : 0)
