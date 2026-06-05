# Whisky name cleanup — 122 of 337 rows to fix (review before apply)

Fix: collapse consecutive duplicate phrases. Reversible via name_original. Nothing applied yet.

- 101 cleaned names start with their distillery (the normal form).
- 21 do NOT — independent-bottler names (bottler prefix, distillery mid-name). SCAN THESE.

## Independent-bottler / non-distillery-leading rows (21) — verify these are right
- «Frank McHardy Teaninich 14YO 14YO Distilled 2009 Bottled 2023»
    → «Frank McHardy Teaninich 14YO Distilled 2009 Bottled 2023»
- «Frank McHardy Ardmore 11YO 11YO Distilled 2009»
    → «Frank McHardy Ardmore 11YO Distilled 2009»
- «DUTY PAID sample - SPRINGBANK - FB 10YO - NO643 »
    → «DUTY PAID sample - SPRINGBANK - FB 10YO - NO643»
- «Duncan Taylor Duncan Taylor Aultmore 2008 13yo Single Malt»
    → «Duncan Taylor Aultmore 2008 13yo Single Malt»
- «Duncan Taylor Duncan Taylor Aultmore 2008 13yo Single Malt»
    → «Duncan Taylor Aultmore 2008 13yo Single Malt»
- «Duncan Taylor Duncan Taylor Laphroaig 2005 16yo Single Malt»
    → «Duncan Taylor Laphroaig 2005 16yo Single Malt»
- «Duncan Taylor Duncan Taylor Glen Moray 14yo Single Malt»
    → «Duncan Taylor Glen Moray 14yo Single Malt»
- «Duncan Taylor Duncan Taylor Tormore 2010 11yo Single Malt»
    → «Duncan Taylor Tormore 2010 11yo Single Malt»
- «Duncan Taylor Duncan Taylor Tormore 2010 11yo Single Malt»
    → «Duncan Taylor Tormore 2010 11yo Single Malt»
- «Duncan Taylor Duncan Taylor Braeval 2000 22yo Single Malt»
    → «Duncan Taylor Braeval 2000 22yo Single Malt»
- «Imperious Imperious Bunnahabhain 1991 30yo Single Malt»
    → «Imperious Bunnahabhain 1991 30yo Single Malt»
- «Imperious Imperious Glenrothes Bourbon 40yo Single Malt»
    → «Imperious Glenrothes Bourbon 40yo Single Malt»
- «Duncan Taylor Duncan Taylor 12yo Special Edition Blended Scotch»
    → «Duncan Taylor 12yo Special Edition Blended Scotch»
- «Duncan Taylor Duncan Taylor 12yo Special Edition Blended Scotch»
    → «Duncan Taylor 12yo Special Edition Blended Scotch»
- «Duncan Taylor Duncan Taylor 5 Star Special Edition Blended Scotch»
    → «Duncan Taylor 5 Star Special Edition Blended Scotch»
- «Duncan Taylor Duncan Taylor 18yo Special Edition Blended Scotch»
    → «Duncan Taylor 18yo Special Edition Blended Scotch»
- «Cadenhead OC13 Macduff 13YO 13YO Bourbon»
    → «Cadenhead OC13 Macduff 13YO Bourbon»
- «Cadenhead OC4 Auchroisk 14YO 14YO Auchroisk»
    → «Cadenhead OC4 Auchroisk 14YO Auchroisk»
- «Cadenhead OC3 The English Distillery 12YO 12YO Bourbon The English Distillery Company»
    → «Cadenhead OC3 The English Distillery 12YO Bourbon The English Distillery Company»
- «Imperious Imperious Miltonduff 1990 30yo Single Malt»
    → «Imperious Miltonduff 1990 30yo Single Malt»
- «IMPERIOUS WHISKY RESERVE - JURA »
    → «IMPERIOUS WHISKY RESERVE - JURA»

## All other changes (101)
- «GlenAllachie GlenAllachie 10yo Cask Strength Batch 12 Single Malt»
    → «GlenAllachie 10yo Cask Strength Batch 12 Single Malt»
- «GLENFIDDICH - SINGLE MALT - SCOTCH WHISKY  - VAT 03»
    → «GLENFIDDICH - SINGLE MALT - SCOTCH WHISKY - VAT 03»
- «Ardnahoe Ardnahoe Bholsa Single Malt»
    → «Ardnahoe Bholsa Single Malt»
- «Arran Signature Series Signature Series Edition 1 Remnant Renegade»
    → «Arran Signature Series Edition 1 Remnant Renegade»
- «Talisker Talisker Distillers Edition Single Malt»
    → «Talisker Distillers Edition Single Malt»
- «Highland Park Highland Park Cask Strength Batch 3 Single Malt»
    → «Highland Park Cask Strength Batch 3 Single Malt»
- «Arran Arran Harmony Ed.4 Single Malt»
    → «Arran Harmony Ed.4 Single Malt»
- «GlenAllachie GlenAllachie 9yo Oloroso Single Malt»
    → «GlenAllachie 9yo Oloroso Single Malt»
- «Glencadam Glencadam Reserva De Porto Single Malt»
    → «Glencadam Reserva De Porto Single Malt»
- «Glenfiddich Glenfiddich Orchard Experiment Single Malt»
    → «Glenfiddich Orchard Experiment Single Malt»
- «Grant's Grant's Triple Wood Blended Scotch»
    → «Grant's Triple Wood Blended Scotch»
- «Speyburn Speyburn 15yo Single Malt»
    → «Speyburn 15yo Single Malt»
- «AUCHROISK - SINGLE MALT - SCOTCH WHISKY »
    → «AUCHROISK - SINGLE MALT - SCOTCH WHISKY»
- «Jura Jura 12yo Single Malt»
    → «Jura 12yo Single Malt»
- «Craigellachie Craigellachie 13yo Single Malt»
    → «Craigellachie 13yo Single Malt»
- «GlenAllachie GlenAllachie 15yo Single Malt»
    → «GlenAllachie 15yo Single Malt»
- «Lagavulin Lagavulin Islay Single Malt Double Matured 2002»
    → «Lagavulin Islay Single Malt Double Matured 2002»
- «Mortlach Mortlach The Wee Witchie 12yo Single Malt»
    → «Mortlach The Wee Witchie 12yo Single Malt»
- «Springbank Springbank Cask Strength 12yo Campbeltown»
    → «Springbank Cask Strength 12yo Campbeltown»
- «Highland Park Highland Park 15yo Single Malt»
    → «Highland Park 15yo Single Malt»
- «Tomintoul Tomintoul Cigar Malt Single Malt»
    → «Tomintoul Cigar Malt Single Malt»
- «Arran Arran Rare Batch 15yo Single Malt»
    → «Arran Rare Batch 15yo Single Malt»
- «The Chuan The Chuan Pure Malt Whisky Emeishan»
    → «The Chuan Pure Malt Whisky Emeishan»
- «ROK ROK 1782 Zak J.A. Baczewski»
    → «ROK 1782 Zak J.A. Baczewski»
- «Edradour Edradour Vintage 1999 Cask No.3021»
    → «Edradour Vintage 1999 Cask No.3021»
- «Bowmore Bowmore 16yo Ruby Post Cask Finish Single Malt»
    → «Bowmore 16yo Ruby Post Cask Finish Single Malt»
- «The Cardrona The Cardrona Single Malt The Falcon»
    → «The Cardrona Single Malt The Falcon»
- «Starward Starward Small Batch 171113-WH»
    → «Starward Small Batch 171113-WH»
- «Glenfiddich Glenfiddich Winter Storm Single Malt»
    → «Glenfiddich Winter Storm Single Malt»
- «Spearhead Spearhead Single Grain Scotch»
    → «Spearhead Single Grain Scotch»
- «Hoiana Hoiana 18yo»
    → «Hoiana 18yo»
- «Arran Arran 25yo Single Malt»
    → «Arran 25yo Single Malt»
- «Bruichladdich Bruichladdich Islay Barley 2011 Single Malt»
    → «Bruichladdich Islay Barley 2011 Single Malt»
- «Chivas Regal Chivas Regal Extra Blended Scotch»
    → «Chivas Regal Extra Blended Scotch»
- «Aberlour Aberlour Cask Annamh V1 Single Malt»
    → «Aberlour Cask Annamh V1 Single Malt»
- «CRAGGANMORE - DISTILLERS EDITION  - DOUBLE MATURED IN PORT»
    → «CRAGGANMORE - DISTILLERS EDITION - DOUBLE MATURED IN PORT»
- «ARRAN - QUAICH BAR - PRIVATE CASK - 12YO »
    → «ARRAN - QUAICH BAR - PRIVATE CASK - 12YO»
- «Tomintoul 14YO Cognac Cognac Cask Finsk»
    → «Tomintoul 14YO Cognac Cask Finsk»
- «Arran Single Cask Single Cask (Singapore Exclusive)»
    → «Arran Single Cask (Singapore Exclusive)»
- «Arran Signature Series Signature Series Edition 3 Duero Discovery»
    → «Arran Signature Series Edition 3 Duero Discovery»
- «Tipperary 2017 Home Grown Barley Port Cask Port Cask Finish»
    → «Tipperary 2017 Home Grown Barley Port Cask Finish»
- «Tipperary 2017 Home Grown Barley Mezcal Cask Mezcal Cask Finish»
    → «Tipperary 2017 Home Grown Barley Mezcal Cask Finish»
- «Tipperary 2017 Home Grown Barley Sake Cask Sake Cask Finish»
    → «Tipperary 2017 Home Grown Barley Sake Cask Finish»
- «Deanston 15YO 2007 Tequila Cask Tequila Cask Finish»
    → «Deanston 15YO 2007 Tequila Cask Finish»
- «Lagg Single Malt Inaugural Release Inaugural Release - Batch 1»
    → «Lagg Single Malt Inaugural Release - Batch 1»
- «Benromach Benromach Contracts Peat Smoke 2014 Single Malt»
    → «Benromach Contracts Peat Smoke 2014 Single Malt»
- «Kilchoman Kilchoman Fino Sherry Single Malt»
    → «Kilchoman Fino Sherry Single Malt»
- «Arran Signature Series Signature Series Edition 2 Barrel Bonfire»
    → «Arran Signature Series Edition 2 Barrel Bonfire»
- «Aberfeldy Aberfeldy 12yo Single Malt»
    → «Aberfeldy 12yo Single Malt»
- «The Lakes Whiskymaker's Editions Kairos Kairos Edition»
    → «The Lakes Whiskymaker's Editions Kairos Edition»
- «The Lakes Whiskymaker's Edition Resfeber Resfeber Edition»
    → «The Lakes Whiskymaker's Edition Resfeber Edition»
- «AnCnoc AnCnoc 12yo Single Malt»
    → «AnCnoc 12yo Single Malt»
- «Ben Nevis Ben Nevis MacDonalds Traditional Single Malt»
    → «Ben Nevis MacDonalds Traditional Single Malt»
- «Glen Garioch Glen Garioch 12yo Single Malt»
    → «Glen Garioch 12yo Single Malt»
- «Macallan Macallan Harmony Rich Cacao Single Malt»
    → «Macallan Harmony Rich Cacao Single Malt»
- «Springbank Springbank 15yo Single Malt»
    → «Springbank 15yo Single Malt»
- «Glenfiddich Glenfiddich Festival Experiment Single Malt»
    → «Glenfiddich Festival Experiment Single Malt»
- «Fettercairn Fettercairn Glenkeir Festival Single Malt - 2015»
    → «Fettercairn Glenkeir Festival Single Malt - 2015»
- «Nikka Nikka Pure Malt Whisky Set»
    → «Nikka Pure Malt Whisky Set»
- «Springbank Springbank 10yo Cage Bottling Single Malt»
    → «Springbank 10yo Cage Bottling Single Malt»
- «Kilkerran Kilkerran Handfill 2021 Single Malt»
    → «Kilkerran Handfill 2021 Single Malt»
- «Glen Scotia Glen Scotia 12yo Seasonal Edition Single Malt»
    → «Glen Scotia 12yo Seasonal Edition Single Malt»
- «Glengoyne Glengoyne Distillery Edition Single Malt»
    → «Glengoyne Distillery Edition Single Malt»
- «Springbank Springbank Machrihanish Edition Single Malt»
    → «Springbank Machrihanish Edition Single Malt»
- «Bruichladdich Bruichladdich Feis 2021 Origins Single Malt»
    → «Bruichladdich Feis 2021 Origins Single Malt»
- «Bruichladdich Bruichladdich Feis Rockindaal 01 Single Malt»
    → «Bruichladdich Feis Rockindaal 01 Single Malt»
- «Bruichladdich Bruichladdich Feis Rockindaal 2 Single Malt»
    → «Bruichladdich Feis Rockindaal 2 Single Malt»
- «GlenDronach GlenDronach Ode to Embers Peated Single Malt»
    → «GlenDronach Ode to Embers Peated Single Malt»
- «GlenDronach GlenDronach Ode to Dark Single Malt»
    → «GlenDronach Ode to Dark Single Malt»
- «Kilkerran Kilkerran 8yo Cask Strength Single Malt»
    → «Kilkerran 8yo Cask Strength Single Malt»
- «Glenfiddich Glenfiddich Mr Porter Single Malt»
    → «Glenfiddich Mr Porter Single Malt»
- «AnCnoc AnCnoc 12yo Single Malt»
    → «AnCnoc 12yo Single Malt»
- «Ardbeg Ardbeg Corryvrechan Single Malt»
    → «Ardbeg Corryvrechan Single Malt»
- «GlenAllachie GlenAllachie 15yo Single Malt»
    → «GlenAllachie 15yo Single Malt»
- «Glenmorangie Glenmorangie Quinta Ruban 14yo Single Malt»
    → «Glenmorangie Quinta Ruban 14yo Single Malt»
- «Tomatin Tomatin TSE Exclusive 2009 15yo Single Malt»
    → «Tomatin TSE Exclusive 2009 15yo Single Malt»
- «GlenAllachie GlenAllachie Single Cask 2012 12yo Single Malt»
    → «GlenAllachie Single Cask 2012 12yo Single Malt»
- «Roseisle Roseisle 12yo Special Release 24 Single Malt»
    → «Roseisle 12yo Special Release 24 Single Malt»
- «Glenglassaugh Glenglassaugh Rare Cask 10yo UK Exclusive Single Malt»
    → «Glenglassaugh Rare Cask 10yo UK Exclusive Single Malt»
- «Ledaig Ledaig Hebridean Moon Single Malt»
    → «Ledaig Hebridean Moon Single Malt»
- «Bunnahabhain Bunnahabhain Toiteach A Dha Single Malt»
    → «Bunnahabhain Toiteach A Dha Single Malt»
- «Glen Scotia Glen Scotia Rubia Del Duero 9yo Single Malt»
    → «Glen Scotia Rubia Del Duero 9yo Single Malt»
- «Mortlach Mortlach Single Malt»
    → «Mortlach Single Malt»
- «The Wealth Spirit The Wealth Spirit 28yo Single Malt»
    → «The Wealth Spirit 28yo Single Malt»
- «Auchentoshan Auchentoshan Single Malt»
    → «Auchentoshan Single Malt»
- «Gordon & MacPhail Gordon & MacPhail 1981 Single Malt»
    → «Gordon & MacPhail 1981 Single Malt»
- «Gordon & MacPhail Gordon & MacPhail 1994 Single Malt»
    → «Gordon & MacPhail 1994 Single Malt»
- «Tomintoul Tomintoul Tawny Port Single Malt»
    → «Tomintoul Tawny Port Single Malt»
- «Cragganmore Cragganmore Distillers Edition 2017 Single Malt»
    → «Cragganmore Distillers Edition 2017 Single Malt»
- «Arran Arran 24yo TWS Single Cask Single Malt»
    → «Arran 24yo TWS Single Cask Single Malt»
- «Tomatin 14YO Port Cask Port Cask Finish»
    → «Tomatin 14YO Port Cask Finish»
- «Tobermory Tobermory 12yo Single Malt»
    → «Tobermory 12yo Single Malt»
- «Singleton Singleton 15yo Single Malt»
    → «Singleton 15yo Single Malt»
- «Mortlach Mortlach Natural Cask Single Malt»
    → «Mortlach Natural Cask Single Malt»
- «Glengoyne Glengoyne Cask Strength Batch 10 Single Malt»
    → «Glengoyne Cask Strength Batch 10 Single Malt»
- «Bunnahabhain Bunnahabhain Feis 2020 Amontillado Single Malt»
    → «Bunnahabhain Feis 2020 Amontillado Single Malt»
- «Clynelish Clynelish 14yo Single Malt»
    → «Clynelish 14yo Single Malt»
- «Ardnamurchan Ardnamurchan Cask Strength Single Malt»
    → «Ardnamurchan Cask Strength Single Malt»
- «BenRiach BenRiach Smoky 12yo Single Malt»
    → «BenRiach Smoky 12yo Single Malt»
- «Cardhu Cardhu 14yo Special Release 2021 Single Malt»
    → «Cardhu 14yo Special Release 2021 Single Malt»
- «Cragganmore Cragganmore Distillers Edition Single Malt»
    → «Cragganmore Distillers Edition Single Malt»
