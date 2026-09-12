// Auto-suggests a class teacher's or head teacher's report card comment from a pupil's actual
// term performance — the overall grading band, the standout and weakest subjects, and (when
// available) the trend against last term. A large pool of phrasings per performance tier means
// two pupils who both did "well" don't get the exact same sentence, and clicking "Suggest"
// again offers a different variant rather than repeating itself. This only ever fills the
// comment box; nothing is saved until the teacher/head reviews it and hits Save, same as typing
// a comment by hand.

export type SubjectPerformance = { name: string; total: number };

export type CommentAudience = "teacher" | "head";

export interface CommentGenerationInput {
  studentFirstName: string;
  subjects: SubjectPerformance[];
  averageValue: number;
  /** The overall band's description/label, e.g. "OUTSTANDING", "SATISFACTORY", "DISTINCTION" —
   * whichever grading scale (CBC or legacy) is active for this pupil's class. */
  overallBandDescription?: string | null;
  /** Last term's average, if it's available from already-fetched history — enables a trend
   * sentence ("an improvement on last term's X%"). Omit or pass null/undefined to skip it. */
  previousAverageValue?: number | null;
}

type Tier = "excellent" | "strong" | "solid" | "developing" | "struggling";

// Covers both the current CBC scale (OUTSTANDING/ADVANCED/BASIC/SATISFACTORY/UNSATISFACTORY)
// and the pre-2023 legacy scale (DISTINCTION/MERIT/CREDIT/SATISFACTORY/UNSATISFACTORY) — both
// happen to already agree on "SATISFACTORY" and "UNSATISFACTORY" for the bottom two tiers.
const LABEL_TIER: Record<string, Tier> = {
  OUTSTANDING: "excellent",
  DISTINCTION: "excellent",
  ADVANCED: "strong",
  MERIT: "strong",
  BASIC: "solid",
  CREDIT: "solid",
  SATISFACTORY: "developing",
  UNSATISFACTORY: "struggling",
};

function resolveTier(description: string | null | undefined, average: number): Tier {
  const normalized = (description ?? "").trim().toUpperCase();
  if (normalized in LABEL_TIER) return LABEL_TIER[normalized];
  // Fallback for a school running a fully custom set of band labels — bucket by the raw
  // average instead so this still works, just without label-matched wording.
  if (average >= 80) return "excellent";
  if (average >= 65) return "strong";
  if (average >= 50) return "solid";
  if (average >= 40) return "developing";
  return "struggling";
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

interface Ctx {
  name: string;
  avg: string;
  best: string | null;
  weak: string | null;
}

function buildCtx(input: CommentGenerationInput): Ctx {
  const sorted = [...input.subjects].sort((a, b) => b.total - a.total);
  const best = sorted.length > 0 ? sorted[0] : null;
  const weak =
    sorted.length > 1 && sorted[sorted.length - 1].total < sorted[0].total
      ? sorted[sorted.length - 1]
      : null;
  return {
    name: input.studentFirstName || "This pupil",
    avg: input.averageValue.toFixed(0),
    best: best?.name ?? null,
    weak: weak?.name ?? null,
  };
}

// Each template is a function so it can skip itself when the data it needs (a genuine
// standout or weak subject) isn't available, rather than printing an awkward blank.
type Template = (ctx: Ctx) => string | null;

const TEACHER_TEMPLATES: Record<Tier, Template[]> = {
  excellent: [
    (c) => `${c.name} has had an outstanding term, achieving excellent results across the board${c.best ? `, with particular strength in ${c.best}` : ""}. Keep up this superb standard of work.`,
    (c) => `An excellent term for ${c.name}, with an overall average of ${c.avg}%${c.best ? `. Your work in ${c.best} especially is truly commendable` : ""}.`,
    (c) => `${c.name} continues to perform at an exceptional level this term. Your dedication in class is clearly reflected in these results — well done.`,
    (c) => c.best ? `A brilliant set of results, ${c.name}. Your grasp of ${c.best} in particular stands out, and your overall effort this term deserves real praise.` : null,
    (c) => `${c.name} has shown outstanding academic ability this term, finishing with an average of ${c.avg}%. Keep striving for this level of excellence.`,
    (c) => `Superb work, ${c.name}. Your performance this term shows a pupil who takes real pride in their studies.`,
  ],
  strong: [
    (c) => c.best && c.weak ? `${c.name} has produced a very good set of results this term, with ${c.best} a particular highlight. A little more focus on ${c.weak} could push this even further.` : null,
    (c) => `A strong term for ${c.name}, averaging ${c.avg}%. You are clearly capable of excellent work — keep pushing yourself.`,
    (c) => c.weak ? `${c.name} is performing well above average this term. Continued effort in ${c.weak}${c.best ? ` alongside your strong showing in ${c.best}` : ""} will serve you well.` : null,
    (c) => `Well done, ${c.name} — a solid, above-average performance this term. Keep bringing this same energy to every subject.`,
    (c) => c.best ? `${c.name} has worked hard this term and it shows, particularly in ${c.best}. Keep building on this momentum.` : `${c.name} has worked hard this term and it shows. Keep building on this momentum.`,
    (c) => `A commendable term for ${c.name}. Apply that same focus across all your subjects next term and even better results are within reach.`,
  ],
  solid: [
    (c) => c.best ? `${c.name} has had a satisfactory term overall, doing well in ${c.best}. More consistent effort${c.weak ? ` in ${c.weak}` : ""} would help raise your overall average.` : `${c.name} has had a satisfactory term overall. More consistent effort would help raise your overall average.`,
    (c) => `A fair term for ${c.name}, averaging ${c.avg}%. There is clear potential here — with more focused revision, real improvement is possible.`,
    (c) => c.best ? `${c.name} is capable of more than this term's results suggest. Your work in ${c.best} shows what you can achieve when you apply yourself fully.` : null,
    (c) => c.weak ? `${c.name}'s results this term are average. I encourage more consistent classwork and homework, particularly in ${c.weak}, next term.` : `${c.name}'s results this term are average. I encourage more consistent classwork and homework next term.`,
    (c) => `A steady term for ${c.name}. Building better study habits would help lift your overall performance.`,
    (c) => c.best ? `${c.name} has shown flashes of good work this term, especially in ${c.best}. Greater consistency across all subjects is now the goal.` : null,
  ],
  developing: [
    (c) => c.weak ? `${c.name}'s performance this term needs improvement. I encourage more regular revision and greater attention in class, particularly in ${c.weak}.` : `${c.name}'s performance this term needs improvement. I encourage more regular revision and greater attention in class.`,
    (c) => `This has been a below-average term for ${c.name}. With more consistent effort, there is room for real progress next term.`,
    (c) => c.weak ? `${c.name} must put in more effort next term. Extra practice in ${c.weak} and more focus during lessons would make a real difference.` : `${c.name} must put in more effort next term. More focus during lessons would make a real difference.`,
    (c) => `${c.name}'s results this term are a concern. I would like to see more homework completed and more questions asked in class.`,
    (c) => `A weak term for ${c.name}, averaging ${c.avg}%. Please encourage more study time at home.`,
    (c) => c.weak ? `${c.name} has the ability to do much better than this. More discipline with schoolwork, especially in ${c.weak}, is needed next term.` : null,
  ],
  struggling: [
    (c) => c.weak ? `${c.name}'s performance this term is well below expectation. Urgent extra support, particularly in ${c.weak}, is strongly recommended.` : `${c.name}'s performance this term is well below expectation. Urgent extra support is strongly recommended.`,
    (c) => `This has been a very difficult term academically for ${c.name}. I would like to arrange extra help and closer monitoring of homework going forward.`,
    (c) => c.weak ? `${c.name} is struggling significantly with the current workload, especially in ${c.weak}. Please arrange a meeting so we can discuss additional support.` : `${c.name} is struggling significantly with the current workload. Please arrange a meeting so we can discuss additional support.`,
    (c) => `${c.name}'s results this term are of serious concern. A structured revision plan and additional support at home are strongly advised.`,
    (c) => c.weak ? `${c.name} needs significant extra help to catch up, particularly in ${c.weak}. I recommend daily revision and close supervision of homework.` : `${c.name} needs significant extra help to catch up. I recommend daily revision and close supervision of homework.`,
    (c) => `This term's results for ${c.name} fall well short of what is needed. Immediate intervention, both at school and at home, is necessary.`,
  ],
};

const HEAD_TEMPLATES: Record<Tier, Template[]> = {
  excellent: [
    (c) => `A truly outstanding performance this term. ${c.name} is commended for this exceptional standard of academic achievement.`,
    (c) => `Congratulations, ${c.name}, on an excellent term's work. This is the standard we hope every pupil aspires to.`,
    (c) => `An exceptional result, averaging ${c.avg}%. Keep up this excellent standard, ${c.name}.`,
    (c) => `${c.name} has excelled this term. This level of achievement reflects great credit on both the pupil and their teachers.`,
    (c) => `A commendable and outstanding academic performance. Well done, ${c.name}.`,
    (c) => `${c.name}'s results this term are exemplary. I encourage this excellent standard to be maintained.`,
  ],
  strong: [
    (c) => `A very good term's work, ${c.name}. Continue striving for excellence.`,
    (c) => `${c.name} has performed well above average this term — a pleasing result. Keep up the good effort.`,
    (c) => `A strong academic performance, ${c.name}. With continued application, even greater results are within reach.`,
    (c) => `Well done, ${c.name}, on a solid term's results. I encourage you to keep working towards your full potential.`,
    (c) => `${c.name}'s performance this term is commendable. Continued hard work will bring further success.`,
    (c) => `A pleasing set of results this term. Keep up the good work, ${c.name}.`,
  ],
  solid: [
    (c) => `An average performance this term. ${c.name} is encouraged to work harder to reach their full potential.`,
    (c) => `${c.name}'s results this term are satisfactory. Greater consistency and effort will lead to improvement.`,
    (c) => `A fair term overall. I encourage ${c.name} to apply themselves more fully next term.`,
    (c) => `${c.name} shows potential for better results with increased effort and discipline.`,
    (c) => `An average term for ${c.name}. Renewed commitment to studies is encouraged.`,
    (c) => `${c.name}'s performance is acceptable but there is clear room for improvement.`,
  ],
  developing: [
    (c) => `${c.name}'s performance this term is below the expected standard. Greater effort and commitment are required.`,
    (c) => `This term's results are a concern. ${c.name} is urged to take their studies more seriously.`,
    (c) => `${c.name} must show greater application to their studies next term to avoid falling further behind.`,
    (c) => `A disappointing term academically. I encourage ${c.name} and their family to prioritise consistent study habits.`,
    (c) => `${c.name}'s results require urgent attention. Increased effort next term is essential.`,
    (c) => `This term's performance falls short of expectations. ${c.name} is encouraged to seek extra help where needed.`,
  ],
  struggling: [
    (c) => `${c.name}'s academic performance this term is of serious concern. Immediate intervention is required.`,
    (c) => `This is a very worrying set of results. I strongly recommend additional academic support for ${c.name} without delay.`,
    (c) => `${c.name} is significantly behind expected standards. A meeting with the school is requested to discuss a way forward.`,
    (c) => `These results are unacceptable and require urgent action. Please arrange to discuss additional support for ${c.name}.`,
    (c) => `${c.name}'s performance this term is well below standard. Close collaboration between school and home is now essential.`,
    (c) => `A serious decline in academic performance. Immediate remedial support for ${c.name} is strongly advised.`,
  ],
};

function trendSentence(current: number, previous: number | null | undefined): string | null {
  if (previous == null || Number.isNaN(previous)) return null;
  const prevRounded = previous.toFixed(0);
  const diff = current - previous;
  if (diff >= 3) {
    return pick([
      `This is a clear improvement on last term's average of ${prevRounded}%.`,
      `Your average has risen from ${prevRounded}% last term — pleasing progress.`,
      `A welcome improvement from last term's ${prevRounded}% average.`,
    ]);
  }
  if (diff <= -3) {
    return pick([
      `This is a decline from last term's average of ${prevRounded}%, which is a concern.`,
      `Your average has fallen from ${prevRounded}% last term — this needs attention.`,
      `A drop from last term's ${prevRounded}% average that should be addressed.`,
    ]);
  }
  return pick([
    `This is broadly consistent with last term's average of ${prevRounded}%.`,
    `A similar result to last term's average of ${prevRounded}%.`,
  ]);
}

export function generatePerformanceComment(input: CommentGenerationInput, audience: CommentAudience): string {
  const ctx = buildCtx(input);
  const tier = resolveTier(input.overallBandDescription, input.averageValue);
  const bank = (audience === "teacher" ? TEACHER_TEMPLATES : HEAD_TEMPLATES)[tier];
  const usable = bank.map((t) => t(ctx)).filter((s): s is string => !!s);
  const base = pick(usable.length > 0 ? usable : [`${ctx.name} averaged ${ctx.avg}% this term.`]);
  const trend = trendSentence(input.averageValue, input.previousAverageValue);
  return trend ? `${base} ${trend}` : base;
}
