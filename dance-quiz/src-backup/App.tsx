import { SpaceRoot } from "@hatch/sdk/components";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Space, type GetTeacherResultsResponse } from "./actions";
import "./theme.css";

/* ─── Types ─── */
type Phase = { id: number; icon: string; title: string };
type QuestionType = "mcq" | "select" | "trueFalse" | "ranking" | "matching" | "text" | "slider" | "wordcloud";

interface BaseQ {
  id: number;
  phase: number;
  type: QuestionType;
  question: string;
  explanation: string;
  points: number;
}
interface McqQ extends BaseQ { type: "mcq"; options: string[]; correct: number }
interface SelectQ extends BaseQ { type: "select"; options: string[]; correct: number[] }
interface TrueFalseQ extends BaseQ { type: "trueFalse"; statements: { text: string; answer: boolean }[] }
interface RankingQ extends BaseQ { type: "ranking"; items: string[]; correctOrder: string[] }
interface MatchingQ extends BaseQ { type: "matching"; pairs: { left: string; right: string }[] }
interface TextQ extends BaseQ { type: "text"; sampleAnswer: string }
interface SliderQ extends BaseQ { type: "slider"; min: number; max: number; labels: [string, string]; note: string }
interface WordCloudQ extends BaseQ { type: "wordcloud"; prompt: string; expectedWords: string[] }

type Question = McqQ | SelectQ | TrueFalseQ | RankingQ | MatchingQ | TextQ | SliderQ | WordCloudQ;

/* ─── Data ─── */
const PHASES: Phase[] = [
  { id: 1, icon: "🔍", title: "Comprendre le sujet" },
  { id: 2, icon: "🧠", title: "Problématique & plan" },
  { id: 3, icon: "🌍", title: "Contextualiser" },
  { id: 4, icon: "🎭", title: "Chorégraphes & œuvres" },
  { id: 5, icon: "✍️", title: "Rédiger & argumenter" },
];

const QUESTIONS: Question[] = [
  // ── PHASE 1 ──
  {
    id: 1, phase: 1, type: "wordcloud", points: 0,
    question: "En lisant ce sujet, quels sont les 2 ou 3 mots qui vous semblent les plus importants ?\n\n« Expliquez de quelle manière les pionnières américaines de la danse moderne, au début du XXᵉ siècle, ont transformé la danse et renouvelé l'art chorégraphique. »",
    prompt: "Entrez 1 à 3 mots-clés",
    expectedWords: ["pionnières", "américaines", "moderne", "transformé", "renouvelé", "corps", "XXᵉ siècle"],
    explanation: "Les mots attendus : pionnières, américaines, moderne, transformé, renouvelé, corps, XXᵉ siècle.\n\n⚠️ Attention si vous avez pensé à « ballet » ou « classique » — ils sont hors du centre de ce sujet.\n\nPoint important : le sujet dit « pionnières » = majoritairement des femmes → à intégrer dans l'argumentation.",
  },
  {
    id: 2, phase: 1, type: "mcq", points: 1,
    question: "À quelle période correspond « le début du XXᵉ siècle » dans ce sujet ?",
    options: ["1850 – 1880", "1890 – 1930", "1930 – 1960", "1960 – 1990"],
    correct: 1,
    explanation: "Bonne réponse : 1890–1930. Cela borne le sujet et évite de parler de Graham dans les années 40–50 comme si elle était une « pionnière ».",
  },
  {
    id: 3, phase: 1, type: "select", points: 1,
    question: "Quelles figures sont obligatoirement au cœur de votre dissertation sur ce sujet ?",
    options: ["Loïe Fuller", "Isadora Duncan", "Ruth St. Denis", "Doris Humphrey", "Merce Cunningham", "Pina Bausch", "Ted Shawn"],
    correct: [0, 1, 2],
    explanation: "Humphrey appartient à la génération suivante, Cunningham et Bausch sont hors période ou hors sujet en tant que figures centrales. Ted Shawn est acceptable en périphérique seulement.\n\nIl est essentiel de distinguer figure centrale et figure périphérique.",
  },
  // ── PHASE 2 ──
  {
    id: 4, phase: 2, type: "mcq", points: 1,
    question: "Parmi ces formulations, laquelle est une vraie problématique (avec enjeu) ?",
    options: [
      "Comment les pionnières américaines ont-elles transformé la danse ?",
      "Qui sont les pionnières américaines de la danse moderne ?",
      "En quoi les pionnières américaines ont-elles opéré une rupture fondamentale avec le ballet académique, inventant un nouveau rapport au corps et au mouvement ?",
      "Comment la danse moderne a créé des femmes pionnières qui ont eu un impact significatif sur la danse.",
    ],
    correct: 2,
    explanation: "A = périphrase du sujet. B = hors sujet (biographie). D = contresens (ce ne sont pas les femmes qui ont été « créées » par la danse moderne, mais l'inverse).\n\nC est la bonne réponse : elle contient une tension rupture/invention et un enjeu de démonstration.",
  },
  {
    id: 5, phase: 2, type: "ranking", points: 1,
    question: "Classez ces éléments dans l'ordre logique d'une introduction de dissertation.",
    items: ["Problématique", "Annonce du plan", "Contextualisation historique (fin XIXᵉ siècle, États-Unis…)", "Présentation du sujet et de ses enjeux"],
    correctOrder: ["Contextualisation historique (fin XIXᵉ siècle, États-Unis…)", "Présentation du sujet et de ses enjeux", "Problématique", "Annonce du plan"],
    explanation: "L'ordre logique d'une introduction :\n1. Contextualisation historique\n2. Présentation du sujet et de ses enjeux\n3. Problématique\n4. Annonce du plan",
  },
  {
    id: 6, phase: 2, type: "select", points: 1,
    question: "Parmi ces axes de plan, lesquels sont pertinents et cohérents pour répondre au sujet ?",
    options: [
      "La rupture avec le ballet académique",
      "L'invention de nouveaux principes esthétiques",
      "La transmission et la filiation (écoles, héritières)",
      "L'histoire du ballet romantique au XIXᵉ siècle",
      "Les techniques de Merce Cunningham",
      "La biographie d'Isadora Duncan",
    ],
    correct: [0, 1, 2],
    explanation: "Les trois derniers sont hors sujet ou hors période.\n\nRappel : un axe doit défendre une idée, pas raconter.",
  },
  // ── PHASE 3 ──
  {
    id: 7, phase: 3, type: "trueFalse", points: 1,
    question: "Vrai ou Faux ?",
    statements: [
      { text: "Les pionnières américaines s'inspirent du système Delsarte.", answer: true },
      { text: "Dalcroze est un chorégraphe américain.", answer: false },
      { text: "Le mouvement suffragiste est un élément de contexte pertinent pour ce sujet.", answer: true },
      { text: "Rudolf Laban doit être développé dans les parties de la dissertation.", answer: false },
    ],
    explanation: "1. VRAI — via Geneviève Stebbins.\n2. FAUX — Dalcroze est un musicien et pédagogue suisse.\n3. VRAI — L'émancipation des femmes est un contexte essentiel.\n4. FAUX — Laban est contexte d'introduction seulement, ne pas développer dans les parties.",
  },
  {
    id: 8, phase: 3, type: "text", points: 0,
    question: "En une phrase, citez deux éléments de contexte (historique, social ou culturel) que vous utiliseriez en introduction pour borner le sujet.",
    sampleAnswer: "Exemples de bonnes réponses :\n\n• Industrialisation et urbanisation aux États-Unis + émancipation des femmes (suffragisme)\n• Développement du spectacle vivant + rejet du ballet académique perçu comme artificiel\n• Art Nouveau et symbolisme + héritage du système Delsarte",
    explanation: "Le contexte doit borner le sujet historiquement et socialement. Plusieurs combinaisons sont acceptables tant qu'elles situent la période et les enjeux.",
  },
  // ── PHASE 4 ──
  {
    id: 9, phase: 4, type: "matching", points: 1,
    question: "Associez chaque chorégraphe à son œuvre.",
    pairs: [
      { left: "Loïe Fuller", right: "Danse Serpentine (1891)" },
      { left: "Isadora Duncan", right: "La Marseillaise (1915)" },
      { left: "Ruth St. Denis", right: "Radha (1906)" },
      { left: "Martha Graham", right: "Lamentation (1930)" },
    ],
    explanation: "Fuller → Danse Serpentine (1891)\nDuncan → La Marseillaise (1915)\nSt. Denis → Radha (1906)\nGraham → Lamentation (1930)",
  },
  {
    id: 10, phase: 4, type: "ranking", points: 1,
    question: "Classez ces œuvres de la plus ancienne à la plus récente.",
    items: ["Lamentation — Martha Graham", "Radha — Ruth St. Denis", "Appalachian Spring — Martha Graham", "Danse Serpentine — Loïe Fuller", "La Marseillaise — Isadora Duncan"],
    correctOrder: ["Danse Serpentine — Loïe Fuller", "Radha — Ruth St. Denis", "La Marseillaise — Isadora Duncan", "Lamentation — Martha Graham", "Appalachian Spring — Martha Graham"],
    explanation: "Ordre chronologique :\n1891 — Danse Serpentine (Fuller)\n1906 — Radha (St. Denis)\n1915 — La Marseillaise (Duncan)\n1930 — Lamentation (Graham)\n1944 — Appalachian Spring (Graham)",
  },
  {
    id: 11, phase: 4, type: "select", points: 1,
    question: "Quelles affirmations sur Isadora Duncan sont exactes ?",
    options: [
      "Elle danse pieds nus en tunique légère",
      "Elle s'inspire de l'Antiquité grecque",
      "Elle fonde une école à Berlin (Grünewald, 1905)",
      "Elle crée la technique contraction/release",
      "Elle est la fondatrice de la Denishawn School",
      "Elle est influencée par le système Delsarte (via Stebbins)",
    ],
    correct: [0, 1, 2, 5],
    explanation: "La technique contraction/release est celle de Martha Graham, pas de Duncan.\nLa Denishawn School a été fondée par Ruth St. Denis et Ted Shawn.\n\nDuncan est bien connue pour : pieds nus, tunique, inspiration grecque, école à Berlin, et influence de Delsarte.",
  },
  {
    id: 12, phase: 4, type: "text", points: 0,
    question: "En 2–3 phrases, expliquez pourquoi Danse Serpentine (1891) de Loïe Fuller est importante dans l'histoire de la danse.\n\n(Utilisez : corps / lumière / rupture / transformation)",
    sampleAnswer: "Dans Danse Serpentine, Fuller utilise des voiles et des éclairages colorés pour dissoudre le corps dans la matière lumineuse. La danse n'est plus l'exhibition d'un corps virtuose : elle devient une image en transformation. Cette œuvre marque une rupture avec le ballet académique en faisant de la technologie scénique (la lumière) un élément artistique à part entière.",
    explanation: "L'important est de mentionner la rupture avec le ballet, le rôle de la lumière comme élément artistique, et la transformation du corps.",
  },
  {
    id: 13, phase: 4, type: "slider", points: 0,
    question: "Martha Graham est une pionnière américaine de la danse moderne au même titre que Fuller, Duncan et St. Denis.",
    min: 1, max: 5,
    labels: ["Pas du tout d'accord", "Tout à fait d'accord"],
    note: "La réponse attendue est nuancée : Graham hérite des pionnières (Denishawn) et les radicalise — elle est une héritière directe (en aval), pas une pionnière au sens strict du sujet.\n\nCela ouvre le débat sur la différence entre pionnier et héritier.",
    explanation: "Il n'y a pas de mauvaise réponse ici — c'est un sujet de débat ! Mais dans le cadre strict de la dissertation, Graham est une héritière directe (via Denishawn), pas une pionnière au sens du sujet.",
  },
  // ── PHASE 5 ──
  {
    id: 14, phase: 5, type: "mcq", points: 1,
    question: "Quel extrait correspond à une bonne analyse (et non une simple description) ?",
    options: [
      "Martha Graham crée Lamentation en 1930. C'est une œuvre importante.",
      "Isadora Duncan danse pieds nus avec une tunique légère.",
      "En abandonnant la verticalité propre au ballet, Martha Graham développe dans Lamentation (1930) une technique fondée sur la contraction qui fait du corps un espace d'expression psychologique.",
      "Les pionnières sont des danseuses qui ont changé la danse.",
    ],
    correct: 2,
    explanation: "A et B sont de simples descriptions. D est une affirmation vague sans analyse.\n\nC est une vraie analyse : elle explique POURQUOI et COMMENT, avec un vocabulaire précis.",
  },
  {
    id: 15, phase: 5, type: "text", points: 0,
    question: "Rédigez un paragraphe de 4–6 phrases sur Ruth St. Denis en utilisant les mots-clés suivants :\n\nspiritualité — rituel — Radha — 1906 — Denishawn School — rupture",
    sampleAnswer: "Vérifiez que votre paragraphe :\n✅ Cite l'œuvre avec la date (Radha, 1906)\n✅ Analyse (ne se contente pas de décrire)\n✅ Fait le lien avec la rupture par rapport au ballet\n✅ Mentionne la filiation (Denishawn → Graham/Humphrey)",
    explanation: "Un bon paragraphe doit citer l'œuvre avec sa date, analyser (pas seulement décrire), relier à la rupture avec le ballet, et mentionner la filiation Denishawn.",
  },
  {
    id: 16, phase: 5, type: "wordcloud", points: 0,
    question: "En un seul mot, qu'est-ce que les pionnières américaines ont, selon vous, inventé pour la danse ?",
    prompt: "Un seul mot",
    expectedWords: ["liberté", "expressivité", "rupture", "transmission", "corps", "naturel", "émotion", "modernité", "révolution"],
    explanation: "Mots souvent cités : liberté, expressivité, rupture, transmission, corps, naturel, émotion, modernité, révolution.\n\nChacun de ces mots reflète un aspect de la transformation apportée par les pionnières.",
  },
];


/* ─── LocalStorage Question Overrides ─── */
const LS_KEY = "dance-quiz-edits";

function loadEdits(): Record<number, Partial<Question>> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveEdits(edits: Record<number, Partial<Question>>) {
  localStorage.setItem(LS_KEY, JSON.stringify(edits));
}

function clearEdits() {
  localStorage.removeItem(LS_KEY);
}

function getQuestions(): Question[] {
  const edits = loadEdits();
  if (Object.keys(edits).length === 0) return QUESTIONS;
  return QUESTIONS.map(q => {
    const override = edits[q.id];
    if (!override) return q;
    return { ...q, ...override } as Question;
  });
}

/* ─── Helpers ─── */
function arraysEqual(a: number[], b: number[]) {
  return a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
}

/* ─── Sub-components ─── */
function McqOptions({ q, selected, revealed, onSelect }: {
  q: McqQ; selected: number | null; revealed: boolean; onSelect: (i: number) => void;
}) {
  return (
    <div className="options-grid">
      {q.options.map((opt, i) => {
        let cls = "option-btn";
        if (revealed) {
          if (i === q.correct) cls += " correct";
          else if (i === selected) cls += " incorrect";
        } else if (i === selected) cls += " selected";
        return (
          <button key={i} className={cls} onClick={() => !revealed && onSelect(i)} disabled={revealed}>
            <span className="option-letter">{"ABCD"[i]}</span>
            <span>{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

function SelectOptions({ q, selected, revealed, onToggle }: {
  q: SelectQ; selected: Set<number>; revealed: boolean; onToggle: (i: number) => void;
}) {
  return (
    <div className="options-grid">
      {q.options.map((opt, i) => {
        const isCorrect = q.correct.includes(i);
        let cls = "option-btn";
        if (revealed) {
          if (isCorrect) cls += " correct";
          else if (selected.has(i)) cls += " incorrect";
        } else if (selected.has(i)) cls += " selected";
        return (
          <button key={i} className={cls} onClick={() => !revealed && onToggle(i)} disabled={revealed}>
            <span className="option-letter">{selected.has(i) ? "✓" : " "}</span>
            <span>{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

function TrueFalseBlock({ q, answers, revealed, onAnswer }: {
  q: TrueFalseQ; answers: Map<number, boolean>; revealed: boolean; onAnswer: (i: number, v: boolean) => void;
}) {
  return (
    <div className="tf-grid">
      {q.statements.map((s, i) => {
        const userAns = answers.get(i);
        return (
          <div key={i} className="tf-statement">
            <div className="tf-text">{s.text}</div>
            <div className="tf-buttons">
              {[true, false].map(val => {
                let cls = "tf-btn";
                if (revealed) {
                  if (val === s.answer) cls += " correct";
                  else if (userAns === val && val !== s.answer) cls += " incorrect";
                } else if (userAns === val) cls += " selected";
                return (
                  <button key={String(val)} className={cls} onClick={() => !revealed && onAnswer(i, val)} disabled={revealed}>
                    {val ? "Vrai" : "Faux"}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankingBlock({ items, onMove }: {
  items: string[]; onMove: (from: number, to: number) => void;
}) {
  return (
    <div className="rank-list">
      {items.map((item, i) => (
        <div key={item} className="rank-item">
          <span className="rank-num">{i + 1}</span>
          <span className="rank-text">{item}</span>
          <div className="rank-arrows">
            <button className="rank-arrow" disabled={i === 0} onClick={() => onMove(i, i - 1)}>▲</button>
            <button className="rank-arrow" disabled={i === items.length - 1} onClick={() => onMove(i, i + 1)}>▼</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchingBlock({ q, selections, revealed, onChange }: {
  q: MatchingQ; selections: Map<number, number>; revealed: boolean; onChange: (left: number, right: number) => void;
}) {
  const shuffledRight = useRef(
    [...q.pairs].map((_, i) => i).sort(() => Math.random() - 0.5)
  ).current;

  return (
    <div className="match-grid">
      {q.pairs.map((pair, li) => (
        <div key={li} className="match-row">
          <div className="match-left">{pair.left}</div>
          <span className="match-arrow">→</span>
          <select
            className="match-select"
            value={selections.get(li) ?? -1}
            onChange={e => onChange(li, Number(e.target.value))}
            disabled={revealed}
            style={revealed ? {
              borderColor: selections.get(li) === li ? "var(--success)" : "var(--error)",
              background: selections.get(li) === li ? "var(--success-glow)" : "var(--error-glow)",
            } : undefined}
          >
            <option value={-1}>Choisir...</option>
            {shuffledRight.map(ri => (
              <option key={ri} value={ri}>{q.pairs[ri].right}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

/* ─── Question Editor ─── */
function QuestionEditor() {
  const [edits, setEdits] = useState<Record<number, Partial<Question>>>(loadEdits);
  const [saved, setSaved] = useState(false);

  const questions = useMemo(() => {
    return QUESTIONS.map(q => {
      const override = edits[q.id];
      if (!override) return q;
      return { ...q, ...override } as Question;
    });
  }, [edits]);

  const updateField = (id: number, field: string, value: unknown) => {
    setEdits(prev => {
      const current = prev[id] ?? {};
      const next = { ...prev, [id]: { ...current, [field]: value } };
      return next;
    });
    setSaved(false);
  };

  const updateOption = (id: number, optIdx: number, value: string) => {
    const q = questions.find(q => q.id === id);
    if (!q || (q.type !== "mcq" && q.type !== "select")) return;
    const opts = [...(q as McqQ | SelectQ).options];
    opts[optIdx] = value;
    updateField(id, "options", opts);
  };

  const updateStatement = (id: number, stIdx: number, text: string) => {
    const q = questions.find(q => q.id === id);
    if (!q || q.type !== "trueFalse") return;
    const stmts = [...(q as TrueFalseQ).statements];
    stmts[stIdx] = { ...stmts[stIdx], text };
    updateField(id, "statements", stmts);
  };

  const toggleStatementAnswer = (id: number, stIdx: number) => {
    const q = questions.find(q => q.id === id);
    if (!q || q.type !== "trueFalse") return;
    const stmts = [...(q as TrueFalseQ).statements];
    stmts[stIdx] = { ...stmts[stIdx], answer: !stmts[stIdx].answer };
    updateField(id, "statements", stmts);
  };

  const handleSave = () => {
    saveEdits(edits);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    clearEdits();
    setEdits({});
    setSaved(false);
  };

  const hasEdits = Object.keys(edits).length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Action bar */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {hasEdits && (
          <button onClick={handleReset} style={{
            background: "transparent", border: "1px solid var(--error)",
            borderRadius: 10, padding: "8px 16px", color: "var(--error)",
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif",
          }}>
            🔄 Réinitialiser
          </button>
        )}
        <button onClick={handleSave} style={{
          background: saved ? "var(--success)" : "var(--accent)",
          border: "none", borderRadius: 10, padding: "8px 20px",
          color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          transition: "background 0.2s",
        }}>
          {saved ? "✅ Sauvegardé !" : "💾 Sauvegarder"}
        </button>
      </div>

      {/* Questions */}
      {PHASES.map(phase => {
        const phaseQs = questions.filter(q => q.phase === phase.id);
        return (
          <div key={phase.id}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: "var(--accent)",
              padding: "8px 0", marginBottom: 8,
              borderBottom: "1px solid var(--border)",
              fontFamily: "'Playfair Display', serif",
            }}>
              {phase.icon} Phase {phase.id} — {phase.title}
            </div>
            {phaseQs.map(q => (
              <div key={q.id} className="glass-card" style={{ padding: 16, marginBottom: 12 }}>
                {/* Question header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: "#000", background: "var(--accent)",
                    padding: "2px 8px", borderRadius: 6,
                  }}>Q{q.id}</span>
                  <span style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {q.type === "mcq" ? "QCM" : q.type === "select" ? "Sélection multiple" : q.type === "trueFalse" ? "Vrai/Faux" :
                     q.type === "ranking" ? "Classement" : q.type === "matching" ? "Appariement" : q.type === "text" ? "Texte libre" :
                     q.type === "slider" ? "Curseur" : "Nuage de mots"}
                  </span>
                  {q.points > 0 && <span style={{ fontSize: 11, color: "var(--accent)" }}>🏆 {q.points}pt</span>}
                </div>

                {/* Question text */}
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
                  Question
                </label>
                <textarea
                  value={q.question}
                  onChange={e => updateField(q.id, "question", e.target.value)}
                  style={{
                    width: "100%", minHeight: 60, background: "var(--surface-2)", border: "1px solid var(--border)",
                    borderRadius: 8, padding: "10px 12px", color: "var(--text)", fontSize: 13, lineHeight: 1.5,
                    fontFamily: "'DM Sans', system-ui, sans-serif", resize: "vertical",
                  }}
                />

                {/* Options for MCQ / Select */}
                {(q.type === "mcq" || q.type === "select") && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                      Options {q.type === "mcq" ? "(cliquer = bonne réponse)" : "(cliquer = bonnes réponses)"}
                    </label>
                    {(q as McqQ | SelectQ).options.map((opt, i) => {
                      const isCorrect = q.type === "mcq" ? (q as McqQ).correct === i : (q as SelectQ).correct.includes(i);
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <button
                            onClick={() => {
                              if (q.type === "mcq") {
                                updateField(q.id, "correct", i);
                              } else {
                                const cur = [...(q as SelectQ).correct];
                                const idx = cur.indexOf(i);
                                if (idx >= 0) cur.splice(idx, 1); else cur.push(i);
                                updateField(q.id, "correct", cur);
                              }
                            }}
                            style={{
                              width: 28, height: 28, borderRadius: 6, border: `2px solid ${isCorrect ? "var(--success)" : "var(--border)"}`,
                              background: isCorrect ? "var(--success-glow)" : "transparent",
                              color: isCorrect ? "var(--success)" : "var(--dim)",
                              fontSize: 14, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            {isCorrect ? "✓" : "ABCDEFG"[i]}
                          </button>
                          <input
                            value={opt}
                            onChange={e => updateOption(q.id, i, e.target.value)}
                            style={{
                              flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)",
                              borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13,
                              fontFamily: "'DM Sans', system-ui, sans-serif",
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* True/False statements */}
                {q.type === "trueFalse" && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                      Affirmations (cliquer V/F pour changer la réponse)
                    </label>
                    {(q as TrueFalseQ).statements.map((st, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <button
                          onClick={() => toggleStatementAnswer(q.id, i)}
                          style={{
                            width: 36, height: 28, borderRadius: 6,
                            border: `2px solid ${st.answer ? "var(--success)" : "var(--error)"}`,
                            background: st.answer ? "var(--success-glow)" : "var(--error-glow)",
                            color: st.answer ? "var(--success)" : "var(--error)",
                            fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                          }}
                        >
                          {st.answer ? "V" : "F"}
                        </button>
                        <input
                          value={st.text}
                          onChange={e => updateStatement(q.id, i, e.target.value)}
                          style={{
                            flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)",
                            borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13,
                            fontFamily: "'DM Sans', system-ui, sans-serif",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Explanation */}
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
                    Explication
                  </label>
                  <textarea
                    value={q.explanation}
                    onChange={e => updateField(q.id, "explanation", e.target.value)}
                    style={{
                      width: "100%", minHeight: 50, background: "var(--surface-2)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "10px 12px", color: "var(--text)", fontSize: 12, lineHeight: 1.5,
                      fontFamily: "'DM Sans', system-ui, sans-serif", resize: "vertical",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* Bottom save bar */}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", padding: "12px 0" }}>
        {hasEdits && (
          <button onClick={handleReset} style={{
            background: "transparent", border: "1px solid var(--error)",
            borderRadius: 10, padding: "10px 20px", color: "var(--error)",
            fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif",
          }}>
            🔄 Réinitialiser tout
          </button>
        )}
        <button onClick={handleSave} style={{
          background: saved ? "var(--success)" : "var(--accent)",
          border: "none", borderRadius: 10, padding: "10px 24px",
          color: "#000", fontSize: 14, fontWeight: 700, cursor: "pointer",
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}>
          {saved ? "✅ Sauvegardé !" : "💾 Sauvegarder les modifications"}
        </button>
      </div>
    </div>
  );
}

/* ─── Teacher Dashboard ─── */
type TeacherSession = NonNullable<GetTeacherResultsResponse["sessions"]>[number];

function TeacherDashboard() {
  const [data, setData] = useState<GetTeacherResultsResponse | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"results" | "editor">("results");

  const fetchData = useCallback(() => {
    setLoading(true);
    Space.getTeacherResults({}).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const sessions = data?.sessions ?? [];

  return (
    <SpaceRoot>
      <div className="quiz-app">
        <div className="quiz-content" style={{ maxWidth: 800 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700 }}>
                📋 Tableau de bord
              </h1>
              <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>
                Vue enseignant — Résultats en temps réel
              </p>
            </div>
            {tab === "results" && (
              <button
                onClick={fetchData}
                style={{
                  background: "var(--surface-2)", border: "1px solid var(--border)",
                  borderRadius: 10, padding: "8px 16px", color: "var(--text)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                {loading ? "⏳" : "🔄"} Actualiser
              </button>
            )}
          </div>

          {/* Tab toggle */}
          <div style={{
            display: "flex", gap: 4, marginBottom: 20,
            background: "var(--surface)", borderRadius: 12,
            padding: 4, border: "1px solid var(--border)",
          }}>
            <button
              onClick={() => setTab("results")}
              style={{
                flex: 1, padding: "10px 16px", borderRadius: 10,
                border: "none", cursor: "pointer",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize: 14, fontWeight: 700,
                background: tab === "results" ? "var(--accent)" : "transparent",
                color: tab === "results" ? "#000" : "var(--dim)",
                transition: "all 0.2s",
              }}
            >
              📊 Résultats
            </button>
            <button
              onClick={() => setTab("editor")}
              style={{
                flex: 1, padding: "10px 16px", borderRadius: 10,
                border: "none", cursor: "pointer",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize: 14, fontWeight: 700,
                background: tab === "editor" ? "var(--accent)" : "transparent",
                color: tab === "editor" ? "#000" : "var(--dim)",
                transition: "all 0.2s",
              }}
            >
              ✏️ Éditer les questions
            </button>
          </div>

          {/* Editor tab */}
          {tab === "editor" && <QuestionEditor />}

          {/* Results tab */}
          {tab === "results" && (
            <>
              {/* Stats cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            <div className="glass-card" style={{ padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "var(--accent)", fontFamily: "'Playfair Display', serif" }}>
                {sessions.length}
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Élèves
              </div>
            </div>
            <div className="glass-card" style={{ padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "var(--success)", fontFamily: "'Playfair Display', serif" }}>
                {sessions.filter(s => s.completed_at).length}
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Terminés
              </div>
            </div>
            <div className="glass-card" style={{ padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "var(--purple)", fontFamily: "'Playfair Display', serif" }}>
                {sessions.length > 0
                  ? Math.round(sessions.filter(s => s.completed_at).reduce((sum, s) => sum + (s.total_score ?? 0), 0) / Math.max(1, sessions.filter(s => s.completed_at).length) * 10) / 10
                  : "—"}
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Score moyen
              </div>
            </div>
          </div>

          {sessions.length === 0 && (
            <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🕐</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>En attente des élèves…</div>
              <div style={{ fontSize: 14, color: "var(--dim)", lineHeight: 1.6 }}>
                Les résultats apparaîtront ici au fur et à mesure que vos élèves répondent au quiz.
                <br />Cette page se rafraîchit automatiquement toutes les 10 secondes.
              </div>
            </div>
          )}

          {/* Student list */}
          {sessions.map((s: TeacherSession) => {
            const isExpanded = expanded === s.id;
            const answers = s.answers ?? [];
            const isComplete = !!s.completed_at;
            const ps = (s.phase_scores ?? {}) as Record<string, { earned: number; possible: number }>;

            return (
              <div key={s.id} className="glass-card" style={{ padding: 0, marginBottom: 12, overflow: "hidden" }}>
                {/* Header row */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : (s.id ?? 0))}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "16px 20px", background: "transparent", border: "none",
                    color: "var(--text)", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: isComplete ? "var(--success-glow)" : "var(--purple-glow)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, fontWeight: 700,
                      color: isComplete ? "var(--success)" : "var(--purple)",
                    }}>
                      {(s.student_name ?? "?")[0].toUpperCase()}
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{s.student_name}</div>
                      <div style={{ fontSize: 12, color: "var(--dim)" }}>
                        {isComplete ? "✅ Terminé" : `⏳ En cours (${answers.length}/${QUESTIONS.length} réponses)`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {isComplete && (
                      <span style={{
                        fontSize: 20, fontWeight: 800,
                        color: "var(--accent)", fontFamily: "'Playfair Display', serif",
                      }}>
                        {s.total_score}/{s.max_score}
                      </span>
                    )}
                    <span style={{ fontSize: 18, color: "var(--dim)", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>
                      ▼
                    </span>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)" }}>
                    {/* Phase breakdown */}
                    {Object.keys(ps).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16, marginBottom: 16 }}>
                        {PHASES.map(p => {
                          const phaseData = ps[String(p.id)];
                          if (!phaseData) return null;
                          return (
                            <div key={p.id} style={{
                              fontSize: 12, padding: "4px 10px", borderRadius: 8,
                              background: "var(--surface-2)", border: "1px solid var(--border)",
                            }}>
                              {p.icon} <span style={{ fontWeight: 600 }}>{phaseData.earned}/{phaseData.possible}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Per-question answers */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {QUESTIONS.map(question => {
                        const ans = answers.find(a => a.question_id === question.id);
                        if (!ans) {
                          return (
                            <div key={question.id} style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "8px 12px", borderRadius: 8,
                              background: "var(--surface-2)", opacity: 0.4,
                            }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--dim)", width: 24 }}>Q{question.id}</span>
                              <span style={{ fontSize: 13, color: "var(--dim)" }}>—</span>
                            </div>
                          );
                        }
                        const correct = ans.is_correct;
                        return (
                          <div key={question.id} style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 12px", borderRadius: 8,
                            background: question.points === 0
                              ? "var(--surface-2)"
                              : correct ? "var(--success-glow)" : "var(--error-glow)",
                            border: `1px solid ${question.points === 0 ? "var(--border)" : correct ? "var(--success)" : "var(--error)"}`,
                          }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--dim)", width: 24 }}>Q{question.id}</span>
                            <span style={{ fontSize: 13, flex: 1 }}>{question.question.substring(0, 60)}…</span>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>
                              {question.points === 0 ? "💭" : correct ? "✅" : "❌"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
            </>
          )}
        </div>
      </div>
    </SpaceRoot>
  );
}

/* ─── Main App ─── */
type Screen = "welcome" | "name" | "quiz" | "results";

function QuizApp({ onTeacherAccess }: { onTeacherAccess: () => void }) {
  const activeQuestions = useMemo(() => getQuestions(), []);
  const scoredCount = useMemo(() => activeQuestions.filter(q => q.points > 0).length, [activeQuestions]);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [showPwPrompt, setShowPwPrompt] = useState(false);
  const [pwValue, setPwValue] = useState("");
  const [pwError, setPwError] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [phaseScores] = useState<Map<number, { earned: number; possible: number }>>(new Map());

  // Per-question state
  const [mcqSel, setMcqSel] = useState<number | null>(null);
  const [selectSel, setSelectSel] = useState<Set<number>>(new Set());
  const [tfAnswers, setTfAnswers] = useState<Map<number, boolean>>(new Map());
  const [rankItems, setRankItems] = useState<string[]>([]);
  const [matchSel, setMatchSel] = useState<Map<number, number>>(new Map());
  const [textVal, setTextVal] = useState("");
  const [sliderVal, setSliderVal] = useState(3);
  const [wordcloudVal, setWordcloudVal] = useState("");

  const q = activeQuestions[qIdx];
  const phase = PHASES.find(p => p.id === q?.phase);
  const prevPhase = qIdx > 0 ? activeQuestions[qIdx - 1].phase : 0;
  const isNewPhase = q?.phase !== prevPhase;

  const resetQState = useCallback(() => {
    setMcqSel(null);
    setSelectSel(new Set());
    setTfAnswers(new Map());
    setMatchSel(new Map());
    setTextVal("");
    setSliderVal(3);
    setWordcloudVal("");
    setRevealed(false);
  }, []);

  const initRanking = useCallback((items: string[]) => {
    setRankItems([...items].sort(() => Math.random() - 0.5));
  }, []);

  const handleStart = () => {
    setScreen("name");
  };

  const handleTeacherPw = () => {
    if (pwValue.trim().toLowerCase() === "tixi") {
      onTeacherAccess();
    } else {
      setPwError(true);
      setPwValue("");
    }
  };

  const handleNameSubmit = async () => {
    if (!studentName.trim()) return;
    try {
      const res = await Space.saveStudentSession({ student_name: studentName.trim() });
      setSessionId(res.session_id ?? 0);
    } catch { /* continue without session */ }
    setScreen("quiz");
    setQIdx(0);
    setScore(0);
    phaseScores.clear();
    resetQState();
    if (activeQuestions[0].type === "ranking") {
      initRanking((activeQuestions[0] as RankingQ).items);
    }
  };

  const canValidate = () => {
    if (revealed) return false;
    switch (q.type) {
      case "mcq": return mcqSel !== null;
      case "select": return selectSel.size > 0;
      case "trueFalse": return (q as TrueFalseQ).statements.every((_, i) => tfAnswers.has(i));
      case "ranking": return true;
      case "matching": return (q as MatchingQ).pairs.every((_, i) => matchSel.has(i));
      case "text": return textVal.trim().length > 0;
      case "slider": return true;
      case "wordcloud": return wordcloudVal.trim().length > 0;
    }
  };

  const handleValidate = () => {
    let earned = 0;
    const pts = q.points;
    let isCorrect = false;
    let answerJson = "{}";

    switch (q.type) {
      case "mcq":
        isCorrect = mcqSel === (q as McqQ).correct;
        if (isCorrect) earned = pts;
        answerJson = JSON.stringify({ selected: mcqSel });
        break;
      case "select":
        isCorrect = arraysEqual([...selectSel], (q as SelectQ).correct);
        if (isCorrect) earned = pts;
        answerJson = JSON.stringify({ selected: [...selectSel] });
        break;
      case "trueFalse": {
        const stmts = (q as TrueFalseQ).statements;
        isCorrect = stmts.every((s, i) => tfAnswers.get(i) === s.answer);
        if (isCorrect) earned = pts;
        const obj: Record<number, boolean> = {};
        tfAnswers.forEach((v, k) => { obj[k] = v; });
        answerJson = JSON.stringify({ answers: obj });
        break;
      }
      case "ranking": {
        const co = (q as RankingQ).correctOrder;
        isCorrect = rankItems.every((item, i) => item === co[i]);
        if (isCorrect) earned = pts;
        answerJson = JSON.stringify({ order: rankItems });
        break;
      }
      case "matching": {
        isCorrect = (q as MatchingQ).pairs.every((_, i) => matchSel.get(i) === i);
        if (isCorrect) earned = pts;
        const obj: Record<number, number> = {};
        matchSel.forEach((v, k) => { obj[k] = v; });
        answerJson = JSON.stringify({ matches: obj });
        break;
      }
      case "text":
        answerJson = JSON.stringify({ text: textVal });
        break;
      case "slider":
        answerJson = JSON.stringify({ value: sliderVal });
        break;
      case "wordcloud":
        answerJson = JSON.stringify({ words: wordcloudVal });
        break;
    }

    setScore(prev => prev + earned);

    const pid = q.phase;
    const existing = phaseScores.get(pid) ?? { earned: 0, possible: 0 };
    phaseScores.set(pid, {
      earned: existing.earned + earned,
      possible: existing.possible + pts,
    });

    setRevealed(true);

    // Save answer to backend
    if (sessionId) {
      Space.saveStudentAnswer({
        session_id: sessionId,
        question_id: q.id,
        answer_json: answerJson,
        is_correct: isCorrect,
        points_earned: earned,
      }).catch(() => {});
    }
  };

  const handleNext = () => {
    if (qIdx >= activeQuestions.length - 1) {
      // Save final session
      if (sessionId) {
        const ps: Record<string, { earned: number; possible: number }> = {};
        phaseScores.forEach((v, k) => { ps[String(k)] = v; });
        const finalScore = score; // already updated
        Space.saveStudentSession({
          session_id: sessionId,
          student_name: studentName,
          total_score: finalScore,
          max_score: scoredCount,
          phase_scores: JSON.stringify(ps),
          completed: true,
        }).catch(() => {});
      }
      setScreen("results");
      return;
    }
    const nextIdx = qIdx + 1;
    const nextQ = activeQuestions[nextIdx];
    resetQState();
    setQIdx(nextIdx);
    if (nextQ.type === "ranking") {
      initRanking((nextQ as RankingQ).items);
    }
  };

  const handleRankMove = (from: number, to: number) => {
    if (revealed) return;
    const arr = [...rankItems];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    setRankItems(arr);
  };

  const handleRestart = () => {
    setStudentName("");
    setSessionId(null);
    setScore(0);
    phaseScores.clear();
    resetQState();
    setQIdx(0);
    setScreen("welcome");
  };

  const getResultMessage = () => {
    const pct = scoredCount > 0 ? (score / scoredCount) * 100 : 0;
    if (pct >= 90) return `🌟 Exceptionnel, ${studentName} ! Tu maîtrises parfaitement le sujet.`;
    if (pct >= 70) return `👏 Très bien, ${studentName} ! Quelques points à revoir avant l'examen.`;
    if (pct >= 50) return `💪 Pas mal, ${studentName} ! Relis les explications pour consolider.`;
    return `📚 Courage, ${studentName} ! Reprends les phases une par une.`;
  };

  /* ─── Welcome ─── */
  if (screen === "welcome") {
    return (
      <SpaceRoot>
        <div className="quiz-app">
          <div className="quiz-content">
            <div className="welcome">
              <div className="welcome-icon">🩰</div>
              <h1 className="welcome-title">Pionnières américaines de la danse moderne</h1>
              <p className="welcome-sub">
                Quiz interactif — 16 questions pour préparer ta dissertation sur les pionnières qui ont transformé l'art chorégraphique.
              </p>
              <div className="welcome-phases">
                {PHASES.map(p => (
                  <div key={p.id} className="welcome-phase">
                    <span className="welcome-phase-icon">{p.icon}</span>
                    <span>Phase {p.id} — {p.title}</span>
                  </div>
                ))}
              </div>
              <button className="btn-primary" onClick={handleStart} style={{ marginTop: 12, maxWidth: 300 }}>
                Commencer le quiz →
              </button>

              {/* Teacher access */}
              {!showPwPrompt ? (
                <button
                  onClick={() => { setShowPwPrompt(true); setPwError(false); setPwValue(""); }}
                  style={{
                    marginTop: 20, background: "none", border: "none", color: "var(--dim)",
                    fontSize: 12, cursor: "pointer", opacity: 0.5, fontFamily: "'DM Sans', system-ui, sans-serif",
                    textDecoration: "underline", textUnderlineOffset: 3,
                  }}
                >
                  Espace Enseignant
                </button>
              ) : (
                <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <p style={{ fontSize: 12, color: "var(--dim)", margin: 0 }}>Mot de passe enseignant</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="password"
                      value={pwValue}
                      onChange={e => { setPwValue(e.target.value); setPwError(false); }}
                      onKeyDown={e => { if (e.key === "Enter" && pwValue.trim()) handleTeacherPw(); }}
                      placeholder="••••"
                      autoFocus
                      style={{
                        padding: "8px 12px", borderRadius: 8, border: `1px solid ${pwError ? "var(--error, #f87171)" : "var(--border)"}`,
                        background: "var(--surface-2)", color: "var(--text)", fontSize: 14, width: 140,
                        fontFamily: "'DM Sans', system-ui, sans-serif", textAlign: "center",
                      }}
                    />
                    <button
                      onClick={handleTeacherPw}
                      disabled={!pwValue.trim()}
                      style={{
                        padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)",
                        background: "var(--surface-2)", color: "var(--text)", fontSize: 13,
                        cursor: pwValue.trim() ? "pointer" : "default", opacity: pwValue.trim() ? 1 : 0.4,
                        fontFamily: "'DM Sans', system-ui, sans-serif",
                      }}
                    >
                      →
                    </button>
                  </div>
                  {pwError && <p style={{ fontSize: 11, color: "var(--error, #f87171)", margin: 0 }}>Mot de passe incorrect</p>}
                  <button
                    onClick={() => setShowPwPrompt(false)}
                    style={{ background: "none", border: "none", color: "var(--dim)", fontSize: 11, cursor: "pointer", opacity: 0.5, fontFamily: "'DM Sans', system-ui, sans-serif" }}
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </SpaceRoot>
    );
  }

  /* ─── Name Entry ─── */
  if (screen === "name") {
    return (
      <SpaceRoot>
        <div className="quiz-app">
          <div className="quiz-content">
            <div className="welcome">
              <div className="welcome-icon">✨</div>
              <h1 className="welcome-title" style={{ fontSize: 28 }}>Entre ton prénom</h1>
              <p className="welcome-sub">Pour que ton professeur puisse suivre tes résultats</p>
              <div style={{ width: "100%", maxWidth: 360, marginTop: 8 }}>
                <input
                  type="text"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && studentName.trim()) handleNameSubmit(); }}
                  placeholder="Ton prénom…"
                  autoFocus
                  className="quiz-input"
                  style={{ minHeight: "auto", padding: "16px 20px", fontSize: 18, textAlign: "center", borderRadius: 14 }}
                />
                <button
                  className="btn-primary"
                  onClick={handleNameSubmit}
                  disabled={!studentName.trim()}
                  style={{ marginTop: 16, width: "100%" }}
                >
                  C'est parti ! 🚀
                </button>
              </div>
            </div>
          </div>
        </div>
      </SpaceRoot>
    );
  }

  /* ─── Results ─── */
  if (screen === "results") {
    return (
      <SpaceRoot>
        <div className="quiz-app">
          <div className="quiz-content">
            <div className="results">
              <div style={{ fontSize: 48 }}>🏁</div>
              <div className="results-score">{score}/{scoredCount}</div>
              <div className="results-label">questions notées correctes</div>
              <div className="results-message">{getResultMessage()}</div>
              <div className="results-breakdown">
                {PHASES.map(p => {
                  const ps = phaseScores.get(p.id);
                  return (
                    <div key={p.id} className="results-phase">
                      <span>{p.icon} {p.title}</span>
                      <span style={{ fontWeight: 600, color: "var(--accent)" }}>
                        {ps ? `${ps.earned}/${ps.possible}` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 16, padding: 16, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", maxWidth: 400, width: "100%" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  📋 Ce qu'il faut retenir
                </div>
                <ol style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text)", paddingLeft: 18, opacity: 0.9 }}>
                  <li>Stabiloter le sujet → QUI / QUAND / OÙ / NOTIONS</li>
                  <li>Construire une vraie problématique avec tension</li>
                  <li>Contextualiser en introduction</li>
                  <li>Citer au moins 1 œuvre par chorégraphe avec date</li>
                  <li>Tester chaque paragraphe : pourquoi ? comment ?</li>
                  <li>Graham = héritière (aval), pas pionnière stricte</li>
                </ol>
              </div>
              <button className="btn-primary" onClick={handleRestart} style={{ marginTop: 16, maxWidth: 300 }}>
                Recommencer le quiz
              </button>
            </div>
          </div>
        </div>
      </SpaceRoot>
    );
  }

  /* ─── Quiz ─── */
  const progress = ((qIdx + (revealed ? 1 : 0)) / activeQuestions.length) * 100;

  return (
    <SpaceRoot>
      <div className="quiz-app">
        <div className="quiz-content">
          {/* Progress */}
          <div className="progress-bar-wrap">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-label">
              <span className="score-pill">⭐ {score}/{scoredCount}</span>
              {" "}· {studentName} · Question {qIdx + 1}/{activeQuestions.length}
            </div>
          </div>

          {/* Phase header */}
          {isNewPhase && phase && (
            <div style={{ marginBottom: 8 }}>
              <span className="phase-badge">{phase.icon} Phase {phase.id} — {phase.title}</span>
            </div>
          )}

          {/* Subject banner */}
          <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11, lineHeight: 1.5, color: "var(--dim)" }}>
            <strong style={{ color: "var(--gold)", fontSize: 12 }}>📜 Sujet Contemporain</strong><br/>
            Expliquez de quelle manière les pionnières américaines de la danse moderne, au début du XXᵉ siècle, ont transformé la danse et renouvelé l'art chorégraphique. Pour répondre, vous vous appuierez sur des exemples précis de chorégraphes, d'œuvres et de principes artistiques ou esthétiques afin de montrer les changements qu'elles ont apportés dans la manière de créer, de danser et de penser le corps en scène.
          </div>

          {/* Question card */}
          <div className="question-card" key={q.id}>
            <div className="question-number">Question {q.id} sur {activeQuestions.length} {q.points > 0 ? "· 🏆 Notée" : "· 💭 Réflexion"}</div>
            <div className="question-text" style={{ whiteSpace: "pre-line" }}>{q.question}</div>

            {q.type === "mcq" && (
              <McqOptions q={q} selected={mcqSel} revealed={revealed} onSelect={setMcqSel} />
            )}
            {q.type === "select" && (
              <SelectOptions q={q} selected={selectSel} revealed={revealed} onToggle={i => {
                const next = new Set(selectSel);
                if (next.has(i)) next.delete(i); else next.add(i);
                setSelectSel(next);
              }} />
            )}
            {q.type === "trueFalse" && (
              <TrueFalseBlock q={q} answers={tfAnswers} revealed={revealed} onAnswer={(i, v) => {
                setTfAnswers(new Map(tfAnswers).set(i, v));
              }} />
            )}
            {q.type === "ranking" && !revealed && (
              <RankingBlock items={rankItems} onMove={handleRankMove} />
            )}
            {q.type === "ranking" && revealed && (
              <div className="rank-list">
                {(q as RankingQ).correctOrder.map((item, i) => {
                  const userItem = rankItems[i];
                  const isRight = userItem === item;
                  return (
                    <div key={i} className="rank-item" style={{
                      borderColor: isRight ? "var(--success)" : "var(--error)",
                      background: isRight ? "var(--success-glow)" : "var(--error-glow)",
                    }}>
                      <span className="rank-num">{i + 1}</span>
                      <span className="rank-text">
                        {isRight ? item : <><s style={{ opacity: 0.5 }}>{userItem}</s> → {item}</>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {q.type === "matching" && (
              <MatchingBlock q={q} selections={matchSel} revealed={revealed} onChange={(l, r) => {
                setMatchSel(new Map(matchSel).set(l, r));
              }} />
            )}
            {q.type === "text" && (
              <>
                <textarea
                  className="quiz-input"
                  placeholder="Rédigez votre réponse ici…"
                  value={textVal}
                  onChange={e => setTextVal(e.target.value)}
                  disabled={revealed}
                />
                {revealed && (
                  <div className="explanation" style={{ marginTop: 12 }}>
                    <div className="explanation-title">💡 Réponse attendue</div>
                    <div className="explanation-text" style={{ whiteSpace: "pre-line" }}>
                      {(q as TextQ).sampleAnswer}
                    </div>
                  </div>
                )}
              </>
            )}
            {q.type === "slider" && (
              <div className="slider-wrap">
                <div className="slider-value">{sliderVal}/5</div>
                <input
                  type="range"
                  className="slider-input"
                  min={(q as SliderQ).min}
                  max={(q as SliderQ).max}
                  value={sliderVal}
                  onChange={e => setSliderVal(Number(e.target.value))}
                  disabled={revealed}
                />
                <div className="slider-labels">
                  <span>{(q as SliderQ).labels[0]}</span>
                  <span>{(q as SliderQ).labels[1]}</span>
                </div>
                {revealed && (
                  <div className="explanation" style={{ marginTop: 12 }}>
                    <div className="explanation-title">💬 Note de l'enseignant</div>
                    <div className="explanation-text" style={{ whiteSpace: "pre-line" }}>{(q as SliderQ).note}</div>
                  </div>
                )}
              </div>
            )}
            {q.type === "wordcloud" && (
              <>
                <input
                  className="quiz-input"
                  style={{ minHeight: "auto", padding: "14px 16px" }}
                  placeholder={(q as WordCloudQ).prompt}
                  value={wordcloudVal}
                  onChange={e => setWordcloudVal(e.target.value)}
                  disabled={revealed}
                />
                {revealed && (
                  <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(q as WordCloudQ).expectedWords.map(w => (
                      <span key={w} style={{
                        padding: "4px 12px",
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 600,
                        background: wordcloudVal.toLowerCase().includes(w.toLowerCase()) ? "var(--success-glow)" : "var(--surface-2)",
                        color: wordcloudVal.toLowerCase().includes(w.toLowerCase()) ? "var(--success)" : "var(--dim)",
                        border: `1px solid ${wordcloudVal.toLowerCase().includes(w.toLowerCase()) ? "var(--success)" : "var(--border)"}`,
                      }}>{w}</span>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Explanation */}
            {revealed && q.type !== "text" && q.type !== "slider" && (
              <div className="explanation">
                <div className="explanation-title">💡 Explication</div>
                <div className="explanation-text" style={{ whiteSpace: "pre-line" }}>{q.explanation}</div>
              </div>
            )}

            {/* Action buttons */}
            <div className="actions-row">
              {!revealed && (
                <button className="btn-primary btn-validate" onClick={handleValidate} disabled={!canValidate()}>
                  Valider ✓
                </button>
              )}
              {revealed && (
                <button className="btn-primary" onClick={handleNext}>
                  {qIdx < activeQuestions.length - 1 ? "Suivant →" : "Voir les résultats 🏁"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </SpaceRoot>
  );
}

/* ─── Root Export ─── */
export default function App() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const [showTeacher, setShowTeacher] = useState(false);

  if (mode === "teacher" || showTeacher) {
    return <TeacherDashboard />;
  }

  return <QuizApp onTeacherAccess={() => setShowTeacher(true)} />;
}
