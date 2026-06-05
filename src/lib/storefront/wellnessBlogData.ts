export interface WellnessBlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  imageEmoji: string;
  gradientFrom: string;
  gradientTo: string;
  author: string;
  authorRole: string;
  publishedAt: string;
  readingTime: number;
  featured: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

export const WELLNESS_BLOG_POSTS: WellnessBlogPost[] = [
  {
    slug: "varfor-d-vitamin-ar-viktigt",
    title: "Varför D-vitamin är avgörande för din hälsa",
    excerpt: "D-vitamin spelar en central roll för immunförsvar, benstyrka och humör — men de flesta nordbor får i sig för lite, särskilt under vintern.",
    content: `<p>D-vitamin är ett av de viktigaste tillskotten du kan ta, särskilt om du bor i Norden. Under vintermånaderna är solstrålarna för svaga för att kroppen ska kunna producera tillräckligt med D-vitamin naturligt.</p>

<h2>Varför behöver vi D-vitamin?</h2>
<p>D-vitamin reglerar calciumupptaget och är kritiskt för starka ben och tänder. Men det är också viktigt för immunsystemet, muskelfunktionen och humöret. Forskning kopplar brist på D-vitamin till ökad risk för förkylningar, trötthet och depression.</p>

<h2>Hur mycket behöver du?</h2>
<p>Livsmedelsverket rekommenderar 10 mikrogram (400 IE) per dag för vuxna. Men många experter menar att den optimala dosen kan vara högre — upp till 50–75 mikrogram (2000–3000 IE) — särskilt under vinterhalvåret.</p>

<h2>D3 + K2: Det perfekta paret</h2>
<p>D3-vitamin hjälper kroppen ta upp calcium, men utan K2 kan calciumet hamna i fel ställen. K2 (menakvinon) styr calciumet till ben och tänder och håller det borta från blodkärlen. Välj ett tillskott som kombinerar D3 och K2 för bästa effekt.</p>

<h2>Källor till D-vitamin</h2>
<ul>
  <li>Solljus (maj–september i Sverige)</li>
  <li>Fet fisk som lax, makrill och sill</li>
  <li>Lever och äggula</li>
  <li>Berikade livsmedel och mjölk</li>
  <li>Kosttillskott (D3 rekommenderas framför D2)</li>
</ul>

<p>Om du är osäker på ditt D-vitaminvärde kan du ta ett enkelt blodprov hos din vårdcentral. De flesta som lever och arbetar inomhus i Sverige har nytta av ett dagligt tillskott, oavsett årstid.</p>`,
    category: "Vitaminer",
    tags: ["d-vitamin", "immunförsvar", "benstyrka", "vitaminbrist", "vinter"],
    imageEmoji: "☀️",
    gradientFrom: "from-amber-50",
    gradientTo: "to-yellow-100",
    author: "Dr. Emma Lindqvist",
    authorRole: "Nutritionist & hälsorådgivare",
    publishedAt: "2026-05-20",
    readingTime: 5,
    featured: true,
    seoTitle: "Varför D-vitamin är viktigt — och hur du tar det rätt",
    seoDescription: "Lär dig varför D-vitamin är avgörande för immunförsvar, ben och humör — och hur D3+K2-kombination ger bäst effekt.",
  },
  {
    slug: "adaptogener-for-stress",
    title: "Adaptogener: Naturlig hjälp mot stress och trötthet",
    excerpt: "Ashwagandha, rhodiola och ginseng hjälper kroppen hantera stress bättre. Här är vad forskningen säger om dessa kraftfulla örter.",
    content: `<p>Adaptogener är en grupp örter och svampar som hjälper kroppen anpassa sig till stress och återhämta sig snabbare. De kallas adaptogener just för att de "adapterar" till vad kroppen behöver — de hjälper systemet fungera mer balanserat utan att driva det i en konstlad riktning.</p>

<h2>De viktigaste adaptogenerna</h2>

<h3>Ashwagandha (Withania somnifera)</h3>
<p>Ashwagandha är en av de mest studerade adaptogenerna. Forskning visar att det kan minska kortisolnivåer med upp till 30 %, förbättra sömnen och öka energinivåerna. Roten används i ayurvedisk medicin sedan tusentals år.</p>

<h3>Rhodiola rosea</h3>
<p>Rhodiola är en nordisk ört som växer i kalla bergsregioner. Den används för att bekämpa mental trötthet och öka uthålligheten. Studier visar att den förbättrar koncentration och minskar känslan av utbrändhet.</p>

<h3>Lion's Mane (Lejonmanssvamp)</h3>
<p>Lion's Mane är en medicinsk svamp som kan stödja hjärnhälsa och kognition. Forskning tyder på att den stimulerar produktionen av NGF (nerve growth factor), vilket är viktigt för nervernas hälsa och minne.</p>

<h2>Hur tar du adaptogener?</h2>
<p>Adaptogener fungerar bäst när de tas regelbundet över tid — vanligtvis 4–8 veckor. Börja med en låg dos och öka gradvis. Ta alltid en paus (2–4 veckor) mellan kurer för att undvika att kroppen anpassar sig för mycket.</p>

<p>Adaptogener är inte en snabblösning. De fungerar bäst som komplement till god sömn, regelbunden motion och balanserad kost.</p>`,
    category: "Stress & Sömn",
    tags: ["adaptogener", "stress", "ashwagandha", "rhodiola", "naturlig hälsa"],
    imageEmoji: "🧘",
    gradientFrom: "from-purple-50",
    gradientTo: "to-indigo-100",
    author: "Sofia Bergström",
    authorRole: "Certifierad hälsocoach",
    publishedAt: "2026-05-15",
    readingTime: 6,
    featured: true,
  },
  {
    slug: "kollagen-for-hy-och-leder",
    title: "Kollagen: Allt du behöver veta för hud och leder",
    excerpt: "Kollagentillskott har blivit alltmer populära. Men fungerar de verkligen? Vi granskar forskningen och förklarar vad du bör leta efter.",
    content: `<p>Kollagen är det vanligaste proteinet i kroppen och utgör en stor del av hud, leder, ben och muskler. Med åldern minskar kroppens naturliga kollagenproduktion — från och med ungefär 25 års ålder.</p>

<h2>Typer av kollagen</h2>
<p>Det finns 28 typer av kollagen, men de vanligaste i tillskott är:</p>
<ul>
  <li><strong>Typ I:</strong> För hud, hår, naglar och ben</li>
  <li><strong>Typ II:</strong> För brosk och leder</li>
  <li><strong>Typ III:</strong> För muskler, blodkärl och organ</li>
</ul>

<h2>Fungerar kollagentillskott?</h2>
<p>Forskning visar att hydrolyserat kollagen (kollagenpeptider) tas upp effektivt av kroppen. Studier visar förbättringar av hudens elasticitet och fuktighet, ledsmärta, benstyrka och muskelmassa vid regelbunden användning under minst 8 veckor.</p>

<h2>Vad bör du leta efter?</h2>
<p>Välj ett tillskott med hydrolyserat kollagen (kollagenpeptider) för bäst absorption. Kombinera gärna med C-vitamin, som är nödvändigt för kroppens kollagensyntés. Marint kollagen (från fisk) anses ha bäst biotillgänglighet.</p>

<h2>Dosering och form</h2>
<p>5–15 gram per dag är vanligaste doseringen i studier. Pulverform löser sig lätt i drycker och är smakfritt, vilket gör det enkelt att tillsätta i morgonkaffet eller en smoothie.</p>`,
    category: "Skönhet & Hälsa",
    tags: ["kollagen", "hud", "leder", "anti-aging", "skönhet"],
    imageEmoji: "✨",
    gradientFrom: "from-rose-50",
    gradientTo: "to-pink-100",
    author: "Dr. Emma Lindqvist",
    authorRole: "Nutritionist & hälsorådgivare",
    publishedAt: "2026-05-10",
    readingTime: 7,
    featured: true,
  },
  {
    slug: "omega-3-hjarthalsa-och-hjarna",
    title: "Omega-3: Så stödjer du ditt hjärta och din hjärna",
    excerpt: "Omega-3-fettsyror är bland de mest välforskade tillskotten. Lär dig skillnaden mellan EPA, DHA och ALA — och varför det spelar roll.",
    content: `<p>Omega-3-fettsyror är essentiella — det betyder att kroppen inte kan producera dem utan vi måste få i oss dem via kosten. De delas in i tre typer: ALA, EPA och DHA.</p>

<h2>EPA vs DHA vs ALA</h2>
<p><strong>EPA (eikosapentaensyra)</strong> — Antiinflammatorisk effekt, viktig för hjärtats hälsa och humörstabilitet.</p>
<p><strong>DHA (dokosahexaensyra)</strong> — Avgörande för hjärnfunktion, syn och fosterutveckling. 60% av hjärnans fett är DHA.</p>
<p><strong>ALA (alfa-linolensyra)</strong> — Finns i linfrön och chiafrön, men omvandlas ineffektivt till EPA/DHA av kroppen (under 5–10%).</p>

<h2>Varför de flesta får i sig för lite omega-3</h2>
<p>Moderna kostvanor innehåller för mycket omega-6 (från vegetabiliska oljor) och för lite omega-3. Det optimala förhållandet är 1:1–4:1 (omega-6:omega-3), men de flesta äter ett förhållande på 15:1 eller mer, vilket skapar en kronisk inflammatorisk miljö.</p>

<h2>Fiskolja vs Algolja</h2>
<p>Fiskolja är den vanligaste källan och innehåller både EPA och DHA. Algolja är ett veganskt alternativ — faktum är att det är källan varifrån fisken får sin omega-3. Algolja ger DHA och ibland EPA, och är miljövänligare.</p>

<h2>Dosering</h2>
<p>1–3 gram EPA+DHA per dag är en vanlig rekommendation. Välj en produkt med hög renhet (utan tungmetaller) och kontrollera att EPA och DHA-innehållet är specificerat på förpackningen.</p>`,
    category: "Hjärnhälsa",
    tags: ["omega-3", "hjärthälsa", "hjärna", "fiskolja", "EPA", "DHA"],
    imageEmoji: "🐟",
    gradientFrom: "from-blue-50",
    gradientTo: "to-cyan-100",
    author: "Maria Svensson",
    authorRole: "Kost- & näringsterapeut",
    publishedAt: "2026-05-05",
    readingTime: 5,
    featured: false,
  },
  {
    slug: "magnesium-sova-battre",
    title: "Magnesium: Den mineral som hjälper dig sova bättre",
    excerpt: "Brist på magnesium är vanligare än man tror och kan bidra till sömnproblem, muskelkramper och ångest. Här är vad du bör veta.",
    content: `<p>Magnesium är involverat i över 300 enzymatiska reaktioner i kroppen. Det spelar en avgörande roll för nervsystemet, muskelfunktionen och sömnkvaliteten — och de flesta vuxna i Sverige får i sig för lite.</p>

<h2>Tecken på magnesiumbrist</h2>
<ul>
  <li>Sömnsvårigheter och ytlig sömn</li>
  <li>Muskelkramper, särskilt i benen</li>
  <li>Ångest och oro</li>
  <li>Konstant trötthet trots tillräcklig sömn</li>
  <li>Huvudvärk och migrän</li>
  <li>Oregelbunden hjärtrytm</li>
</ul>

<h2>De bästa formerna av magnesium</h2>
<ul>
  <li><strong>Magnesiumglycinat:</strong> Bäst för sömn och ångest, skonsamt för magen. Rekommenderas.</li>
  <li><strong>Magnesiummalat:</strong> Bra för energi och muskelfunktion, lämpar sig för dagtid.</li>
  <li><strong>Magnesiumcitrat:</strong> God absorption, populärt och prisvärt.</li>
  <li><strong>Magnesiumoxid:</strong> Mycket låg absorption (under 4%) — undvik detta i tillskott.</li>
</ul>

<h2>Hur du tar magnesium för bättre sömn</h2>
<p>Ta 200–400 mg magnesiumglycinat 30–60 minuter före läggdags. Det sänker kortisolnivåerna och aktiverar GABA-receptorer i hjärnan, vilket lugnar nervsystemet och underlättar insomning.</p>

<p>Undvik höga doser utan läkares råd (över 600 mg/dag). Magnesium kan ha lösande effekt i höga doser — börja lågt och öka gradvis.</p>`,
    category: "Sömn & Stress",
    tags: ["magnesium", "sömn", "stress", "muskelkramper", "mineraler"],
    imageEmoji: "😴",
    gradientFrom: "from-indigo-50",
    gradientTo: "to-violet-100",
    author: "Sofia Bergström",
    authorRole: "Certifierad hälsocoach",
    publishedAt: "2026-04-28",
    readingTime: 4,
    featured: false,
  },
  {
    slug: "probiotika-tarmhalsa",
    title: "Probiotika och tarmhälsa: Grunden för ett starkt immunförsvar",
    excerpt: "70–80% av immunsystemet finns i tarmen. Lär dig hur du förbättrar din tarmhälsa med rätt probiotika, prebiotika och kostvanor.",
    content: `<p>Tarmen är kroppens mest komplexa organ och är hem för ungefär 100 biljoner bakterier. Dessa bakterier, kallade mikrobiotan, spelar en avgörande roll för immunsystemet, humöret via tarm-hjärnaxeln, och den allmänna hälsan.</p>

<h2>Probiotika vs Prebiotika vs Synbiotika</h2>
<p><strong>Probiotika</strong> är levande bakterier som tillförs via mat eller tillskott (t.ex. Lactobacillus, Bifidobacterium).</p>
<p><strong>Prebiotika</strong> är fibrer som matar de goda bakterierna i tarmen (t.ex. inulin, FOS, betaglukan från havre).</p>
<p><strong>Synbiotika</strong> är produkter som kombinerar probiotika och prebiotika för synergistisk effekt.</p>

<h2>Viktiga bakteriestammar</h2>
<ul>
  <li><strong>Lactobacillus acidophilus:</strong> Hjälper mot IBS och laktosintolerans</li>
  <li><strong>Bifidobacterium longum:</strong> Minskar inflammation och stödjer immunsystemet</li>
  <li><strong>Lactobacillus rhamnosus GG:</strong> Förhindrar och behandlar diarré och mag-tarmproblem</li>
  <li><strong>Saccharomyces boulardii:</strong> En nyttig jäst som skyddar mot antibiotikaassocierad diarré</li>
</ul>

<h2>Fermenterade livsmedel som naturliga probiotika</h2>
<p>Surkål, kimchi, kefir, kombucha och naturell yoghurt är utmärkta källor till probiotika i kosten. Försök inkludera minst en fermenterad mat per dag. Välj varierat för att gynna en mångfaldig mikrobiota.</p>

<h2>När behöver du ett probiotikumtillskott?</h2>
<p>Antibiotikakurer, stress, alkohol och en fiber- och grönsakfattig kost skadar tarmbiotan. I dessa lägen kan ett probiotikumtillskott med minst 10 miljarder CFU per portion vara till stor nytta.</p>`,
    category: "Tarmhälsa",
    tags: ["probiotika", "tarmhälsa", "immunförsvar", "fermenterat", "mikrobiom"],
    imageEmoji: "🌱",
    gradientFrom: "from-green-50",
    gradientTo: "to-emerald-100",
    author: "Maria Svensson",
    authorRole: "Kost- & näringsterapeut",
    publishedAt: "2026-04-20",
    readingTime: 6,
    featured: false,
  },
];
