const text = (label, type = 'long') => ({ label, type });

const yesNoQuestions = [
  'Do you currently perform under a professional artist name?',
  'Do you currently have professional management?',
  'Do you currently have an attorney?',
  'Do you currently have a business manager or accountant?',
  'Do you currently have a booking agent?',
  'Do you currently have a publicist?',
  'Do you currently have a record label?',
  'Do you currently have a distributor?',
  'Do you currently have a publishing company or publisher?',
  'Do you currently have a business entity?',
  'Do you have a separate business bank account?',
  'Do you have an EIN for your entertainment business?',
  'Do you currently have active entertainment contracts?',
  'Are you currently negotiating any contracts?',
  'Do you currently have outstanding label offers?',
  'Do you currently have publishing offers?',
  'Do you currently have distribution offers?',
  'Do you currently have brand or sponsorship offers?',
  'Are you currently involved in a legal dispute related to your career?',
  "Are any of your recordings subject to another party's ownership?",
  "Are any of your songs subject to another party's ownership?",
  'Do you own your masters?',
  'Do you own your publishing?',
  'Do you have unreleased music ready for release?',
  'Do you have completed projects that have not been released?',
  'Do you write your own songs?',
  'Do you produce music?',
  'Do you regularly collaborate with other songwriters?',
  'Do you regularly collaborate with producers?',
  'Are you registered with a performing rights organization?',
  'Do you have an IPI / CAE number?',
  'Are your songs registered with your PRO?',
  'Are your songs registered with The MLC or another mechanical administrator?',
  'Are your recordings registered with SoundExchange?',
  'Do you currently receive publishing royalties?',
  'Have you registered copyrights for your music?',
  'Have you registered your artist name as a trademark?',
  'Do you own your artist logo?',
  'Do you own your merchandise designs?',
  'Do you currently sell merchandise?',
  'Do you have an active merchandise store?',
  'Have you generated merchandise revenue in the past 12 months?',
  'Have you generated music revenue in the past 12 months?',
  'Have you generated touring revenue in the past 12 months?',
  'Have you generated brand revenue in the past 12 months?',
  'Have you performed live professionally?',
  'Have you headlined your own shows?',
  'Have you toured professionally?',
  'Have you performed internationally?',
  'Have you opened for an established artist?',
  'Have you performed at a major festival?',
  'Have you received editorial playlist placement?',
  'Have you received significant press coverage?',
  'Have you had a song exceed 100,000 streams?',
  'Have you had a song exceed 500,000 streams?',
  'Have you had a song exceed 1 million streams?',
  'Have you had a social media post exceed 100,000 views?',
  'Have you had a social media post exceed 500,000 views?',
  'Have you had a social media post exceed 1 million views?',
  'Have you previously entered into a brand partnership?',
  'Do you currently have pending brand opportunities?',
  'Do you currently have sync opportunities?',
  'Are you interested in film or television opportunities?',
  'Are you interested in acting?',
  'Are you interested in developing businesses outside music?',
].map(label => text(label, 'yesno'));

const documents = [
  'Corporate / LLC documents', 'EIN documentation', 'Operating agreement', 'Business ownership documents',
  'Recording agreements', 'Distribution agreements', 'Publishing agreements', 'Administration agreements',
  'Producer agreements', 'Songwriter agreements', 'Split sheets', 'Licensing agreements', 'Sync agreements',
  'Copyright registrations', 'Trademark registrations', 'Trademark applications', 'Royalty statements',
  'Label statements', 'Publishing statements', 'PRO statements', 'SoundExchange statements',
  'Merchandise reports', 'Sales reports', 'Streaming analytics', 'Social analytics', 'Touring history',
  'Press kit / EPK', 'Current biography', 'Professional photographs', 'Logos / brand assets', 'Music catalog', 'Music videos',
].map(label => text(`Can you provide: ${label}?`, 'yesno'));

const sections = [
  { title: 'Artist identification', questions: [
    text('Legal name', 'short'), text('Artist name', 'short'), text('Date of birth', 'date'), text('Legal resident', 'short'),
    text('Country / city of residence', 'short'), text('Primary email', 'email'), text('Phone', 'tel'),
    text('Website', 'url'), text('Instagram', 'short'), text('TikTok', 'short'), text('YouTube', 'short'),
    text('Spotify', 'short'), text('Apple Music', 'short'), text('Other platforms'),
  ] },
  { title: 'Artist & business status', questions: yesNoQuestions },
  { title: 'Artist identity & creative profile', questions: [
    'How would you describe yourself as an artist?', 'How would you describe your sound?',
    'What makes you different from other artists in your genre?', 'What do you want people to feel when they experience your music?',
    'What is the story behind your artist name?', 'What does your brand represent?', 'What do you never want your brand to represent?',
    'What are your greatest artistic strengths?', 'What areas of your artistry need development?',
  ].map(text) },
  { title: 'A&R & career profile', questions: [
    text('Primary genre', 'short'), text('Secondary genres', 'short'), text('Current career stage', 'short'),
    text('How long have you been pursuing music professionally?', 'short'), text('What do you believe is your biggest opportunity right now?'),
    text('What is your biggest career obstacle?'), text('What do you need from management?'),
    text('What are your three highest priorities for the next 12 months?'),
  ] },
  { title: 'Music catalog', questions: [
    'Number of officially released songs', 'Number of albums', 'Number of EPs', 'Number of mixtapes / projects', 'Number of singles',
    'Number of completed unreleased songs', 'Number of unfinished songs', 'Number of demos',
    'Approximate number of commercially viable unreleased songs',
  ].map(label => text(label, 'short')).concat([
    text('Significant releases (enter N/A if none). Include song/project, release date, label/distributor, master owner, publishing owner, ISRC, UPC, writers, producers, and featured artists.'),
  ]) },
  { title: 'Streaming & digital performance', questions: [
    'Spotify monthly listeners, followers, total streams, top song and top-song streams', 'Spotify top five songs',
    'Apple Music total streams/plays, followers and top song', 'YouTube subscribers, lifetime views, average monthly views, top video and top-video views',
    'TikTok followers, total views, average views, highest-performing video and its views',
    'Instagram followers, average Reel views, average Story views and average engagement',
  ].map(text) },
  { title: 'Audience & market data', questions: [
    'Top ten listener / follower markets', 'Top U.S. markets', 'Top international markets', 'Primary audience age range', 'Primary audience demographics',
  ].map(text) },
  { title: 'Live performance & touring', questions: [
    'Number of professional performances', 'Largest audience', 'Largest headlining audience', 'Average headlining attendance',
    'Average ticket price', 'Highest-grossing show', 'Highest performance fee', 'Live income - previous 12 months', 'Live income - previous 36 months',
  ].map(label => text(label, 'short')).concat([
    'Previous tours', 'Major festivals', 'Notable opening / support slots', 'International performances',
    'Upcoming confirmed performances', 'Upcoming holds / tentative dates',
  ].map(text)) },
  { title: 'Music sales & revenue', questions: [
    'Physical units sold', 'Digital downloads', 'Total streaming revenue - previous 12 months', 'Total music revenue - previous 12 months',
    'Total music revenue - previous 36 months', 'Average monthly music income', 'Average monthly streaming income',
    'Best-selling release', 'Highest-grossing release',
  ].map(label => text(label, 'short')).concat([
    text('Revenue by source: streaming, downloads, physical, publishing, touring, merchandise, brand partnerships, features, songwriting/production, and other.'),
  ]) },
  { title: 'Merchandise', questions: [
    'Current merchandise products', 'Merchandise store / URL', 'Who owns the merchandise business?', 'Who manufactures the merchandise?',
    'Who fulfills orders?', 'Best-selling merchandise item', 'Average merchandise order value', 'Average monthly merchandise sales',
    'Total merchandise revenue - previous 12 months', 'Current inventory value', 'Gross merchandise margin, if known',
    'Sales by channel: website, touring, retail and other', 'Describe your ideal merchandise strategy',
  ].map(text) },
  { title: 'Copyright, masters & intellectual property', questions: [
    'Master ownership structure', 'Publishing ownership structure', 'Are any masters jointly owned? Explain.',
    'Are any masters licensed to third parties?', 'Are any masters subject to recoupment or financial obligations?',
    'Who owns your copyrights?', 'Who administers your copyrights?', 'Copyright registrations', 'Current copyright disputes or claims',
  ].map(text) },
  { title: 'Trademarks & brand IP', questions: [
    'Artist name trademark status', 'Trademark owner', 'Trademark registration numbers', 'Trademark jurisdictions',
    'Trademark classes', 'Pending applications', 'Logo ownership', 'Who created your logo / visual identity?', 'Other important intellectual property',
  ].map(text) },
  { title: 'Songwriting & production', questions: [
    'Number of songs written', 'Number of commercially released songs written', 'Number of songs written for other artists',
    'Number of productions created for other artists', 'Primary songwriting collaborators', 'Primary producers',
    'Artists you want to write for', 'Artists you want to collaborate with', 'Producers you want to work with',
    'Approximate number of unreleased compositions',
  ].map(text) },
  { title: 'IPI, PRO & royalty information', questions: [
    'PRO', 'Writer name on PRO account', 'Writer IPI / CAE', 'Publisher name', 'Publisher IPI / CAE',
    'Publisher administrator', 'Mechanical rights administrator', 'MLC registration information',
    'SoundExchange account', 'Neighboring rights administrator', 'Other royalty accounts',
  ].map(text) },
  { title: 'Publishing', questions: [
    'Current publisher', 'Publishing administrator', 'Deal type', 'Effective date', 'Expiration date', 'Term', 'Territory',
    'Advance', 'Recoupable balance', 'Writer share', 'Publisher share', 'Reversion rights', 'Describe your ideal publishing relationship',
  ].map(text) },
  { title: 'Record label & distribution', questions: [
    'Current label', 'Deal type', 'Effective date', 'Expiration date', 'Options', 'Advance', 'Royalty rate', 'Recoupable balance',
    'Master ownership', 'Distributor', 'Labels that have expressed interest', 'Labels you have met with', 'Labels that have made offers',
    'Outstanding offers', 'What would make you sign with a label?', 'What would make you reject a label deal?', 'Preferred deal structure',
  ].map(text) },
  { title: 'Business structure', questions: [
    'Entity name', 'Entity type', 'State / country of formation', 'Date formed', 'EIN', 'Owners / members / shareholders',
    'Ownership percentages', 'Business bank', 'Bookkeeping system', 'Accountant / CPA', 'Business manager',
    'Are all business filings current? Explain if necessary.',
  ].map(text) },
  { title: 'Existing contracts', questions: [
    text('For every active agreement, list the counterparty, agreement type, effective and expiration dates, term, territory, exclusivity, financial terms, ownership rights, options, termination rights and current status.'),
    text('Additional agreements'),
  ] },
  { title: 'Pending contracts & offers', questions: [
    'Are you currently negotiating any agreements?', 'Company / counterparty', 'Agreement type', 'Current stage',
    'Financial terms', 'Ownership / rights offered', 'Deadline', 'Attorney involved',
  ].map(text) },
  { title: 'Artist image & visual brand', questions: [
    'Describe your current visual identity', 'Colors associated with your brand', 'Fashion influences', 'Visual inspirations',
    'Photography inspirations', 'Music-video inspirations', 'Brands you want to work with', 'Brands you do not want to work with',
    'Stylist', 'Creative director', 'Photographer / videographer', 'Designer', 'What elements of your image are non-negotiable?',
    'What aspects of your image would you like to evolve?',
  ].map(text) },
  { title: 'Brand & commercial opportunities', questions: [
    'Previous brand partnerships', 'Current brand relationships', 'Previous brand income', 'Pending brand opportunities',
    'Dream brand partnerships', 'Brand categories of interest', 'Consumer products you would like to develop', 'Businesses you would like to build',
  ].map(text) },
  { title: 'Social media & content', questions: [
    'Who manages your social media?', 'Which platform performs best?', 'Which platform has the greatest growth potential?',
    'What content performs best?', 'What content do you enjoy creating?', 'What content do you dislike creating?',
    'Current content strategy', 'Current posting frequency',
  ].map(text) },
  { title: 'Media & publicity', questions: [
    'Major press coverage', 'Major interviews', 'Radio appearances', 'Podcast appearances', 'Television appearances',
    'Awards / nominations', 'Industry recognition', 'Major playlist placements', 'Current publicist',
  ].map(text) },
  { title: 'Creative team', questions: [
    'Managers', 'Attorneys', 'Business manager', 'Accountant / CPA', 'Booking agent', 'Publicist', 'Label / distributor',
    'Publisher', 'Producers', 'Songwriters', 'Engineers', 'Creative director', 'Photographer / videographer', 'Designer',
  ].map(text) },
  { title: 'Creative process', questions: [
    'Describe your songwriting process', 'Describe your recording process', 'How often do you write?', 'How often do you record?',
    'How many songs do you typically complete each month?', 'How quickly can you create new music?', 'Preferred release format',
    'Preferred release frequency', 'What prevents you from creating more?', 'What would make you more productive?',
  ].map(text) },
  { title: '3-year goals', questions: [
    'Where do you want your career to be in three years?', 'What specific accomplishments do you want?',
    'What revenue level do you want to reach?', 'What audience size do you want?', 'What markets do you want to enter?', 'What do you want to own?',
  ].map(text) },
  { title: '5-year goals', questions: [
    'Where do you want your career to be in five years?', 'What do you want your career to be known for?',
    'What businesses or assets do you want to own?', 'What financial goals do you want to achieve?', 'What creative milestones do you want?',
  ].map(text) },
  { title: '10-year vision', questions: [
    'Where do you want to be in ten years?', 'What do you want your legacy to be?', 'What do you want to own?',
    'What do you want to have built?', 'What do you want your catalog to represent?', 'What industries do you want to enter?',
  ].map(text) },
  { title: 'Dreams & inspirations', questions: [
    'If money, access, fame and fear were not limitations, what would you build?', 'What is your biggest career dream?',
    'What is your biggest dream outside music?', 'Who would you love to collaborate with?', 'Who would you love to perform for?',
    'What venue would be a dream performance?', 'What festival would be a dream booking?',
    'What award or recognition would mean the most?', 'What brand would be your dream partnership?',
    'What creative project have you always wanted to make?', 'What business have you always wanted to build?',
    'What impact do you want your career to have?',
  ].map(text) },
  { title: 'Artist definition of success', questions: [
    'What does success mean to you?', 'How will you know that you have made it?', 'What matters most to you about your career?',
    'Rank your top five priorities',
  ].map(text) },
  { title: 'Management expectations', questions: [
    'Why are you seeking management now?', 'What do you expect management to accomplish?', 'What do you want management to handle?',
    'What do you want to remain personally involved in?', 'What has frustrated you about previous teams or representatives?',
    'What does an ideal artist / manager relationship look like?', 'What are your non-negotiables?',
  ].map(text) },
  { title: 'Immediate opportunities', questions: [
    'Music opportunities', 'Label opportunities', 'Publishing opportunities', 'Distribution opportunities', 'Brand opportunities',
    'Merchandise opportunities', 'Touring opportunities', 'Sync opportunities', 'Other opportunities',
    'Important upcoming release dates', 'Contract deadlines', 'Option deadlines', 'Trademark deadlines', 'Tour dates', 'Other important dates',
  ].map(text) },
  { title: 'Top priorities', questions: [
    'Top five career goals', 'Top five business goals', 'Top five creative goals',
  ].map(text) },
  { title: 'Supporting documents', intro: 'Answer based on what is currently available. Documents can be shared securely with the team separately.', questions: documents },
  { title: 'Artist certification', intro: 'I understand that management may rely on this information when evaluating my career, business interests, intellectual property, contracts, opportunities and strategic plans. This intake is for evaluation and assessment only. It is not a contract and does not guarantee a contract.', questions: [
    text('Artist legal name', 'short'), text('Artist name', 'short'), text('Certification date', 'date'),
    text('I certify that the information provided is accurate and complete to the best of my knowledge.', 'certify'),
  ] },
];

const questionnaire = sections.map((section, sectionIndex) => ({
  id: `section_${String(sectionIndex + 1).padStart(2, '0')}`,
  title: section.title,
  intro: section.intro || '',
  questions: section.questions.map((question, questionIndex) => ({
    id: `s${String(sectionIndex + 1).padStart(2, '0')}_${String(questionIndex + 1).padStart(2, '0')}`,
    ...question,
  })),
}));

const questionMap = new Map(questionnaire.flatMap(section => section.questions.map(question => [question.id, question])));

module.exports = { questionnaire, questionMap };
