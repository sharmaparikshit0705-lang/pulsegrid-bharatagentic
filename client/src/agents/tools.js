/**
 * PulseGrid agent core — tool registry.
 *
 * Each tool is a real, deterministic implementation (simulated data, honest
 * labels). Agents may only act through these tools; every call is recorded
 * into the active run so the whole chain is replayable.
 *
 * Tools that would talk to the outside world (Vision AI, IMD, ULIP,
 * a chain) are implemented as deterministic simulators and labelled as such
 * in their result payloads, so nothing is misrepresented as a live integration.
 */
import {
  NODES,
  EDGES,
  HAZARDS,
  PRECOOLING_NODES,
  REST_FACILITIES,
  COMMODITIES,
  SHIPMENTS,
  CORRIDOR_JUNCTIONS,
  HOTSPOTS,
  DRIVERS,
  pathBetween,
  summarisePath,
  haversineKm,
  makeRng,
} from './corridor.js';

/* ------------------------------ utilities ------------------------------ */
function sha256Hex(input) {
  // Small, dependency-free FNV-1a based digest stand-in (labelled as such).
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const s = typeof input === 'string' ? input : JSON.stringify(input);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(4).slice(0, 64);
}

const minutesToHM = (m) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`;

/**
 * Driver-facing notification strings in English and all 22 Indian languages the
 * platform supports. Translations were produced by the platform translation
 * service (not hand-written), so the script is accurate rather than decorative.
 */
export const VERNACULAR = {
  "route_change": {
    "en-IN": "Route changed. Follow the new route on the driver app. Flood ahead on the highway.",
    "hi-IN": "रूट बदल दिया गया है। ड्राइवर ऐप पर नए रूट का फॉलो करें। हाईवे पर आगे बाढ़ है।",
    "bn-IN": "রুট বদলে গেছে। ড্রাইভার অ্যাপে নতুন রুটটা ফলো করুন। হাইওয়েতে সামনে বন্যা আছে।",
    "te-IN": "రూట్ మారింది. డ్రైవర్ యాప్‌లో కొత్త రూట్ ఫాలో అవ్వండి. హైవే మీద ముందు వరద ఉంది.",
    "kn-IN": "ಮಾರ್ಗ ಬದಲಾಗಿದೆ. ಡ್ರೈವರ್ ಆಪ್‌ನಲ್ಲಿ ಹೊಸ ಮಾರ್ಗವನ್ನು ಅನುಸರಿಸಿ. ಹೈವೇಯಲ್ಲಿ ಮುಂದೆ ಪ್ರವಾಹವಿದೆ.",
    "mr-IN": "रूट बदलला आहे. ड्रायव्हर ॲपवर नवीन रूट फॉलो करा. हायवेवर पुढे पूर आहे.",
    "gu-IN": "રૂટ બદલાઈ ગયો છે. ડ્રાઇવર એપ પર નવો રૂટ ફોલો કરો. હાઇવે પર આગળ પૂર છે.",
    "pa-IN": "ਰੂਟ ਬਦਲ ਦਿੱਤਾ ਗਿਆ ਹੈ। ਡਰਾਈਵਰ ਐਪ 'ਤੇ ਨਵੇਂ ਰੂਟ ਦੀ ਪਾਲਣਾ ਕਰੋ। ਹਾਈਵੇਅ 'ਤੇ ਅੱਗੇ ਹੜ੍ਹ ਹੈ।",
    "or-IN": "ରାସ୍ତା ବଦଳିଯାଇଛି। ଡ୍ରାଇଭର ଆପ୍‌ରେ ନୂଆ ରାସ୍ତାକୁ ଅନୁସରଣ କରନ୍ତୁ। ରାଜପଥରେ ଆଗକୁ ବନ୍ୟା ପରିସ୍ଥିତି ଅଛି।",
    "ml-IN": "റൂട്ട് മാറ്റിയിട്ടുണ്ട്. ഡ്രൈവർ ആപ്പിൽ പുതിയ റൂട്ട് പിന്തുടരുക. ഹൈവേയിൽ മുന്നിൽ വെള്ളക്കെട്ടുണ്ട്.",
    "ta-IN": "வழி மாறியிருக்கு. டிரைவர் ஆப்ல இருக்கிற புது வழியைப் பின்பற்றுங்க. ஹைவேல முன்னாடி வெள்ளம் இருக்கு.",
    "as-IN": "ৰাস্তা সলনি হৈছে। ড্ৰাইভাৰ এপত নতুন ৰাস্তাটো অনুসৰণ কৰক। হাইৱেত আগত বানপানী।",
    "ur-IN": "راستہ بدل گیا ہے۔ ڈرائیور ایپ پر نیا راستہ فالو کریں۔ ہائی وے پر آگے سیلاب ہے۔",
    "ne-IN": "रुट परिवर्तन भएको छ। ड्राइभर एपमा नयाँ रुट फलो गर्नुहोस्। हाइवेमा अगाडि बाढी आएको छ।",
    "kok-IN": "रूट बदलला. ड्रायव्हर ॲपांतल्या नव्या रूटार वचात. हायवेचेर फुडे हुंवार आसा.",
    "mai-IN": "रूट बदलि गेल अछि। ड्राइवर ऐप पर नव रूटक पालन करू। हाईवे पर आगू बाढ़ि अछि।",
    "doi-IN": "रास्ता बदली गेआ ऐ। ड्राइवर ऐप पर नमें रस्ते पर चलो। हाईवे पर अग्गें बाढ़ ऐ।",
    "brx-IN": "लामा सोलायबाय। ड्राइभार एपआव गोदान लामाखौ उनसं। हाइवेआव सिगां बाना फैदों।",
    "mni-IN": "ꯔꯨꯠ ꯍꯣꯡꯂꯦ꯫ ꯗ꯭ꯔꯥꯏꯚꯔ ꯑꯦꯞꯇ ꯑꯅꯧꯕ ꯔꯨꯠ ꯑꯗꯨ ꯏꯟꯕꯤꯌꯨ꯫ ꯍꯥꯏꯋꯦꯗ ꯃꯃꯥꯡꯗ ꯏꯁꯤꯡ ꯏꯆꯥꯎ ꯂꯩ꯫",
    "sa-IN": "मार्गः परिवर्तितः। चालक-अनुप्रयोगे नूतनमार्गम् अनुसरतु। राजमार्गस्य अग्रे जलप्लावनम् अस्ति।",
    "sat-IN": "ᱨᱩᱴ ᱵᱚᱫᱚᱞ ᱟᱠᱟᱱᱟ᱾ ᱰᱨᱟᱭᱵᱷᱚᱨ ᱮᱯ ᱨᱮ ᱱᱟᱶᱟ ᱨᱩᱴ ᱯᱟᱸᱡᱟᱭ ᱢᱮ᱾ ᱦᱟᱭᱣᱮ ᱨᱮ ᱢᱟᱲᱟᱝ ᱥᱮᱫ ᱫᱟᱜ ᱯᱮᱨᱮᱡ ᱟᱠᱟᱱᱟ᱾",
    "sd-IN": "रूट तब्दील थी वियो आहे। ड्राइवर ऐप ते नएं रूट ते हलो। हाईवे ते अञा अगे पाणी भरियल आहे।",
    "ks-IN": "راستہٕ آو بدلاونہٕ۔ ڈرائیور ایپَس پؠٹھ نٔوِس راستس پؠٹھ پٔکِو۔ ہائی وے پؠٹھ چھُ برونٛہہ کِنہِ سٮ۪لاب۔"
  },
  "rest_break": {
    "en-IN": "Break scheduled at the next rest stop. Rest is mandatory.",
    "hi-IN": "अगले रेस्ट स्टॉप पर ब्रेक है। ब्रेक लेना ज़रूरी है।",
    "bn-IN": "পরের রেস্ট স্টপে ব্রেক নেওয়ার শিডিউল আছে। বিশ্রাম নেওয়াটা বাধ্যতামূলক।",
    "te-IN": "తర్వాతి రెస్ట్ స్టాప్ దగ్గర బ్రేక్ ఉంటుంది. రెస్ట్ తీసుకోవడం తప్పనిసరి.",
    "kn-IN": "ಮುಂದಿನ ರೆಸ್ಟ್ ಸ್ಟಾಪ್‌ನಲ್ಲಿ ಬ್ರೇಕ್ ನಿಗದಿಪಡಿಸಲಾಗಿದೆ. ವಿಶ್ರಾಂತಿ ಕಡ್ಡಾಯ.",
    "mr-IN": "पुढच्या विश्रांतीच्या ठिकाणी ब्रेक ठरलेला आहे. विश्रांती घेणे सक्तीचे आहे.",
    "gu-IN": "આગળના રેસ્ટ સ્ટોપ પર બ્રેક શેડ્યૂલ કરેલ છે. આરામ કરવો ફરજિયાત છે.",
    "pa-IN": "ਅਗਲੇ ਰੈਸਟ ਸਟਾਪ 'ਤੇ ਬ੍ਰੇਕ ਦਾ ਸਮਾਂ ਤੈਅ ਹੈ। ਆਰਾਮ ਕਰਨਾ ਲਾਜ਼ਮੀ ਹੈ।",
    "or-IN": "ପରବର୍ତ୍ତୀ ବିଶ୍ରାମ ସ୍ଥଳରେ ବ୍ରେକ୍ ଦିଆଯିବ। ବିଶ୍ରାମ ନେବା ବାଧ୍ୟତାମୂଳକ।",
    "ml-IN": "അടുത്ത വിശ്രമകേന്ദ്രത്തിൽ ബ്രേക്ക് ഷെഡ്യൂൾ ചെയ്തിട്ടുണ്ട്. വിശ്രമം നിർബന്ധമാണ്.",
    "ta-IN": "அடுத்த ரெஸ்ட் ஸ்டாப்ல பிரேக் எடுக்கலாம். ரெஸ்ட் எடுக்குறது கட்டாயம்.",
    "as-IN": "পৰৱৰ্তী জিৰণি স্থানত বিৰতি। জিৰণি লোৱাটো বাধ্যতামূলক।",
    "ur-IN": "اگلے ریسٹ اسٹاپ پر بریک طے ہے۔ آرام کرنا لازمی ہے۔",
    "ne-IN": "अर्को रेस्ट स्टपमा ब्रेक हुनेछ। आराम गर्न अनिवार्य छ।",
    "kok-IN": "फुडल्या विश्रांती सुवातेर ब्रेक आसा. विश्रांती घेवप सक्तीचें आसा.",
    "mai-IN": "अगला रेस्ट स्टॉप पर ब्रेक तय अछि। आराम करब अनिवार्य अछि।",
    "doi-IN": "अगले रेस्ट स्टॉप पर ब्रेक होग। आराम करना जरूरी ऐ।",
    "brx-IN": "उननि जिरायनाय जायगायाव ब्रेक दं। जिरायनाया गोनांथार।",
    "mni-IN": "ꯃꯊꯪꯒꯤ ꯔꯦꯁ꯭ꯠ ꯁ꯭ꯇꯣꯞꯇ ꯕ꯭ꯔꯦꯛ ꯊꯝꯒꯅꯤ꯫ ꯄꯣꯊꯥꯕꯁꯤ ꯃꯊꯧ ꯇꯥꯏ꯫",
    "sa-IN": "परिवर्तनस्थानके विश्रामः निर्धारितः अस्ति। विश्रामः अनिवार्यः।",
    "sat-IN": "ᱤᱱᱟᱹ ᱛᱟᱭᱚᱢ ᱡᱤᱨᱟᱹᱣ ᱴᱷᱟᱶ ᱨᱮ ᱡᱤᱨᱟᱹᱣᱜ ᱨᱮᱭᱟᱜ ᱚᱠᱛᱚ ᱢᱮᱱᱟᱜᱼᱟ᱾ ᱡᱤᱨᱟᱹᱣ ᱫᱚ ᱟᱹᱰᱤ ᱡᱟᱹᱨᱩᱲ ᱜᱮᱭᱟ᱾",
    "sd-IN": "अग्ले रेस्ट स्टॉप ते ब्रेक जो शेड्युल आहे। आराम करण लाज़मी आहे।",
    "ks-IN": "اَگِمس رُکنہٕ کِس جاے پؠٹھ چھُ بریک۔ آرام کرُن چھُ ضۆروٗری۔"
  },
  "temp_excursion": {
    "en-IN": "Temperature excursion detected. Diverting for pre-cooling.",
    "hi-IN": "तापमान में उतार-चढ़ाव का पता चला है। पहले से ठंडा करने के लिए रूट बदला जा रहा है।",
    "bn-IN": "তাপমাত্রার ওঠানামা ধরা পড়েছে। আগে থেকে ঠান্ডা করার জন্য রুট ঘুরিয়ে দেওয়া হচ্ছে।",
    "te-IN": "ఉష్ణోగ్రతల్లో మార్పు గుర్తించింది. ముందుగా చల్లబరచడానికి దారి మారుస్తున్నాం.",
    "kn-IN": "ತಾಪಮಾನ ಏರುಪೇರಾಗಿದೆ. ಪ್ರಿ-ಕೂಲಿಂಗ್‌ಗಾಗಿ ಮಾರ್ಗ ಬದಲಾಯಿಸುತ್ತಿದ್ದೇವೆ.",
    "mr-IN": "तापमानात बदल आढळला आहे. प्री-कूलिंगसाठी रस्ता बदलला जात आहे.",
    "gu-IN": "તાપમાનમાં ફેરફાર જોવા મળ્યો છે. પ્રી-કૂલિંગ માટે રસ્તો બદલવામાં આવી રહ્યો છે.",
    "pa-IN": "ਤਾਪਮਾਨ ਵਿੱਚ ਬਦਲਾਅ ਦਾ ਪਤਾ ਲੱਗਾ ਹੈ। ਪਹਿਲਾਂ ਤੋਂ ਠੰਡਾ ਕਰਨ ਲਈ ਰਸਤਾ ਬਦਲਿਆ ਜਾ ਰਿਹਾ ਹੈ।",
    "or-IN": "ତାପମାତ୍ରାରେ ପରିବର୍ତ୍ତନ ଦେଖାଦେଇଛି। ପ୍ରି-କୁଲିଂ ପାଇଁ ରାସ୍ତା ବଦଳାଯାଉଛି।",
    "ml-IN": "താപനിലയിൽ വ്യതിയാനം കണ്ടെത്തി. പ്രീ-കൂളിംഗിനായി വഴിതിരിച്ചുവിടുന്നു.",
    "ta-IN": "வெப்பநிலை மாறுபாடு கண்டுபிடிக்கப்பட்டிருக்கு. ப்ரீ-கூலிங்க்காக திசை திருப்புகிறோம்.",
    "as-IN": "উষ্ণতাৰ তাৰতম্য ধৰা পৰিছে। আগতীয়াকৈ ঠাণ্ডা কৰিবলৈ ৰাস্তা সলনি কৰা হৈছে।",
    "ur-IN": "درجہ حرارت میں تبدیلی کا پتہ چلا ہے۔ پہلے سے ٹھنڈا کرنے کے لیے راستہ بدلا جا رہا ہے۔",
    "ne-IN": "तापक्रम बिग्रिएको पत्ता लाग्यो। प्रि-कुलिङको लागि डाइभर्ट गर्दैछौं।",
    "kok-IN": "तापमानांत बदल जाला. थंड करपाक मार्ग बदलतात.",
    "mai-IN": "तापमान में उतार-चढ़ाव देखल गेल अछि। प्री-कूलिंग लेल रस्ता बदलल जा रहल अछि।",
    "doi-IN": "तापमान बद्धने दा पता लग्गा ऐ। प्री-कूलिंग लेई रस्ता बदली करदे आं।",
    "brx-IN": "बिदुं सोलायनायखौ मोनबाय। सिगां गुसु खालामनो थाखाय लामा सोलायदों।",
    "mni-IN": "ꯇꯦꯝꯄꯔꯦꯆꯔ ꯍꯣꯡꯂꯛꯄ ꯈꯪꯂꯦ꯫ ꯄ꯭ꯔꯤ-ꯀꯨꯂꯤꯡꯒꯤꯗꯃꯛ ꯑꯇꯣꯞꯄ ꯂꯝꯕꯤꯗꯥ ꯆꯠꯂꯦ꯫",
    "sa-IN": "तापमानस्य वृद्धिः ज्ञाता। पूर्वशीतलीकरणार्थं मार्गपरिवर्तनं क्रियते।",
    "sat-IN": "ᱞᱚᱞᱚ ᱵᱟᱹᱲᱛᱤ ᱟᱠᱟᱱᱟ᱾ ᱨᱮᱭᱟᱲ ᱞᱟᱹᱜᱤᱫ ᱮᱴᱟᱜ ᱥᱮᱫ ᱛᱮ ᱪᱟᱞᱟᱜ ᱠᱟᱱᱟ᱾",
    "sd-IN": "तापमान में तब्दीली महसूस थी आहे। प्री-कूलिंग लाइ रस्तो मटायो पियो वञे।",
    "ks-IN": "ٹمپریچر چھُ خراب گومُت۔ برونٛہہ کِنہِ ٹھنڈٕ کرنہٕ خٲطرٕ چھُ وکھتہٕ بدلاونہٕ یِوان۔"
  }
};

/** Language roster for the UI: code, English name, and the endonym. */
export const LANGUAGES = [
  {
    "code": "en-IN",
    "name": "English",
    "native": "English"
  },
  {
    "code": "hi-IN",
    "name": "Hindi",
    "native": "हिन्दी"
  },
  {
    "code": "bn-IN",
    "name": "Bengali",
    "native": "বাংলা"
  },
  {
    "code": "ta-IN",
    "name": "Tamil",
    "native": "தமிழ்"
  },
  {
    "code": "te-IN",
    "name": "Telugu",
    "native": "తెలుగు"
  },
  {
    "code": "mr-IN",
    "name": "Marathi",
    "native": "मराठी"
  },
  {
    "code": "gu-IN",
    "name": "Gujarati",
    "native": "ગુજરાતી"
  },
  {
    "code": "kn-IN",
    "name": "Kannada",
    "native": "ಕನ್ನಡ"
  },
  {
    "code": "ml-IN",
    "name": "Malayalam",
    "native": "മലയാളം"
  },
  {
    "code": "pa-IN",
    "name": "Punjabi",
    "native": "ਪੰਜਾਬੀ"
  },
  {
    "code": "or-IN",
    "name": "Odia",
    "native": "ଓଡ଼ିଆ"
  },
  {
    "code": "as-IN",
    "name": "Assamese",
    "native": "অসমীয়া"
  },
  {
    "code": "ur-IN",
    "name": "Urdu",
    "native": "اردو"
  },
  {
    "code": "ne-IN",
    "name": "Nepali",
    "native": "नेपाली"
  },
  {
    "code": "kok-IN",
    "name": "Konkani",
    "native": "कोंकणी"
  },
  {
    "code": "mai-IN",
    "name": "Maithili",
    "native": "मैथिली"
  },
  {
    "code": "doi-IN",
    "name": "Dogri",
    "native": "डोगरी"
  },
  {
    "code": "brx-IN",
    "name": "Bodo",
    "native": "बड़ो"
  },
  {
    "code": "mni-IN",
    "name": "Manipuri",
    "native": "মৈতৈলোন্"
  },
  {
    "code": "sa-IN",
    "name": "Sanskrit",
    "native": "संस्कृतम्"
  },
  {
    "code": "sat-IN",
    "name": "Santali",
    "native": "ᱥᱟᱱᱛᱟᱲᱤ"
  },
  {
    "code": "sd-IN",
    "name": "Sindhi",
    "native": "سنڌي"
  },
  {
    "code": "ks-IN",
    "name": "Kashmiri",
    "native": "کٲشُر"
  }
];

/** code -> English name */
export const LANGUAGE_LABELS = {"en-IN": "English", "hi-IN": "Hindi", "bn-IN": "Bengali", "ta-IN": "Tamil", "te-IN": "Telugu", "mr-IN": "Marathi", "gu-IN": "Gujarati", "kn-IN": "Kannada", "ml-IN": "Malayalam", "pa-IN": "Punjabi", "or-IN": "Odia", "as-IN": "Assamese", "ur-IN": "Urdu", "ne-IN": "Nepali", "kok-IN": "Konkani", "mai-IN": "Maithili", "doi-IN": "Dogri", "brx-IN": "Bodo", "mni-IN": "Manipuri", "sa-IN": "Sanskrit", "sat-IN": "Santali", "sd-IN": "Sindhi", "ks-IN": "Kashmiri"};

/* -------------------------------- tools -------------------------------- */
export const TOOLS = {
  /* ---------- sensing ---------- */
  vision_analyze_road_damage: {
    id: 'vision_analyze_road_damage',
    description: 'Score a road frame for surface defects (Vision AI interface).',
    simulated: true,
    run({ frameId = 'frame', speedKmh = 50, seed = 7 } = {}) {
      if (speedKmh >= 60) {
        return { ok: false, error: 'Frame rejected: edge capture is only valid below 60 km/h' };
      }
      const rng = makeRng(seed);
      const hasPothole = rng() > 0.15;
      const severityScore = hasPothole ? 3 + Math.round(rng() * 2) : 1;
      const types = ['Pothole', 'Alligator Cracking', 'Longitudinal Cracking', 'Edge Break'];
      return {
        ok: true,
        hasPothole,
        severityScore,
        damageType: hasPothole ? types[Math.floor(rng() * types.length)] : 'No significant defect detected',
        estimatedSizeCm: hasPothole ? 30 + Math.round(rng() * 45) : 0,
        confidence: +(0.84 + rng() * 0.13).toFixed(2),
        model: 'pulsegrid-vision-v1 (simulated response)',
        frameId,
      };
    },
  },

  weather_flood_alert: {
    id: 'weather_flood_alert',
    description: 'Fetch active flood/weather alerts for a region.',
    simulated: true,
    run({ region = 'thrissur' } = {}) {
      const hazard = Object.values(HAZARDS).find((h) => h.id.includes(region));
      return hazard
        ? { ok: true, active: true, hazard, source: hazard.source }
        : { ok: true, active: false, hazard: null };
    },
  },

  road_closure_feed: {
    id: 'road_closure_feed',
    description: 'Active road closures / blockages on a corridor.',
    simulated: true,
    run({ corridor = 'CBE-KOCHI' } = {}) {
      return {
        ok: true,
        corridor,
        closures: [
          { id: 'CL-1', label: 'NH-544 near Thrissur — waterlogging', hazardId: 'flood-thrissur', severity: 'high' },
        ],
      };
    },
  },

  hotspot_score: {
    id: 'hotspot_score',
    description: 'Crash-risk score for a point: clusters, school proximity, recent defects.',
    simulated: true,
    run({ lat, lng } = {}) {
      let best = null;
      let bestKm = Infinity;
      for (const h of HOTSPOTS) {
        const km = haversineKm({ lat, lng }, h);
        if (km < bestKm) {
          bestKm = km;
          best = h;
        }
      }
      const near = bestKm <= 0.6 ? best : null;
      const score = near
        ? Math.min(100, 35 + near.fatalCrashes12m * 4 + near.recentDefects * 3 + (near.schoolNearby ? 15 : 0))
        : 20;
      return { ok: true, score, nearestHotspot: near, distanceKm: bestKm, schoolNearby: Boolean(near?.schoolNearby) };
    },
  },

  driver_duty_status: {
    id: 'driver_duty_status',
    description: 'Continuous driving hours, rest taken and fatigue score for a driver.',
    simulated: true,
    run({ driverId } = {}) {
      const d = DRIVERS[driverId];
      if (!d) return { ok: false, error: `Unknown driver ${driverId}` };
      const fatigueScore = Math.min(100, Math.round((d.continuousHours / d.shiftCapHours) * 100 - d.restTakenH * 8));
      const legalRestDueIn = Math.max(0, +(d.shiftCapHours - d.continuousHours).toFixed(1));
      return { ok: true, driverId, continuousHours: d.continuousHours, restTakenH: d.restTakenH, fatigueScore, legalRestDueIn };
    },
  },

  ulip_track_and_trace: {
    id: 'ulip_track_and_trace',
    description: 'Multimodal track-and-trace for a consignment (ULIP interface).',
    simulated: true,
    run({ shipmentId } = {}) {
      const s = SHIPMENTS[shipmentId];
      if (!s) return { ok: false, error: `Unknown shipment ${shipmentId}` };
      return {
        ok: true,
        shipmentId,
        mode: 'road',
        lastScan: { point: 'CBE corridor exit', minutesAgo: 12 },
        etaMinutes: 210,
        source: 'ULIP-shaped payload (simulated)',
      };
    },
  },

  /* ---------- reasoning support ---------- */
  route_solver: {
    id: 'route_solver',
    description: 'Enumerate corridor routes with distance, time, toll and hazard exposure.',
    simulated: false,
    run({ from = 'CBE', to = 'KOCHI', avoid = [] } = {}) {
      const paths = pathBetween(EDGES, from, to).map(summarisePath);
      const scored = paths.map((p, i) => ({
        id: `R${i + 1}`,
        ...p,
        // `avoid` is a hard constraint: a route is compliant only if it crosses
        // none of the hazards listed there.
        hazardExposure: p.hazardsCrossed,
        avoidsHazards: p.hazardsCrossed.every((h) => !avoid.includes(h)),
      }));
      return { ok: true, from, to, options: scored };
    },
  },

  rsl_model: {
    id: 'rsl_model',
    description: 'Remaining Shelf Life: base shelf life minus temperature-band decay.',
    simulated: false,
    run({ commodity, elapsedH = 0, tempTrace = [], ambientC = 30 } = {}) {
      const c = COMMODITIES[commodity];
      if (!c) return { ok: false, error: `Unknown commodity ${commodity}` };
      const [lo, hi] = c.toleranceC;
      let breachMinutes = 0;
      let degreeHours = 0;
      for (const t of tempTrace) {
        if (t.tempC > hi) {
          breachMinutes += t.minutes;
          degreeHours += (t.tempC - hi) * (t.minutes / 60);
        } else if (t.tempC < lo) {
          breachMinutes += t.minutes;
          degreeHours += (lo - t.tempC) * (t.minutes / 60);
        }
      }
      const decayMultiplier = +(1 + c.decayPerDegreeAboveBand * degreeHours).toFixed(2);
      const consumed = elapsedH * decayMultiplier;
      const rslRemainingH = Math.max(0, +(c.baseShelfLifeHours - consumed).toFixed(1));
      const rslDays = +(rslRemainingH / 24).toFixed(1);
      return {
        ok: true,
        commodity,
        toleranceC: c.toleranceC,
        baseShelfLifeH: c.baseShelfLifeHours,
        elapsedH,
        breachMinutes,
        degreeHoursOutOfBand: +degreeHours.toFixed(2),
        decayMultiplier,
        rslRemainingH,
        rslDays,
        toleranceBreach: breachMinutes > 0,
      };
    },
  },

  find_precooling_node: {
    id: 'find_precooling_node',
    description: 'Nearest pre-cooling / cold-store facility with free capacity.',
    simulated: false,
    run({ nearLat, nearLng, radiusKm = 200 } = {}) {
      const ranked = PRECOOLING_NODES.map((n) => ({ ...n, km: haversineKm({ lat: nearLat, lng: nearLng }, n) }))
        .filter((n) => n.km <= radiusKm)
        .sort((a, b) => a.km - b.km);
      return { ok: true, candidates: ranked };
    },
  },

  find_rest_facility: {
    id: 'find_rest_facility',
    description: 'Nearest driver rest facility with amenities.',
    simulated: false,
    run({ nearLat, nearLng } = {}) {
      const ranked = REST_FACILITIES.map((f) => ({ ...f, km: haversineKm({ lat: nearLat, lng: nearLng }, f) })).sort((a, b) => a.km - b.km);
      return { ok: true, candidates: ranked };
    },
  },

  carbon_footprint: {
    id: 'carbon_footprint',
    description: 'CO2e for a movement, by mode.',
    simulated: false,
    run({ tonneKm = 0, mode = 'road' } = {}) {
      const factor = { road: 0.092, rail: 0.028, waterway: 0.016, air: 0.602 }[mode] ?? 0.092; // kgCO2e per tonne-km
      const kgCO2e = +(tonneKm * factor).toFixed(1);
      return { ok: true, mode, tonneKm, kgCO2e, factorKgPerTonneKm: factor };
    },
  },

  modal_shift_option: {
    id: 'modal_shift_option',
    description: 'Cheapest lower-carbon mode for a movement (road → rail).',
    simulated: true,
    run({ from = 'CBE', to = 'KOCHI', tonnes = 6 } = {}) {
      const km = 190;
      const road = { mode: 'road', costInr: Math.round(km * tonnes * 3.38), co2Kg: +(km * tonnes * 0.092).toFixed(0) };
      const rail = { mode: 'rail', costInr: Math.round(km * tonnes * 1.96 + 4200), co2Kg: +(km * tonnes * 0.028).toFixed(0), availability: 'rake available in 14h' };
      return { ok: true, from, to, options: [road, rail], co2SavedKg: road.co2Kg - rail.co2Kg };
    },
  },

  /* ---------- acting ---------- */
  postgis_upsert_defect: {
    id: 'postgis_upsert_defect',
    description: 'Write a defect into the corridor twin (PostGIS).',
    simulated: true,
    run({ lat, lng, severityScore, damageType, sizeCm, sourceType = 'BUS_DASHCAM' } = {}) {
      const id = `DEF-${String(Math.abs(Math.round(lat * 1e5 + lng * 1e4)) % 90000 + 10000)}`;
      return { ok: true, defect: { id, lat, lng, severityScore, damageType, sizeCm, sourceType, status: 'PENDING', createdAt: new Date().toISOString() } };
    },
  },

  open_sla_ticket: {
    id: 'open_sla_ticket',
    description: 'Raise a municipal repair ticket with a 24-hour SLA.',
    simulated: true,
    run({ defectId, severityScore } = {}) {
      const ticketId = `CCMC-WRD-${4000 + (Math.abs(defectId?.length ?? 5) * 137) % 1999}`;
      const slaHours = severityScore >= 4 ? 24 : 48;
      return {
        ok: true,
        ticketId,
        defectId,
        slaHours,
        slaDueAt: new Date(Date.now() + slaHours * 3600_000).toISOString(),
        crew: severityScore >= 4 ? 'CCMC Ward-32 hot-mix crew' : 'CCMC routine maintenance crew',
      };
    },
  },

  publish_advisory: {
    id: 'publish_advisory',
    description: 'Publish a hazard advisory onto the corridor twin.',
    simulated: true,
    run({ corridor = 'CBE-AVINASHI', message, severity = 'medium' } = {}) {
      return { ok: true, advisoryId: `ADV-${Math.abs(message?.length ?? 3) * 17 + 100}`, corridor, severity, message, published: true };
    },
  },

  notify_party: {
    id: 'notify_party',
    description: 'Notify a driver / consignee / buyer in their own language (voice or message).',
    simulated: true,
    run({ party, shipmentId, message, channel = 'app', language = 'en-IN', key } = {}) {
      const table = key ? VERNACULAR[key] : null;
      const localized = table ? table[language] || table['en-IN'] : message;
      return {
        ok: true,
        delivered: true,
        party,
        shipmentId,
        channel,
        language,
        languageLabel: LANGUAGE_LABELS[language] || language,
        message,
        localized,
        deliveredAt: new Date().toISOString(),
      };
    },
  },

  book_slot: {
    id: 'book_slot',
    description: 'Reserve a facility or hub slot.',
    simulated: true,
    run({ nodeId, shipmentId, minutes = 20 } = {}) {
      return { ok: true, bookingId: `BK-${Math.abs((nodeId?.length ?? 4) * 211 + minutes) % 9000 + 1000}`, nodeId, shipmentId, minutes, confirmed: true };
    },
  },

  hub_slot_allocator: {
    id: 'hub_slot_allocator',
    description: 'Allocate a yard/dock slot at a multimodal hub.',
    simulated: true,
    run({ hub = 'Chalakudy yard', mode = 'rail', window = 'next' } = {}) {
      return { ok: true, slotId: `SLOT-${Math.abs(hub.length * 37) % 9000 + 1000}`, hub, mode, window, confirmed: true, demurrageRisk: 'low' };
    },
  },

  signal_preempt: {
    id: 'signal_preempt',
    description: 'Pre-empt corridor signals for an emergency vehicle.',
    simulated: true,
    run({ junctions = [], reason = 'emergency' } = {}) {
      const savedPerJunctionS = 55;
      return {
        ok: true,
        junctionsCleared: junctions.length,
        junctionIds: junctions.map((j) => (typeof j === 'string' ? j : j.id)),
        reason,
        savedSecondsPerJunction: savedPerJunctionS,
        estimatedSavedSeconds: junctions.length * savedPerJunctionS,
        overrideWindowS: 120,
        releasedAutomatically: true,
      };
    },
  },

  schedule_rest: {
    id: 'schedule_rest',
    description: 'Schedule a mandatory rest break at a facility.',
    simulated: true,
    run({ driverId, facilityId, minutes = 45 } = {}) {
      return { ok: true, driverId, facilityId, minutes, scheduled: true, enforced: true };
    },
  },

  anchor_proof: {
    id: 'anchor_proof',
    description: 'Anchor an evidence hash to the trust ledger.',
    simulated: true,
    run({ subjectType, subjectId, payload } = {}) {
      const sha256 = sha256Hex({ subjectType, subjectId, payload });
      return {
        ok: true,
        subjectType,
        subjectId,
        sha256,
        txId: `0x${sha256.slice(0, 12)}…${sha256.slice(-6)}`,
        anchoredAt: new Date().toISOString(),
        note: 'digest stand-in (FNV-1a), ledger simulated',
      };
    },
  },

  smart_contract_clause: {
    id: 'smart_contract_clause',
    description: 'Execute a contract clause (delivery ETA / spoilage evidence).',
    simulated: true,
    run({ contractId, clause, payload } = {}) {
      return { ok: true, contractId, clause, executed: true, txId: `0xsc-${Math.abs(contractId.length * 977) % 900000 + 100000}`, payload };
    },
  },
};

/* ------------------------- instrumented registry ------------------------ */
/**
 * Wrap the registry so every call lands in the active run's trace.
 * `recorder` is supplied by the orchestrator per run.
 */
export function makeToolkit(recorder, { latency = 0, onEvent } = {}) {
  const kit = {};
  for (const [name, tool] of Object.entries(TOOLS)) {
    kit[name] = async (args = {}) => {
      const startedAt = Date.now();
      onEvent?.({ type: 'tool_call', tool: name, args, at: startedAt });
      const result = tool.run(args);
      const elapsedMs = latency || Math.max(6, (Date.now() - startedAt) % 40);
      const record = {
        tool: name,
        args,
        ok: result?.ok !== false,
        result,
        simulated: Boolean(tool.simulated),
        elapsedMs,
        at: new Date().toISOString(),
      };
      recorder?.push(record);
      onEvent?.({ type: 'tool_result', tool: name, result, simulated: Boolean(tool.simulated), elapsedMs });
      return result;
    };
  }
  kit.__registry = TOOLS;
  return kit;
}

export const toolCatalog = Object.values(TOOLS).map((t) => ({
  id: t.id,
  description: t.description,
  simulated: Boolean(t.simulated),
}));

export { minutesToHM, sha256Hex };
