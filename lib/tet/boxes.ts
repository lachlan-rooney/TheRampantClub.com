// ═══════════════════════════════════════════════════════════════════════════
// THE DESIGN COMPANY'S BOX COVERS — twelve of them, and how each one folds.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-25: a folder of new cover options, to be background-removed
// and shown on the Tết page as foldable boxes. The cutouts and every number
// below came out of scripts/tet/box-cutouts.mjs, which reads the artwork
// rather than being told about it; lib/tet/box-measurements.json is its
// output, and this file is the reading of it.
//
// ONE DIELINE, ELEVEN COVERS. Every 2752 × 1069 cover has its outline at the
// same four places — a glue flap, then four faces under a gabled top:
//
//   x    0 –  115  flap: it tucks inside and is never seen
//   x  115 –  878  the warning and barcode panel        763 wide
//   x  878 – 1652  THE ILLUSTRATION, under the gable    774 wide
//   x 1652 – 2415  Duncan Taylor's text                 763 wide
//   x 2415 – 3200  the crest                            785 wide
//
// Opposite faces match — 763 against 763, and 774 against 785, 1.4% apart —
// which is what says the reading is right: opposite faces of a box must be
// the same size, and if this were mis-read they would not be.
//
// The ±2 px between covers (some measure 114/877/1654/2417) is the JPEG's
// edge, not a different dieline, so one set of folds is used for all eleven
// and each is drawn from its own artwork.
//
// THE TWELFTH IS NOT THE SAME BOX. "COVER COMBO 3 Chai" is 2732 × 1397 with
// no gable and no shoulders — a wrap for the three-bottle box. It has no fold
// table here, so it is shown flat and says so, exactly as Sleeve 2 did until
// its dieline was confirmed. Guessing folds would draw a box that does not
// exist.
//
// ⚠ THE NAMES. Where the artwork signs itself — Chợ Bến Thành, BƯU ĐIỆN — the
// name is read off the picture. Where it does not, the landmark is named only
// when it is unmistakable (the Opera House, Tháp Rùa, Long Biên, Dinh Độc
// Lập). Two are described rather than named, because being wrong in print
// about somebody's temple is worse than being vague.
// ═══════════════════════════════════════════════════════════════════════════

export interface BoxFace { x: number; w: number }

export interface BoxFolds {
  /** The cutout these numbers describe. */
  art: { w: number; h: number; top: number; bottom: number }
  /** Around the box: left end, front, right end, back. */
  faces: { endL: BoxFace; front: BoxFace; endR: BoxFace; back: BoxFace }
}

export interface TetBox {
  slug: string
  /** EN, VN. */
  name: [string, string]
  /** What the tall panel shows, EN and VN. */
  subject: [string, string]
  /** True where the landmark is read off the artwork's own signage. */
  signed?: boolean
  /** Three bottles rather than one. */
  combo?: boolean
  folds: BoxFolds | null
}

/** The shared dieline, in the 3200-wide cutout's own pixels. */
export const HOUSE_FOLDS: BoxFolds = {
  art: { w: 3200, h: 1243, top: 2, bottom: 1242 },
  faces: {
    endL:  { x: 115,  w: 763 },   // warning, barcode
    front: { x: 878,  w: 774 },   // the illustration, under the gable
    endR:  { x: 1652, w: 763 },   // Duncan Taylor
    back:  { x: 2415, w: 785 },   // the crest
  },
}

export const BOXES: TetBox[] = [
  { slug: 'cover-hop-ruou-01', name: ['Chợ Bến Thành', 'Chợ Bến Thành'],
    subject: ['The market clock tower, Sài Gòn', 'Tháp đồng hồ chợ Bến Thành, Sài Gòn'], signed: true, folds: HOUSE_FOLDS },
  { slug: 'cover-hop-ruou-02', name: ['The temple gate', 'Cổng tam quan'],
    subject: ['A triple gateway under cloud', 'Cổng tam quan dưới mây'], folds: HOUSE_FOLDS },
  { slug: 'cover-hop-ruou-03', name: ['Khuê Văn Các', 'Khuê Văn Các'],
    subject: ['The pavilion over the lotus pond, Hà Nội', 'Gác Khuê Văn bên hồ sen, Hà Nội'], folds: HOUSE_FOLDS },
  { slug: 'cover-hop-ruou-04', name: ['Bưu Điện', 'Bưu Điện'],
    subject: ['The Central Post Office, Sài Gòn', 'Bưu điện Trung tâm, Sài Gòn'], signed: true, folds: HOUSE_FOLDS },
  { slug: 'cover-hop-ruou-05', name: ['Dinh Độc Lập', 'Dinh Độc Lập'],
    subject: ['The palace and its fountain, Sài Gòn', 'Dinh và đài phun nước, Sài Gòn'], folds: HOUSE_FOLDS },
  { slug: 'cover-hop-ruou-06', name: ['Tháp Rùa', 'Tháp Rùa'],
    subject: ['The tower on Hoàn Kiếm lake, Hà Nội', 'Tháp Rùa hồ Hoàn Kiếm, Hà Nội'], folds: HOUSE_FOLDS },
  { slug: 'cover-hop-ruou-07', name: ['The Opera House', 'Nhà hát Thành phố'],
    subject: ['Nhà hát Thành phố, Sài Gòn', 'Nhà hát Thành phố, Sài Gòn'], folds: HOUSE_FOLDS },
  { slug: 'cover-hop-ruou-08', name: ['Cầu Long Biên', 'Cầu Long Biên'],
    subject: ['The bridge over the Red River, Hà Nội', 'Cầu bắc qua sông Hồng, Hà Nội'], folds: HOUSE_FOLDS },
  { slug: 'cover-combo-3-v1', name: ['The dragon · Chợ Bến Thành', 'Rồng · Chợ Bến Thành'],
    subject: ['A dragon above the market', 'Rồng bay trên chợ'], combo: true, folds: HOUSE_FOLDS },
  { slug: 'cover-combo-3-v2', name: ['The dragon · City Hall', 'Rồng · Trụ sở UBND'],
    subject: ['A dragon above the old Hôtel de Ville', 'Rồng bay trên toà thị chính cũ'], combo: true, folds: HOUSE_FOLDS },
  { slug: 'cover-combo-3-v3', name: ['The dragon · the cathedral', 'Rồng · Nhà thờ Đức Bà'],
    subject: ['A dragon above Notre-Dame, Sài Gòn', 'Rồng bay trên Nhà thờ Đức Bà, Sài Gòn'], combo: true, folds: HOUSE_FOLDS },
  { slug: 'cover-combo-3-chai', name: ['The three-bottle wrap', 'Hộp ba chai'],
    subject: ['The dragon over the whole skyline', 'Rồng bay trên toàn cảnh thành phố'], combo: true, folds: null },
]

export const boxArt = (slug: string, px: 640 | 1600 | 3200 = 1600) =>
  `/images/tet/boxes/${slug}-${px}.webp`
