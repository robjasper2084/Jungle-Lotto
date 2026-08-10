import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REVIEW_DATE = "2026-08-05";
const sources = {
  powerball: ["Powerball and official lottery education", "https://www.powerball.com/"],
  mega: ["Mega Millions", "https://www.megamillions.com/"],
  michiganLottery: ["Michigan Lottery", "https://www.michiganlottery.com/resources/responsible-gaming"],
  ncpg: ["National Council on Problem Gambling", "https://www.ncpgambling.org/help-treatment/about-the-national-problem-gambling-helpline/"],
  mathworld: ["Wolfram MathWorld", "https://mathworld.wolfram.com/"],
  nasaUap: ["NASA UAP Independent Study", "https://science.nasa.gov/uap/"],
  archivesUap: ["U.S. National Archives UAP Records", "https://www.archives.gov/research/topics/uaps"],
  airForce: ["National Museum of the U.S. Air Force", "https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/196709/project-blue-book/"],
  detroitHistory: ["Encyclopedia of Detroit", "https://detroithistorical.org/learn/encyclopedia-of-detroit"],
  motown: ["Motown Museum", "https://www.motownmuseum.org/"],
  dia: ["Detroit Institute of Arts", "https://dia.org/"],
  detroit: ["City of Detroit", "https://detroitmi.gov/"],
  locMusic: ["Library of Congress National Recording Registry", "https://www.loc.gov/programs/national-recording-preservation-board/recording-registry/"],
  smithsonianMusic: ["Smithsonian Music", "https://music.si.edu/"],
  nasa: ["NASA Science", "https://science.nasa.gov/"],
  noaa: ["NOAA Ocean Exploration", "https://oceanexplorer.noaa.gov/"],
  nps: ["National Park Service", "https://www.nps.gov/"],
  smithsonian: ["Smithsonian Institution", "https://www.si.edu/"],
  loc: ["Library of Congress", "https://www.loc.gov/"],
  internal: ["LottoMind product guide", ""],
};

const q = (question, correct, wrong, explanation, source = sources.internal, tags = []) => ({ question, correct, wrong, explanation, source, tags });

const categoryData = {
  "lottery-knowledge": [
    q("What does a lottery jackpot advertise before a drawing?", "The top prize available under the game's rules", ["A guaranteed payment to every ticket", "The number most likely to be drawn", "A prediction from the retailer"], "A jackpot is the advertised top prize, not a promise that any particular ticket will win.", sources.powerball, ["responsible-play"]),
    q("Which statement best describes lottery drawings?", "Each drawing is a random event under the game's procedures", ["Past numbers force future numbers", "A long gap guarantees a number", "Buying at a lucky hour changes the machine"], "Past outcomes do not force future independent random outcomes.", sources.michiganLottery, ["randomness"]),
    q("Why should players check an official lottery source after a drawing?", "To verify results and claim instructions", ["To improve the printed ticket", "To make a near miss count", "To change the draw order"], "Only official operators and authorized retailers can verify results and claims.", sources.michiganLottery, ["verification"]),
    q("What is a lottery ticket's barcode primarily used for?", "Identifying and validating the ticket in an authorized system", ["Predicting the next numbers", "Displaying a player's credit score", "Changing the ticket after purchase"], "Barcodes support ticket identification and validation; they do not predict results.", sources.michiganLottery, ["tickets"]),
    q("In a draw game, what does 'quick pick' usually mean?", "Numbers selected automatically by the lottery terminal", ["Numbers chosen by the cashier from memory", "The most frequently drawn numbers", "A ticket that skips verification"], "A quick pick is an automated number selection, not a forecast.", sources.powerball, ["terms"]),
    q("What is the safest way to set a lottery spending limit?", "Choose an affordable amount before playing and stop at it", ["Increase it after every loss", "Borrow to keep a streak alive", "Use winnings that have not occurred"], "A pre-set affordable limit supports responsible play.", sources.ncpg, ["responsible-play"]),
    q("What does 'odds' express in a lottery game?", "The mathematical likelihood of a defined outcome", ["The order in which tickets print", "A promise that someone nearby wins", "A schedule for number repeats"], "Odds quantify likelihood; they do not guarantee an individual result.", sources.powerball, ["odds"]),
    q("Why is a near miss not the same as a win?", "Prizes depend on exact published match rules", ["Near misses are paid one week later", "Retailers may convert them manually", "The next drawing completes the match"], "A ticket earns only the prize defined by the official rules for its exact match.", sources.michiganLottery, ["verification"]),
    q("What should a player do with a signed winning ticket?", "Protect it and follow the official claim process", ["Post every identifying detail online", "Alter the printed numbers", "Mail it to an unknown tip account"], "Official claim guidance explains how to safeguard and submit a ticket.", sources.michiganLottery, ["claims"]),
    q("What is a lottery drawing matrix?", "The set of number fields and selections used by a game", ["A map of winning retailers", "A player's personal budget", "A guarantee table"], "The matrix defines how many numbers are selected and from what ranges.", sources.powerball, ["terms"]),
    q("If a game uses five main numbers plus one separate ball, what is the separate ball?", "A distinct selection drawn from its own field", ["A replacement for any main number", "Always the largest number", "A free ticket code"], "Games with a separate ball treat it as a distinct part of the match rules.", sources.powerball, ["game-structure"]),
    q("What happens to the probability of matching all numbers when a number field grows?", "It generally becomes harder if the number of picks stays the same", ["It always becomes easier", "It becomes exactly fifty percent", "It stops being random"], "More possible combinations generally reduce the chance of matching one exact combination.", sources.mathworld, ["combinations"]),
    q("Which behavior is a warning sign for harmful play?", "Chasing losses with money needed for essentials", ["Checking results once", "Keeping a ticket in a safe place", "Reading the published rules"], "Using essential funds or chasing losses can indicate gambling harm.", sources.ncpg, ["responsible-play"]),
    q("What is the purpose of an official draw audit?", "To document that procedures and controls were followed", ["To select popular numbers", "To create numerology meanings", "To guarantee a jackpot winner"], "Audits and controls support integrity; they do not influence which numbers should win.", sources.michiganLottery, ["integrity"]),
    q("When multiple tickets win the same jackpot, what commonly happens?", "The jackpot prize is divided according to the game's rules", ["The oldest ticket takes all", "The retailer chooses one winner", "Every ticket receives the full jackpot"], "Shared jackpots are allocated under the published prize rules.", sources.powerball, ["prizes"]),
    q("What is the main difference between an annuity and a cash option?", "An annuity pays over time while cash is a current lump-sum option", ["An annuity changes the winning numbers", "Cash is always tax-free", "Only retailers can choose"], "Large prizes may offer payment choices with different timing and values.", sources.powerball, ["prizes"]),
    q("Can a number be 'due' because it has not appeared recently?", "No; a past gap does not force an independent future draw", ["Yes, after exactly ten draws", "Yes, if many players choose it", "Only on weekends"], "The 'due number' idea is a form of gambler's fallacy for independent drawings.", sources.michiganLottery, ["randomness"]),
    q("What should an entertainment-only number tool avoid claiming?", "That its suggestions improve the odds of winning", ["That users can save a list", "That numbers can be sorted", "That results should be verified"], "Creative number tools must not present inspiration as an advantage over random odds.", sources.michiganLottery, ["responsible-play"]),
    q("Why should a ticket be checked before its claim deadline?", "Valid prizes can expire under the game's published rules", ["Numbers change after the deadline", "The barcode becomes a prediction", "Expired tickets enter the next draw"], "Claim periods are defined by the responsible lottery jurisdiction.", sources.michiganLottery, ["claims"]),
    q("What does 'pari-mutuel' describe in some prize structures?", "A prize pool shared among winning tickets", ["A fixed number printed twice", "A guaranteed retailer bonus", "A drawing with no random process"], "Pari-mutuel prizes depend on the pool and number of winning tickets.", sources.michiganLottery, ["prizes"]),
    q("What is the best source for game-specific rules?", "The official lottery operator for that jurisdiction", ["An anonymous prediction post", "A dream dictionary", "A resale listing"], "Official operators publish current rules, odds, deadlines, and claim instructions.", sources.michiganLottery, ["verification"]),
    q("What does responsible lottery play treat ticket cost as?", "Entertainment spending that can be lost", ["A guaranteed investment", "Emergency savings", "A loan repayment method"], "Lottery spending should be affordable entertainment, never relied on for income.", sources.ncpg, ["responsible-play"]),
  ],
  "numbers-numerology": [
    q("What is a prime number?", "A whole number greater than one with exactly two positive divisors", ["Any odd number", "A number divisible by ten", "A negative fraction"], "A prime has only 1 and itself as positive divisors.", sources.mathworld, ["mathematics"]),
    q("Which number is the multiplicative identity?", "1", ["0", "2", "10"], "Multiplying any number by 1 leaves it unchanged.", sources.mathworld, ["mathematics"]),
    q("What is the digital root of 38?", "2", ["3", "8", "11"], "Add 3 + 8 = 11, then 1 + 1 = 2.", sources.mathworld, ["digital-root"]),
    q("Which sequence begins 1, 1, 2, 3, 5, 8?", "The Fibonacci sequence", ["The prime sequence", "The square numbers", "The powers of ten"], "Each Fibonacci term after the first two is the sum of the previous two.", sources.mathworld, ["sequences"]),
    q("What is a palindrome number?", "A number that reads the same forward and backward", ["A number with no digits", "A number always divisible by five", "A number written only in Roman numerals"], "Examples include 121 and 7447.", sources.mathworld, ["patterns"]),
    q("How many degrees are in a full circle?", "360", ["90", "180", "720"], "A full rotation is conventionally divided into 360 degrees.", sources.mathworld, ["geometry"]),
    q("What is 7 squared?", "49", ["14", "21", "56"], "Squaring 7 means multiplying 7 by itself.", sources.mathworld, ["arithmetic"]),
    q("Which number is neither positive nor negative?", "0", ["1", "-1", "10"], "Zero is the boundary between positive and negative numbers.", sources.mathworld, ["mathematics"]),
    q("What does the symbol π represent?", "The ratio of a circle's circumference to its diameter", ["The count of prime numbers", "The square root of ten", "A unit of time"], "Pi is a constant that appears throughout circle geometry.", sources.mathworld, ["geometry"]),
    q("What is the least common multiple of 4 and 6?", "12", ["2", "10", "24"], "12 is the smallest positive number divisible by both 4 and 6.", sources.mathworld, ["arithmetic"]),
    q("In folklore-based numerology, how should a number meaning be presented?", "As a symbolic tradition, not a verified prediction", ["As a guaranteed scientific result", "As legal advice", "As proof of a future lottery outcome"], "Numerology is a symbolic belief practice and should not be confused with empirical prediction.", sources.internal, ["numerology", "safety"]),
    q("What is the Roman numeral for 50?", "L", ["C", "X", "V"], "In the Roman numeral system, L represents 50.", sources.mathworld, ["number-systems"]),
    q("Which fraction equals 0.25?", "1/4", ["1/2", "2/3", "3/4"], "One divided by four equals twenty-five hundredths.", sources.mathworld, ["fractions"]),
    q("What is an even number?", "An integer divisible by 2", ["Any number ending in 5", "A number with three digits", "Only a positive number"], "Even integers have no remainder when divided by 2.", sources.mathworld, ["mathematics"]),
    q("What is the next square number after 36?", "49", ["42", "48", "64"], "36 is 6 squared; the next positive square is 7 squared, or 49.", sources.mathworld, ["sequences"]),
    q("What is the sum of the interior angles of a triangle?", "180 degrees", ["90 degrees", "270 degrees", "360 degrees"], "In Euclidean geometry, a triangle's interior angles total 180 degrees.", sources.mathworld, ["geometry"]),
    q("What does a percentage measure?", "A quantity per hundred", ["A quantity per twelve", "Only a probability above one", "A unit of distance"], "Percent literally describes a ratio out of 100.", sources.mathworld, ["arithmetic"]),
    q("Which operation reverses multiplication?", "Division", ["Addition", "Squaring", "Rounding"], "Division can undo multiplication when the divisor is nonzero.", sources.mathworld, ["arithmetic"]),
    q("What is the binary representation of decimal 2?", "10", ["01", "11", "100"], "Binary 10 equals one group of two and zero ones.", sources.mathworld, ["number-systems"]),
    q("What is the absolute value of -9?", "9", ["-9", "0", "18"], "Absolute value is distance from zero, so it is nonnegative.", sources.mathworld, ["arithmetic"]),
    q("Which is an irrational number?", "The square root of 2", ["1/2", "0.75", "4"], "The square root of 2 cannot be expressed as a ratio of integers.", sources.mathworld, ["mathematics"]),
    q("Why can a visually striking number pattern be misleading in random data?", "Humans naturally notice patterns even when chance produced them", ["Patterns always control the next result", "Random data cannot repeat", "Every pattern is intentionally designed"], "Pattern recognition is useful, but random sequences can contain clusters and repetitions.", sources.internal, ["randomness", "critical-thinking"]),
  ],
  "ufo-unexplained": [
    q("What does UAP stand for in current U.S. government usage?", "Unidentified Anomalous Phenomena", ["Universal Astronomy Program", "United Aircraft Patrol", "Unknown Atmospheric Pressure"], "UAP is the current umbrella term used in official records.", sources.archivesUap, ["terminology"]),
    q("What does 'unidentified' mean in a UAP report?", "The observation has not yet been conclusively identified", ["It proves an alien origin", "It was invisible to all sensors", "It cannot ever be explained"], "Unidentified describes the state of available evidence, not a verified cause.", sources.nasaUap, ["critical-thinking"]),
    q("What is a common challenge when analyzing distant lights in video?", "Limited distance, scale, and motion context", ["Videos automatically contain full radar data", "Every camera has perfect focus", "Pixels reveal the object's owner"], "Without contextual data, apparent speed and size can be difficult to infer.", sources.nasaUap, ["evidence"]),
    q("What was Project Blue Book?", "A U.S. Air Force program that investigated UFO reports", ["NASA's first Moon landing", "A Detroit music label", "A weather satellite"], "Project Blue Book collected and evaluated reported UFO sightings from 1952 to 1969.", sources.airForce, ["history"]),
    q("Which approach best distinguishes a report from a verified conclusion?", "Describe what witnesses reported and separately state what evidence establishes", ["Repeat the most dramatic claim as fact", "Ignore all uncertainty", "Treat popularity as proof"], "Careful wording preserves the difference between testimony and verification.", sources.nasaUap, ["media-literacy"]),
    q("Why can Venus be mistaken for an unusual aerial light?", "It can appear exceptionally bright near the horizon", ["It moves between buildings at street level", "It broadcasts aircraft signals", "It changes into a satellite"], "Bright celestial objects can look unfamiliar without a reference frame.", sources.nasa, ["astronomy"]),
    q("What is parallax?", "An apparent position shift caused by a change in viewpoint", ["A type of engine noise", "A measure of radio volume", "A guaranteed sign of propulsion"], "Parallax can make motion look different when observer and object positions change.", sources.nasa, ["observation"]),
    q("What can weather balloons carry?", "Instruments that measure atmospheric conditions", ["Passengers to the Moon", "Ocean-floor cameras only", "Lottery drawing machines"], "Weather balloons lift instrument packages through the atmosphere.", sources.noaa, ["atmosphere"]),
    q("Why are multiple independent sensors useful for an unusual observation?", "They can provide complementary data and reduce single-sensor ambiguity", ["They guarantee an extraordinary cause", "They remove the need for timestamps", "They make witness accounts unnecessary"], "Correlated observations can improve confidence in position, timing, and motion.", sources.nasaUap, ["evidence"]),
    q("What is a meteor?", "The visible streak produced when a meteoroid enters the atmosphere", ["A permanent artificial satellite", "A cloud that emits radio programs", "A star leaving its galaxy"], "Atmospheric entry heats material and creates a visible trail.", sources.nasa, ["astronomy"]),
    q("Which statement reflects scientific caution?", "Insufficient data means the cause remains unresolved", ["No answer proves the wildest answer", "One blurry image settles the issue", "A famous witness cannot be mistaken"], "Uncertainty is a limit on conclusions, not evidence for a specific extraordinary explanation.", sources.nasaUap, ["scientific-method"]),
    q("What is atmospheric scintillation?", "Apparent twinkling caused by light passing through turbulent air", ["A spacecraft changing color intentionally", "A camera recording sound", "A magnetic compass spinning"], "Turbulent air refracts light and can make stars appear to shimmer.", sources.nasa, ["atmosphere"]),
    q("Why does metadata matter in a photo investigation?", "It can provide time, device, and capture context", ["It always identifies every object", "It changes the pixels into radar", "It guarantees the file is unedited"], "Metadata adds context but still must be authenticated and interpreted carefully.", sources.archivesUap, ["evidence"]),
    q("What is the best label for a story passed through generations without confirming evidence?", "Folklore or legend", ["Scientific consensus", "A controlled experiment", "A legal verdict"], "Folklore can be culturally meaningful without being established as physical fact.", sources.smithsonian, ["folklore"]),
    q("What is satellite flare?", "Sunlight reflecting from a satellite and briefly brightening", ["A star exploding in Earth's atmosphere", "A camera deleting a frame", "Lightning beneath the ocean"], "Reflective surfaces can produce short, bright events in the sky.", sources.nasa, ["astronomy"]),
    q("Why can a zoomed phone video make movement look unstable?", "Hand motion and digital zoom amplify small shifts", ["Digital zoom adds radar tracking", "Phone lenses stop recording perspective", "Unstable video proves high speed"], "Magnification and stabilization artifacts can exaggerate apparent movement.", sources.nasaUap, ["media-literacy"]),
    q("What should a responsible mystery game avoid doing?", "Presenting unverified paranormal claims as established fact", ["Labeling folklore clearly", "Providing source context", "Inviting critical thinking"], "Entertainment can explore mysteries while keeping claims and evidence distinct.", sources.internal, ["safety"]),
    q("What is ball lightning?", "A rare reported luminous atmospheric phenomenon that remains incompletely understood", ["A confirmed alien probe", "A routine form of hail", "A planet visible at noon"], "Reports describe glowing spheres, but the phenomenon is rare and difficult to study.", sources.noaa, ["atmosphere"]),
    q("Which record source preserves many official U.S. UAP-related documents?", "The U.S. National Archives", ["The Patent Office gift shop", "A private horoscope feed", "A music streaming chart"], "The National Archives provides research access to government records on UAP topics.", sources.archivesUap, ["archives"]),
    q("What does corroboration mean?", "Independent evidence supports part of an account", ["A story has many social likes", "A claim uses dramatic language", "The observer repeats the same sentence"], "Corroboration comes from independent sources or evidence, not repetition alone.", sources.nasaUap, ["critical-thinking"]),
    q("Why is a timestamp important in sky observation?", "It helps compare the report with aircraft, satellite, weather, and astronomy data", ["It proves the object was solid", "It predicts another sighting", "It replaces location data"], "Accurate time and place enable meaningful cross-checks.", sources.nasaUap, ["evidence"]),
    q("What conclusion did NASA's independent UAP study emphasize about data?", "Better calibrated, standardized data is needed for stronger analysis", ["Every report has one known cause", "Civilian observations have no value", "No further study is possible"], "NASA emphasized rigorous data collection and scientific analysis rather than extraordinary assumptions.", sources.nasaUap, ["scientific-method"]),
  ],
  "detroit-history-culture": [
    q("Which river separates Detroit from Windsor, Ontario?", "The Detroit River", ["The Hudson River", "The Missouri River", "The Potomac River"], "The Detroit River links Lake St. Clair and Lake Erie and forms part of the U.S.–Canada boundary.", sources.detroitHistory, ["geography"]),
    q("What nickname reflects Detroit's automotive history?", "The Motor City", ["The Emerald City", "The Mile High City", "The Crescent City"], "Detroit became globally associated with automobile manufacturing.", sources.detroitHistory, ["industry"]),
    q("Where is the Motown Museum located?", "The former Hitsville U.S.A. site in Detroit", ["Inside the Detroit Zoo", "On Mackinac Island", "At Niagara Falls"], "The museum preserves the Detroit houses where Motown's early music business operated.", sources.motown, ["music"]),
    q("Which industry made the moving assembly line central to Detroit's identity?", "Automobile manufacturing", ["Whaling", "Silk weaving", "Orange farming"], "Detroit's auto plants transformed mass production and the region's economy.", sources.detroitHistory, ["industry"]),
    q("What is Belle Isle?", "An island park in the Detroit River", ["A downtown skyscraper", "A suburban airport", "A music record label"], "Belle Isle is a large public island park with cultural and natural attractions.", sources.detroitHistory, ["places"]),
    q("What major art museum is known for Diego Rivera's Detroit Industry murals?", "The Detroit Institute of Arts", ["The Motown Museum", "The Henry Ford airport", "The Michigan Science shipyard"], "Rivera's mural cycle is housed in the DIA's Rivera Court.", sources.dia, ["art"]),
    q("Which Detroit neighborhood is known for a historic public market?", "Eastern Market", ["Hollywood Hills", "French Quarter", "Beacon Hill"], "Eastern Market has served as a major food and community market district.", sources.detroitHistory, ["places"]),
    q("Detroit was founded in 1701 by which French explorer?", "Antoine de la Mothe Cadillac", ["Jacques Cousteau", "Samuel Morse", "Louis Pasteur"], "Cadillac established Fort Pontchartrain du Détroit in 1701.", sources.detroitHistory, ["history"]),
    q("What does the French word 'détroit' mean?", "Strait", ["Mountain", "Forest", "Golden city"], "The name refers to the narrow waterway connecting the lakes.", sources.detroitHistory, ["language"]),
    q("Which baseball team plays at Comerica Park?", "Detroit Tigers", ["Detroit Lions", "Detroit Red Wings", "Detroit Pistons"], "Comerica Park is the home ballpark of the Detroit Tigers.", sources.detroit, ["sports"]),
    q("Which Detroit music label helped popularize artists such as the Supremes and the Temptations?", "Motown Records", ["Sun Records", "Blue Note Records", "Sub Pop"], "Motown's Detroit sound became a major force in popular music.", sources.motown, ["music"]),
    q("What architectural complex is headquartered beside the Detroit River downtown?", "The Renaissance Center", ["The Space Needle", "The Alamo", "The Gateway Arch"], "The Renaissance Center is a prominent Detroit riverfront landmark.", sources.detroitHistory, ["architecture"]),
    q("Which avenue became famous for mansions built by Detroit industrial leaders?", "Woodward Avenue", ["Sunset Boulevard", "Pennsylvania Avenue", "Bourbon Street"], "Woodward is a historic spine of Detroit and the region.", sources.detroitHistory, ["places"]),
    q("What was the Underground Railroad's code name for Detroit?", "Midnight", ["Sunrise", "Liberty Bell", "North Star City"], "Detroit's location near Canada made it a crucial crossing point for freedom seekers.", sources.detroitHistory, ["history"]),
    q("Which Detroit landmark was once one of the world's busiest train stations?", "Michigan Central Station", ["Guardian Building", "Fisher Building", "Penobscot Building"], "Michigan Central opened in 1913 and became a monumental rail gateway.", sources.detroitHistory, ["architecture"]),
    q("What style is strongly associated with the Guardian Building's colorful interior?", "Art Deco", ["Brutalist", "Gothic Revival only", "Colonial farmhouse"], "The Guardian Building is celebrated for its richly ornamented Art Deco design.", sources.detroitHistory, ["architecture"]),
    q("Which lake is directly upstream from the Detroit River?", "Lake St. Clair", ["Lake Superior", "Lake Tahoe", "Great Salt Lake"], "Water flows from Lake St. Clair through the Detroit River toward Lake Erie.", sources.detroitHistory, ["geography"]),
    q("What annual Detroit event celebrates car culture along Woodward Avenue?", "Woodward Dream Cruise", ["Mardi Gras", "Rose Parade", "Running of the Bulls"], "The Dream Cruise draws classic and custom vehicles to Woodward.", sources.detroit, ["events"]),
    q("Which Detroit venue has long hosted major performances and is known for its ornate interior?", "Fox Theatre", ["Sydney Opera House", "Radio City only", "Red Rocks Amphitheatre"], "The Fox Theatre is a restored 1920s movie palace and performance venue.", sources.detroitHistory, ["culture"]),
    q("What was Paradise Valley historically known for?", "A center of Black business, music, and nightlife", ["A gold-mining camp", "A ski resort", "An automobile test track"], "Paradise Valley and Black Bottom were vital centers of Detroit's Black cultural life.", sources.detroitHistory, ["culture"]),
    q("Which Detroit team plays professional hockey?", "Detroit Red Wings", ["Detroit Tigers", "Detroit Lions", "Detroit City FC"], "The Red Wings are Detroit's National Hockey League team.", sources.detroit, ["sports"]),
    q("Why is Detroit important to techno music history?", "Detroit artists helped create and define techno in the 1980s", ["The genre began as a silent film", "Techno was invented by an auto company", "The city banned electronic instruments"], "Detroit innovators fused electronic music, futurism, and dance culture into a foundational techno sound.", sources.smithsonianMusic, ["music"]),
  ],
  "music-pop-culture": [
    q("What does BPM measure in music?", "Beats per minute", ["Bass pitch memory", "Bars per melody", "Broadcast power mode"], "BPM is a common way to describe tempo.", sources.smithsonianMusic, ["music-theory"]),
    q("Which instrument family includes the violin?", "Strings", ["Brass", "Woodwind", "Percussion"], "A violin produces sound from vibrating strings.", sources.smithsonianMusic, ["instruments"]),
    q("What is a chorus in a popular song?", "A recurring section that usually carries the main hook", ["The silence before recording", "A tuning tool", "A legal copyright form"], "The chorus commonly repeats musical and lyrical material.", sources.smithsonianMusic, ["songwriting"]),
    q("Which city is closely linked to the birth of Motown Records?", "Detroit", ["Seattle", "Nashville", "Miami"], "Berry Gordy founded Motown in Detroit.", sources.motown, ["motown"]),
    q("What is sampling in music production?", "Reusing a recorded sound within a new work", ["Measuring concert attendance", "Tuning only acoustic pianos", "Deleting every repeated beat"], "Sampling incorporates recorded audio and can require rights clearance.", sources.smithsonianMusic, ["production"]),
    q("What is a music bridge?", "A contrasting section that connects other song sections", ["A cable between two speakers only", "The first beat of every bar", "A list of tour dates"], "A bridge often creates contrast before returning to a familiar section.", sources.smithsonianMusic, ["songwriting"]),
    q("What does a DJ commonly use crossfading for?", "Blending audio from one source into another", ["Printing sheet music", "Changing a singer's name", "Building a stage roof"], "A crossfader can transition between decks or channels.", sources.smithsonianMusic, ["dj-culture"]),
    q("Which device converts sound waves into an electrical signal?", "A microphone", ["A projector", "A turntable platter", "A drumstick"], "Microphones transduce acoustic energy into an electrical signal.", sources.smithsonianMusic, ["audio"]),
    q("What is syncopation?", "Rhythmic emphasis placed on unexpected beats or subdivisions", ["Every note played at once", "A song with no rhythm", "A method for painting album art"], "Syncopation shifts accents away from expected strong beats.", sources.smithsonianMusic, ["rhythm"]),
    q("What does 'a cappella' mean?", "Singing without instrumental accompaniment", ["Playing only drums", "A very fast tempo", "Recording outdoors"], "A cappella performance centers unaccompanied voices.", sources.smithsonianMusic, ["performance"]),
    q("What is an LP in recorded music?", "A long-playing record", ["A lighting program", "A lyric paragraph", "A loudspeaker patent"], "LP became a standard term for long-form vinyl albums.", sources.locMusic, ["recordings"]),
    q("Which role is responsible for shaping the overall sound of a recording session?", "Record producer", ["Ticket usher", "Costume tailor", "Venue architect"], "A producer guides creative and technical decisions in making a recording.", sources.smithsonianMusic, ["production"]),
    q("What is a remix?", "A new version made by altering or recombining recorded elements", ["An untouched master recording", "A concert ticket refund", "A silent rehearsal"], "Remixes reshape existing stems, tracks, or arrangements.", sources.smithsonianMusic, ["production"]),
    q("Which format stores audio as digital samples?", "A WAV file", ["A paper poster", "A guitar pick", "A stage pass"], "WAV is a container commonly used for digital audio data.", sources.smithsonianMusic, ["audio"]),
    q("What is the purpose of a metronome?", "Providing a steady pulse for tempo practice", ["Adding lyrics automatically", "Changing a record label", "Measuring microphone color"], "Metronomes mark regular beats at a chosen tempo.", sources.smithsonianMusic, ["music-theory"]),
    q("Which register preserves recordings judged culturally, historically, or aesthetically significant in the United States?", "The National Recording Registry", ["The Patent Drawing Vault", "The Highway Register", "The Weather Almanac"], "The Library of Congress adds selected recordings to the National Recording Registry.", sources.locMusic, ["archives"]),
    q("What is a synthesizer?", "An instrument that generates or shapes electronic sound", ["A stand that holds sheet music", "A purely acoustic drum", "A camera lens"], "Synthesizers create sound using electronic or digital methods.", sources.smithsonianMusic, ["instruments"]),
    q("What is call and response?", "A musical phrase answered by another phrase or group", ["A method for selling tickets", "A silent section between albums", "A microphone repair"], "Call and response is a foundational musical interaction across many traditions.", sources.smithsonianMusic, ["music-theory"]),
    q("What does stereo audio provide?", "Two channels that can create left-right spatial placement", ["Exactly three singers", "One note at a time", "A guarantee of high volume"], "Stereo uses two channels to represent spatial differences.", sources.smithsonianMusic, ["audio"]),
    q("What is a hook in popular music?", "A memorable musical or lyrical idea", ["A cable used to hang speakers", "The legal end of a contract", "A count of microphones"], "Hooks are designed to be distinctive and easy to remember.", sources.smithsonianMusic, ["songwriting"]),
    q("Why should a game use original or licensed sound effects?", "To respect creators' rights and avoid copying protected recordings", ["To make every sound silent", "To guarantee a chart hit", "To change lottery odds"], "Original or properly licensed audio avoids unauthorized use of protected material.", sources.locMusic, ["copyright"]),
    q("What is a stem in music production?", "A grouped audio export such as drums, vocals, or instruments", ["A printed concert seat", "A microphone brand", "A single album review"], "Stems let creators rebalance or remix major parts of a production.", sources.smithsonianMusic, ["production"]),
  ],
  "lottomind-universe": [
    q("What is LottoMind's safest promise about number suggestions?", "They are entertainment and organization tools, not winning predictions", ["They guarantee a jackpot", "They change official odds", "They replace ticket verification"], "LottoMind does not claim to predict random lottery outcomes.", sources.internal, ["safety"]),
    q("Which LottoMind lane stores saved sets and readings?", "History Vault", ["Abundance Radio", "Merch Store", "Weather Radar"], "History Vault is the app's saved-record lane.", sources.internal, ["product"]),
    q("What does Dream Oracle do with dream text?", "Creates a symbolic entertainment interpretation", ["Certifies a winning ticket", "Changes a lottery drawing", "Provides medical diagnosis"], "Dream Oracle is a symbolic creative feature, not a prediction engine.", sources.internal, ["dream-oracle"]),
    q("Which tool is intended to scan ticket images?", "Ticket Scanner", ["Sonic Studio", "Horoscope", "Trivia Vault"], "Ticket Scanner is the capture lane, while official verification remains required.", sources.internal, ["scanner"]),
    q("What should happen before relying on a scanned ticket result?", "Verify it with the official lottery operator or retailer", ["Treat OCR as final", "Post the barcode publicly", "Change the printed digits"], "OCR can make mistakes; the official lottery is authoritative.", sources.internal, ["scanner", "safety"]),
    q("Which color pair anchors LottoMind's premium interface?", "Black and gold", ["Beige and brown", "Orange and pink only", "White and lime only"], "LottoMind's visual identity uses dark cinematic panels with gold energy accents.", sources.internal, ["brand"]),
    q("What is the role of Signal Radar?", "Comparing historical number activity for entertainment analysis", ["Guaranteeing future numbers", "Redeeming a ticket", "Mixing a music master"], "Historical patterns can be organized without claiming predictive power.", sources.internal, ["radar"]),
    q("Which LottoMind area contains playable experiences?", "Arcade", ["Policies", "Store Locator", "Account Recovery"], "The Arcade collects LottoMind game routes.", sources.internal, ["product"]),
    q("What is Abundance Radio designed for?", "Optional music and reset sessions", ["Official draw certification", "Ticket barcode encryption", "Tax filing"], "Abundance Radio supports the app's music and mindset lane.", sources.internal, ["music"]),
    q("What should a guest earn in the static Trivia Vault build?", "Non-monetary score and local badge progress", ["Real wallet credits", "Cash prizes", "Purchasable lottery tickets"], "Without a secure reward backend, guest play remains score-only.", sources.internal, ["security"]),
    q("Why are real trivia credits disabled in this build?", "The existing backend has no secure trivia session and reward endpoint", ["The answer buttons are too large", "The timer is circular", "The questions use categories"], "Authoritative rewards require server-side sessions, scoring, caps, and ledger writes.", sources.internal, ["security"]),
    q("What does the LottoMind Guardian represent visually?", "A futuristic branded guide through app tools", ["An official lottery regulator", "A guarantee of luck", "A television game-show character"], "The Guardian supports LottoMind's original cinematic technology identity.", sources.internal, ["brand"]),
    q("Which control should always remain visible during trivia?", "Mute", ["Purchase ticket", "Claim jackpot", "Autoplay all audio"], "Players need immediate control of optional sound.", sources.internal, ["accessibility"]),
    q("What happens when reduced motion is enabled?", "Nonessential animation is minimized", ["Questions become harder", "Answers are hidden", "Scores double"], "Reduced motion preserves play while limiting visual movement.", sources.internal, ["accessibility"]),
    q("What are Quick Play's keyboard answer shortcuts?", "Keys 1 through 4", ["Only F1", "The arrow keys plus ten", "No keyboard controls"], "Four numbered shortcuts map directly to the four answer choices.", sources.internal, ["accessibility"]),
    q("What does the Dream Video Studio create before a provider video?", "A structured scene and provider prompt", ["An official winning number", "A ticket barcode", "A tax receipt"], "The studio turns symbolic content into a creative production prompt.", sources.internal, ["dream-video"]),
    q("Which notice belongs near LottoMind trivia?", "Scores do not predict lottery outcomes or improve winning odds", ["Eight correct answers guarantee a prize", "Numerology changes random drawings", "A streak makes a ticket valid"], "Clear entertainment-only language prevents misleading claims.", sources.internal, ["safety"]),
    q("Why does the Vault keep admin tools in a separate route?", "To split authoring controls from the player experience", ["To expose correct answers sooner", "To autoplay sound", "To remove validation"], "Separating authoring tools reduces public UI complexity and supports stricter access controls later.", sources.internal, ["architecture"]),
    q("What does a cyan focus outline communicate?", "Which interactive control currently has keyboard focus", ["The answer is correct", "Credits were claimed", "The network is offline"], "A visible focus indicator helps keyboard users track navigation.", sources.internal, ["accessibility"]),
    q("What does local leaderboard mean in this static build?", "It shows only genuine runs saved on the current device", ["It invents global competitors", "It exposes player emails", "It validates wallet credits"], "The preview never fabricates public ranks or social proof.", sources.internal, ["privacy"]),
    q("Which action should never be handled by localStorage?", "Granting authoritative wallet credits", ["Remembering mute preference", "Saving guest badge progress", "Saving a local score"], "Wallet credits require a trusted shared ledger and server validation.", sources.internal, ["security"]),
    q("What should happen if leaderboard saving fails after a round?", "Keep the completed score and explain the leaderboard issue", ["Erase the entire round", "Change correct answers", "Grant extra credits"], "Secondary-service failures must not destroy a completed result.", sources.internal, ["resilience"]),
  ],
  "mystery-mix": [
    q("Which planet is known for its prominent ring system?", "Saturn", ["Mercury", "Venus", "Mars"], "All giant planets have rings, but Saturn's are the most visually prominent.", sources.nasa, ["space"]),
    q("What creates the aurora near Earth's polar regions?", "Charged particles interacting with Earth's magnetic field and atmosphere", ["Moonlight reflecting from snow only", "Ocean waves reaching the sky", "City lasers crossing clouds"], "Solar particles guided by the magnetic field excite atmospheric gases.", sources.nasa, ["science"]),
    q("What is bioluminescence?", "Light produced by a living organism", ["Sunlight reflected from metal", "Heat visible through glass", "A painted glow"], "Many ocean organisms produce light through chemical reactions.", sources.noaa, ["ocean"]),
    q("Which ancient writing material was made from a Nile-region plant?", "Papyrus", ["Plastic", "Aluminum foil", "Rubber"], "Papyrus sheets were made from the papyrus plant and used for writing.", sources.smithsonian, ["history"]),
    q("What is the deepest known part of the world's oceans?", "Challenger Deep", ["Great Blue Hole", "Lake Baikal", "Hudson Canyon"], "Challenger Deep lies within the Mariana Trench.", sources.noaa, ["ocean"]),
    q("Which force keeps planets in orbit around the Sun?", "Gravity", ["Sound", "Friction with air", "Magnetism alone"], "Gravity bends planetary motion into orbits around the Sun.", sources.nasa, ["space"]),
    q("What is dendrochronology?", "Dating and studying events using tree rings", ["Mapping ocean currents with drums", "Reading ancient star signs", "Measuring cave echoes"], "Tree-ring patterns can provide precisely dated environmental records.", sources.nps, ["science"]),
    q("Which animal is the largest known to have lived on Earth?", "Blue whale", ["African elephant", "Tyrannosaurus rex", "Giant squid"], "Blue whales exceed the mass of any known dinosaur.", sources.smithsonian, ["animals"]),
    q("What is a cryptogram?", "A puzzle in which text is encoded", ["A map of cloud types", "A fossil footprint", "A musical tempo"], "Solvers decode substituted or transformed symbols to reveal a message.", sources.loc, ["puzzles"]),
    q("What causes a lunar eclipse?", "Earth passes between the Sun and Moon", ["The Moon turns off its light", "Venus blocks every star", "Clouds cover the entire planet"], "Earth's shadow falls across the Moon during a lunar eclipse.", sources.nasa, ["space"]),
    q("What is the Rosetta Stone famous for helping scholars do?", "Decipher Egyptian hieroglyphs", ["Predict eclipses with electricity", "Invent paper currency", "Map the ocean floor"], "Parallel texts in multiple scripts helped unlock ancient Egyptian writing.", sources.smithsonian, ["history"]),
    q("Which layer of Earth is liquid and helps generate the magnetic field?", "Outer core", ["Crust", "Inner core", "Upper atmosphere"], "Flowing iron-rich material in the outer core powers the geodynamo.", sources.smithsonian, ["earth-science"]),
    q("What is echolocation?", "Using reflected sound to locate objects", ["Seeing ultraviolet colors", "Reading magnetic tape", "Measuring temperature with light only"], "Bats and toothed whales can interpret returning echoes.", sources.smithsonian, ["animals"]),
    q("Which civilization built Machu Picchu?", "The Inca", ["The Roman", "The Viking", "The Phoenician"], "Machu Picchu was an Inca site in the Andes.", sources.smithsonian, ["history"]),
    q("What does a seismograph record?", "Ground motion from seismic waves", ["Wind direction only", "Ocean salinity", "Starlight color"], "Seismographs measure vibrations traveling through Earth.", sources.nps, ["earth-science"]),
    q("Why do deep-sea animals often have unusual adaptations?", "They live under darkness, cold, pressure, and scarce food", ["They breathe only desert air", "They never encounter pressure", "They live above the atmosphere"], "Extreme deep-ocean conditions favor specialized bodies and behaviors.", sources.noaa, ["ocean"]),
    q("What is the Milky Way?", "The galaxy that contains our Solar System", ["A cloud inside Earth's atmosphere", "A ring around Saturn", "A single nearby comet"], "The Sun is one star among hundreds of billions in the Milky Way.", sources.nasa, ["space"]),
    q("What are the moving stone tracks of Racetrack Playa linked to?", "Thin ice, water, and wind moving rocks across mud", ["Hidden animal teams", "A magnetic lottery machine", "Volcanic eruptions every night"], "Observed conditions showed wind pushing ice panels that moved rocks across the playa.", sources.nps, ["mystery-explained"]),
    q("What is a mirage?", "An optical effect caused by light bending through layers of air", ["A permanent lake appearing instantly", "A message from a satellite", "A shadow with no light source"], "Temperature gradients refract light and can shift or invert distant images.", sources.noaa, ["atmosphere"]),
    q("Which library is the largest in the United States by collection size?", "Library of Congress", ["A neighborhood bookmobile", "New York Public Library alone", "The Vatican Library"], "The Library of Congress maintains the country's largest library collection.", sources.loc, ["culture"]),
    q("What is the scientific value of a null result?", "It can show that a tested effect was not detected under the study conditions", ["It proves every alternative is true", "It means no data was collected", "It must be hidden"], "Null results constrain ideas and help refine future questions.", sources.smithsonian, ["scientific-method"]),
    q("Which practice makes a mystery claim easier to evaluate?", "Preserving original data, time, location, and methods", ["Removing all context", "Sharing only a cropped screenshot", "Changing the story after questions"], "Transparent records let others inspect evidence and attempt independent checks.", sources.smithsonian, ["critical-thinking"]),
  ],
};

const categoryLabels = {
  "lottery-knowledge": "Lottery Knowledge",
  "numbers-numerology": "Numbers and Numerology",
  "ufo-unexplained": "UFO and Unexplained",
  "detroit-history-culture": "Detroit History and Culture",
  "music-pop-culture": "Music and Pop Culture",
  "lottomind-universe": "LottoMind Universe",
  "mystery-mix": "Mystery Mix",
};

function makeQuestion(category, item, localIndex, globalIndex) {
  const position = globalIndex % 4;
  const choices = [...item.wrong];
  choices.splice(position, 0, item.correct);
  return {
    id: `${category}-${String(localIndex + 1).padStart(3, "0")}`,
    category,
    difficulty: localIndex < 7 ? "easy" : localIndex < 15 ? "medium" : "hard",
    question: item.question,
    choices,
    correctChoiceIndex: position,
    explanation: item.explanation,
    sourceName: item.source[0],
    sourceUrl: item.source[1],
    reviewedAt: REVIEW_DATE,
    reviewStatus: "approved",
    active: true,
    tags: item.tags,
    version: 1,
    editedBy: "LottoMind editorial seed",
    editedAt: `${REVIEW_DATE}T12:00:00.000Z`,
  };
}

let globalIndex = 0;
const manifest = { schemaVersion: 1, generatedAt: new Date().toISOString(), totalQuestions: 0, categories: [] };
const outputDirectory = path.join(ROOT, "data", "categories");
await mkdir(outputDirectory, { recursive: true });

for (const [category, rows] of Object.entries(categoryData)) {
  if (rows.length < 20) throw new Error(`${category} has only ${rows.length} questions.`);
  const questions = rows.map((item, localIndex) => makeQuestion(category, item, localIndex, globalIndex++));
  const serialized = `${JSON.stringify(questions, null, 2)}\n`;
  const file = `${category}.json`;
  await writeFile(path.join(outputDirectory, file), serialized, "utf8");
  manifest.categories.push({ id: category, label: categoryLabels[category], file, count: questions.length, sha256: createHash("sha256").update(serialized).digest("hex") });
  manifest.totalQuestions += questions.length;
}

if (manifest.totalQuestions < 150) throw new Error(`Only ${manifest.totalQuestions} questions generated.`);
await writeFile(path.join(ROOT, "data", "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${manifest.totalQuestions} reviewed questions across ${manifest.categories.length} category shards.`);
