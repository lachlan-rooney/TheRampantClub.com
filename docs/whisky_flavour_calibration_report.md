# Whisky flavour-tagging — Phase 1 calibration report

Model: `claude-opus-4-7` · taxonomy: SMWS-style two-tier (12 categories) · all tags `confirmed=false`.

## Summary
- Calibration batch: **44** bottles — rich 28, thin 8, empty 8.
- **Rich** notes that produced tags: **28/28**.
- **Thin** notes that produced tags: **1/8** (expect ~0 — thin = region/operational only).
- **Empty** notes that produced tags: **0/8** (MUST be 0 — any tag here = hallucination).
- Total tags: **351**, average confidence **0.83**.
- Off-taxonomy tags rejected by the validator: **0**.


## RICH notes

### Aberfeldy Aberfeldy 12yo Single Malt
*Highland · 12yo · model says notes are "rich"*

> **Notes:** Nose: Heather honey, vanilla, ripe pear and a light waxy note. Palate: Smooth and honeyed, with malted cereal, orange marmalade, mild green apple and a touch of toasted oak. Finish: Medium length, gently sweet with honey, soft spice and a clean malty fade.

**Tags:**
- **Sweet, Fruity & Mellow** › honey — `0.95` · _“Heather honey”_
- **Sweet, Fruity & Mellow** › vanilla — `0.95` · _“vanilla”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.90` · _“ripe pear”_
- **Old & Dignified** › beeswax — `0.60` · _“a light waxy note”_
- **Young & Spritely** › cereal — `0.85` · _“malted cereal”_
- **Young & Spritely** › citrus_zest — `0.70` · _“orange marmalade”_
- **Young & Spritely** › green_apple — `0.85` · _“mild green apple”_
- **Juicy, Oak & Vanilla** › toasted_oak — `0.80` · _“a touch of toasted oak”_
- **Spicy & Sweet** › honeyed_spice — `0.75` · _“gently sweet with honey, soft spice”_

_model note: Confident across honey/orchard/cereal axes; waxy note mapped to old_dignified beeswax at lower confidence._

### Ardbeg Ardbeg Corryvrechan Single Malt
*Islay · model says notes are "rich"*

> **Notes:** Nose: Tarry rope, black pepper, charred oak, blue cheese, and dark chocolate over briny smoke. Palate: Oily and powerful, with creosote, espresso, cracked pepper, smoked meats, and a wave of seaweed and dark berry fruit. Finish: Long, peppery and smoky, with bitter chocolate, salt and lingering ashy peat.

**Tags:**
- **Heavily Peated** › creosote — `0.98` · _“creosote”_
- **Heavily Peated** › intense_smoke — `0.85` · _“Long, peppery and smoky”_
- **Peated** › tar — `0.95` · _“Tarry rope”_
- **Peated** › smoked_meat — `0.95` · _“smoked meats”_
- **Peated** › ash — `0.90` · _“lingering ashy peat”_
- **Peated** › bonfire_smoke — `0.70` · _“briny smoke”_
- **Oily & Coastal** › oily_texture — `0.95` · _“Oily and powerful”_
- **Oily & Coastal** › seaweed — `0.95` · _“a wave of seaweed”_
- **Oily & Coastal** › brine — `0.90` · _“briny smoke”_
- **Oily & Coastal** › sea_salt — `0.85` · _“salt and lingering ashy peat”_
- **Spicy & Dry** › black_pepper — `0.98` · _“black pepper”_
- **Spicy & Dry** › char — `0.90` · _“charred oak”_
- **Deep, Rich & Dried Fruits** › dark_chocolate — `0.95` · _“dark chocolate”_
- **Deep, Rich & Dried Fruits** › dried_fruit — `0.55` · _“dark berry fruit”_

_model note: Classic heavily-peated Ardbeg profile; "dark berry fruit" is fresh not dried, so dried_fruit tag is weak._

### Arran Signature Series Signature Series Edition 1 Remnant Renegade
*Islands · model says notes are "rich"*

> **Notes:** Nose: Tropical fruits, mango and pineapple, with vanilla cream, light orange peel and a wisp of charred oak. Palate: Honeyed barley, banana bread and toffee, building into peppery oak, cinnamon and a savoury smoky edge from the peated component. Finish: Medium length, drying, with lingering sweet smoke, ginger and citrus zest.

**Tags:**
- **Sweet, Fruity & Mellow** › vanilla — `0.95` · _“vanilla cream”_
- **Sweet, Fruity & Mellow** › honey — `0.90` · _“Honeyed barley”_
- **Sweet, Fruity & Mellow** › toffee — `0.95` · _“banana bread and toffee”_
- **Juicy, Oak & Vanilla** › vanilla — `0.90` · _“vanilla cream”_
- **Juicy, Oak & Vanilla** › banana — `0.90` · _“banana bread”_
- **Juicy, Oak & Vanilla** › butterscotch — `0.50` · _“toffee”_
- **Young & Spritely** › citrus_zest — `0.95` · _“citrus zest”_
- **Young & Spritely** › cereal — `0.70` · _“Honeyed barley”_
- **Spicy & Sweet** › cinnamon — `0.95` · _“cinnamon”_
- **Spicy & Sweet** › ginger — `0.95` · _“ginger”_
- **Spicy & Dry** › black_pepper — `0.90` · _“peppery oak”_
- **Spicy & Dry** › oak_tannin — `0.70` · _“peppery oak ... drying”_
- **Spicy & Dry** › char — `0.85` · _“wisp of charred oak”_
- **Lightly Peated** › gentle_smoke — `0.90` · _“lingering sweet smoke”_
- **Lightly Peated** › soft_peat — `0.80` · _“savoury smoky edge from the peated component”_

_model note: Rich notes; tropical fruit (mango/pineapple/orange peel) noted but no clean descriptor slot — closest broad tags applied. Peat is described as a savoury edge / wisp, so lightly_peated rather than peated._

### Benromach Benromach Contracts Peat Smoke 2014 Single Malt
*Highland · Vintage 2014 · model says notes are "rich"*

> **Notes:** Nose: Bonfire smoke, smoked bacon, vanilla and orchard fruit, with a light coastal brine. Palate: Sweet peat, barley sugar, toasted oak and pear, with cracked black pepper and ginger warmth. Finish: Long, dry and ashy, with lingering malt sweetness and a whisper of liquorice.

**Tags:**
- **Peated** › bonfire_smoke — `0.98` · _“Bonfire smoke”_
- **Peated** › smoked_meat — `0.95` · _“smoked bacon”_
- **Peated** › ash — `0.90` · _“Long, dry and ashy”_
- **Sweet, Fruity & Mellow** › vanilla — `0.95` · _“vanilla and orchard fruit”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.95` · _“vanilla and orchard fruit”_
- **Oily & Coastal** › brine — `0.85` · _“light coastal brine”_
- **Juicy, Oak & Vanilla** › toasted_oak — `0.90` · _“toasted oak and pear”_
- **Spicy & Dry** › black_pepper — `0.95` · _“cracked black pepper”_
- **Spicy & Sweet** › ginger — `0.90` · _“ginger warmth”_

_model note: Clearly peated with sherry/bourbon-cask sweetness and a coastal edge; liquorice has no clean slot so left untagged._

### Bunnahabhain Feis IIe 2023 Canasta Cask Matured
*Islay · model says notes are "rich"*

> **Notes:** Nose: Rich sherried fruit, raisin, dark chocolate and a wisp of coastal salt with faint smoke. Palate: Sweet sticky toffee, fig, walnut and orange peel, layered with brine, leather and gentle peat. Finish: Long, drying oak, dark cocoa, hazelnut and lingering maritime smoke.

**Tags:**
- **Deep, Rich & Dried Fruits** — `0.95` · _“Rich sherried fruit, raisin, dark chocolate”_
- **Deep, Rich & Dried Fruits** › raisin — `0.98` · _“raisin”_
- **Deep, Rich & Dried Fruits** › dark_chocolate — `0.95` · _“dark chocolate”_
- **Deep, Rich & Dried Fruits** › fig — `0.95` · _“fig”_
- **Deep, Rich & Dried Fruits** › walnut — `0.90` · _“walnut”_
- **Sweet, Fruity & Mellow** › toffee — `0.90` · _“Sweet sticky toffee”_
- **Oily & Coastal** › brine — `0.95` · _“layered with brine”_
- **Oily & Coastal** › sea_salt — `0.85` · _“wisp of coastal salt”_
- **Oily & Coastal** — `0.80` · _“lingering maritime smoke”_
- **Spicy & Dry** › leather — `0.90` · _“leather”_
- **Spicy & Dry** › oak_tannin — `0.85` · _“Long, drying oak”_
- **Lightly Peated** › gentle_smoke — `0.90` · _“faint smoke”_
- **Lightly Peated** › soft_peat — `0.90` · _“gentle peat”_
- **Peated** — `0.50` · _“lingering maritime smoke”_

_model note: Classic sherried Bunna profile; smoke described as faint/gentle so leaned lightly_peated with a low-confidence peated tag for the lingering smoke. No descriptor for orange peel or hazelnut in taxonomy._

### Clynelish Clynelish 14yo Single Malt
*Highland · 14yo · model says notes are "rich"*

> **Notes:** Nose: Beeswax, lemon zest, sea spray and light honey with a waxy mineral edge. Palate: Oily mouthfeel, candle wax, orchard fruits, salted toffee and a touch of pepper. Finish: Medium-long, drying, with citrus peel, brine and lingering waxiness.

**Tags:**
- **Old & Dignified** › beeswax — `0.95` · _“Beeswax”_
- **Light & Delicate** › lemon — `0.90` · _“lemon zest”_
- **Oily & Coastal** › sea_salt — `0.85` · _“sea spray”_
- **Oily & Coastal** › brine — `0.95` · _“brine”_
- **Oily & Coastal** › oily_texture — `0.95` · _“Oily mouthfeel”_
- **Oily & Coastal** › mineral — `0.85` · _“waxy mineral edge”_
- **Light & Delicate** › light_honey — `0.90` · _“light honey”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.95` · _“orchard fruits”_
- **Sweet, Fruity & Mellow** › toffee — `0.90` · _“salted toffee”_
- **Spicy & Dry** › black_pepper — `0.80` · _“a touch of pepper”_
- **Spicy & Dry** › dry_spice — `0.70` · _“Medium-long, drying”_
- **Young & Spritely** › citrus_zest — `0.85` · _“citrus peel”_

_model note: Classic waxy/coastal Clynelish profile; "candle wax" and "waxiness" map to beeswax/old_dignified by closest taxonomy fit._

### Cu Bocan 15YO
*Highland · model says notes are "rich"*

> **Notes:** Nose: Light peat smoke, vanilla, baked apple and a touch of toasted coconut. Palate: Creamy mouthfeel with honeyed barley, soft wood smoke, ginger, citrus peel and brown sugar. Finish: Medium length, drying smoke, oak spice and lingering sweet malt.

**Tags:**
- **Lightly Peated** › gentle_smoke — `0.95` · _“Light peat smoke”_
- **Lightly Peated** › soft_peat — `0.85` · _“soft wood smoke”_
- **Juicy, Oak & Vanilla** › vanilla — `0.95` · _“vanilla”_
- **Juicy, Oak & Vanilla** › coconut — `0.90` · _“a touch of toasted coconut”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.90` · _“baked apple”_
- **Sweet, Fruity & Mellow** › honey — `0.90` · _“honeyed barley”_
- **Spicy & Sweet** › ginger — `0.95` · _“ginger”_
- **Young & Spritely** › citrus_zest — `0.85` · _“citrus peel”_
- **Sweet, Fruity & Mellow** › caramel — `0.60` · _“brown sugar”_
- **Spicy & Dry** › oak_tannin — `0.80` · _“oak spice”_
- **Spicy & Dry** › dry_spice — `0.80` · _“drying smoke, oak spice”_

_model note: Clear lightly-peated profile with bourbon-cask sweetness and a spice kick; confident mapping throughout._

### Duncan Taylor Black Bull 21yo Blended Scotch
*Highland · 21yo · model says notes are "rich"*

> **Notes:** Nose: Rich sherry influence, dark chocolate, dried figs, orange peel and a whiff of oak spice. Palate: Full-bodied and oily, malty fruitcake, raisins, toffee, leather and clove, with the high malt content (50%) lending cereal depth. Finish: Long, warming and spicy, with lingering sherried fruit, dark sugar and gentle tannic oak.

**Tags:**
- **Deep, Rich & Dried Fruits** — `0.95` · _“Rich sherry influence”_
- **Deep, Rich & Dried Fruits** › dark_chocolate — `0.95` · _“dark chocolate”_
- **Deep, Rich & Dried Fruits** › fig — `0.95` · _“dried figs”_
- **Deep, Rich & Dried Fruits** › raisin — `0.95` · _“raisins”_
- **Deep, Rich & Dried Fruits** › christmas_cake — `0.80` · _“malty fruitcake”_
- **Spicy & Sweet** › clove — `0.95` · _“leather and clove”_
- **Spicy & Sweet** — `0.80` · _“Long, warming and spicy”_
- **Spicy & Dry** › oak_tannin — `0.90` · _“gentle tannic oak”_
- **Spicy & Dry** › leather — `0.95` · _“leather and clove”_
- **Spicy & Dry** › dry_spice — `0.70` · _“whiff of oak spice”_
- **Sweet, Fruity & Mellow** › toffee — `0.95` · _“toffee”_
- **Young & Spritely** › cereal — `0.80` · _“high malt content (50%) lending cereal depth”_
- **Young & Spritely** › citrus_zest — `0.70` · _“orange peel”_

_model note: Strong sherry-cask profile; orange peel tagged as citrus_zest under young_spritely as no better fit in taxonomy. Cereal note explicit despite age._

### Duncan Taylor Bunnahabhain 19 Year Old Single Cask
*Islay · 19 years · model says notes are "rich"*

> **Notes:** Nose (Aroma) Dark Fruits: Rich sherry, raisins, and dried figs.Sweet Pastry: Caramel, orange zest, and citrus sponge cake.Coastal Air: Traditional Islay maritime salinity. Palate (Taste)Mouthfeel: Oily, full-bodied, and robustly warming.Sweet Spice: Molasses, spiced fruitcake, and dark chocolate.Fruit Balance: Tropical pineapple and crisp green apple.🏁 Finish Duration: Long, drying, and elegant.

**Tags:**
- **Deep, Rich & Dried Fruits** — `0.95` · _“Dark Fruits: Rich sherry, raisins, and dried figs”_
- **Deep, Rich & Dried Fruits** › raisin — `0.95` · _“raisins”_
- **Deep, Rich & Dried Fruits** › fig — `0.95` · _“dried figs”_
- **Deep, Rich & Dried Fruits** › christmas_cake — `0.80` · _“spiced fruitcake”_
- **Deep, Rich & Dried Fruits** › dark_chocolate — `0.95` · _“dark chocolate”_
- **Sweet, Fruity & Mellow** › caramel — `0.95` · _“Caramel, orange zest”_
- **Young & Spritely** › citrus_zest — `0.90` · _“orange zest, and citrus sponge cake”_
- **Young & Spritely** › green_apple — `0.90` · _“crisp green apple”_
- **Oily & Coastal** — `0.90` · _“Coastal Air: Traditional Islay maritime salinity”_
- **Oily & Coastal** › sea_salt — `0.85` · _“maritime salinity”_
- **Oily & Coastal** › oily_texture — `0.90` · _“Mouthfeel: Oily, full-bodied”_
- **Spicy & Sweet** › baking_spice — `0.80` · _“Sweet Spice: Molasses, spiced fruitcake”_
- **Spicy & Dry** › oak_tannin — `0.60` · _“Long, drying, and elegant”_

_model note: Rich sherry-led Islay profile; tropical pineapple has no clean home in taxonomy so left untagged._

### GlenAllachie GlenAllachie 10yo Cask Strength Batch 12 Single Malt
*Speyside · 10yo · model says notes are "rich"*

> **Notes:** Nose: Rich sherry, dark chocolate, fig roll, toasted almonds and a waft of cinnamon-spiced orange peel. Palate: Thick and oily, dates, treacle, raisin, baked apple, oak tannin and clove with a peppery cask-strength kick. Finish: Long, drying, with bitter chocolate, stewed berries, ginger and lingering oak spice.

**Tags:**
- **Deep, Rich & Dried Fruits** — `0.95` · _“Rich sherry, dark chocolate, fig roll”_
- **Deep, Rich & Dried Fruits** › fig — `0.95` · _“fig roll”_
- **Deep, Rich & Dried Fruits** › dark_chocolate — `0.95` · _“dark chocolate”_
- **Deep, Rich & Dried Fruits** › date — `0.95` · _“dates”_
- **Deep, Rich & Dried Fruits** › raisin — `0.95` · _“raisin”_
- **Deep, Rich & Dried Fruits** › walnut — `0.50` · _“toasted almonds”_
- **Spicy & Sweet** › cinnamon — `0.90` · _“cinnamon-spiced orange peel”_
- **Spicy & Sweet** › clove — `0.90` · _“clove”_
- **Spicy & Sweet** › ginger — `0.90` · _“ginger”_
- **Spicy & Dry** › oak_tannin — `0.95` · _“oak tannin”_
- **Spicy & Dry** › black_pepper — `0.90` · _“peppery cask-strength kick”_
- **Spicy & Dry** › dry_spice — `0.85` · _“Long, drying, with ... lingering oak spice”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.80` · _“baked apple”_
- **Sweet, Fruity & Mellow** › toffee — `0.60` · _“treacle”_
- **Oily & Coastal** › oily_texture — `0.70` · _“Thick and oily”_

_model note: Classic sherry-bomb profile; oily_texture tagged though no coastal context — flagging for review. Almonds mapped loosely to walnut as nearest nut descriptor._

### Glencadam 13YO Sauternes Cask Finish
*Highland · model says notes are "rich"*

> **Notes:** Nose: Honeyed barley, apricot jam, beeswax and a light floral note with hints of marzipan. Palate: Creamy mouthfeel, dessert wine sweetness, candied citrus peel, vanilla, ripe pear and a touch of ginger. Finish: Medium length, drying gently with white grape, almond and soft oak spice.

**Tags:**
- **Sweet, Fruity & Mellow** › honey — `0.95` · _“Honeyed barley”_
- **Sweet, Fruity & Mellow** › stone_fruit — `0.95` · _“apricot jam”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.90` · _“ripe pear”_
- **Sweet, Fruity & Mellow** › vanilla — `0.95` · _“vanilla”_
- **Old & Dignified** › beeswax — `0.95` · _“beeswax”_
- **Light & Delicate** › floral — `0.85` · _“light floral note”_
- **Young & Spritely** › cereal — `0.70` · _“Honeyed barley”_
- **Young & Spritely** › citrus_zest — `0.75` · _“candied citrus peel”_
- **Spicy & Sweet** › ginger — `0.90` · _“a touch of ginger”_
- **Spicy & Dry** › dry_spice — `0.80` · _“drying gently with white grape, almond and soft oak spice”_
- **Spicy & Dry** › oak_tannin — `0.70` · _“soft oak spice”_

_model note: Rich prose; marzipan/almond and white grape have no clean home in taxonomy — left untagged. Beeswax mapped to old_dignified though overall profile is youthful._

### GLENFIDDICH - SINGLE MALT - SCOTCH WHISKY  - VAT 03
*— · 15 · model says notes are "rich"*

> **Notes:** Nose: Heather honey, dark fruits (plums/cherries), sweet malt, and subtle baking spices (cinnamon and nutmeg). Palate: A robust, medium-bodied explosion of fruitiness, followed by warm notes of marzipan, leather, and oak. Finish: Lingering, sweet, and warmly velvety.

**Tags:**
- **Sweet, Fruity & Mellow** › honey — `0.95` · _“Heather honey”_
- **Sweet, Fruity & Mellow** › stone_fruit — `0.90` · _“dark fruits (plums/cherries)”_
- **Deep, Rich & Dried Fruits** — `0.60` · _“dark fruits (plums/cherries)”_
- **Young & Spritely** › fresh_malt — `0.60` · _“sweet malt”_
- **Spicy & Sweet** › baking_spice — `0.95` · _“subtle baking spices”_
- **Spicy & Sweet** › cinnamon — `0.95` · _“cinnamon and nutmeg”_
- **Spicy & Sweet** › nutmeg — `0.95` · _“cinnamon and nutmeg”_
- **Spicy & Dry** › leather — `0.90` · _“warm notes of marzipan, leather, and oak”_
- **Spicy & Dry** › oak_tannin — `0.65` · _“marzipan, leather, and oak”_

_model note: Rich prose; marzipan has no clean home in taxonomy so left untagged._

### Glenmorangie Glenmorangie Quinta Ruban 14yo Single Malt
*Highland · 14yo · model says notes are "rich"*

> **Notes:** Nose: dark chocolate, orange peel, walnut and a whiff of mint. Palate: rich and silky with chocolate-covered orange, rose Turkish delight, hazelnut and gentle tannic spice from the port pipes. Finish: long, drying, with bittersweet cocoa, cinnamon and lingering citrus oils.

**Tags:**
- **Deep, Rich & Dried Fruits** › dark_chocolate — `0.95` · _“dark chocolate”_
- **Deep, Rich & Dried Fruits** › walnut — `0.90` · _“walnut”_
- **Deep, Rich & Dried Fruits** — `0.80` · _“bittersweet cocoa”_
- **Spicy & Dry** › oak_tannin — `0.90` · _“gentle tannic spice from the port pipes”_
- **Spicy & Dry** › dry_spice — `0.80` · _“long, drying”_
- **Spicy & Sweet** › cinnamon — `0.95` · _“cinnamon”_
- **Sweet, Fruity & Mellow** — `0.60` · _“rose Turkish delight”_
- **Young & Spritely** › citrus_zest — `0.85` · _“orange peel”_
- **Young & Spritely** — `0.70` · _“lingering citrus oils”_

_model note: Port-cask profile: chocolate/nut/orange dominant. Citrus mapped to young_spritely citrus_zest as closest taxonomy fit; no dedicated "nutty" or "chocolate-orange" category._

### Grant's Grant's Triple Wood Blended Scotch
*Highland · model says notes are "rich"*

> **Notes:** Nose: light vanilla, green apple, soft toffee and a faint cereal note. Palate: smooth and sweet, with honey, pear, vanilla cream and a gentle nutty malt backbone. Finish: short, clean, with lingering toffee, light oak and a whisper of spice.

**Tags:**
- **Sweet, Fruity & Mellow** — `0.95` · _“smooth and sweet, with honey, pear, vanilla cream”_
- **Sweet, Fruity & Mellow** › vanilla — `0.95` · _“light vanilla”_
- **Sweet, Fruity & Mellow** › honey — `0.95` · _“honey”_
- **Sweet, Fruity & Mellow** › toffee — `0.95` · _“soft toffee”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.90` · _“pear”_
- **Young & Spritely** › green_apple — `0.95` · _“green apple”_
- **Young & Spritely** › cereal — `0.85` · _“faint cereal note”_
- **Young & Spritely** › fresh_malt — `0.60` · _“gentle nutty malt backbone”_
- **Juicy, Oak & Vanilla** › vanilla — `0.80` · _“vanilla cream”_
- **Juicy, Oak & Vanilla** › custard — `0.60` · _“vanilla cream”_
- **Spicy & Dry** › dry_spice — `0.50` · _“light oak and a whisper of spice”_
- **Spicy & Sweet** — `0.40` · _“whisper of spice”_

_model note: Clear sweet/mellow profile with young cereal-apple lift; spice mention is faint so split low-confidence between dry and sweet spice categories._

### Highland Park Highland Park Cask Strength Batch 3 Single Malt
*Islands · model says notes are "rich"*

> **Notes:** Nose: Rich sherry, honeyed malt, orange peel, light heather smoke and dark chocolate. Palate: Big and oily; dried figs, treacle, baking spice, cocoa and a salty, peppery heat that needs water. Finish: Long, warming and smoky, with toffee, clove and a faint maritime tang.

**Tags:**
- **Deep, Rich & Dried Fruits** — `0.95` · _“Rich sherry”_
- **Deep, Rich & Dried Fruits** › fig — `0.95` · _“dried figs”_
- **Deep, Rich & Dried Fruits** › dark_chocolate — `0.90` · _“dark chocolate”_
- **Sweet, Fruity & Mellow** › honey — `0.85` · _“honeyed malt”_
- **Sweet, Fruity & Mellow** › toffee — `0.90` · _“toffee”_
- **Spicy & Sweet** › baking_spice — `0.95` · _“baking spice”_
- **Spicy & Sweet** › clove — `0.90` · _“clove”_
- **Spicy & Dry** › black_pepper — `0.85` · _“salty, peppery heat”_
- **Lightly Peated** › gentle_smoke — `0.85` · _“light heather smoke”_
- **Peated** — `0.60` · _“Long, warming and smoky”_
- **Oily & Coastal** › oily_texture — `0.90` · _“Big and oily”_
- **Oily & Coastal** › sea_salt — `0.80` · _“a salty, peppery heat”_
- **Oily & Coastal** › brine — `0.70` · _“faint maritime tang”_
- **Young & Spritely** › citrus_zest — `0.75` · _“orange peel”_

_model note: Rich, multi-category prose; orange peel mapped to citrus_zest as closest fit (no dedicated orange descriptor). Treacle and cocoa have no direct slot but support rich_dried_fruits broadly._

### IMPERIOUS WHISKY RESERVE - JURA 
*Islands · 30 · model says notes are "rich"*

> **Notes:** Nose: Rich aromas of beeswax, burnt caramel toffee, vanilla, and yellow floral notes, with a subtle, unique hint of maritime salinity from the island sea breeze. Palate: Exceptionally smooth and silky. A luscious sweetness of honey and rich, buttery toffee coats the mouth, accompanied by ripe citrus fruits and a delicate hint of old oak spice. Finish: Very long and warming, tapering off into buttery toasted pastry and warm baking spices like nutmeg and cinnamon.

**Tags:**
- **Old & Dignified** › beeswax — `0.95` · _“Rich aromas of beeswax”_
- **Sweet, Fruity & Mellow** › toffee — `0.95` · _“burnt caramel toffee”_
- **Sweet, Fruity & Mellow** › caramel — `0.90` · _“burnt caramel toffee”_
- **Sweet, Fruity & Mellow** › vanilla — `0.95` · _“vanilla”_
- **Young & Spritely** › floral — `0.80` · _“yellow floral notes”_
- **Light & Delicate** › floral — `0.70` · _“yellow floral notes”_
- **Oily & Coastal** › sea_salt — `0.75` · _“subtle, unique hint of maritime salinity from the island sea breeze”_
- **Sweet, Fruity & Mellow** › honey — `0.95` · _“luscious sweetness of honey”_
- **Young & Spritely** › citrus_zest — `0.70` · _“ripe citrus fruits”_
- **Light & Delicate** › lemon — `0.40` · _“ripe citrus fruits”_
- **Spicy & Dry** › oak_tannin — `0.60` · _“delicate hint of old oak spice”_
- **Old & Dignified** › polished_oak — `0.55` · _“delicate hint of old oak spice”_
- **Spicy & Sweet** › baking_spice — `0.95` · _“warm baking spices”_
- **Spicy & Sweet** › nutmeg — `0.95` · _“nutmeg”_
- **Spicy & Sweet** › cinnamon — `0.95` · _“cinnamon”_

_model note: Rich prose, multi-category. "Buttery toasted pastry" had no clean home; closest hits already covered by toffee/baking spice._

### Jura Jura 12yo Single Malt
*Islands · 12yo · model says notes are "rich"*

> **Notes:** Nose: Sherried orchard fruit, honey, light brine and a whisper of smoke. Palate: Sweet malt, baked apple, almond, milk chocolate and dried fig, with a coastal salinity from the Oloroso finish. Finish: Medium length, gently spiced with nutmeg and oak, lingering sherry sweetness and a faint smoky edge.

**Tags:**
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.95` · _“Sherried orchard fruit”_
- **Sweet, Fruity & Mellow** › honey — `0.95` · _“honey”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.90` · _“baked apple”_
- **Deep, Rich & Dried Fruits** › fig — `0.95` · _“dried fig”_
- **Deep, Rich & Dried Fruits** › dark_chocolate — `0.50` · _“milk chocolate”_
- **Deep, Rich & Dried Fruits** — `0.80` · _“lingering sherry sweetness”_
- **Oily & Coastal** › brine — `0.90` · _“light brine”_
- **Oily & Coastal** › sea_salt — `0.85` · _“coastal salinity from the Oloroso finish”_
- **Lightly Peated** › gentle_smoke — `0.90` · _“a whisper of smoke”_
- **Lightly Peated** › gentle_smoke — `0.85` · _“a faint smoky edge”_
- **Spicy & Sweet** › nutmeg — `0.95` · _“gently spiced with nutmeg”_
- **Spicy & Dry** › oak_tannin — `0.60` · _“gently spiced with nutmeg and oak”_

_model note: Multi-faceted notes; almond and milk chocolate have no exact descriptor — chocolate mapped weakly to dark_chocolate._

### Lochlea Cask Strength Bath 1 2023 Cask Strength Bath 1
*Lowland · model says notes are "rich"*

> **Notes:** Nose: Fresh barley, lemon zest, green apple, vanilla cream and a light malty sweetness with subtle oak spice. Palate: Rich and oily, bold malt, honeyed cereal, baked apple, cinnamon, white pepper and toasted oak from first-fill bourbon casks. Finish: Long, warming, drying oak tannins with lingering vanilla, ginger and barley sugar.

**Tags:**
- **Young & Spritely** › fresh_malt — `0.90` · _“Fresh barley”_
- **Young & Spritely** › citrus_zest — `0.95` · _“lemon zest”_
- **Young & Spritely** › green_apple — `0.95` · _“green apple”_
- **Young & Spritely** › cereal — `0.85` · _“honeyed cereal”_
- **Juicy, Oak & Vanilla** › vanilla — `0.95` · _“vanilla cream”_
- **Juicy, Oak & Vanilla** › toasted_oak — `0.95` · _“toasted oak from first-fill bourbon casks”_
- **Juicy, Oak & Vanilla** › custard — `0.60` · _“vanilla cream”_
- **Sweet, Fruity & Mellow** › honey — `0.85` · _“honeyed cereal”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.85` · _“baked apple”_
- **Spicy & Sweet** › cinnamon — `0.95` · _“cinnamon”_
- **Spicy & Sweet** › ginger — `0.90` · _“lingering vanilla, ginger and barley sugar”_
- **Spicy & Dry** › black_pepper — `0.90` · _“white pepper”_
- **Spicy & Dry** › oak_tannin — `0.95` · _“drying oak tannins”_
- **Spicy & Dry** › dry_spice — `0.70` · _“subtle oak spice”_

_model note: Rich prose across nose/palate/finish; clear bourbon-cask profile with young malty character and drying oak spice._

### Roseisle Roseisle 12yo Special Release 24 Single Malt
*Speyside · 12yo · model says notes are "rich"*

> **Notes:** Nose: ripe pineapple, mango and pear drops with light icing sugar and a waxy, faintly sulphury edge. Palate: tropical fruit salad, vanilla custard, green apple and white pepper, with a creamy mid-palate and gentle oak spice. Finish: medium length, drying with grapefruit pith, cereal sweetness and a whisper of struck match.

**Tags:**
- **Sweet, Fruity & Mellow** — `0.90` · _“ripe pineapple, mango and pear drops”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.80` · _“pear drops”_
- **Sweet, Fruity & Mellow** › vanilla — `0.95` · _“vanilla custard”_
- **Juicy, Oak & Vanilla** › vanilla — `0.90` · _“vanilla custard”_
- **Juicy, Oak & Vanilla** › custard — `0.95` · _“vanilla custard”_
- **Juicy, Oak & Vanilla** › toasted_oak — `0.60` · _“gentle oak spice”_
- **Young & Spritely** › green_apple — `0.95` · _“green apple”_
- **Young & Spritely** › cereal — `0.85` · _“cereal sweetness”_
- **Young & Spritely** › citrus_zest — `0.60` · _“grapefruit pith”_
- **Spicy & Sweet** › baking_spice — `0.60` · _“gentle oak spice”_
- **Spicy & Dry** › black_pepper — `0.90` · _“white pepper”_
- **Spicy & Dry** › oak_tannin — `0.60` · _“drying with grapefruit pith”_

_model note: Tropical/vanilla-led profile; "struck match" and "sulphury edge" have no taxonomy home so left untagged._

### Springbank Springbank Cask Strength 12yo Campbeltown
*Campbeltown · 12yo · model says notes are "rich"*

> **Notes:** Nose: Coastal brine, damp earth, sherried dried fruit, leather and a whiff of coal smoke. Palate: Oily and full-bodied, raisin and fig, salted dark chocolate, peppery oak, brackish peat and toffee. Finish: Long, drying, with lingering sea salt, tobacco and roasted nuts.

**Tags:**
- **Oily & Coastal** › brine — `0.95` · _“Coastal brine”_
- **Oily & Coastal** › sea_salt — `0.95` · _“lingering sea salt”_
- **Oily & Coastal** › oily_texture — `0.90` · _“Oily and full-bodied”_
- **Deep, Rich & Dried Fruits** › dried_fruit — `0.95` · _“sherried dried fruit”_
- **Deep, Rich & Dried Fruits** › raisin — `0.95` · _“raisin and fig”_
- **Deep, Rich & Dried Fruits** › fig — `0.95` · _“raisin and fig”_
- **Deep, Rich & Dried Fruits** › dark_chocolate — `0.90` · _“salted dark chocolate”_
- **Deep, Rich & Dried Fruits** › walnut — `0.60` · _“roasted nuts”_
- **Spicy & Dry** › leather — `0.90` · _“leather”_
- **Spicy & Dry** › tobacco — `0.90` · _“tobacco”_
- **Spicy & Dry** › black_pepper — `0.85` · _“peppery oak”_
- **Spicy & Dry** › oak_tannin — `0.70` · _“Long, drying”_
- **Peated** › bonfire_smoke — `0.60` · _“whiff of coal smoke”_
- **Peated** — `0.80` · _“brackish peat”_
- **Sweet, Fruity & Mellow** › toffee — `0.90` · _“toffee”_

_model note: Rich prose, classic Campbeltown profile: coastal + sherry + light peat. "Damp earth" and "roasted nuts" don't map cleanly; nuts tagged as walnut with low confidence._

### The Lakes Whiskymaker's Editions Nostalgia
*England · model says notes are "rich"*

> **Notes:** Nose: Christmas cake, candied orange peel, milk chocolate and toasted almond. Palate: rich sherry sweetness, dried figs, dates, cinnamon and clove, with a creamy oloroso weight. Finish: medium-long, warming spice, dark cocoa and lingering raisin.

**Tags:**
- **Deep, Rich & Dried Fruits** › christmas_cake — `0.98` · _“Christmas cake”_
- **Deep, Rich & Dried Fruits** › fig — `0.95` · _“dried figs”_
- **Deep, Rich & Dried Fruits** › date — `0.95` · _“dates”_
- **Deep, Rich & Dried Fruits** › raisin — `0.90` · _“lingering raisin”_
- **Deep, Rich & Dried Fruits** › dark_chocolate — `0.85` · _“dark cocoa”_
- **Deep, Rich & Dried Fruits** › dried_fruit — `0.90` · _“rich sherry sweetness, dried figs, dates”_
- **Spicy & Sweet** › cinnamon — `0.95` · _“cinnamon”_
- **Spicy & Sweet** › clove — `0.95` · _“clove”_
- **Spicy & Sweet** › baking_spice — `0.80` · _“warming spice”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.40` · _“candied orange peel”_

_model note: Classic oloroso sherry profile; orange peel is citrus-candied not really orchard fruit, tagged low-confidence as nearest mellow-sweet anchor. Milk chocolate/toasted almond have no clean home in taxonomy._

### THE OCTAVE - AUCHENTOSHAN
*Lowland · 14 · model says notes are "rich"*

> **Notes:** Nose: Elegant, bright, and complex. Rich notes of roasted nuts, toasted almond pastry, and orange zest blend with dried fruits and a hint of salted caramel. Palate: Unusually weighty and full-bodied for a triple-distilled malt. The 48% ABV retains excellent mouth-coating oils, delivering layers of bitter orange marmalade, rich dark cocoa, dried plums, and a dry, vinous grape skin quality. Finish: Long, crisp, and clean. The sweetness gives way to a dry, oaky warmth accented by sharp ginger, white pepper, and a subtle salinity.

**Tags:**
- **Sweet, Fruity & Mellow** › caramel — `0.90` · _“a hint of salted caramel”_
- **Deep, Rich & Dried Fruits** › dried_fruit — `0.95` · _“blend with dried fruits”_
- **Deep, Rich & Dried Fruits** › dark_chocolate — `0.90` · _“rich dark cocoa”_
- **Deep, Rich & Dried Fruits** › raisin — `0.60` · _“dried plums”_
- **Deep, Rich & Dried Fruits** › walnut — `0.60` · _“Rich notes of roasted nuts”_
- **Spicy & Sweet** › ginger — `0.95` · _“sharp ginger”_
- **Spicy & Dry** › black_pepper — `0.90` · _“white pepper”_
- **Spicy & Dry** › oak_tannin — `0.80` · _“a dry, oaky warmth”_
- **Spicy & Dry** › dry_spice — `0.70` · _“a dry, vinous grape skin quality”_
- **Oily & Coastal** › oily_texture — `0.85` · _“excellent mouth-coating oils”_
- **Oily & Coastal** › sea_salt — `0.70` · _“a subtle salinity”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.50` · _“bitter orange marmalade”_

_model note: Rich sherry-leaning profile with dry oak spice and a coastal hint; orange marmalade doesn't map cleanly — used orchard_fruit weakly._

### TOMATIN - THE SPIRITS EMBASSY 2009
*Highland · 15 · model says notes are "rich"*

> **Notes:** Nose: Initially muted, featuring dense toffee, Cadbury’s Eclairs, highlighter pen, and a hint of seaweed. When diluted to 50% ABV, aromas of coffee, charred oak, seared plum, light Soreen loaf, nutmeg, and faintly astringent coriander emerge. Palate: Complex and concentrated with molasses, dark coffee liqueur, a balance of dry and sweet notes, charred damson, buttery fig biscuit, and slight saltiness. The flavor is intense and layered, though the whisky is not overly hot despite high ABV. Finish: Relatively short, highlighting the tighter, “closed-up” nature of the whisky early on, but opens subtly with water addition.

**Tags:**
- **Sweet, Fruity & Mellow** › toffee — `0.95` · _“dense toffee”_
- **Sweet, Fruity & Mellow** › caramel — `0.70` · _“Cadbury's Eclairs”_
- **Oily & Coastal** › seaweed — `0.85` · _“a hint of seaweed”_
- **Oily & Coastal** › sea_salt — `0.75` · _“slight saltiness”_
- **Spicy & Dry** › char — `0.90` · _“charred oak”_
- **Spicy & Dry** › oak_tannin — `0.60` · _“charred oak”_
- **Spicy & Sweet** › nutmeg — `0.90` · _“nutmeg”_
- **Deep, Rich & Dried Fruits** › fig — `0.90` · _“buttery fig biscuit”_
- **Deep, Rich & Dried Fruits** › dark_chocolate — `0.55` · _“dark coffee liqueur”_
- **Deep, Rich & Dried Fruits** › dried_fruit — `0.60` · _“seared plum... charred damson”_
- **Sweet, Fruity & Mellow** › stone_fruit — `0.70` · _“seared plum”_

_model note: Rich, layered notes. Molasses/coffee/coffee liqueur don't map cleanly to taxonomy — leaned on dark chocolate proxy at low confidence. Damson/plum mapped to dried_fruit and stone_fruit._

### Tomatin 12YO The Italian Collection Marsala Italian Collection - Marsala Cask
*Highland · 12 Years · model says notes are "rich"*

> **Notes:** Nose: Sultanas, candied orange peel, almond paste and light barley malt with a fortified-wine sweetness. Palate: Soft and rounded; raisin cake, honeyed apple, mild spice and a Marsala-driven nutty grape character over Tomatin's gentle malt. Finish: Medium length, drying lightly with toasted oak, dark fruit and a faint herbal bitterness.

**Tags:**
- **Deep, Rich & Dried Fruits** › raisin — `0.95` · _“Sultanas... raisin cake”_
- **Deep, Rich & Dried Fruits** › dried_fruit — `0.85` · _“dark fruit”_
- **Deep, Rich & Dried Fruits** › walnut — `0.60` · _“Marsala-driven nutty grape character”_
- **Sweet, Fruity & Mellow** › honey — `0.90` · _“honeyed apple”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.85` · _“honeyed apple”_
- **Sweet, Fruity & Mellow** › vanilla — `0.40` · _“fortified-wine sweetness”_
- **Young & Spritely** › cereal — `0.70` · _“light barley malt”_
- **Young & Spritely** › fresh_malt — `0.70` · _“Tomatin's gentle malt”_
- **Young & Spritely** › citrus_zest — `0.70` · _“candied orange peel”_
- **Spicy & Sweet** › baking_spice — `0.70` · _“mild spice”_
- **Spicy & Dry** › oak_tannin — `0.75` · _“drying lightly with toasted oak”_
- **Spicy & Dry** › dry_spice — `0.60` · _“faint herbal bitterness”_
- **Juicy, Oak & Vanilla** › toasted_oak — `0.90` · _“toasted oak”_

_model note: Clear Marsala-cask profile: dried fruit + honeyed orchard + nutty wine character; toasted oak finish. "Almond paste" and "nutty grape" don't map cleanly to a descriptor — walnut is the closest fit but loose._

### Ardnahoe Ardnahoe Bholsa Single Malt
*Islay · model says notes are "rich"*

> **Notes:** Nose: Aromas of red fruits, walnuts, and orange zest, layered with earthy peat smoke and subtle spices.Palate: Rich, juicy, and smooth. Prominent layers of dark fruit—such as raisins, dates, and ripe plums—are underpinned by classic Islay peat and woody cinnamon.Finish: Long, warm, and peppery with lingering smoke and a hint of ginger

**Tags:**
- **Deep, Rich & Dried Fruits** › raisin — `0.95` · _“dark fruit—such as raisins, dates, and ripe plums”_
- **Deep, Rich & Dried Fruits** › date — `0.95` · _“raisins, dates, and ripe plums”_
- **Deep, Rich & Dried Fruits** › dried_fruit — `0.90` · _“Prominent layers of dark fruit”_
- **Deep, Rich & Dried Fruits** › walnut — `0.90` · _“Aromas of red fruits, walnuts”_
- **Peated** › bonfire_smoke — `0.85` · _“earthy peat smoke”_
- **Peated** — `0.95` · _“classic Islay peat”_
- **Spicy & Sweet** › cinnamon — `0.90` · _“woody cinnamon”_
- **Spicy & Sweet** › ginger — `0.90` · _“a hint of ginger”_
- **Spicy & Sweet** › baking_spice — `0.60` · _“subtle spices”_
- **Spicy & Dry** › black_pepper — `0.85` · _“Long, warm, and peppery”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.60` · _“ripe plums”_
- **Young & Spritely** › citrus_zest — `0.70` · _“orange zest”_

_model note: Rich sherried + peated Islay profile; orange zest placed under citrus_zest though it could equally read as a marmalade-like note._

### Ardnamurchan Ardnamurchan Cask Strength Single Malt
*Highland · model says notes are "rich"*

> **Notes:** Nose: Coastal smoke, sea spray, vanilla custard and orchard fruit, with a waxy cereal note. Palate: Oily and warming, peat smoke layered over honey, citrus peel, dark chocolate and brine, with sherry-cask spice building. Finish: Long, salty and smoky, with lingering cocoa, ginger and oak char.

**Tags:**
- **Oily & Coastal** › sea_salt — `0.90` · _“sea spray”_
- **Oily & Coastal** › brine — `0.95` · _“dark chocolate and brine”_
- **Oily & Coastal** › oily_texture — `0.90` · _“Oily and warming”_
- **Peated** › bonfire_smoke — `0.85` · _“Coastal smoke”_
- **Peated** › campfire — `0.80` · _“peat smoke layered over honey”_
- **Juicy, Oak & Vanilla** › custard — `0.95` · _“vanilla custard”_
- **Juicy, Oak & Vanilla** › vanilla — `0.95` · _“vanilla custard”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.95` · _“orchard fruit”_
- **Sweet, Fruity & Mellow** › honey — `0.90` · _“layered over honey”_
- **Young & Spritely** › cereal — `0.70` · _“waxy cereal note”_
- **Young & Spritely** › citrus_zest — `0.80` · _“citrus peel”_
- **Deep, Rich & Dried Fruits** › dark_chocolate — `0.95` · _“dark chocolate and brine”_
- **Spicy & Sweet** › ginger — `0.90` · _“lingering cocoa, ginger and oak char”_
- **Spicy & Sweet** › baking_spice — `0.70` · _“sherry-cask spice building”_
- **Spicy & Dry** › char — `0.90` · _“oak char”_
- **Old & Dignified** › beeswax — `0.50` · _“waxy cereal note”_

_model note: Rich multi-axis profile: coastal/peated core with sherry-cask dried fruit spice and bourbon-cask vanilla. Waxy note tentatively mapped to beeswax (low confidence)._

### Arran Arran 25yo Single Malt
*Islands · 25yo · model says notes are "rich"*

> **Notes:** Nose: Honeyed orchard fruit, beeswax, toasted almond, a whisper of sea salt and old oak. Palate: Rich and waxy, poached pear, candied orange peel, vanilla custard, gentle spice and dunnage earthiness. Finish: Long, drying oak, lingering citrus oils and a soft saline note.

**Tags:**
- **Sweet, Fruity & Mellow** › honey — `0.90` · _“Honeyed orchard fruit”_
- **Sweet, Fruity & Mellow** › orchard_fruit — `0.95` · _“Honeyed orchard fruit”_
- **Sweet, Fruity & Mellow** › stone_fruit — `0.60` · _“poached pear”_
- **Old & Dignified** › beeswax — `0.95` · _“beeswax”_
- **Old & Dignified** › polished_oak — `0.70` · _“old oak”_
- **Old & Dignified** › antique_wood — `0.55` · _“dunnage earthiness”_
- **Juicy, Oak & Vanilla** › custard — `0.95` · _“vanilla custard”_
- **Juicy, Oak & Vanilla** › vanilla — `0.90` · _“vanilla custard”_
- **Oily & Coastal** › sea_salt — `0.85` · _“whisper of sea salt”_
- **Oily & Coastal** › brine — `0.70` · _“soft saline note”_
- **Oily & Coastal** › oily_texture — `0.70` · _“Rich and waxy”_
- **Spicy & Sweet** › baking_spice — `0.60` · _“gentle spice”_
- **Spicy & Dry** › oak_tannin — `0.85` · _“Long, drying oak”_
- **Young & Spritely** › citrus_zest — `0.70` · _“candied orange peel”_
- **Light & Delicate** › lemon — `0.50` · _“lingering citrus oils”_

_model note: Confident overall; "toasted almond" had no clean home in taxonomy (no nutty category), so left untagged._

### Ben Nevis Ben Nevis MacDonalds Traditional Single Malt
*Highland · model says notes are "rich"*

> **Notes:** Nose: Peat smoke, malt loaf, orange peel and a waxy oiliness. Palate: Oily and chewy, with peat embers, dark honey, cocoa, dried fruit and a faint coastal salinity. Finish: Long, smoky and earthy, with lingering malt sweetness and bitter chocolate.

**Tags:**
- **Peated** — `0.95` · _“Peat smoke”_
- **Peated** › ash — `0.75` · _“peat embers”_
- **Peated** › campfire — `0.60` · _“Long, smoky and earthy”_
- **Deep, Rich & Dried Fruits** › dried_fruit — `0.95` · _“dried fruit”_
- **Deep, Rich & Dried Fruits** › dark_chocolate — `0.90` · _“bitter chocolate”_
- **Deep, Rich & Dried Fruits** › christmas_cake — `0.50` · _“malt loaf”_
- **Sweet, Fruity & Mellow** › honey — `0.90` · _“dark honey”_
- **Old & Dignified** › beeswax — `0.60` · _“waxy oiliness”_
- **Oily & Coastal** › oily_texture — `0.95` · _“Oily and chewy”_
- **Oily & Coastal** › sea_salt — `0.80` · _“faint coastal salinity”_
- **Young & Spritely** › citrus_zest — `0.80` · _“orange peel”_

_model note: Confident tagging — rich prose covering peat, sherry-ish dark fruit/chocolate, waxy/oily texture, coastal hint, and citrus peel. "Malt loaf" loosely mapped to christmas_cake (low confidence) as taxonomy has no bread/cake descriptor closer._


## THIN notes

### Currach Atlantic Kombu Apple Ice Wine Cask
*Ireland · model says notes are "none"*

> **Notes:** Ireland

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: Only a country of origin is given; no flavour prose to tag._

### Currach Atlantic Kombu Mezcal Cask
*Ireland · model says notes are "none"*

> **Notes:** Ireland

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: Only a country of origin is given; no flavour prose to tag._

### Currach Atlantic Kombu Pandanus Cask Finsh
*Ireland · model says notes are "none"*

> **Notes:** Ireland. Broken While Sorting - Lachlan and Mr Sy saw it.

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: No flavour prose — only a region and an operational/breakage note._

### Currach Atlantic Kombu PX Cask
*Ireland · model says notes are "none"*

> **Notes:** Ireland

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: Only a region ("Ireland") given; no flavour prose to tag from._

### Currach Atlantic Wakame Sake Cask Finish
*Ireland · model says notes are "none"*

> **Notes:** Ireland

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: Only a country of origin given; no flavour prose to tag._

### Ledaig Triple Wood
*Islands · model says notes are "none"*

> **Notes:** Broken While Sorting - Lachlan and Mr Sy saw it.

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: Operational note only (breakage incident); no flavour prose to tag._

### Private bottling
*Other · model says notes are "thin"*

> **Notes:** Sweet, Sherry, Coastal yet very rye-forwrd

**Tags:**
- **Sweet, Fruity & Mellow** — `0.70` · _“Sweet”_
- **Deep, Rich & Dried Fruits** — `0.75` · _“Sherry”_
- **Oily & Coastal** — `0.80` · _“Coastal”_

_model note: Thin notes; "rye-forward" has no taxonomy home so left untagged._

### The Chuan The Chuan Pure Malt Whisky Emeishan
*Japan · model says notes are "none"*

> **Notes:** China

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: Only a country name ("China") — no flavour prose to tag._


## EMPTY notes

### ABERFELDY
*Highland · 12 · model says notes are "none"*

> **Notes:** _(none)_

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: No tasting notes provided; nothing to tag._

### Bunnahabhain 12YO Cask Strength
*Islay · 12 years · model says notes are "none"*

> **Notes:** _(none)_

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: No tasting notes provided; nothing to tag._

### Duncan Taylor Battlehill Ben Nevis 12yo Single Malt
*Highland · 12yo · model says notes are "none"*

> **Notes:** _(none)_

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: No tasting notes provided; nothing to tag._

### Duncan Taylor Duncan Taylor 5 Star Special Edition Blended Scotch
*Highland · model says notes are "none"*

> **Notes:** _(none)_

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: No tasting notes provided; nothing to tag._

### Duncan Taylor Octave Royal Brackla 2014 10yo Single Malt
*Highland · 10yo / 2014 · model says notes are "none"*

> **Notes:** _(none)_

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: No tasting notes provided; nothing to tag._

### Duncan Taylor Whiskies of Scotland Glenlossie 1992 49.6% Single Malt
*Speyside · Vintage 1992 · model says notes are "none"*

> **Notes:** _(none)_

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: No tasting notes provided; nothing to tag._

### Glenfiddich Glenfiddich Festival Experiment Single Malt
*Speyside · model says notes are "none"*

> **Notes:** _(none)_

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: No tasting notes provided; nothing to tag._

### Longrow 100 Proof Batch 1 100 Proof (Batch 1)
*Campbeltown · model says notes are "none"*

> **Notes:** _(none)_

**Tags:** _none_ ✓ (correctly no hallucination)

_model note: No tasting notes provided; nothing to tag._

