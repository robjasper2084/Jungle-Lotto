import { CATEGORY_LABELS, TRIVIA_CONFIG } from "./trivia-config.mjs";

const LOTTERY_SOURCE = Object.freeze({
  name: "Powerball official FAQs",
  url: "https://www.powerball.com/faqs",
});
const MEGA_SOURCE = Object.freeze({
  name: "Mega Millions official FAQs",
  url: "https://www.megamillions.com/FAQs.aspx",
});
const NASA_SOURCE = Object.freeze({
  name: "NASA UAP Independent Study",
  url: "https://science.nasa.gov/uap/",
});
const AARO_SOURCE = Object.freeze({
  name: "All-domain Anomaly Resolution Office",
  url: "https://www.aaro.mil/",
});
const DETROIT_SOURCE = Object.freeze({
  name: "Detroit Historical Society",
  url: "https://www.detroithistorical.org/learn/online-research/encyclopedia-of-detroit",
});
const MOTOWN_SOURCE = Object.freeze({
  name: "Motown Museum",
  url: "https://www.motownmuseum.org/",
});

const banks = Object.freeze({
  "lottery-knowledge": [
    ["easy", "What does a random lottery drawing mean for the next valid number combination?", "Every valid combination has its stated chance", ["Recent numbers cannot repeat", "Only balanced combinations can win", "Past drawings choose the next result"], "Independent random drawings do not give unused combinations a memory or a turn.", LOTTERY_SOURCE, ["randomness", "responsible-play"]],
    ["easy", "Which action is the responsible way to treat a lottery ticket?", "Set a spending limit before playing", ["Borrow money for more entries", "Chase a loss immediately", "Treat play as guaranteed income"], "Lottery play is entertainment, so a preset budget and stopping point help keep it responsible.", LOTTERY_SOURCE, ["responsible-play"]],
    ["medium", "What is the gambler's fallacy?", "Believing past random outcomes make a future outcome due", ["Checking a ticket after a draw", "Choosing numbers with a calculator", "Reading official game rules"], "Independent random events do not become due because of an earlier streak.", LOTTERY_SOURCE, ["probability", "fallacy"]],
    ["easy", "Where should a player verify a winning lottery ticket?", "With the official lottery or an authorized retailer", ["In an anonymous social post", "Through an unrelated prediction app", "By comparing it with an old draw"], "Official lottery channels and authorized retailers provide the authoritative validation process.", LOTTERY_SOURCE, ["ticket-safety"]],
    ["medium", "What is an annuity option in a jackpot game?", "A prize paid in scheduled installments", ["A second free ticket", "A fee added to every play", "A prediction based on prior draws"], "An annuity distributes an advertised prize through scheduled payments rather than one immediate lump sum.", MEGA_SOURCE, ["prize-options"]],
    ["medium", "What does a lump-sum prize option generally provide?", "A single present-value payment before applicable taxes", ["The full advertised annuity over time", "Automatic entry in future drawings", "A guaranteed tax-free payment"], "The cash option is generally the present cash value and differs from the advertised annuity total.", LOTTERY_SOURCE, ["prize-options"]],
    ["easy", "Does buying more valid tickets guarantee a jackpot?", "No, it increases entries but cannot guarantee a win", ["Yes, after ten tickets", "Yes, when numbers are spread evenly", "Only on rollover drawings"], "Additional entries change the number of combinations held, not the randomness of the draw.", LOTTERY_SOURCE, ["probability", "responsible-play"]],
    ["medium", "Why should official draw results be checked before acting on a screenshot?", "Screenshots can be incomplete, altered, or outdated", ["Official sites hide all winning numbers", "Screenshots change the odds", "A screenshot automatically claims a prize"], "A source-linked official result is safer than an image detached from its publication context.", LOTTERY_SOURCE, ["verification"]],
    ["hard", "In probability, what does independence between drawings mean?", "One drawing does not change the probabilities of another", ["Every drawing must use different numbers", "The same result can never recur", "All players have identical tickets"], "Independent events do not transfer probability from one completed drawing to the next.", LOTTERY_SOURCE, ["probability"]],
    ["easy", "What is a lottery draw machine intended to do?", "Select outcomes through an audited random process", ["Reward the oldest ticket", "Avoid every recently drawn number", "Match player birthdays first"], "Draw systems are designed and audited to select results without favoring personal patterns.", LOTTERY_SOURCE, ["draw-process"]],
    ["medium", "What is the safest response to a message demanding a fee to release an unknown prize?", "Verify independently and do not send money", ["Pay quickly before the deadline", "Send account credentials as proof", "Forward the message to more players"], "Unexpected prize demands are a common scam signal; use official contact information to verify.", LOTTERY_SOURCE, ["scam-awareness"]],
    ["easy", "What does a ticket purchase buy?", "A chance under the published game rules", ["A guaranteed return", "A share of every jackpot", "A prediction service"], "A valid ticket is an entry in a game of chance, not an investment or promise.", LOTTERY_SOURCE, ["responsible-play"]],
    ["hard", "If a fair drawing has just produced an unusual sequence, what happens to the next drawing's valid combinations?", "Their probabilities remain governed by the next drawing", ["The unusual numbers are removed", "Opposite numbers become more likely", "The machine must correct the sequence"], "An unusual past result does not force a compensating future result in an independent process.", LOTTERY_SOURCE, ["probability", "fallacy"]],
    ["medium", "Why can advertised jackpot and cash-value figures differ?", "They describe different payment structures", ["One figure includes lucky numbers", "Cash value counts only small prizes", "The advertised figure is a prediction"], "The advertised annuity and present cash value represent different ways of paying the prize.", MEGA_SOURCE, ["prize-options"]],
    ["easy", "Which record helps resolve a ticket dispute?", "The original ticket and official transaction information", ["A handwritten prediction", "A social-media comment", "A memory of the number set"], "The physical or authenticated digital ticket and official records are the relevant evidence.", LOTTERY_SOURCE, ["ticket-safety"]],
    ["medium", "What does it mean when a jackpot rolls over?", "No qualifying jackpot claim was produced for that drawing", ["Every smaller prize is canceled", "All old tickets remain active", "The next draw becomes predictable"], "Under published rules, an unclaimed top prize can carry into the next advertised jackpot cycle.", LOTTERY_SOURCE, ["jackpot"]],
    ["hard", "Why is a long run without a particular number not proof that it is due?", "Random processes can naturally produce uneven short-term frequencies", ["Draw machines permanently ban missing numbers", "Only even numbers can repeat", "Odds reset only once a year"], "Short samples often look uneven even when each drawing follows the same random mechanism.", LOTTERY_SOURCE, ["probability"]],
    ["easy", "What should entertainment-only number tools avoid claiming?", "That generated numbers predict or guarantee wins", ["That users can save a set", "That numbers can be displayed", "That a session can be replayed"], "Creative generators can organize or inspire number sets but must not imply predictive power.", LOTTERY_SOURCE, ["responsible-play", "entertainment-only"]],
    ["medium", "Why are lottery rules best read on the official game page?", "Rules, deadlines, and eligibility can vary by game and jurisdiction", ["Unofficial summaries control prize payment", "Every lottery uses one permanent rulebook", "Official pages cannot be updated"], "The operator's current rules are authoritative and may differ across games or locations.", LOTTERY_SOURCE, ["verification"]],
    ["hard", "What is expected value?", "A probability-weighted average outcome over many repetitions", ["The largest possible prize", "A guarantee for one ticket", "The most common recent number"], "Expected value describes a long-run mathematical average, not what one play must return.", LOTTERY_SOURCE, ["probability", "math"]],
    ["easy", "What should a player do after deciding a play budget is spent?", "Stop for that planned period", ["Double the next purchase", "Borrow against a future prize", "Keep playing until a win"], "A limit works only when it remains the stopping point.", LOTTERY_SOURCE, ["responsible-play"]],
    ["medium", "Which statement about quick-pick and self-chosen valid combinations is mathematically sound in a fair draw?", "A specific valid combination has the same chance either way", ["Quick-pick numbers are always luckier", "Birthdays increase jackpot odds", "Self-chosen numbers cannot repeat"], "The selection method does not change the drawing probability of a particular valid combination.", LOTTERY_SOURCE, ["probability"]],
  ],
  "numbers-numerology": [
    ["easy", "Which number is the only even prime?", "2", ["1", "4", "6"], "A prime has exactly two positive divisors; 2 is divisible only by 1 and 2."],
    ["easy", "What is the next number in 1, 1, 2, 3, 5?", "8", ["6", "7", "10"], "Each Fibonacci term is the sum of the two preceding terms."],
    ["easy", "What is the digital root of 29?", "2", ["9", "11", "29"], "Add 2 and 9 to get 11, then add 1 and 1 to get 2."],
    ["medium", "Which number is a perfect square?", "81", ["72", "84", "90"], "81 equals 9 multiplied by 9."],
    ["easy", "What does the Roman numeral X represent?", "10", ["5", "50", "100"], "In Roman numerals, X represents ten."],
    ["medium", "Which fraction is equal to 0.25?", "1/4", ["1/3", "2/5", "3/8"], "One divided by four is twenty-five hundredths."],
    ["hard", "What is 5 factorial, written 5!?", "120", ["25", "60", "125"], "5! is 5 x 4 x 3 x 2 x 1, which equals 120."],
    ["medium", "Which integer is both triangular and square?", "36", ["18", "27", "45"], "36 is 6 squared and also the sum of the integers 1 through 8."],
    ["easy", "Which number is a palindrome?", "1221", ["1231", "1201", "1321"], "A palindrome reads the same from left to right and right to left."],
    ["medium", "What is the binary representation of decimal 5?", "101", ["110", "111", "1001"], "Binary 101 represents 4 + 0 + 1."],
    ["hard", "Which value is closest to the golden ratio?", "1.618", ["1.414", "2.718", "3.142"], "The golden ratio phi is approximately 1.618."],
    ["easy", "What is the sum of the interior angles of a triangle?", "180 degrees", ["90 degrees", "270 degrees", "360 degrees"], "In Euclidean geometry, a triangle's interior angles sum to 180 degrees."],
    ["medium", "Which number has exactly three positive divisors?", "49", ["30", "42", "50"], "49 has the divisors 1, 7, and 49 because it is the square of a prime."],
    ["easy", "What is 7 squared?", "49", ["14", "42", "56"], "Seven squared means 7 multiplied by 7."],
    ["hard", "What is the least common multiple of 6 and 8?", "24", ["12", "36", "48"], "24 is the smallest positive number divisible by both 6 and 8."],
    ["medium", "Which statement describes an irrational number?", "It cannot be written as a ratio of two integers", ["It is always negative", "It has no decimal digits", "It must be a whole number"], "Irrational numbers have nonterminating, nonrepeating decimal expansions."],
    ["easy", "What is the place value of 7 in 4,732?", "700", ["7", "70", "7,000"], "The 7 appears in the hundreds place."],
    ["medium", "Which number is divisible by 9?", "729", ["721", "734", "742"], "The digits of 729 sum to 18, which is divisible by 9."],
    ["hard", "What is the remainder when 100 is divided by 9?", "1", ["0", "8", "9"], "Nine times eleven is 99, leaving a remainder of 1."],
    ["easy", "Which symbol represents pi?", "π", ["Σ", "√", "∞"], "The Greek letter pi denotes the ratio of a circle's circumference to its diameter."],
    ["medium", "What is the median of 3, 5, 8, 12, 20?", "8", ["5", "9.6", "12"], "The median is the middle value after the set is ordered."],
    ["easy", "What can numerology responsibly be described as?", "A cultural or symbolic practice, not a proven prediction method", ["A guaranteed forecasting science", "A replacement for probability", "An audited lottery system"], "People use numerology symbolically, but it does not scientifically predict random lottery outcomes."],
  ],
  "ufo-unexplained": [
    ["easy", "What does UAP stand for in current scientific and government usage?", "Unidentified Anomalous Phenomena", ["Universal Astronaut Program", "Unverified Alien Proof", "Upper Atmospheric Prediction"], "UAP is a neutral term for observations not yet identified.", NASA_SOURCE, ["uap", "terminology"]],
    ["easy", "Does the word unidentified mean extraterrestrial?", "No, it means the observation has not yet been resolved", ["Yes, in every official report", "Only when radar is involved", "Only at night"], "An unresolved observation is not evidence of a particular origin.", NASA_SOURCE, ["scientific-method"]],
    ["medium", "What did NASA identify as a major obstacle to studying UAP?", "Limited high-quality, standardized observations", ["Too many verified alien samples", "A ban on atmospheric data", "The absence of any sensors"], "Better calibrated data and consistent reporting improve scientific analysis.", NASA_SOURCE, ["data-quality"]],
    ["medium", "What is AARO designed to analyze?", "Anomalous reports across multiple domains", ["Only telescope discoveries", "Movie special effects", "Commercial airline schedules"], "AARO is the U.S. office focused on resolving anomalous reports across domains.", AARO_SOURCE, ["aaro"]],
    ["easy", "Which ordinary effect can make a distant light appear to move unexpectedly?", "Parallax from the observer's motion", ["A guaranteed warp drive", "A calendar error", "A musical echo"], "Relative motion between an observer and a distant object can create apparent movement.", NASA_SOURCE, ["observation"]],
    ["medium", "Why are multiple independent sensor types useful in an investigation?", "They can cross-check one observation from different measurements", ["They guarantee an exotic answer", "They remove the need for timestamps", "They make witness accounts identical"], "Corroborating calibrated sensors can reduce ambiguity and measurement error.", NASA_SOURCE, ["data-quality"]],
    ["hard", "What is a technosignature?", "Observable evidence that could indicate technology", ["Any unexplained shadow", "A fossil from any organism", "A weather radar warning"], "Researchers use technosignature for potentially detectable signs of technology, which still require careful validation.", NASA_SOURCE, ["astrobiology"]],
    ["medium", "What is a biosignature?", "A feature that may provide evidence of life", ["A pilot's signature", "A satellite serial number", "A guaranteed alien transmission"], "A biosignature is a measurable feature potentially associated with life and must be evaluated against nonliving explanations.", NASA_SOURCE, ["astrobiology"]],
    ["easy", "What is the best label for a dramatic story without verifiable evidence?", "An unverified claim", ["A confirmed scientific finding", "A completed identification", "An official measurement"], "Clear labels separate reports and folklore from documented findings.", NASA_SOURCE, ["media-literacy"]],
    ["medium", "What can atmospheric refraction do to a light source?", "Shift or distort its apparent position", ["Prove it is a spacecraft", "Stop all radio signals", "Create a physical crater"], "Layers of air can bend light and alter how distant objects appear.", NASA_SOURCE, ["atmosphere"]],
    ["hard", "Why does a sensor artifact matter in UAP analysis?", "It can create a feature that is not present in the scene", ["It always reveals hidden propulsion", "It identifies the pilot", "It changes the weather"], "Glare, compression, calibration, and processing can affect recorded imagery.", NASA_SOURCE, ["sensors"]],
    ["easy", "Which approach is most scientific when an observation remains unresolved?", "Keep the conclusion open while seeking better evidence", ["Choose the most exciting explanation", "Delete conflicting measurements", "Treat repetition online as proof"], "Uncertainty is a valid outcome when evidence is insufficient.", NASA_SOURCE, ["scientific-method"]],
    ["medium", "What is the Fermi paradox about?", "The contrast between possible cosmic life and the lack of confirmed contact", ["The shape of lunar craters", "The speed of weather balloons", "The design of a radio antenna"], "The Fermi paradox frames the gap between estimates of potential civilizations and confirmed evidence of them.", NASA_SOURCE, ["astrobiology"]],
    ["hard", "What does the Drake equation estimate conceptually?", "Factors affecting the number of communicative civilizations", ["The orbit of one UAP", "The winning numbers of a drawing", "The age of every star exactly"], "The Drake equation organizes uncertain factors; it does not supply a confirmed count.", NASA_SOURCE, ["astrobiology"]],
    ["easy", "Why should a star or planet app be checked during a night-sky report?", "Bright celestial objects can be misidentified", ["Apps control the objects", "Planets move randomly each minute", "Stars produce radar tracks"], "Known positions of Venus, Jupiter, stars, and satellites can help test ordinary explanations.", NASA_SOURCE, ["observation"]],
    ["medium", "What does triangulation use?", "Observations from separated locations to estimate position", ["One cropped image only", "A popularity vote", "A color filter without timing"], "Multiple known viewpoints can constrain distance and location.", NASA_SOURCE, ["measurement"]],
    ["hard", "Why is metadata important for an unexplained video?", "It can preserve time, location, device, and capture details", ["It adds a fictional story", "It guarantees authenticity", "It replaces the original recording"], "Contextual metadata helps analysts reconstruct what a sensor recorded and when.", NASA_SOURCE, ["data-quality"]],
    ["easy", "Which statement about eyewitnesses is fair?", "Reports can be sincere while perception remains imperfect", ["Every witness is dishonest", "Every report is physically exact", "Memory cannot change"], "Human observation is valuable context but can be affected by distance, lighting, expectation, and memory.", NASA_SOURCE, ["observation"]],
    ["medium", "What is SETI primarily searching for?", "Potential evidence of technology beyond Earth", ["Lottery patterns", "Weather forecasts only", "Lost terrestrial aircraft"], "SETI programs examine possible technosignatures while applying verification standards.", NASA_SOURCE, ["seti"]],
    ["easy", "What is folklore?", "Traditional stories and beliefs shared by a culture", ["A calibrated sensor record", "A peer-reviewed measurement", "An official flight plan"], "Folklore can be culturally meaningful without being treated as verified physical evidence.", NASA_SOURCE, ["folklore"]],
    ["medium", "Why is a chain of custody useful for physical evidence?", "It documents who handled it and how it was preserved", ["It makes every claim true", "It removes the need for testing", "It changes the sample's origin"], "Documented handling helps analysts assess contamination and authenticity.", NASA_SOURCE, ["evidence"]],
    ["hard", "What conclusion follows when available data support several explanations equally well?", "The case remains underdetermined", ["The rarest explanation wins", "All explanations are confirmed", "The first report becomes proof"], "When evidence cannot discriminate among hypotheses, a responsible conclusion preserves uncertainty.", NASA_SOURCE, ["scientific-method"]],
  ],
  "detroit-history-culture": [
    ["easy", "In what year was Detroit founded as a French settlement?", "1701", ["1776", "1812", "1903"], "Antoine de la Mothe Cadillac established Fort Pontchartrain du Detroit in 1701.", DETROIT_SOURCE, ["founding"]],
    ["easy", "What does the French word detroit mean?", "Strait", ["River city", "Motor", "Fortress"], "Detroit takes its name from the French word for a strait, referring to the narrow waterway.", DETROIT_SOURCE, ["language"]],
    ["easy", "Which river separates Detroit from Windsor, Ontario?", "Detroit River", ["Hudson River", "Ohio River", "Mississippi River"], "The Detroit River links Lake St. Clair and Lake Erie and forms part of the international border.", DETROIT_SOURCE, ["geography"]],
    ["medium", "Which music company did Berry Gordy found in Detroit in 1959?", "Motown Records", ["Sun Records", "Stax Records", "Chess Records"], "Berry Gordy founded Motown in Detroit and built its early studio at Hitsville U.S.A.", MOTOWN_SOURCE, ["motown"]],
    ["easy", "What is the nickname of Motown's original headquarters on West Grand Boulevard?", "Hitsville U.S.A.", ["Music Row North", "Studio 313", "Motor Sound Hall"], "The two-story house that became Motown's early headquarters is known as Hitsville U.S.A.", MOTOWN_SOURCE, ["motown"]],
    ["medium", "Which industry gave Detroit the nickname Motor City?", "Automobile manufacturing", ["Shipbuilding only", "Film production", "Gold mining"], "Detroit became globally associated with automobile production and its industrial workforce.", DETROIT_SOURCE, ["industry"]],
    ["medium", "Which island park sits in the Detroit River?", "Belle Isle", ["Mackinac Island", "Coney Island", "Navy Pier"], "Belle Isle is a public island park between Detroit and Windsor.", DETROIT_SOURCE, ["places"]],
    ["easy", "What is Detroit's best-known telephone area code?", "313", ["212", "404", "702"], "The 313 area code is strongly associated with Detroit and nearby communities.", DETROIT_SOURCE, ["313"]],
    ["medium", "Which market district is known for sheds, vendors, and murals?", "Eastern Market", ["Pike Place", "Chelsea Market", "French Market"], "Eastern Market is a long-running Detroit food district and public market.", DETROIT_SOURCE, ["places"]],
    ["hard", "Which artists created the Detroit Industry Murals at the Detroit Institute of Arts?", "Diego Rivera", ["Andy Warhol", "Georgia O'Keeffe", "Jean-Michel Basquiat"], "Diego Rivera painted the Detroit Industry fresco cycle in the 1930s.", DETROIT_SOURCE, ["art"]],
    ["easy", "Which country is directly across the Detroit River from downtown Detroit?", "Canada", ["Mexico", "France", "Cuba"], "Windsor, Ontario, Canada is directly across the river from Detroit.", DETROIT_SOURCE, ["geography"]],
    ["medium", "What structure connects Detroit and Windsor by road?", "Ambassador Bridge", ["Brooklyn Bridge", "Golden Gate Bridge", "Mackinac Bridge"], "The Ambassador Bridge spans the Detroit River between the United States and Canada.", DETROIT_SOURCE, ["architecture"]],
    ["medium", "Which Detroit neighborhood is widely recognized as the city's oldest surviving neighborhood?", "Corktown", ["Greektown", "Midtown", "Palmer Woods"], "Corktown traces its name to Irish immigrants from County Cork and is Detroit's oldest surviving neighborhood.", DETROIT_SOURCE, ["neighborhoods"]],
    ["easy", "Which downtown monument shows a seated figure holding a sphere and a family group?", "The Spirit of Detroit", ["Gateway Arch", "Cloud Gate", "Liberty Bell"], "Marshall Fredericks created The Spirit of Detroit, installed at the City-County Building.", DETROIT_SOURCE, ["public-art"]],
    ["medium", "Which electronic music genre was pioneered by Detroit artists in the 1980s?", "Techno", ["Bluegrass", "Salsa", "Reggae"], "Detroit techno emerged through artists including Juan Atkins, Derrick May, and Kevin Saunderson.", DETROIT_SOURCE, ["music", "techno"]],
    ["hard", "What nickname is given to techno pioneers Juan Atkins, Derrick May, and Kevin Saunderson?", "The Belleville Three", ["The Funk Brothers", "The Wrecking Crew", "The Highwaymen"], "The three school friends became foundational figures in Detroit techno.", DETROIT_SOURCE, ["music", "techno"]],
    ["easy", "Which major museum stands on Woodward Avenue in Midtown?", "Detroit Institute of Arts", ["The Getty", "The Met Cloisters", "Whitney Museum"], "The Detroit Institute of Arts houses a broad collection and the Detroit Industry Murals.", DETROIT_SOURCE, ["art"]],
    ["medium", "Which historic Detroit theater is known for an ornate interior and large marquee?", "Fox Theatre", ["Apollo Theater", "Ryman Auditorium", "Radio City only"], "Detroit's Fox Theatre opened in 1928 and remains a major performance venue.", DETROIT_SOURCE, ["architecture", "performance"]],
    ["hard", "Which boxer is commemorated by a giant fist sculpture near downtown Detroit?", "Joe Louis", ["Sugar Ray Leonard", "Muhammad Ali", "Jack Johnson"], "The Monument to Joe Louis honors the Detroit-associated heavyweight champion.", DETROIT_SOURCE, ["sports", "public-art"]],
    ["easy", "What major road is often called Detroit's main street?", "Woodward Avenue", ["Broadway", "Sunset Boulevard", "Lombard Street"], "Woodward Avenue runs from downtown through the region and is central to Detroit history.", DETROIT_SOURCE, ["places"]],
    ["medium", "What architectural complex of cylindrical towers is prominent on Detroit's riverfront skyline?", "Renaissance Center", ["Sears Tower", "Fisherman's Wharf", "Space Needle"], "The Renaissance Center is a group of high-rise towers on the Detroit riverfront.", DETROIT_SOURCE, ["architecture"]],
    ["hard", "Before European settlement, who lived in the region that became Detroit?", "Indigenous peoples including Anishinaabe communities", ["Only French soldiers", "No permanent communities", "Roman settlers"], "Indigenous nations lived and traveled in the Great Lakes region long before 1701.", DETROIT_SOURCE, ["indigenous-history"]],
  ],
  "music-pop-culture": [
    ["easy", "What does BPM measure in music?", "Beats per minute", ["Bass pitch mode", "Bars per melody", "Balance per microphone"], "BPM is a common measure of musical tempo."],
    ["easy", "What is a chorus?", "A recurring song section", ["A microphone cable", "A file format", "A tuning peg"], "The chorus typically returns with the song's central hook or refrain."],
    ["medium", "What is syncopation?", "Emphasis on unexpected or off-beat rhythms", ["Removing every drum", "Singing without pitch", "Playing one note forever"], "Syncopation shifts accents away from the most expected beats."],
    ["easy", "What does MIDI primarily transmit?", "Musical performance instructions", ["Finished analog sound only", "Printed sheet music", "Lighting power"], "MIDI carries note, timing, velocity, and control data rather than recorded audio."],
    ["medium", "What is a stem in music production?", "A grouped audio part such as vocals or drums", ["A copyright notice", "A concert ticket", "A speaker stand"], "Stems let producers balance or process major elements of a mix separately."],
    ["easy", "What does EQ adjust?", "Frequency balance", ["Song ownership", "Video frame rate", "Ticket numbers"], "Equalization boosts or cuts frequency ranges."],
    ["medium", "What does reverb simulate?", "Reflections of sound in a space", ["A faster tempo", "A reversed lyric", "A silent channel"], "Reverb models the persistence and reflections of sound after the source."],
    ["easy", "What does panning control?", "A sound's left-right position", ["Its copyright date", "Its file name", "Its song key only"], "Stereo panning places a signal between left and right channels."],
    ["hard", "What is headroom in a digital mix?", "Level space before clipping", ["The room above a stage", "A headphone brand", "The highest lyric"], "Headroom helps peaks remain below the clipping limit."],
    ["medium", "What is sampling?", "Using a recorded sound as material in a new production", ["Counting audience seats", "Tuning every instrument to C", "Printing album covers"], "A sample is a portion of recorded audio used creatively, subject to applicable rights."],
    ["easy", "Which device converts acoustic sound into an electrical signal?", "Microphone", ["Metronome", "Music stand", "Turntable mat"], "A microphone transduces sound pressure into an electrical signal."],
    ["medium", "What is a bridge in a song?", "A contrasting section connecting major sections", ["A type of speaker cone", "The first beat only", "A backup file"], "A bridge introduces contrast before returning to familiar material."],
    ["easy", "What does a metronome provide?", "A steady timing reference", ["Automatic lyrics", "A final master", "Audience applause"], "A metronome marks a regular pulse at a selected tempo."],
    ["hard", "What does audio compression primarily manage?", "Dynamic range", ["Album artwork", "Song title length", "Stereo cable color"], "Compression reduces the level difference between louder and quieter signal portions."],
    ["medium", "What is a DAW?", "Digital audio workstation", ["Direct acoustic waveform", "Dynamic artist website", "Drum alignment wheel"], "A DAW records, edits, arranges, and mixes digital audio and MIDI."],
    ["easy", "Which Detroit label became known for the Motown sound?", "Motown Records", ["Sun Records", "Blue Note only", "Sub Pop"], "Motown developed a globally influential pop and soul sound from Detroit.", MOTOWN_SOURCE, ["detroit", "motown"]],
    ["medium", "Which genre is closely associated with Detroit's Belleville Three?", "Techno", ["Bebop", "Bluegrass", "Flamenco"], "Juan Atkins, Derrick May, and Kevin Saunderson are foundational Detroit techno artists.", DETROIT_SOURCE, ["detroit", "techno"]],
    ["easy", "What is a waveform?", "A visual representation of signal amplitude over time", ["A list of concert dates", "A type of stage light", "A chord name"], "Waveforms help editors see the changing amplitude of recorded sound."],
    ["hard", "What is latency in a music system?", "Delay between an action and its audible result", ["The loudest frequency", "The key signature", "The album release year"], "Audio systems aim to keep monitoring latency low enough for comfortable performance."],
    ["medium", "What does mastering prepare?", "A final mix for distribution formats", ["A rough lyric draft", "A venue seating chart", "A musician's tax return"], "Mastering balances and formats the final program for release while preserving musical intent."],
    ["easy", "What does a mute control do?", "Silences a selected signal", ["Raises its pitch", "Deletes the file", "Adds a harmony"], "Mute temporarily removes a channel or output from the audible mix."],
    ["medium", "Why should a web music experience wait for a user gesture before sound?", "Browsers protect users from unexpected audio", ["Audio cannot play online", "Music changes the page URL", "Speakers require a lottery ticket"], "User-initiated audio respects browser policies and gives visitors control."],
  ],
  "lottomind-universe": [
    ["easy", "What is LOTTOMINDED ULTRA positioned as?", "The parent creative entertainment platform", ["A lottery operator", "A bank", "A guaranteed prediction service"], "LOTTOMINDED ULTRA connects the App, Arcade, News, Storefront, Guardian, and Membership routes."],
    ["easy", "What should LottoMind number generators be treated as?", "Entertainment-only creative tools", ["Guaranteed winning systems", "Official lottery terminals", "Financial advice"], "Generated sets organize creative signals and do not predict outcomes."],
    ["medium", "What is the Guardian in the LottoMind universe?", "A collectible character and visual guide", ["A government regulator", "A cash-value token", "A draw machine"], "The Guardian carries the platform's Detroit-inspired collectible identity."],
    ["easy", "Do LottoCredits have cash value?", "No", ["Yes, one dollar each", "Only on weekends", "Only after a jackpot"], "LottoCredits are entertainment account credits and are not money or lottery tickets."],
    ["medium", "Which route gathers browser games into one directory?", "The Arcade", ["Privacy", "Contact", "Terms"], "The Arcade presents playable game and creative-tool routes from one directory."],
    ["easy", "Which LottoMind page carries current reporting and source links?", "News", ["Memberships", "Account", "Accessibility"], "The News route organizes source-linked reporting and clearly labels speculative content."],
    ["medium", "What is Static Wav in the current navigation?", "A playable signal route", ["A payment processor", "A legal policy", "A verified lottery draw"], "Static Wav is an arcade-style game experience within LottoMind."],
    ["easy", "Who is Robot RAHBEE?", "A LottoMind arcade character and game route", ["A live lottery official", "A payment provider", "A news agency"], "Robot RAHBEE belongs to the original LottoMind arcade world."],
    ["medium", "What should happen before optional site audio begins?", "The visitor makes a clear gesture", ["The page forces maximum volume", "A credit is deducted", "An account password is requested"], "Sound starts from a user action so visitors remain in control."],
    ["easy", "What does the LottoMind App help organize?", "Ideas, number sets, notes, and creative signals", ["Guaranteed jackpots", "Bank transfers", "Official draw equipment"], "The App is a creative and organizational route, not a prediction service."],
    ["medium", "What does Collector Access connect?", "An authenticated account with eligible collectible benefits", ["Anonymous users to cash payouts", "News stories to betting slips", "Music tempo to jackpot odds"], "Collector Access uses the existing account boundary for eligible benefits and protected actions."],
    ["easy", "What does the Storefront present?", "LottoMind merchandise and collectible concepts", ["Official winning tickets", "Bank accounts", "Unverified rankings"], "The Storefront carries apparel, Guardian items, and art within the platform identity."],
    ["medium", "What is the safest staging behavior for account writes?", "Disable them unless an isolated staging backend is configured", ["Write to production silently", "Pretend each write succeeded", "Store passwords in the page"], "Preview builds default to read-only safety unless isolated services are explicitly verified."],
    ["easy", "What does the Search control do?", "Opens keyboard-accessible route search", ["Predicts numbers", "Starts checkout", "Redeems a collectible"], "The shared search helps visitors find platform routes and supports Ctrl or Command plus K."],
    ["medium", "What does the music-technology console represent?", "A local interactive creative instrument", ["A credit ledger", "A guaranteed odds engine", "A payment receipt"], "The console reinforces LottoMind's music-tech personality through local browser interaction."],
    ["easy", "Which principle belongs on every number game route?", "Play for entertainment, not a promise", ["Winning is guaranteed", "Past draws predict future draws", "Credits are cash"], "Responsible language keeps creative play separate from outcome claims."],
    ["medium", "What is the role of the staging banner?", "Clearly identify a preview as not production", ["Advertise a jackpot", "Hide test limitations", "Enable live payments"], "The banner keeps reviewers aware that staging integrations and write actions are restricted."],
    ["easy", "Which color group is central to LottoMind's current visual language?", "Black, gold, cyan, and violet", ["Beige only", "Red and white only", "Pastel green only"], "The palette combines Detroit night energy, gold signal accents, cyan light, and violet arcade color."],
    ["medium", "Why does Trivia Vault keep credit rewards behind a secure feature flag?", "The browser cannot authoritatively award shared credits", ["Scores cannot be calculated", "Questions cannot be displayed", "Keyboard input is unsafe"], "A verified server session must calculate and issue any real account reward."],
    ["easy", "What does the Free Credits control represent in a staging preview?", "An interface route whose production mutations remain guarded", ["A promise of cash", "A secret admin key", "An automatic live redemption"], "Staging can preserve the interface while blocking production data mutations."],
    ["medium", "What should a LottoMind share card avoid revealing?", "Daily Vault answers", ["The game title", "A player's score", "The platform name"], "Daily challenge answers remain hidden so the shared challenge stays fair."],
    ["hard", "What makes the Trivia Vault daily mode credit-eligible in the future?", "A server-created session with verified answers and idempotent reward handling", ["A localStorage balance", "A client-submitted final score alone", "A screenshot of the results"], "Authoritative sessions, answer validation, daily caps, and ledger writes are required before credits can be enabled."],
  ],
  "mystery-mix": [
    ["easy", "Which planet is known for its prominent ring system?", "Saturn", ["Mercury", "Venus", "Mars"], "All four giant planets have rings, but Saturn's are the most prominent in visible light.", NASA_SOURCE, ["space"]],
    ["easy", "What is the largest ocean on Earth?", "Pacific Ocean", ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean"], "The Pacific covers more area than any other ocean basin."],
    ["medium", "Which logical statement must be true if all A are B and all B are C?", "All A are C", ["All C are A", "No A are C", "Some B are not C"], "Class inclusion is transitive from A through B to C."],
    ["easy", "What gas do plants absorb during photosynthesis?", "Carbon dioxide", ["Helium", "Neon", "Argon"], "Plants use carbon dioxide, water, and light energy to build sugars."],
    ["medium", "Which instrument measures atmospheric pressure?", "Barometer", ["Thermometer", "Metronome", "Altimeter only"], "A barometer measures air pressure."],
    ["hard", "What does Occam's razor recommend when explanations fit the evidence equally well?", "Prefer the one with fewer unsupported assumptions", ["Choose the strangest one", "Accept every explanation", "Ignore all evidence"], "Occam's razor is a reasoning heuristic, not proof that the simplest idea is always true."],
    ["easy", "Which shape has eight sides?", "Octagon", ["Hexagon", "Pentagon", "Heptagon"], "The prefix octa refers to eight."],
    ["medium", "What is the freezing point of pure water at standard pressure in Celsius?", "0°C", ["10°C", "32°C", "100°C"], "On the Celsius scale, pure water freezes at approximately zero degrees under standard pressure."],
    ["easy", "Which direction does a compass needle generally indicate?", "Magnetic north", ["True east", "The nearest city", "The Moon"], "A compass aligns with Earth's local magnetic field."],
    ["hard", "What is confirmation bias?", "Favoring information that supports an existing belief", ["Measuring twice", "Changing a hypothesis after new evidence", "Using multiple sources"], "Confirmation bias can shape which evidence people notice, remember, or seek."],
    ["medium", "Which layer of Earth is liquid and helps generate the magnetic field?", "Outer core", ["Inner core", "Crust", "Upper mantle only"], "Motion of electrically conducting liquid iron in the outer core drives the geodynamo."],
    ["easy", "What is a palindrome word?", "A word that reads the same forward and backward", ["A word with three syllables", "A word borrowed from French", "A word with no vowels"], "Level and civic are examples of word palindromes."],
    ["medium", "Which clue best distinguishes a correlation from causation?", "Two variables moving together does not prove one caused the other", ["Correlation always proves a mechanism", "Causation needs no evidence", "Random samples remove every bias"], "A causal claim needs evidence beyond an observed association."],
    ["hard", "What is the name for an apparent pattern perceived in unrelated random data?", "Apophenia", ["Refraction", "Osmosis", "Resonance"], "Apophenia describes perceiving meaningful connections where none are established."],
    ["easy", "Which color results from combining blue and red light?", "Magenta", ["Green", "Yellow", "Black"], "In additive color mixing, red and blue light combine as magenta."],
    ["medium", "What is an eclipse?", "One celestial body moves into another's shadow or blocks it from view", ["A planet stops rotating", "A star changes its name", "A comet becomes a moon"], "Solar and lunar eclipses result from particular alignments of the Sun, Earth, and Moon.", NASA_SOURCE, ["space"]],
    ["easy", "Which material is attracted strongly by a typical magnet?", "Iron", ["Glass", "Dry wood", "Paper"], "Iron is ferromagnetic and responds strongly to magnetic fields."],
    ["hard", "What does falsifiable mean in science?", "A claim could in principle be tested and shown false", ["A claim is automatically false", "A claim requires no measurement", "A claim is popular online"], "Falsifiability makes it possible for evidence to challenge a scientific claim."],
    ["medium", "Which map line marks zero degrees longitude?", "Prime Meridian", ["Equator", "Tropic of Cancer", "International Date Line only"], "The Prime Meridian is the reference line for longitude."],
    ["easy", "What is the main purpose of a control group in an experiment?", "Provide a comparison for the tested condition", ["Guarantee the preferred outcome", "Hide the measurements", "Increase every result"], "A control helps isolate the effect of the variable being tested."],
    ["medium", "What is a primary source in historical research?", "Evidence created during the time being studied", ["Any modern summary", "A fictional retelling", "An unsourced repost"], "Letters, records, photographs, and artifacts from the period can serve as primary sources."],
    ["hard", "What should happen when strong new evidence contradicts a working explanation?", "Revise or replace the explanation", ["Discard the new evidence automatically", "Keep the claim unchanged", "Stop collecting data"], "Evidence-based inquiry updates conclusions when better information arrives."],
  ],
});

function normalizeSource(source) {
  return source || Object.freeze({ name: "LottoMind editorial review", url: "../../how-to-use.html" });
}

function buildQuestion(category, entry, categoryIndex, questionIndex) {
  const [difficulty, question, answer, distractors, explanation, sourceValue, tags = []] = entry;
  const correctChoiceIndex = ((categoryIndex * 22) + questionIndex) % 4;
  const choices = distractors.slice();
  choices.splice(correctChoiceIndex, 0, answer);
  const source = normalizeSource(sourceValue);
  return Object.freeze({
    id: `${category}-${String(questionIndex + 1).padStart(2, "0")}`,
    category,
    categoryLabel: CATEGORY_LABELS[category],
    difficulty,
    question,
    choices: Object.freeze(choices),
    correctChoiceIndex,
    explanation,
    sourceName: source.name,
    sourceUrl: source.url,
    reviewedAt: TRIVIA_CONFIG.reviewedAt,
    reviewStatus: "approved",
    active: true,
    tags: Object.freeze(tags),
    version: 1,
  });
}

export const QUESTIONS = Object.freeze(Object.entries(banks).flatMap(([category, entries], categoryIndex) =>
  entries.map((entry, questionIndex) => buildQuestion(category, entry, categoryIndex, questionIndex))
));

export function publicQuestions() {
  return QUESTIONS.filter((question) => question.active && question.reviewStatus === "approved");
}
