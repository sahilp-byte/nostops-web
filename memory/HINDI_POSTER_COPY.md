# Hindi poster wording — for owner review (Venue Partner posters)

Font: **Hind** (Indian Type Foundry, SIL Open Font License, `/app/backend/fonts/`), shaped with HarfBuzz so
conjuncts and matras render correctly. Venue names stay exactly as the owner typed them. `NOSTOPS` stays in Latin letters.
Edit the wording in `/app/backend/venue_growth_partners.py → poster_copy(lang="hi")`.

| Where | English | Hindi (हिन्दी) |
|---|---|---|
| Top band tagline | A teacher-first yoga cooperative | शिक्षक-प्रथम योग सहकारी संस्था |
| **Teachers poster** · eyebrow | FOR YOGA TEACHERS | योग शिक्षकों के लिए |
| Teachers · headline | Yoga teachers, host your retreat here | योग शिक्षक, अपना रिट्रीट यहाँ आयोजित करें |
| Teachers · subline | {Venue} welcomes yoga teachers for retreats, trainings and collaborations. | {Venue} रिट्रीट, प्रशिक्षण और सहयोग के लिए योग शिक्षकों का स्वागत करता है। |
| Teachers · under QR (published) | Scan to explore our venue on NOSTOPS | NOSTOPS पर हमारा स्थल देखने के लिए स्कैन करें |
| Teachers · under QR (not yet published) | Scan to discover venues on NOSTOPS | NOSTOPS पर स्थल खोजने के लिए स्कैन करें |
| Teachers · join box | Not on NOSTOPS yet? Create your free teacher profile: | अभी NOSTOPS पर नहीं हैं? अपनी निःशुल्क शिक्षक प्रोफ़ाइल बनाएँ: |
| **Guests poster** (published) · eyebrow | LISTED ON NOSTOPS | NOSTOPS पर सूचीबद्ध |
| Guests (published) · headline | Find us on NOSTOPS | हमें NOSTOPS पर खोजें |
| Guests (published) · subline | {Venue} is listed on NOSTOPS, a teacher-first yoga cooperative. | {Venue} NOSTOPS पर सूचीबद्ध है, जो शिक्षक-प्रथम योग सहकारी संस्था है। |
| Guests (published) · under QR | Scan to see our NOSTOPS venue profile | हमारी NOSTOPS स्थल प्रोफ़ाइल देखने के लिए स्कैन करें |
| Guests (not yet published) · headline | We're joining NOSTOPS | हम NOSTOPS से जुड़ रहे हैं |
| Guests (not yet published) · subline | {Venue} is joining NOSTOPS, a teacher-first yoga cooperative. | {Venue} NOSTOPS से जुड़ रहा है, जो शिक्षक-प्रथम योग सहकारी संस्था है। |
| Guests (not yet published) · under QR | Scan to discover NOSTOPS | NOSTOPS के बारे में जानने के लिए स्कैन करें |
| Footer (both) | Listing on NOSTOPS is not a verification or endorsement of the venue. | NOSTOPS पर सूचीबद्ध होना स्थल का सत्यापन या समर्थन नहीं है। |

Notes for the reviewer
- "स्थल" is used for "venue" (alternatives: "स्थान", "केंद्र"). "रिट्रीट" is kept as the commonly used loan word.
- "करता है" / "जुड़ रहा है" use the masculine default for "स्थल". If you prefer gender-neutral phrasing, e.g. "… का स्वागत है", tell us.
- Each Hindi word is shaped on its own (HarfBuzz, Devanagari rules), so lines that mix NOSTOPS, the venue name or URLs with Hindi
  still render proper conjuncts and matras (e.g. "सूचीबद्ध", "शिक्षक", "स्थल").

## Invitation note (PDF) and WhatsApp message — Hindi
Edit in `/app/backend/venue_growth.py → invitation_lines_hi()` and `/app/frontend/app/(public)/venues/submit/thank-you/page.tsx → whatsappMessageHi()`.

| English | Hindi |
|---|---|
| AN INVITATION TO YOGA TEACHERS | योग शिक्षकों के लिए निमंत्रण |
| Namaste! | नमस्ते! |
| Our venue, {Venue}, is listed on NOSTOPS, a teacher-first yoga cooperative. | हमारा स्थल, {Venue}, NOSTOPS पर सूचीबद्ध है, जो शिक्षक-प्रथम योग सहकारी संस्था है। |
| (not yet published) … is joining NOSTOPS … | हमारा स्थल, {Venue}, NOSTOPS से जुड़ रहा है, जो शिक्षक-प्रथम योग सहकारी संस्था है। |
| We invite yoga teachers to discover our property and explore opportunities to host meaningful yoga retreats. | हम योग शिक्षकों को हमारे स्थल को देखने और यहाँ सार्थक योग रिट्रीट आयोजित करने की संभावनाएँ तलाशने के लिए आमंत्रित करते हैं। |
| We would love to discuss the facilities, possible dates and commercial arrangements with interested teachers. | इच्छुक शिक्षकों के साथ हम सुविधाओं, संभावित तिथियों और व्यावसायिक व्यवस्थाओं पर चर्चा करना चाहेंगे। |
| EXPLORE OUR VENUE: | हमारा स्थल देखें: |
| VIEW OUR NOSTOPS LISTING: / DISCOVER VENUES ON NOSTOPS: | NOSTOPS पर हमारी लिस्टिंग देखें: / NOSTOPS पर स्थल खोजें: |
| ARE YOU A YOGA TEACHER? | क्या आप योग शिक्षक हैं? |
| Create your free professional profile on NOSTOPS and discover opportunities to connect with venues and the wider yoga community. | NOSTOPS पर अपनी निःशुल्क पेशेवर प्रोफ़ाइल बनाएँ और स्थलों तथा व्यापक योग समुदाय से जुड़ने के अवसर खोजें। |
| CREATE YOUR FREE TEACHER PROFILE: | अपनी निःशुल्क शिक्षक प्रोफ़ाइल बनाएँ: |
| We look forward to exploring the possibilities together. | हम साथ मिलकर संभावनाएँ तलाशने के लिए उत्सुक हैं। |
| Warm regards, | सादर, |
| WhatsApp: … Yoga teachers are warmly invited to explore our property and connect with us about hosting meaningful retreats. | … योग शिक्षकों को हमारे स्थल को देखने और सार्थक रिट्रीट आयोजित करने के लिए हमसे जुड़ने का सादर निमंत्रण है। |
| WhatsApp: Are you a yoga teacher? Create your free professional profile: | क्या आप योग शिक्षक हैं? अपनी निःशुल्क पेशेवर प्रोफ़ाइल बनाएँ: |
