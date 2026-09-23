export const LANGUAGE_PACKS = {
  zh: {
    code: "zh", locale: "zh-CN", label: "Chinese", native: "中文", flag: "🇨🇳",
    annotation: "Pinyin", framework: "HSK / 3 bậc 9 cấp",
    levels: ["Beginner", "HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6", "Level 7–9"],
    sampleSentence: "我今天去工厂检查设备。",
    sampleWords: ["我", "今天", "去", "工厂", "检查", "设备"],
    writingTarget: "好"
  },
  en: {
    code: "en", locale: "en-US", label: "English", native: "English", flag: "🇬🇧",
    annotation: "IPA", framework: "CEFR",
    levels: ["Beginner", "A1", "A2", "B1", "B2", "C1", "C2"],
    sampleSentence: "I check the machine before production starts.",
    sampleWords: ["I", "check", "the", "machine", "before", "production", "starts"],
    writingTarget: "A"
  },
  ja: {
    code: "ja", locale: "ja-JP", label: "Japanese", native: "日本語", flag: "🇯🇵",
    annotation: "Romaji", framework: "JLPT",
    levels: ["Beginner", "N5", "N4", "N3", "N2", "N1"],
    sampleSentence: "今日は工場で設備を確認します。",
    sampleWords: ["今日", "は", "工場", "で", "設備", "を", "確認します"],
    writingTarget: "日"
  },
  ko: {
    code: "ko", locale: "ko-KR", label: "Korean", native: "한국어", flag: "🇰🇷",
    annotation: "Romanization", framework: "TOPIK",
    levels: ["Beginner", "TOPIK I", "TOPIK II"],
    sampleSentence: "오늘 공장에서 설비를 확인합니다.",
    sampleWords: ["오늘", "공장에서", "설비를", "확인합니다"],
    writingTarget: "한"
  },
  es: {
    code: "es", locale: "es-ES", label: "Spanish", native: "Español", flag: "🇪🇸",
    annotation: "Pronunciation", framework: "CEFR",
    levels: ["Beginner", "A1", "A2", "B1", "B2", "C1", "C2"],
    sampleSentence: "Hoy reviso la máquina antes de la producción.",
    sampleWords: ["Hoy", "reviso", "la", "máquina", "antes", "de", "la", "producción"],
    writingTarget: "ñ"
  },
  fr: {
    code: "fr", locale: "fr-FR", label: "French", native: "Français", flag: "🇫🇷",
    annotation: "IPA", framework: "CEFR",
    levels: ["Beginner", "A1", "A2", "B1", "B2", "C1", "C2"],
    sampleSentence: "Je vérifie la machine avant la production.",
    sampleWords: ["Je", "vérifie", "la", "machine", "avant", "la", "production"],
    writingTarget: "é"
  },
  de: {
    code: "de", locale: "de-DE", label: "German", native: "Deutsch", flag: "🇩🇪",
    annotation: "IPA", framework: "CEFR",
    levels: ["Beginner", "A1", "A2", "B1", "B2", "C1", "C2"],
    sampleSentence: "Ich prüfe die Maschine vor Produktionsbeginn.",
    sampleWords: ["Ich", "prüfe", "die", "Maschine", "vor", "Produktionsbeginn"],
    writingTarget: "ß"
  }
};

export const INDUSTRIES = [
  "Giao tiếp hằng ngày", "Nhà máy / Sản xuất", "QA/QC", "Cơ khí", "Điện - Điện tử",
  "Logistics", "Xuất nhập khẩu", "Mua hàng", "Văn phòng", "Kế toán", "Xây dựng",
  "Khách sạn", "Nhà hàng", "Bán hàng", "Quản lý"
];

export function languageInstruction(code) {
  const map = {
    zh: "Mandarin Chinese. Use Simplified Chinese. pronunciation must be standard Hanyu Pinyin with tone marks. Segment tokens into useful words/phrases, not isolated characters unless they are standalone words.",
    en: "English. pronunciation should be concise IPA for learners.",
    ja: "Japanese. Keep normal Japanese orthography. pronunciation should be standard Hepburn romaji with macrons when useful.",
    ko: "Korean. Keep Hangul. pronunciation should be Revised Romanization.",
    es: "Spanish. pronunciation should be concise learner-friendly IPA.",
    fr: "French. pronunciation should be concise IPA.",
    de: "German. pronunciation should be concise IPA."
  };
  return map[code] || `${LANGUAGE_PACKS[code]?.label || "the target language"}. Give a concise learner-friendly pronunciation guide.`;
}
