# Whisky flavour-tagging — Phase 0 calibration report

Model: `claude-opus-4-7` · taxonomy: SMWS-style two-tier (12 categories) · two signals: **confidence** (present?) + **intensity 1-4** (how strong — the radar spokes) · all rows `confirmed=false`.

## Summary
- Calibration batch: **44** bottles — rich 28, thin 8, empty 8.
- **Rich** notes that produced a radar: **28/28**.
- **Thin** notes that produced a radar: **1/8** (expect ~0).
- **Empty** notes that produced a radar: **0/8** (MUST be 0 — any spoke here = hallucination).
- **150** category spokes + **339** descriptor tags. Descriptor avg confidence **0.85**.
- Intensity spread (spokes at each level): 1=32, 2=78, 3=35, 4=5.
- Off-taxonomy attempts rejected by the validator: **1**.

### ⚠ Off-taxonomy attempts (rejected, not written):
- GlenAllachie GlenAllachie 10yo Cask Strength Batch 12 Single Malt: `spicy_dry/clove` — descriptor not in category


## RICH notes

### Aberfeldy Aberfeldy 12yo Single Malt
*Highland · 12yo · notes "rich"*

> **Notes:** Nose: Heather honey, vanilla, ripe pear and a light waxy note. Palate: Smooth and honeyed, with malted cereal, orange marmalade, mild green apple and a touch of toasted oak. Finish: Medium length, gently sweet with honey, soft spice and a clean malty fade.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ██·· 2  (conf 0.85)
  Sweet, Fruity & Mellow     ███· 3  (conf 0.95)
  Spicy & Sweet              █··· 1  (conf 0.70)
  Spicy & Dry                ···· 0
  Deep, Rich & Dried Fruits  ···· 0
  Old & Dignified            █··· 1  (conf 0.50)
  Light & Delicate           ██·· 2  (conf 0.70)
  Juicy, Oak & Vanilla       ██·· 2  (conf 0.80)
  Oily & Coastal             ···· 0
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Sweet, Fruity & Mellow › honey — `0.95` · _“Heather honey ... Smooth and honeyed”_
- Sweet, Fruity & Mellow › vanilla — `0.90` · _“vanilla”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.90` · _“ripe pear”_
- Young & Spritely › cereal — `0.90` · _“malted cereal”_
- Young & Spritely › green_apple — `0.85` · _“mild green apple”_
- Young & Spritely › citrus_zest — `0.75` · _“orange marmalade”_
- Young & Spritely › fresh_malt — `0.80` · _“clean malty fade”_
- Juicy, Oak & Vanilla › vanilla — `0.90` · _“vanilla”_
- Juicy, Oak & Vanilla › toasted_oak — `0.85` · _“a touch of toasted oak”_
- Light & Delicate › light_honey — `0.85` · _“Heather honey”_
- Old & Dignified › beeswax — `0.50` · _“a light waxy note”_
- Spicy & Sweet › honeyed_spice — `0.70` · _“gently sweet with honey, soft spice”_

_model note: Rich, classic honeyed-Highland profile; waxy note is light so old_dignified kept faint._

### Ardbeg Ardbeg Corryvrechan Single Malt
*Islay · notes "rich"*

> **Notes:** Nose: Tarry rope, black pepper, charred oak, blue cheese, and dark chocolate over briny smoke. Palate: Oily and powerful, with creosote, espresso, cracked pepper, smoked meats, and a wave of seaweed and dark berry fruit. Finish: Long, peppery and smoky, with bitter chocolate, salt and lingering ashy peat.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ···· 0
  Spicy & Sweet              ···· 0
  Spicy & Dry                ███· 3  (conf 0.90)
  Deep, Rich & Dried Fruits  ██·· 2  (conf 0.80)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ███· 3  (conf 0.95)
  Lightly Peated             ···· 0
  Peated                     ████ 4  (conf 0.95)
  Heavily Peated             ████ 4  (conf 0.90)
```
**Descriptors:**
- Heavily Peated › creosote — `0.98` · _“creosote”_
- Heavily Peated › intense_smoke — `0.80` · _“briny smoke ... long, peppery and smoky”_
- Peated › smoked_meat — `0.98` · _“smoked meats”_
- Peated › ash — `0.95` · _“lingering ashy peat”_
- Peated › tar — `0.95` · _“Tarry rope”_
- Oily & Coastal › seaweed — `0.98` · _“wave of seaweed”_
- Oily & Coastal › brine — `0.95` · _“briny smoke”_
- Oily & Coastal › sea_salt — `0.90` · _“salt”_
- Oily & Coastal › oily_texture — `0.95` · _“Oily and powerful”_
- Spicy & Dry › black_pepper — `0.98` · _“black pepper ... cracked pepper”_
- Spicy & Dry › char — `0.90` · _“charred oak”_
- Spicy & Dry › oak_tannin — `0.60` · _“charred oak”_
- Deep, Rich & Dried Fruits › dark_chocolate — `0.95` · _“dark chocolate ... bitter chocolate”_
- Deep, Rich & Dried Fruits › dried_fruit — `0.50` · _“dark berry fruit”_

_model note: Rich, classic heavily-peated coastal profile with pepper and dark chocolate accents._

### Arran Signature Series Signature Series Edition 1 Remnant Renegade
*Islands · notes "rich"*

> **Notes:** Nose: Tropical fruits, mango and pineapple, with vanilla cream, light orange peel and a wisp of charred oak. Palate: Honeyed barley, banana bread and toffee, building into peppery oak, cinnamon and a savoury smoky edge from the peated component. Finish: Medium length, drying, with lingering sweet smoke, ginger and citrus zest.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           █··· 1  (conf 0.70)
  Sweet, Fruity & Mellow     ███· 3  (conf 0.95)
  Spicy & Sweet              ██·· 2  (conf 0.90)
  Spicy & Dry                ██·· 2  (conf 0.85)
  Deep, Rich & Dried Fruits  ···· 0
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ███· 3  (conf 0.90)
  Oily & Coastal             ···· 0
  Lightly Peated             ██·· 2  (conf 0.90)
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Sweet, Fruity & Mellow › vanilla — `0.95` · _“vanilla cream”_
- Sweet, Fruity & Mellow › honey — `0.90` · _“Honeyed barley”_
- Sweet, Fruity & Mellow › toffee — `0.95` · _“banana bread and toffee”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.50` · _“Tropical fruits, mango and pineapple”_
- Juicy, Oak & Vanilla › vanilla — `0.95` · _“vanilla cream”_
- Juicy, Oak & Vanilla › banana — `0.90` · _“banana bread”_
- Juicy, Oak & Vanilla › butterscotch — `0.60` · _“toffee”_
- Juicy, Oak & Vanilla › toasted_oak — `0.70` · _“wisp of charred oak”_
- Spicy & Sweet › cinnamon — `0.95` · _“cinnamon”_
- Spicy & Sweet › ginger — `0.95` · _“ginger”_
- Spicy & Dry › black_pepper — `0.90` · _“peppery oak”_
- Spicy & Dry › oak_tannin — `0.80` · _“peppery oak... drying”_
- Spicy & Dry › char — `0.70` · _“wisp of charred oak”_
- Lightly Peated › gentle_smoke — `0.90` · _“lingering sweet smoke”_
- Lightly Peated › soft_peat — `0.85` · _“savoury smoky edge from the peated component”_
- Young & Spritely › citrus_zest — `0.95` · _“citrus zest”_

### Benromach Benromach Contracts Peat Smoke 2014 Single Malt
*Highland · Vintage 2014 · notes "rich"*

> **Notes:** Nose: Bonfire smoke, smoked bacon, vanilla and orchard fruit, with a light coastal brine. Palate: Sweet peat, barley sugar, toasted oak and pear, with cracked black pepper and ginger warmth. Finish: Long, dry and ashy, with lingering malt sweetness and a whisper of liquorice.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.90)
  Spicy & Sweet              ██·· 2  (conf 0.85)
  Spicy & Dry                ██·· 2  (conf 0.85)
  Deep, Rich & Dried Fruits  ···· 0
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ██·· 2  (conf 0.80)
  Oily & Coastal             █··· 1  (conf 0.70)
  Lightly Peated             ···· 0
  Peated                     ███· 3  (conf 0.95)
  Heavily Peated             ···· 0
```
**Descriptors:**
- Peated › bonfire_smoke — `0.98` · _“Bonfire smoke”_
- Peated › smoked_meat — `0.95` · _“smoked bacon”_
- Peated › ash — `0.95` · _“Long, dry and ashy”_
- Sweet, Fruity & Mellow › vanilla — `0.90` · _“vanilla and orchard fruit”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.95` · _“vanilla and orchard fruit”_
- Juicy, Oak & Vanilla › vanilla — `0.85` · _“vanilla”_
- Juicy, Oak & Vanilla › toasted_oak — `0.95` · _“toasted oak”_
- Spicy & Sweet › ginger — `0.95` · _“ginger warmth”_
- Spicy & Dry › black_pepper — `0.95` · _“cracked black pepper”_
- Spicy & Dry › dry_spice — `0.75` · _“Long, dry and ashy”_
- Oily & Coastal › brine — `0.90` · _“a light coastal brine”_

_model note: Confident peated profile with sweet/oak/spice support; coastal note is explicitly light._

### Bunnahabhain Feis IIe 2023 Canasta Cask Matured
*Islay · notes "rich"*

> **Notes:** Nose: Rich sherried fruit, raisin, dark chocolate and a wisp of coastal salt with faint smoke. Palate: Sweet sticky toffee, fig, walnut and orange peel, layered with brine, leather and gentle peat. Finish: Long, drying oak, dark cocoa, hazelnut and lingering maritime smoke.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.85)
  Spicy & Sweet              ···· 0
  Spicy & Dry                ██·· 2  (conf 0.85)
  Deep, Rich & Dried Fruits  ███· 3  (conf 0.95)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ██·· 2  (conf 0.90)
  Lightly Peated             █··· 1  (conf 0.85)
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Deep, Rich & Dried Fruits › raisin — `0.98` · _“raisin”_
- Deep, Rich & Dried Fruits › dark_chocolate — `0.95` · _“dark chocolate”_
- Deep, Rich & Dried Fruits › fig — `0.98` · _“fig”_
- Deep, Rich & Dried Fruits › walnut — `0.95` · _“walnut”_
- Deep, Rich & Dried Fruits › dried_fruit — `0.85` · _“Rich sherried fruit”_
- Sweet, Fruity & Mellow › toffee — `0.95` · _“Sweet sticky toffee”_
- Oily & Coastal › sea_salt — `0.90` · _“wisp of coastal salt”_
- Oily & Coastal › brine — `0.95` · _“brine”_
- Oily & Coastal › mineral — `0.60` · _“lingering maritime smoke”_
- Lightly Peated › gentle_smoke — `0.90` · _“faint smoke”_
- Lightly Peated › soft_peat — `0.90` · _“gentle peat”_
- Spicy & Dry › oak_tannin — `0.90` · _“Long, drying oak”_
- Spicy & Dry › leather — `0.95` · _“leather”_

_model note: Confident sherry+coastal+light peat profile; orange peel didn't map cleanly to a citrus descriptor under sweet_fruity_mellow so tagged via toffee only._

### Clynelish Clynelish 14yo Single Malt
*Highland · 14yo · notes "rich"*

> **Notes:** Nose: Beeswax, lemon zest, sea spray and light honey with a waxy mineral edge. Palate: Oily mouthfeel, candle wax, orchard fruits, salted toffee and a touch of pepper. Finish: Medium-long, drying, with citrus peel, brine and lingering waxiness.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.85)
  Spicy & Sweet              ···· 0
  Spicy & Dry                █··· 1  (conf 0.70)
  Deep, Rich & Dried Fruits  ···· 0
  Old & Dignified            ███· 3  (conf 0.90)
  Light & Delicate           ██·· 2  (conf 0.85)
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ███· 3  (conf 0.90)
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Old & Dignified › beeswax — `0.95` · _“Beeswax”_
- Light & Delicate › lemon — `0.90` · _“lemon zest”_
- Light & Delicate › light_honey — `0.95` · _“light honey”_
- Oily & Coastal › sea_salt — `0.85` · _“sea spray”_
- Oily & Coastal › mineral — `0.85` · _“waxy mineral edge”_
- Oily & Coastal › oily_texture — `0.95` · _“Oily mouthfeel”_
- Oily & Coastal › brine — `0.90` · _“brine”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.90` · _“orchard fruits”_
- Sweet, Fruity & Mellow › toffee — `0.90` · _“salted toffee”_
- Spicy & Dry › black_pepper — `0.80` · _“a touch of pepper”_
- Spicy & Dry › dry_spice — `0.60` · _“Medium-long, drying”_

_model note: Classic waxy/coastal profile clearly described; confident tagging across spokes._

### Cu Bocan 15YO
*Highland · notes "rich"*

> **Notes:** Nose: Light peat smoke, vanilla, baked apple and a touch of toasted coconut. Palate: Creamy mouthfeel with honeyed barley, soft wood smoke, ginger, citrus peel and brown sugar. Finish: Medium length, drying smoke, oak spice and lingering sweet malt.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           █··· 1  (conf 0.60)
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.90)
  Spicy & Sweet              ██·· 2  (conf 0.85)
  Spicy & Dry                █··· 1  (conf 0.70)
  Deep, Rich & Dried Fruits  ···· 0
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ██·· 2  (conf 0.80)
  Oily & Coastal             ···· 0
  Lightly Peated             ██·· 2  (conf 0.90)
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Lightly Peated › soft_peat — `0.90` · _“Light peat smoke”_
- Lightly Peated › gentle_smoke — `0.90` · _“soft wood smoke”_
- Sweet, Fruity & Mellow › vanilla — `0.95` · _“vanilla”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.90` · _“baked apple”_
- Sweet, Fruity & Mellow › honey — `0.90` · _“honeyed barley”_
- Juicy, Oak & Vanilla › coconut — `0.90` · _“a touch of toasted coconut”_
- Juicy, Oak & Vanilla › vanilla — `0.90` · _“vanilla”_
- Spicy & Sweet › ginger — `0.95` · _“ginger”_
- Spicy & Sweet › honeyed_spice — `0.70` · _“honeyed barley ... ginger”_
- Spicy & Dry › oak_tannin — `0.70` · _“oak spice”_
- Spicy & Dry › dry_spice — `0.75` · _“drying smoke, oak spice”_
- Young & Spritely › citrus_zest — `0.85` · _“citrus peel”_

_model note: Clear lightly-peated profile with vanilla/coconut bourbon-cask sweetness, baked apple and honey, plus warming ginger and a drying oak finish._

### Duncan Taylor Black Bull 21yo Blended Scotch
*Highland · 21yo · notes "rich"*

> **Notes:** Nose: Rich sherry influence, dark chocolate, dried figs, orange peel and a whiff of oak spice. Palate: Full-bodied and oily, malty fruitcake, raisins, toffee, leather and clove, with the high malt content (50%) lending cereal depth. Finish: Long, warming and spicy, with lingering sherried fruit, dark sugar and gentle tannic oak.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           █··· 1  (conf 0.70)
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.85)
  Spicy & Sweet              ██·· 2  (conf 0.85)
  Spicy & Dry                ██·· 2  (conf 0.90)
  Deep, Rich & Dried Fruits  ████ 4  (conf 0.98)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ···· 0
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Deep, Rich & Dried Fruits › dark_chocolate — `0.98` · _“dark chocolate”_
- Deep, Rich & Dried Fruits › fig — `0.98` · _“dried figs”_
- Deep, Rich & Dried Fruits › raisin — `0.98` · _“raisins”_
- Deep, Rich & Dried Fruits › christmas_cake — `0.85` · _“malty fruitcake”_
- Deep, Rich & Dried Fruits › dried_fruit — `0.95` · _“lingering sherried fruit”_
- Sweet, Fruity & Mellow › toffee — `0.95` · _“toffee”_
- Spicy & Sweet › clove — `0.95` · _“clove”_
- Spicy & Sweet › baking_spice — `0.75` · _“Long, warming and spicy”_
- Spicy & Dry › oak_tannin — `0.95` · _“gentle tannic oak”_
- Spicy & Dry › leather — `0.95` · _“leather”_
- Spicy & Dry › dry_spice — `0.80` · _“whiff of oak spice”_
- Young & Spritely › cereal — `0.85` · _“cereal depth”_

_model note: Classic sherried blend; rich_dried_fruits clearly dominant, with supporting oak/spice and a cereal undercurrent from the high malt content._

### Duncan Taylor Bunnahabhain 19 Year Old Single Cask
*Islay · 19 years · notes "rich"*

> **Notes:** Nose (Aroma) Dark Fruits: Rich sherry, raisins, and dried figs.Sweet Pastry: Caramel, orange zest, and citrus sponge cake.Coastal Air: Traditional Islay maritime salinity. Palate (Taste)Mouthfeel: Oily, full-bodied, and robustly warming.Sweet Spice: Molasses, spiced fruitcake, and dark chocolate.Fruit Balance: Tropical pineapple and crisp green apple.🏁 Finish Duration: Long, drying, and elegant.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           █··· 1  (conf 0.70)
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.85)
  Spicy & Sweet              ██·· 2  (conf 0.85)
  Spicy & Dry                █··· 1  (conf 0.60)
  Deep, Rich & Dried Fruits  ███· 3  (conf 0.95)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ██·· 2  (conf 0.90)
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Deep, Rich & Dried Fruits › raisin — `0.95` · _“raisins”_
- Deep, Rich & Dried Fruits › fig — `0.95` · _“dried figs”_
- Deep, Rich & Dried Fruits › dark_chocolate — `0.90` · _“dark chocolate”_
- Deep, Rich & Dried Fruits › christmas_cake — `0.80` · _“spiced fruitcake”_
- Sweet, Fruity & Mellow › caramel — `0.90` · _“Caramel”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.60` · _“crisp green apple”_
- Oily & Coastal › sea_salt — `0.85` · _“Islay maritime salinity”_
- Oily & Coastal › brine — `0.70` · _“maritime salinity”_
- Oily & Coastal › oily_texture — `0.95` · _“Mouthfeel: Oily, full-bodied”_
- Spicy & Sweet › baking_spice — `0.80` · _“spiced fruitcake”_
- Young & Spritely › green_apple — `0.90` · _“crisp green apple”_
- Young & Spritely › citrus_zest — `0.85` · _“orange zest”_
- Spicy & Dry › dry_spice — `0.60` · _“Long, drying, and elegant”_

_model note: Rich sherry-led prose with coastal/oily texture; tropical pineapple noted but no clean taxonomy slot, skipped._

### GlenAllachie GlenAllachie 10yo Cask Strength Batch 12 Single Malt
*Speyside · 10yo · notes "rich"*

> **Notes:** Nose: Rich sherry, dark chocolate, fig roll, toasted almonds and a waft of cinnamon-spiced orange peel. Palate: Thick and oily, dates, treacle, raisin, baked apple, oak tannin and clove with a peppery cask-strength kick. Finish: Long, drying, with bitter chocolate, stewed berries, ginger and lingering oak spice.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.80)
  Spicy & Sweet              ██·· 2  (conf 0.90)
  Spicy & Dry                ███· 3  (conf 0.95)
  Deep, Rich & Dried Fruits  ████ 4  (conf 0.98)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ···· 0
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Deep, Rich & Dried Fruits › dark_chocolate — `0.98` · _“dark chocolate”_
- Deep, Rich & Dried Fruits › fig — `0.95` · _“fig roll”_
- Deep, Rich & Dried Fruits › raisin — `0.97` · _“raisin”_
- Deep, Rich & Dried Fruits › date — `0.95` · _“dates”_
- Deep, Rich & Dried Fruits › dried_fruit — `0.85` · _“stewed berries”_
- Spicy & Sweet › cinnamon — `0.95` · _“cinnamon-spiced orange peel”_
- Spicy & Sweet › ginger — `0.95` · _“ginger”_
- Spicy & Dry › oak_tannin — `0.95` · _“oak tannin”_
- Spicy & Dry › black_pepper — `0.90` · _“peppery cask-strength kick”_
- Spicy & Dry › dry_spice — `0.85` · _“lingering oak spice”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.85` · _“baked apple”_
- Sweet, Fruity & Mellow › toffee — `0.70` · _“treacle”_

_model note: Classic sherry-bomb prose; rich_dried_fruits dominant, strong drying oak spice alongside. Treacle tagged as toffee proxy._

### Glencadam 13YO Sauternes Cask Finish
*Highland · notes "rich"*

> **Notes:** Nose: Honeyed barley, apricot jam, beeswax and a light floral note with hints of marzipan. Palate: Creamy mouthfeel, dessert wine sweetness, candied citrus peel, vanilla, ripe pear and a touch of ginger. Finish: Medium length, drying gently with white grape, almond and soft oak spice.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ███· 3  (conf 0.95)
  Spicy & Sweet              █··· 1  (conf 0.75)
  Spicy & Dry                █··· 1  (conf 0.60)
  Deep, Rich & Dried Fruits  ···· 0
  Old & Dignified            █··· 1  (conf 0.70)
  Light & Delicate           ██·· 2  (conf 0.85)
  Juicy, Oak & Vanilla       ██·· 2  (conf 0.80)
  Oily & Coastal             ···· 0
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Sweet, Fruity & Mellow › honey — `0.95` · _“Honeyed barley”_
- Sweet, Fruity & Mellow › stone_fruit — `0.95` · _“apricot jam”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.90` · _“ripe pear”_
- Sweet, Fruity & Mellow › vanilla — `0.90` · _“vanilla”_
- Light & Delicate › floral — `0.85` · _“a light floral note”_
- Light & Delicate › light_honey — `0.70` · _“Honeyed barley”_
- Old & Dignified › beeswax — `0.95` · _“beeswax”_
- Juicy, Oak & Vanilla › vanilla — `0.90` · _“vanilla”_
- Juicy, Oak & Vanilla › toasted_oak — `0.60` · _“soft oak spice”_
- Spicy & Sweet › ginger — `0.90` · _“a touch of ginger”_
- Spicy & Dry › oak_tannin — `0.60` · _“drying gently with... soft oak spice”_

_model note: Rich prose; clear sweet/fruity Sauternes character with waxy/floral edge and light spice. Marzipan/almond and white grape don't map to a descriptor slug._

### GLENFIDDICH - SINGLE MALT - SCOTCH WHISKY  - VAT 03
*— · 15 · notes "rich"*

> **Notes:** Nose: Heather honey, dark fruits (plums/cherries), sweet malt, and subtle baking spices (cinnamon and nutmeg). Palate: A robust, medium-bodied explosion of fruitiness, followed by warm notes of marzipan, leather, and oak. Finish: Lingering, sweet, and warmly velvety.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ███· 3  (conf 0.95)
  Spicy & Sweet              ██·· 2  (conf 0.90)
  Spicy & Dry                ██·· 2  (conf 0.85)
  Deep, Rich & Dried Fruits  ███· 3  (conf 0.90)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ···· 0
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Sweet, Fruity & Mellow › honey — `0.95` · _“Heather honey”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.80` · _“explosion of fruitiness”_
- Deep, Rich & Dried Fruits › dried_fruit — `0.90` · _“dark fruits (plums/cherries)”_
- Spicy & Sweet › cinnamon — `0.95` · _“subtle baking spices (cinnamon and nutmeg)”_
- Spicy & Sweet › nutmeg — `0.95` · _“subtle baking spices (cinnamon and nutmeg)”_
- Spicy & Sweet › baking_spice — `0.90` · _“subtle baking spices”_
- Spicy & Dry › leather — `0.95` · _“marzipan, leather, and oak”_
- Spicy & Dry › oak_tannin — `0.75` · _“leather, and oak”_

_model note: Clear nose/palate/finish prose; confident tagging across four spokes._

### Glenmorangie Glenmorangie Quinta Ruban 14yo Single Malt
*Highland · 14yo · notes "rich"*

> **Notes:** Nose: dark chocolate, orange peel, walnut and a whiff of mint. Palate: rich and silky with chocolate-covered orange, rose Turkish delight, hazelnut and gentle tannic spice from the port pipes. Finish: long, drying, with bittersweet cocoa, cinnamon and lingering citrus oils.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.70)
  Spicy & Sweet              ██·· 2  (conf 0.80)
  Spicy & Dry                ██·· 2  (conf 0.85)
  Deep, Rich & Dried Fruits  ███· 3  (conf 0.90)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ···· 0
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Deep, Rich & Dried Fruits › dark_chocolate — `0.95` · _“dark chocolate”_
- Deep, Rich & Dried Fruits › walnut — `0.90` · _“walnut”_
- Deep, Rich & Dried Fruits › dried_fruit — `0.60` · _“chocolate-covered orange”_
- Spicy & Dry › oak_tannin — `0.90` · _“gentle tannic spice from the port pipes”_
- Spicy & Dry › dry_spice — `0.80` · _“long, drying”_
- Spicy & Sweet › cinnamon — `0.95` · _“cinnamon”_

_model note: Port-pipe finish profile: chocolate/orange/nut leads rich_dried_fruits; tannic dry spice + cinnamon clear; Turkish delight a soft rounded note._

### Grant's Grant's Triple Wood Blended Scotch
*Highland · notes "rich"*

> **Notes:** Nose: light vanilla, green apple, soft toffee and a faint cereal note. Palate: smooth and sweet, with honey, pear, vanilla cream and a gentle nutty malt backbone. Finish: short, clean, with lingering toffee, light oak and a whisper of spice.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ██·· 2  (conf 0.80)
  Sweet, Fruity & Mellow     ███· 3  (conf 0.95)
  Spicy & Sweet              █··· 1  (conf 0.50)
  Spicy & Dry                ···· 0
  Deep, Rich & Dried Fruits  ···· 0
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ██·· 2  (conf 0.75)
  Oily & Coastal             ···· 0
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Sweet, Fruity & Mellow › vanilla — `0.90` · _“light vanilla”_
- Sweet, Fruity & Mellow › toffee — `0.95` · _“soft toffee... lingering toffee”_
- Sweet, Fruity & Mellow › honey — `0.90` · _“honey”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.90` · _“green apple... pear”_
- Young & Spritely › green_apple — `0.95` · _“green apple”_
- Young & Spritely › cereal — `0.85` · _“a faint cereal note”_
- Young & Spritely › fresh_malt — `0.60` · _“gentle nutty malt backbone”_
- Juicy, Oak & Vanilla › vanilla — `0.85` · _“vanilla cream”_
- Juicy, Oak & Vanilla › custard — `0.70` · _“vanilla cream”_
- Juicy, Oak & Vanilla › toasted_oak — `0.60` · _“light oak”_
- Spicy & Sweet › baking_spice — `0.40` · _“a whisper of spice”_

_model note: Clear soft-sweet orchard profile; spice barely present (intensity 1)._

### Highland Park Highland Park Cask Strength Batch 3 Single Malt
*Islands · notes "rich"*

> **Notes:** Nose: Rich sherry, honeyed malt, orange peel, light heather smoke and dark chocolate. Palate: Big and oily; dried figs, treacle, baking spice, cocoa and a salty, peppery heat that needs water. Finish: Long, warming and smoky, with toffee, clove and a faint maritime tang.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.90)
  Spicy & Sweet              ██·· 2  (conf 0.85)
  Spicy & Dry                ██·· 2  (conf 0.80)
  Deep, Rich & Dried Fruits  ███· 3  (conf 0.95)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ██·· 2  (conf 0.85)
  Lightly Peated             █··· 1  (conf 0.90)
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Deep, Rich & Dried Fruits › fig — `0.95` · _“dried figs”_
- Deep, Rich & Dried Fruits › dark_chocolate — `0.95` · _“dark chocolate”_
- Deep, Rich & Dried Fruits › dried_fruit — `0.85` · _“Rich sherry... dried figs”_
- Sweet, Fruity & Mellow › honey — `0.90` · _“honeyed malt”_
- Sweet, Fruity & Mellow › toffee — `0.90` · _“toffee”_
- Spicy & Sweet › baking_spice — `0.95` · _“baking spice”_
- Spicy & Sweet › clove — `0.95` · _“clove”_
- Spicy & Dry › black_pepper — `0.85` · _“peppery heat”_
- Lightly Peated › gentle_smoke — `0.90` · _“light heather smoke”_
- Oily & Coastal › oily_texture — `0.90` · _“Big and oily”_
- Oily & Coastal › sea_salt — `0.80` · _“salty, peppery heat”_
- Oily & Coastal › brine — `0.75` · _“a faint maritime tang”_

_model note: Rich sherried profile with clear oily/coastal streak and a light smoke wisp; confident tagging throughout._

### IMPERIOUS WHISKY RESERVE - JURA 
*Islands · 30 · notes "rich"*

> **Notes:** Nose: Rich aromas of beeswax, burnt caramel toffee, vanilla, and yellow floral notes, with a subtle, unique hint of maritime salinity from the island sea breeze. Palate: Exceptionally smooth and silky. A luscious sweetness of honey and rich, buttery toffee coats the mouth, accompanied by ripe citrus fruits and a delicate hint of old oak spice. Finish: Very long and warming, tapering off into buttery toasted pastry and warm baking spices like nutmeg and cinnamon.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           █··· 1  (conf 0.60)
  Sweet, Fruity & Mellow     ███· 3  (conf 0.95)
  Spicy & Sweet              ██·· 2  (conf 0.90)
  Spicy & Dry                ···· 0
  Deep, Rich & Dried Fruits  ···· 0
  Old & Dignified            ██·· 2  (conf 0.80)
  Light & Delicate           █··· 1  (conf 0.70)
  Juicy, Oak & Vanilla       ██·· 2  (conf 0.85)
  Oily & Coastal             █··· 1  (conf 0.75)
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Sweet, Fruity & Mellow › honey — `0.95` · _“luscious sweetness of honey”_
- Sweet, Fruity & Mellow › toffee — `0.95` · _“rich, buttery toffee coats the mouth”_
- Sweet, Fruity & Mellow › caramel — `0.90` · _“burnt caramel toffee”_
- Sweet, Fruity & Mellow › vanilla — `0.90` · _“vanilla”_
- Juicy, Oak & Vanilla › vanilla — `0.90` · _“vanilla”_
- Juicy, Oak & Vanilla › butterscotch — `0.60` · _“buttery toffee”_
- Juicy, Oak & Vanilla › toasted_oak — `0.60` · _“buttery toasted pastry”_
- Old & Dignified › beeswax — `0.95` · _“Rich aromas of beeswax”_
- Old & Dignified › polished_oak — `0.70` · _“delicate hint of old oak spice”_
- Spicy & Sweet › nutmeg — `0.95` · _“nutmeg”_
- Spicy & Sweet › cinnamon — `0.95` · _“cinnamon”_
- Spicy & Sweet › baking_spice — `0.95` · _“warm baking spices”_
- Light & Delicate › floral — `0.85` · _“yellow floral notes”_
- Oily & Coastal › sea_salt — `0.75` · _“maritime salinity from the island sea breeze”_
- Oily & Coastal › brine — `0.60` · _“maritime salinity”_
- Young & Spritely › citrus_zest — `0.65` · _“ripe citrus fruits”_

### Jura Jura 12yo Single Malt
*Islands · 12yo · notes "rich"*

> **Notes:** Nose: Sherried orchard fruit, honey, light brine and a whisper of smoke. Palate: Sweet malt, baked apple, almond, milk chocolate and dried fig, with a coastal salinity from the Oloroso finish. Finish: Medium length, gently spiced with nutmeg and oak, lingering sherry sweetness and a faint smoky edge.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ███· 3  (conf 0.95)
  Spicy & Sweet              ██·· 2  (conf 0.85)
  Spicy & Dry                █··· 1  (conf 0.60)
  Deep, Rich & Dried Fruits  ██·· 2  (conf 0.90)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             █··· 1  (conf 0.85)
  Lightly Peated             █··· 1  (conf 0.90)
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Sweet, Fruity & Mellow › orchard_fruit — `0.95` · _“Sherried orchard fruit”_
- Sweet, Fruity & Mellow › honey — `0.95` · _“honey”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.90` · _“baked apple”_
- Deep, Rich & Dried Fruits › fig — `0.95` · _“dried fig”_
- Deep, Rich & Dried Fruits › dark_chocolate — `0.50` · _“milk chocolate”_
- Deep, Rich & Dried Fruits › dried_fruit — `0.90` · _“dried fig... lingering sherry sweetness”_
- Oily & Coastal › brine — `0.90` · _“light brine”_
- Oily & Coastal › sea_salt — `0.85` · _“coastal salinity”_
- Lightly Peated › gentle_smoke — `0.90` · _“a whisper of smoke”_
- Lightly Peated › soft_peat — `0.70` · _“a faint smoky edge”_
- Spicy & Sweet › nutmeg — `0.95` · _“gently spiced with nutmeg”_
- Spicy & Dry › oak_tannin — `0.60` · _“nutmeg and oak”_

_model note: Solid prose; sherry-and-orchard core with faint coastal/smoke accents — both kept at intensity 1 per "light"/"whisper"/"faint"._

### Lochlea Cask Strength Bath 1 2023 Cask Strength Bath 1
*Lowland · notes "rich"*

> **Notes:** Nose: Fresh barley, lemon zest, green apple, vanilla cream and a light malty sweetness with subtle oak spice. Palate: Rich and oily, bold malt, honeyed cereal, baked apple, cinnamon, white pepper and toasted oak from first-fill bourbon casks. Finish: Long, warming, drying oak tannins with lingering vanilla, ginger and barley sugar.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ██·· 2  (conf 0.90)
  Sweet, Fruity & Mellow     ███· 3  (conf 0.95)
  Spicy & Sweet              ██·· 2  (conf 0.90)
  Spicy & Dry                ██·· 2  (conf 0.85)
  Deep, Rich & Dried Fruits  ···· 0
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ███· 3  (conf 0.95)
  Oily & Coastal             ···· 0
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Young & Spritely › fresh_malt — `0.95` · _“Fresh barley”_
- Young & Spritely › citrus_zest — `0.95` · _“lemon zest”_
- Young & Spritely › green_apple — `0.95` · _“green apple”_
- Young & Spritely › cereal — `0.85` · _“bold malt, honeyed cereal”_
- Sweet, Fruity & Mellow › vanilla — `0.95` · _“vanilla cream”_
- Sweet, Fruity & Mellow › honey — `0.90` · _“honeyed cereal”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.90` · _“baked apple”_
- Juicy, Oak & Vanilla › vanilla — `0.95` · _“lingering vanilla”_
- Juicy, Oak & Vanilla › toasted_oak — `0.95` · _“toasted oak from first-fill bourbon casks”_
- Spicy & Sweet › cinnamon — `0.95` · _“cinnamon”_
- Spicy & Sweet › ginger — `0.90` · _“ginger”_
- Spicy & Sweet › honeyed_spice — `0.70` · _“barley sugar”_
- Spicy & Dry › black_pepper — `0.85` · _“white pepper”_
- Spicy & Dry › oak_tannin — `0.95` · _“drying oak tannins”_
- Spicy & Dry › dry_spice — `0.70` · _“subtle oak spice”_

_model note: Clear bourbon-cask Lowland-style profile; multiple overlapping spokes well-supported by the prose._

### Roseisle Roseisle 12yo Special Release 24 Single Malt
*Speyside · 12yo · notes "rich"*

> **Notes:** Nose: ripe pineapple, mango and pear drops with light icing sugar and a waxy, faintly sulphury edge. Palate: tropical fruit salad, vanilla custard, green apple and white pepper, with a creamy mid-palate and gentle oak spice. Finish: medium length, drying with grapefruit pith, cereal sweetness and a whisper of struck match.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ██·· 2  (conf 0.85)
  Sweet, Fruity & Mellow     ███· 3  (conf 0.95)
  Spicy & Sweet              ···· 0
  Spicy & Dry                ██·· 2  (conf 0.80)
  Deep, Rich & Dried Fruits  ···· 0
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ██·· 2  (conf 0.90)
  Oily & Coastal             ···· 0
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Sweet, Fruity & Mellow › orchard_fruit — `0.85` · _“pear drops... green apple”_
- Sweet, Fruity & Mellow › vanilla — `0.95` · _“vanilla custard”_
- Sweet, Fruity & Mellow › stone_fruit — `0.60` · _“mango”_
- Juicy, Oak & Vanilla › vanilla — `0.95` · _“vanilla custard”_
- Juicy, Oak & Vanilla › custard — `0.95` · _“vanilla custard”_
- Juicy, Oak & Vanilla › toasted_oak — `0.60` · _“gentle oak spice”_
- Young & Spritely › green_apple — `0.95` · _“green apple”_
- Young & Spritely › cereal — `0.90` · _“cereal sweetness”_
- Young & Spritely › citrus_zest — `0.70` · _“grapefruit pith”_
- Spicy & Dry › black_pepper — `0.90` · _“white pepper”_
- Spicy & Dry › oak_tannin — `0.70` · _“drying with grapefruit pith”_
- Spicy & Dry › dry_spice — `0.80` · _“gentle oak spice”_

_model note: Confident tropical/vanilla profile. The sulphury/struck-match note has no home in the taxonomy — noted as gap._

### Springbank Springbank Cask Strength 12yo Campbeltown
*Campbeltown · 12yo · notes "rich"*

> **Notes:** Nose: Coastal brine, damp earth, sherried dried fruit, leather and a whiff of coal smoke. Palate: Oily and full-bodied, raisin and fig, salted dark chocolate, peppery oak, brackish peat and toffee. Finish: Long, drying, with lingering sea salt, tobacco and roasted nuts.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     █··· 1  (conf 0.70)
  Spicy & Sweet              ···· 0
  Spicy & Dry                ██·· 2  (conf 0.90)
  Deep, Rich & Dried Fruits  ███· 3  (conf 0.95)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ███· 3  (conf 0.95)
  Lightly Peated             ···· 0
  Peated                     ██·· 2  (conf 0.85)
  Heavily Peated             ···· 0
```
**Descriptors:**
- Oily & Coastal › brine — `0.95` · _“Coastal brine”_
- Oily & Coastal › sea_salt — `0.95` · _“lingering sea salt”_
- Oily & Coastal › oily_texture — `0.95` · _“Oily and full-bodied”_
- Deep, Rich & Dried Fruits › raisin — `0.98` · _“raisin and fig”_
- Deep, Rich & Dried Fruits › fig — `0.98` · _“raisin and fig”_
- Deep, Rich & Dried Fruits › dark_chocolate — `0.95` · _“salted dark chocolate”_
- Deep, Rich & Dried Fruits › dried_fruit — `0.90` · _“sherried dried fruit”_
- Deep, Rich & Dried Fruits › walnut — `0.60` · _“roasted nuts”_
- Spicy & Dry › leather — `0.95` · _“leather”_
- Spicy & Dry › black_pepper — `0.90` · _“peppery oak”_
- Spicy & Dry › oak_tannin — `0.85` · _“peppery oak... Long, drying”_
- Spicy & Dry › tobacco — `0.95` · _“lingering sea salt, tobacco”_
- Peated › bonfire_smoke — `0.70` · _“a whiff of coal smoke”_
- Peated › soot — `0.65` · _“whiff of coal smoke... brackish peat”_
- Sweet, Fruity & Mellow › toffee — `0.90` · _“and toffee”_

_model note: Rich, multi-axis prose: coastal + sherry + dry spice + light coal smoke. Smoke is a "whiff" so intensity kept at 2._

### The Lakes Whiskymaker's Editions Nostalgia
*England · notes "rich"*

> **Notes:** Nose: Christmas cake, candied orange peel, milk chocolate and toasted almond. Palate: rich sherry sweetness, dried figs, dates, cinnamon and clove, with a creamy oloroso weight. Finish: medium-long, warming spice, dark cocoa and lingering raisin.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ···· 0
  Spicy & Sweet              ██·· 2  (conf 0.90)
  Spicy & Dry                ···· 0
  Deep, Rich & Dried Fruits  ████ 4  (conf 0.98)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ···· 0
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Deep, Rich & Dried Fruits › christmas_cake — `0.98` · _“Christmas cake”_
- Deep, Rich & Dried Fruits › fig — `0.95` · _“dried figs”_
- Deep, Rich & Dried Fruits › date — `0.95` · _“dates”_
- Deep, Rich & Dried Fruits › raisin — `0.90` · _“lingering raisin”_
- Deep, Rich & Dried Fruits › dark_chocolate — `0.85` · _“dark cocoa”_
- Deep, Rich & Dried Fruits › dried_fruit — `0.90` · _“dried figs, dates”_
- Spicy & Sweet › cinnamon — `0.95` · _“cinnamon”_
- Spicy & Sweet › clove — `0.95` · _“clove”_
- Spicy & Sweet › baking_spice — `0.80` · _“warming spice”_

_model note: Classic oloroso sherry profile — dried fruits dominant, baking spice clearly present but secondary. Milk chocolate/candied orange/toasted almond noted but no clean taxonomy slot, so left untagged._

### THE OCTAVE - AUCHENTOSHAN
*Lowland · 14 · notes "rich"*

> **Notes:** Nose: Elegant, bright, and complex. Rich notes of roasted nuts, toasted almond pastry, and orange zest blend with dried fruits and a hint of salted caramel. Palate: Unusually weighty and full-bodied for a triple-distilled malt. The 48% ABV retains excellent mouth-coating oils, delivering layers of bitter orange marmalade, rich dark cocoa, dried plums, and a dry, vinous grape skin quality. Finish: Long, crisp, and clean. The sweetness gives way to a dry, oaky warmth accented by sharp ginger, white pepper, and a subtle salinity.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.80)
  Spicy & Sweet              ██·· 2  (conf 0.85)
  Spicy & Dry                ██·· 2  (conf 0.90)
  Deep, Rich & Dried Fruits  ███· 3  (conf 0.95)
  Old & Dignified            █··· 1  (conf 0.50)
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             █··· 1  (conf 0.70)
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Deep, Rich & Dried Fruits › dried_fruit — `0.95` · _“dried fruits”_
- Deep, Rich & Dried Fruits › dark_chocolate — `0.90` · _“rich dark cocoa”_
- Deep, Rich & Dried Fruits › walnut — `0.60` · _“roasted nuts, toasted almond pastry”_
- Deep, Rich & Dried Fruits › raisin — `0.70` · _“dried plums”_
- Sweet, Fruity & Mellow › caramel — `0.90` · _“a hint of salted caramel”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.50` · _“bitter orange marmalade”_
- Spicy & Sweet › ginger — `0.95` · _“sharp ginger”_
- Spicy & Dry › black_pepper — `0.90` · _“white pepper”_
- Spicy & Dry › oak_tannin — `0.85` · _“dry, oaky warmth... dry, vinous grape skin quality”_
- Spicy & Dry › dry_spice — `0.70` · _“dry... white pepper”_
- Oily & Coastal › sea_salt — `0.70` · _“subtle salinity”_
- Oily & Coastal › oily_texture — `0.75` · _“excellent mouth-coating oils”_
- Old & Dignified › polished_oak — `0.50` · _“dry, oaky warmth”_

_model note: Rich prose; sherry/oak-led with citrus and a subtle saline edge._

### TOMATIN - THE SPIRITS EMBASSY 2009
*Highland · 15 · notes "rich"*

> **Notes:** Nose: Initially muted, featuring dense toffee, Cadbury’s Eclairs, highlighter pen, and a hint of seaweed. When diluted to 50% ABV, aromas of coffee, charred oak, seared plum, light Soreen loaf, nutmeg, and faintly astringent coriander emerge. Palate: Complex and concentrated with molasses, dark coffee liqueur, a balance of dry and sweet notes, charred damson, buttery fig biscuit, and slight saltiness. The flavor is intense and layered, though the whisky is not overly hot despite high ABV. Finish: Relatively short, highlighting the tighter, “closed-up” nature of the whisky early on, but opens subtly with water addition.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ███· 3  (conf 0.90)
  Spicy & Sweet              ██·· 2  (conf 0.70)
  Spicy & Dry                ██·· 2  (conf 0.75)
  Deep, Rich & Dried Fruits  ███· 3  (conf 0.90)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             █··· 1  (conf 0.70)
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Sweet, Fruity & Mellow › toffee — `0.95` · _“dense toffee, Cadbury's Eclairs”_
- Sweet, Fruity & Mellow › stone_fruit — `0.85` · _“seared plum... charred damson”_
- Deep, Rich & Dried Fruits › fig — `0.90` · _“buttery fig biscuit”_
- Deep, Rich & Dried Fruits › dark_chocolate — `0.60` · _“molasses, dark coffee liqueur”_
- Deep, Rich & Dried Fruits › dried_fruit — `0.60` · _“light Soreen loaf”_
- Spicy & Sweet › nutmeg — `0.90` · _“nutmeg”_
- Spicy & Dry › char — `0.90` · _“charred oak”_
- Spicy & Dry › dry_spice — `0.60` · _“balance of dry and sweet notes”_
- Oily & Coastal › seaweed — `0.90` · _“a hint of seaweed”_
- Oily & Coastal › sea_salt — `0.70` · _“slight saltiness”_

_model note: Rich prose; dark sweet/sherry-ish core with charred oak edge and small coastal hint. Coffee/molasses tagged under dried-fruit family as the closest fit._

### Tomatin 12YO The Italian Collection Marsala Italian Collection - Marsala Cask
*Highland · 12 Years · notes "rich"*

> **Notes:** Nose: Sultanas, candied orange peel, almond paste and light barley malt with a fortified-wine sweetness. Palate: Soft and rounded; raisin cake, honeyed apple, mild spice and a Marsala-driven nutty grape character over Tomatin's gentle malt. Finish: Medium length, drying lightly with toasted oak, dark fruit and a faint herbal bitterness.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           █··· 1  (conf 0.70)
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.85)
  Spicy & Sweet              █··· 1  (conf 0.60)
  Spicy & Dry                █··· 1  (conf 0.70)
  Deep, Rich & Dried Fruits  ███· 3  (conf 0.90)
  Old & Dignified            █··· 1  (conf 0.40)
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ···· 0
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Deep, Rich & Dried Fruits › raisin — `0.95` · _“Sultanas... raisin cake”_
- Deep, Rich & Dried Fruits › christmas_cake — `0.70` · _“raisin cake”_
- Deep, Rich & Dried Fruits › dried_fruit — `0.90` · _“dark fruit”_
- Deep, Rich & Dried Fruits › walnut — `0.60` · _“almond paste... nutty grape character”_
- Sweet, Fruity & Mellow › honey — `0.85` · _“honeyed apple”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.85` · _“honeyed apple”_
- Young & Spritely › fresh_malt — `0.75` · _“light barley malt”_
- Young & Spritely › cereal — `0.60` · _“Tomatin's gentle malt”_
- Young & Spritely › citrus_zest — `0.70` · _“candied orange peel”_
- Spicy & Sweet › baking_spice — `0.55` · _“mild spice”_
- Spicy & Dry › oak_tannin — `0.75` · _“drying lightly with toasted oak”_
- Old & Dignified › dried_herbs — `0.50` · _“faint herbal bitterness”_

_model note: Marsala cask profile: clear dried-fruit/sherry-like core with honeyed apple and gentle malt base; light oak drying on finish._

### Ardnahoe Ardnahoe Bholsa Single Malt
*Islay · notes "rich"*

> **Notes:** Nose: Aromas of red fruits, walnuts, and orange zest, layered with earthy peat smoke and subtle spices.Palate: Rich, juicy, and smooth. Prominent layers of dark fruit—such as raisins, dates, and ripe plums—are underpinned by classic Islay peat and woody cinnamon.Finish: Long, warm, and peppery with lingering smoke and a hint of ginger

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.70)
  Spicy & Sweet              ██·· 2  (conf 0.85)
  Spicy & Dry                ██·· 2  (conf 0.80)
  Deep, Rich & Dried Fruits  ███· 3  (conf 0.95)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ···· 0
  Lightly Peated             ···· 0
  Peated                     ███· 3  (conf 0.90)
  Heavily Peated             ···· 0
```
**Descriptors:**
- Deep, Rich & Dried Fruits › raisin — `0.95` · _“raisins”_
- Deep, Rich & Dried Fruits › date — `0.95` · _“dates”_
- Deep, Rich & Dried Fruits › dried_fruit — `0.90` · _“Prominent layers of dark fruit”_
- Deep, Rich & Dried Fruits › walnut — `0.90` · _“walnuts”_
- Peated › bonfire_smoke — `0.70` · _“earthy peat smoke”_
- Peated › ash — `0.50` · _“classic Islay peat”_
- Spicy & Sweet › cinnamon — `0.95` · _“woody cinnamon”_
- Spicy & Sweet › ginger — `0.90` · _“a hint of ginger”_
- Spicy & Dry › black_pepper — `0.85` · _“warm, and peppery”_
- Sweet, Fruity & Mellow › stone_fruit — `0.80` · _“ripe plums”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.50` · _“red fruits”_

_model note: Rich sherried-Islay profile: dark fruits + peat smoke spine, with cinnamon/ginger spice and a peppery finish. Orange zest noted but no citrus_zest descriptor under sweet_fruity_mellow, so mapped via orchard/stone fruit instead._

### Ardnamurchan Ardnamurchan Cask Strength Single Malt
*Highland · notes "rich"*

> **Notes:** Nose: Coastal smoke, sea spray, vanilla custard and orchard fruit, with a waxy cereal note. Palate: Oily and warming, peat smoke layered over honey, citrus peel, dark chocolate and brine, with sherry-cask spice building. Finish: Long, salty and smoky, with lingering cocoa, ginger and oak char.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           █··· 1  (conf 0.60)
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.80)
  Spicy & Sweet              ██·· 2  (conf 0.80)
  Spicy & Dry                ██·· 2  (conf 0.75)
  Deep, Rich & Dried Fruits  ██·· 2  (conf 0.75)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ██·· 2  (conf 0.85)
  Oily & Coastal             ███· 3  (conf 0.95)
  Lightly Peated             ···· 0
  Peated                     ███· 3  (conf 0.90)
  Heavily Peated             ···· 0
```
**Descriptors:**
- Oily & Coastal › sea_salt — `0.90` · _“sea spray... salty”_
- Oily & Coastal › brine — `0.95` · _“brine”_
- Oily & Coastal › oily_texture — `0.90` · _“Oily and warming”_
- Peated › bonfire_smoke — `0.70` · _“peat smoke layered over honey”_
- Peated › ash — `0.60` · _“oak char”_
- Juicy, Oak & Vanilla › vanilla — `0.95` · _“vanilla custard”_
- Juicy, Oak & Vanilla › custard — `0.95` · _“vanilla custard”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.90` · _“orchard fruit”_
- Sweet, Fruity & Mellow › honey — `0.90` · _“honey”_
- Young & Spritely › cereal — `0.80` · _“waxy cereal note”_
- Young & Spritely › citrus_zest — `0.85` · _“citrus peel”_
- Deep, Rich & Dried Fruits › dark_chocolate — `0.95` · _“dark chocolate... lingering cocoa”_
- Spicy & Sweet › ginger — `0.95` · _“ginger”_
- Spicy & Sweet › baking_spice — `0.70` · _“sherry-cask spice building”_
- Spicy & Dry › char — `0.90` · _“oak char”_
- Spicy & Dry › oak_tannin — `0.60` · _“oak char”_

### Arran Arran 25yo Single Malt
*Islands · 25yo · notes "rich"*

> **Notes:** Nose: Honeyed orchard fruit, beeswax, toasted almond, a whisper of sea salt and old oak. Palate: Rich and waxy, poached pear, candied orange peel, vanilla custard, gentle spice and dunnage earthiness. Finish: Long, drying oak, lingering citrus oils and a soft saline note.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ███· 3  (conf 0.95)
  Spicy & Sweet              ···· 0
  Spicy & Dry                ██·· 2  (conf 0.85)
  Deep, Rich & Dried Fruits  ···· 0
  Old & Dignified            ███· 3  (conf 0.90)
  Light & Delicate           ██·· 2  (conf 0.75)
  Juicy, Oak & Vanilla       ██·· 2  (conf 0.80)
  Oily & Coastal             █··· 1  (conf 0.85)
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```
**Descriptors:**
- Sweet, Fruity & Mellow › honey — `0.90` · _“Honeyed orchard fruit”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.95` · _“Honeyed orchard fruit, ... poached pear”_
- Sweet, Fruity & Mellow › vanilla — `0.90` · _“vanilla custard”_
- Old & Dignified › beeswax — `0.98` · _“beeswax”_
- Old & Dignified › polished_oak — `0.80` · _“old oak”_
- Old & Dignified › antique_wood — `0.70` · _“dunnage earthiness”_
- Juicy, Oak & Vanilla › custard — `0.95` · _“vanilla custard”_
- Juicy, Oak & Vanilla › vanilla — `0.90` · _“vanilla custard”_
- Spicy & Dry › oak_tannin — `0.90` · _“Long, drying oak”_
- Spicy & Dry › dry_spice — `0.70` · _“gentle spice”_
- Oily & Coastal › sea_salt — `0.90` · _“a whisper of sea salt”_
- Oily & Coastal › brine — `0.80` · _“soft saline note”_
- Oily & Coastal › oily_texture — `0.75` · _“Rich and waxy... lingering citrus oils”_
- Light & Delicate › lemon — `0.70` · _“candied orange peel... lingering citrus oils”_

_model note: Confident read: waxy old-oak orchard-fruit profile with light coastal lift and drying oak finish._

### Ben Nevis Ben Nevis MacDonalds Traditional Single Malt
*Highland · notes "rich"*

> **Notes:** Nose: Peat smoke, malt loaf, orange peel and a waxy oiliness. Palate: Oily and chewy, with peat embers, dark honey, cocoa, dried fruit and a faint coastal salinity. Finish: Long, smoky and earthy, with lingering malt sweetness and bitter chocolate.

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.85)
  Spicy & Sweet              ···· 0
  Spicy & Dry                ···· 0
  Deep, Rich & Dried Fruits  ██·· 2  (conf 0.85)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ██·· 2  (conf 0.80)
  Lightly Peated             ···· 0
  Peated                     ███· 3  (conf 0.95)
  Heavily Peated             ···· 0
```
**Descriptors:**
- Peated › bonfire_smoke — `0.90` · _“Peat smoke”_
- Peated › ash — `0.80` · _“peat embers”_
- Peated › campfire — `0.75` · _“Long, smoky and earthy”_
- Sweet, Fruity & Mellow › honey — `0.90` · _“dark honey”_
- Sweet, Fruity & Mellow › orchard_fruit — `0.50` · _“orange peel”_
- Deep, Rich & Dried Fruits › dried_fruit — `0.95` · _“dried fruit”_
- Deep, Rich & Dried Fruits › dark_chocolate — `0.90` · _“cocoa... bitter chocolate”_
- Oily & Coastal › oily_texture — `0.95` · _“waxy oiliness... Oily and chewy”_
- Oily & Coastal › sea_salt — `0.70` · _“faint coastal salinity”_
- Oily & Coastal › brine — `0.60` · _“faint coastal salinity”_

_model note: Confident multi-spoke profile: clear peat smoke with sherry-ish dried fruit/chocolate, malty sweetness, and an oily-coastal edge._


## THIN notes

### Currach Atlantic Kombu Apple Ice Wine Cask
*Ireland · notes "none"*

> **Notes:** Ireland

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: Notes contain only a country ("Ireland") — no flavour information to tag._

### Currach Atlantic Kombu Mezcal Cask
*Ireland · notes "none"*

> **Notes:** Ireland

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: Notes contain only a country ("Ireland") — no flavour information to tag._

### Currach Atlantic Kombu Pandanus Cask Finsh
*Ireland · notes "none"*

> **Notes:** Ireland. Broken While Sorting - Lachlan and Mr Sy saw it.

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: No flavour prose — just origin and an operational breakage note._

### Currach Atlantic Kombu PX Cask
*Ireland · notes "none"*

> **Notes:** Ireland

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: Notes contain only the country "Ireland" — no flavour information to tag._

### Currach Atlantic Wakame Sake Cask Finish
*Ireland · notes "none"*

> **Notes:** Ireland

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: Notes contain only a country ("Ireland") — no flavour information to tag._

### Ledaig Triple Wood
*Islands · notes "none"*

> **Notes:** Broken While Sorting - Lachlan and Mr Sy saw it.

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: Operational note only (breakage), no flavour information._

### Private bottling
*Other · notes "thin"*

> **Notes:** Sweet, Sherry, Coastal yet very rye-forwrd

**Radar (intensity 0-4 per family):**
```
  Young & Spritely           ···· 0
  Sweet, Fruity & Mellow     ██·· 2  (conf 0.70)
  Spicy & Sweet              ···· 0
  Spicy & Dry                ···· 0
  Deep, Rich & Dried Fruits  ██·· 2  (conf 0.75)
  Old & Dignified            ···· 0
  Light & Delicate           ···· 0
  Juicy, Oak & Vanilla       ···· 0
  Oily & Coastal             ██·· 2  (conf 0.75)
  Lightly Peated             ···· 0
  Peated                     ···· 0
  Heavily Peated             ···· 0
```

_model note: Very thin prose — three broad family words only, no specific descriptors. "Rye-forward" has no home in this whisky taxonomy so it's left untagged._

### The Chuan The Chuan Pure Malt Whisky Emeishan
*Japan · notes "none"*

> **Notes:** China

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: Prose contains only a country ("China"); no flavour information to tag._


## EMPTY notes

### ABERFELDY
*Highland · 12 · notes "none"*

> **Notes:** _(none)_

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: No tasting notes provided; nothing to tag._

### Bunnahabhain 12YO Cask Strength
*Islay · 12 years · notes "none"*

> **Notes:** _(none)_

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: No tasting notes provided; nothing to tag._

### Duncan Taylor Battlehill Ben Nevis 12yo Single Malt
*Highland · 12yo · notes "none"*

> **Notes:** _(none)_

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: No tasting notes provided; nothing to tag._

### Duncan Taylor Duncan Taylor 5 Star Special Edition Blended Scotch
*Highland · notes "none"*

> **Notes:** _(none)_

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: No tasting notes provided — empty profile is the honest answer._

### Duncan Taylor Octave Royal Brackla 2014 10yo Single Malt
*Highland · 10yo / 2014 · notes "none"*

> **Notes:** _(none)_

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: No tasting notes provided; nothing to tag._

### Duncan Taylor Whiskies of Scotland Glenlossie 1992 49.6% Single Malt
*Speyside · Vintage 1992 · notes "none"*

> **Notes:** _(none)_

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: No tasting notes provided — nothing to tag._

### Glenfiddich Glenfiddich Festival Experiment Single Malt
*Speyside · notes "none"*

> **Notes:** _(none)_

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: No tasting notes provided — empty radar is the honest answer._

### Longrow 100 Proof Batch 1 100 Proof (Batch 1)
*Campbeltown · notes "none"*

> **Notes:** _(none)_

**Radar:** _empty_ ✓ (correctly no hallucination)

_model note: No tasting notes provided; cannot infer flavour from name/distillery._

