# Dashboard artwork

## thailand.svg

Hero map drawn from the Thailand feature of [Natural Earth 1:50m Admin 0 Countries](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson), accessed 2026-09-17. The SVG uses a Mercator projection, preserves the complete country including its islands, and adds a silver gradient and subtle extrusion. The canvas is tightly framed around the country, without geographic grid lines or surrounding guides. Natural Earth data is [public domain](https://www.naturalearthdata.com/about/terms-of-use/).

### Station overlay

`ThailandStationMap.tsx` overlays the user's supplied 16 Station codes at 15 geographic locations. BKKPA and BKK share one Suvarnabhumi marker. This roster is configured company coverage, not a live headcount or an inference from employee records. Pin coordinates and label callouts are separate; labels can move for readability without moving the geographic locations. The overlay uses the exact Mercator transform of the country artwork.

Airport reference-point coordinates were checked against CAAT AIP Thailand, **AD 2.2**, AIRAC **2026-09-03** (accessed 2026-09-17):

| Station | CAAT source |
| --- | --- |
| BKKPA / BKK | [VTBS](https://aip.caat.or.th/2026-09-03-AIRAC/html/eAIP/VT-AD-2.VTBS-en-GB.html) |
| DMK | [VTBD](https://aip.caat.or.th/2026-09-03-AIRAC/html/eAIP/VT-AD-2.VTBD-en-GB.html) |
| CEI | [VTCT](https://aip.caat.or.th/2026-09-03-AIRAC/html/eAIP/VT-AD-2.VTCT-en-GB.html) |
| CNX | [VTCC](https://aip.caat.or.th/2026-09-03-AIRAC/html/eAIP/VT-AD-2.VTCC-en-GB.html) |
| UTH | [VTUD](https://aip.caat.or.th/2026-09-03-AIRAC/html/eAIP/VT-AD-2.VTUD-en-GB.html) |
| UBP | [VTUU](https://aip.caat.or.th/2026-09-03-AIRAC/html/eAIP/VT-AD-2.VTUU-en-GB.html) |
| KKC | [VTUK](https://aip.caat.or.th/2026-09-03-AIRAC/html/eAIP/VT-AD-2.VTUK-en-GB.html) |
| UTP | [VTBU](https://aip.caat.or.th/2026-09-03-AIRAC/html/eAIP/VT-AD-2.VTBU-en-GB.html) |
| HKT | [VTSP](https://aip.caat.or.th/2026-09-03-AIRAC/html/eAIP/VT-AD-2.VTSP-en-GB.html) |
| URT | [VTSB](https://aip.caat.or.th/2026-09-03-AIRAC/html/eAIP/VT-AD-2.VTSB-en-GB.html) |
| CJM | [VTSE](https://aip.caat.or.th/2026-09-03-AIRAC/html/eAIP/VT-AD-2.VTSE-en-GB.html) |
| HDY | [VTSS](https://aip.caat.or.th/2026-09-03-AIRAC/html/eAIP/VT-AD-2.VTSS-en-GB.html) |
| KBV | [VTSG](https://aip.caat.or.th/2026-09-03-AIRAC/html/eAIP/VT-AD-2.VTSG-en-GB.html) |
| NST | [VTSF](https://aip.caat.or.th/2026-09-03-AIRAC/html/eAIP/VT-AD-2.VTSF-en-GB.html) |

HDQ is an **approximate** marker for Ban Mai, Pak Kret, Nonthaburi, consistent with the [company's published office address](https://www.pattayaaviation.com/contact-us). It is explicitly identified as approximate in the interface; it is not a surveyed building coordinate or an airport.

## Generated photography

Created with the built-in image_gen tool for OrbitHire. These are fictional illustrative scenes, not photographs of actual employees or company facilities. Original generated PNG files remain in the Codex generated_images directory; the website uses compressed WebP copies.

## aircraft.webp

Use case: product-mockup. Asset type: transparent aircraft cutout for an elegant monochrome aviation HR dashboard, replacing a museum specimen in a large editorial layout. Generate one photorealistic silver-white twin-engine commercial passenger jet with a charcoal tail, no airline logos or lettering, seen from a dramatic three-quarter front-left view slightly above the nose, nose pointing left and wings spreading toward the right. Show the complete aircraft including both wingtips and tail, wide horizontal composition with generous transparent margins. Premium museum-quality aviation object photography, satin metal, accurate engines, soft neutral daylight, delicate surface reflections, crisp silhouette. True transparent background with alpha, no ground or horizon, no sky, no shadow backdrop, no text, no watermark. Render wide landscape.

## organization.webp

Use case: photorealistic-natural. Asset type: square editorial chapter photograph for an aviation people-management website. A sculptural airport air traffic control tower and a small section of its modern terminal architecture, photographed from below, the tower centered with generous breathing room, no people. Strictly monochrome silver gelatin photography, rich black and charcoal shadows, luminous silver highlights, fine film grain, understated premium magazine art direction, authentic human proportions and anatomy, sophisticated composition, realistic material textures. Soft directional light, 4:5 or square composition that can crop gracefully. No typography, no logos, no watermark, no UI. This is an illustrative fictional scene, not actual employees.

## manpower.webp

Use case: photorealistic-natural. Asset type: square editorial chapter photograph for an aviation people-management website. An overhead architectural photograph of a parked commercial jet at an airport gate with precisely aligned ground service vehicles and subtle apron lines, elegant orderly composition. Strictly monochrome silver gelatin photography, rich black and charcoal shadows, luminous silver highlights, fine film grain, understated premium magazine art direction, authentic human proportions and anatomy, sophisticated composition, realistic material textures. Soft directional light, 4:5 or square composition that can crop gracefully. No typography, no logos, no watermark, no UI. This is an illustrative fictional scene, not actual employees.

## employees.webp

Use case: photorealistic-natural. Asset type: square editorial chapter photograph for an aviation people-management website. Three fictional Thai and Southeast Asian airport ground operations colleagues, two women and one man in practical uniforms and safety vests, walking together naturally on an airport apron near an out-of-focus passenger aircraft, confident candid teamwork, no visible company logos. Strictly monochrome silver gelatin photography, rich black and charcoal shadows, luminous silver highlights, fine film grain, understated premium magazine art direction, authentic human proportions and anatomy, sophisticated composition, realistic material textures. Soft directional light, 4:5 or square composition that can crop gracefully. No typography, no logos, no watermark, no UI. This is an illustrative fictional scene, not actual employees.

## recruitment.webp

Use case: photorealistic-natural. Asset type: square editorial chapter photograph for an aviation people-management website. A candid moment of a fictional Thai HR recruiter and an aviation job candidate speaking across a desk in a refined glass airport office, thoughtful and welcoming, airport architecture softly blurred behind them, no paperwork with readable text. Strictly monochrome silver gelatin photography, rich black and charcoal shadows, luminous silver highlights, fine film grain, understated premium magazine art direction, authentic human proportions and anatomy, sophisticated composition, realistic material textures. Soft directional light, 4:5 or square composition that can crop gracefully. No typography, no logos, no watermark, no UI. This is an illustrative fictional scene, not actual employees.

## probation.webp

Use case: photorealistic-natural. Asset type: square editorial chapter photograph for an aviation people-management website. A fictional experienced Thai aviation operations mentor explaining a checklist on a tablet to a younger colleague during a hands-on airport ground safety briefing, attentive realistic expressions, aircraft fuselage in soft focus, uniformed professionals, no readable text. Strictly monochrome silver gelatin photography, rich black and charcoal shadows, luminous silver highlights, fine film grain, understated premium magazine art direction, authentic human proportions and anatomy, sophisticated composition, realistic material textures. Soft directional light, 4:5 or square composition that can crop gracefully. No typography, no logos, no watermark, no UI. This is an illustrative fictional scene, not actual employees.
