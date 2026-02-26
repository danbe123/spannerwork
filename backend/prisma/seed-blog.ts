/**
 * Blog Post Seed Script
 *
 * Run with: npx tsx prisma/seed-blog.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const blogPosts = [
  {
    slug: 'complete-guide-renting-tools-car-restoration',
    title: 'Complete Guide to Renting Tools for Your First Car Restoration',
    excerpt: 'Everything you need to know about which tools to rent vs buy for your classic car restoration project, plus budget-saving tips from experienced restorers.',
    category: 'DIY Tips',
    tags: ['car restoration', 'tool rental', 'classic cars', 'DIY', 'budget tips'],
    author: 'SpannerWork Team',
    readTime: 12,
    metaTitle: 'Car Restoration Tool Rental Guide | SpannerWork',
    metaDescription: 'Learn which tools to rent vs buy for your car restoration project. Expert tips on saving money and finding the right equipment locally.',
    content: `<h2>Starting Your First Restoration Project</h2>
<p>Restoring a classic car is one of the most rewarding projects a DIY enthusiast can undertake. Whether you've picked up a barn find MG or a weathered Ford Escort, the journey from project to polished gem requires the right tools at the right time.</p>

<p>The big question most first-timers face is: <strong>should I buy all these tools or rent them?</strong> The answer isn't straightforward, but this guide will help you make smart decisions that save money without compromising your project.</p>

<h2>Tools You Should Own vs. Rent</h2>

<h3>Always Own These Basics</h3>
<p>Some tools you'll use so frequently that ownership makes sense from day one:</p>
<ul>
<li><strong>Socket sets</strong> (metric and imperial) - You'll reach for these daily</li>
<li><strong>Combination spanners</strong> - Essential for every stage of work</li>
<li><strong>Screwdrivers</strong> - Various sizes, flathead and Phillips</li>
<li><strong>Pliers and cutters</strong> - Wire stripping, clip removal, general gripping</li>
<li><strong>Hammers</strong> - Ball peen and rubber mallet</li>
<li><strong>Torque wrench</strong> - Critical for proper assembly</li>
</ul>

<p>These basics typically cost £200-400 for a decent set and will serve you for decades.</p>

<h3>Rent These Specialist Tools</h3>
<p>Specialist equipment that you'll only need for specific tasks makes perfect sense to rent:</p>
<ul>
<li><strong>Engine hoist</strong> - Unless you're doing multiple engine swaps, rent it</li>
<li><strong>Bearing pullers and press sets</strong> - Used once or twice per restoration</li>
<li><strong>Spring compressors</strong> - Essential but infrequent use</li>
<li><strong>Panel beating tools</strong> - Dollies, hammers, and shrinkers for bodywork</li>
<li><strong>Welding equipment</strong> - MIG welders for patches and repairs</li>
<li><strong>Sandblasting kit</strong> - For rust removal and surface prep</li>
</ul>

<h2>Budget Breakdown: Rent vs Buy</h2>

<p>Let's compare costs for a typical restoration spanning 12-18 months:</p>

<table>
<thead>
<tr><th>Tool Category</th><th>Buy Cost</th><th>Rental Cost (12 months)</th><th>Recommendation</th></tr>
</thead>
<tbody>
<tr><td>Engine hoist</td><td>£200-400</td><td>£15-25/day × ~5 days = £75-125</td><td>Rent</td></tr>
<tr><td>MIG welder (professional)</td><td>£800-1500</td><td>£40-60/day × ~10 days = £400-600</td><td>Rent (unless going pro)</td></tr>
<tr><td>Panel beating set</td><td>£150-300</td><td>£20-30/day × ~8 days = £160-240</td><td>Either works</td></tr>
<tr><td>Spring compressor</td><td>£40-80</td><td>£10/day × 2 days = £20</td><td>Rent</td></tr>
</tbody>
</table>

<h2>Finding Local Tool Rentals</h2>

<p>SpannerWork connects you with local tool owners who rent out their equipment. Unlike big-box rental shops:</p>
<ul>
<li>Often better quality (enthusiast-owned, well-maintained)</li>
<li>Local knowledge and tips included</li>
<li>Flexible rental periods</li>
<li>Lower costs without commercial overheads</li>
</ul>

<h2>Pro Tips for First-Time Restorers</h2>

<blockquote>
<p>"The biggest mistake I made on my first project was buying a cheap welder. I should have rented a professional unit for the panels and bought a basic one for small repairs later." - Mark, E30 restorer</p>
</blockquote>

<ol>
<li><strong>Stage your tool needs</strong> - Don't rent everything at once. Focus on disassembly tools first, then mechanical, then bodywork, then paint prep.</li>
<li><strong>Take photos before you unbolt anything</strong> - This isn't a tool tip, but trust us on this one.</li>
<li><strong>Rent for weekends</strong> - Many providers offer weekend rates that give you more working time.</li>
<li><strong>Ask about instruction</strong> - Many SpannerWork tool providers can show you the basics.</li>
</ol>

<h2>When to Consider Workshop Space</h2>

<p>If you're working from a home garage with limited space, consider renting workshop time for specific tasks:</p>
<ul>
<li>Engine removal and rebuild</li>
<li>Bodywork and panel fitting</li>
<li>Paint preparation and spraying</li>
<li>Chassis work requiring a lift</li>
</ul>

<p>Workshop space typically costs £25-50 per hour, with day rates available. Many include basic tools and equipment in the price.</p>

<h2>Conclusion</h2>

<p>Your first restoration doesn't need to break the bank. By strategically renting specialist tools and investing in quality basics, you can complete a professional-quality restoration while building a toolkit that grows with your skills.</p>

<p>Ready to find tools for your project? <a href="/feed">Browse local tool rentals on SpannerWork</a> and connect with providers in your area.</p>`
  },

  {
    slug: 'how-to-price-mechanic-services-provider-guide',
    title: 'How to Price Your Mechanic Services: A Provider\'s Guide',
    excerpt: 'Setting the right prices for your mobile mechanic or workshop services can make or break your side business. Learn proven strategies for competitive, profitable pricing.',
    category: 'For Providers',
    tags: ['pricing', 'mobile mechanic', 'side hustle', 'business tips', 'earning'],
    author: 'SpannerWork Team',
    readTime: 10,
    metaTitle: 'Mechanic Service Pricing Guide | SpannerWork',
    metaDescription: 'Learn how to price your mechanic services competitively. Research local rates, calculate costs, and build a profitable side business on SpannerWork.',
    content: `<h2>The Pricing Challenge</h2>
<p>Whether you're a qualified mechanic looking to earn on the side or a skilled DIYer ready to help others, pricing your services correctly is crucial. Price too high and you won't get bookings. Price too low and you'll work yourself into the ground for minimal profit.</p>

<p>This guide will help you find that sweet spot where customers feel they're getting value and you're earning what your skills are worth.</p>

<h2>Researching Your Local Market</h2>

<h3>What Are Garages Charging?</h3>
<p>Start by understanding what established businesses charge in your area. Call a few local garages and ask for quotes on common jobs:</p>
<ul>
<li><strong>Basic service</strong> - Oil, filter, visual check</li>
<li><strong>Full service</strong> - Comprehensive with fluid top-ups</li>
<li><strong>Brake pad replacement</strong> (per axle)</li>
<li><strong>Timing belt</strong> (for a common car model)</li>
<li><strong>Diagnostics</strong> - Fault code reading and investigation</li>
</ul>

<p>You'll typically find garage hourly rates between £45-80/hour depending on location (higher in the South East, lower in the North). Dealerships often charge £90-150/hour.</p>

<h3>The SpannerWork Advantage</h3>
<p>As a SpannerWork provider, you can undercut garage prices while still earning well:</p>
<ul>
<li>No showroom rent or business rates</li>
<li>No staff wages to cover</li>
<li>Lower insurance costs</li>
<li>Flexible scheduling means efficient use of your time</li>
</ul>

<h2>Pricing Strategies</h2>

<h3>Option 1: Hourly Rate</h3>
<p><strong>Best for:</strong> Diagnostic work, complex jobs, anything where time is uncertain.</p>

<p>Set your hourly rate by calculating your true costs:</p>
<ol>
<li><strong>Base target</strong> - What do you want to earn per hour after expenses? (e.g., £25)</li>
<li><strong>Add tool costs</strong> - Wear and consumables (e.g., £3/hour)</li>
<li><strong>Add travel</strong> - For mobile work (e.g., £5-10 average per job)</li>
<li><strong>Add platform fee</strong> - SpannerWork's 5% (built into your rate)</li>
</ol>

<p>If you want to take home £25/hour, you might set your rate at £35-40/hour.</p>

<h3>Option 2: Fixed Price Jobs</h3>
<p><strong>Best for:</strong> Routine services, brake pads, common repairs you've done many times.</p>

<p>Fixed pricing gives customers certainty and can be more profitable for efficient workers:</p>
<ul>
<li><strong>Basic service</strong> - £80-120 (customer supplies parts) or £150-200 (you supply)</li>
<li><strong>Brake pad replacement</strong> - £60-100 labour per axle</li>
<li><strong>Diagnostics scan</strong> - £30-50 for code reading and interpretation</li>
</ul>

<blockquote>
<p>"I price 20% under local garages for routine jobs. I work faster than their book times, so I actually earn more per hour while the customer gets a better deal." - James, SpannerWork provider</p>
</blockquote>

<h3>Option 3: Day Rates</h3>
<p><strong>Best for:</strong> Larger projects like clutch replacement, engine work, or helping someone with their restoration project.</p>

<p>Day rates typically range from £150-300 depending on your experience and the work involved.</p>

<h2>Factors That Affect Your Pricing</h2>

<h3>Your Qualifications and Experience</h3>
<p>Be honest about your skill level:</p>
<ul>
<li><strong>Time-served mechanic</strong> with qualifications can command premium rates</li>
<li><strong>Experienced DIYer</strong> should price lower but can still earn well on jobs within their expertise</li>
<li><strong>Specialist skills</strong> (classic cars, performance tuning, specific marques) allow premium pricing</li>
</ul>

<h3>Customer-Supplied vs. You-Supplied Parts</h3>
<p>Two approaches:</p>
<ol>
<li><strong>Labour only</strong> - Customer sources parts. Simpler, less risk, lower earnings.</li>
<li><strong>Complete service</strong> - You source and supply parts at a markup (typically 20-30%). More hassle but higher earnings and convenience for customers.</li>
</ol>

<h3>Mobile vs. Workshop</h3>
<p>If you're going to the customer:</p>
<ul>
<li>Factor in travel time and fuel</li>
<li>Consider a call-out fee for distance</li>
<li>Be realistic about what jobs are possible without a lift</li>
</ul>

<h2>Building Your Reputation</h2>

<p>When starting out, consider:</p>
<ul>
<li>Pricing slightly lower to build reviews quickly</li>
<li>Offering excellent communication and service</li>
<li>Taking before/after photos</li>
<li>Providing clear written notes on what was done</li>
</ul>

<p>Once you have 10+ positive reviews, you can gradually increase your rates.</p>

<h2>Common Pricing Mistakes</h2>

<ol>
<li><strong>Forgetting consumables</strong> - Brake cleaner, copper grease, cable ties add up</li>
<li><strong>Underestimating job time</strong> - Allow for stuck bolts and complications</li>
<li><strong>No cancellation policy</strong> - Consider a small fee for no-shows</li>
<li><strong>Racing to the bottom</strong> - Super-low prices attract price-focused customers who complain more</li>
</ol>

<h2>Sample Price List Template</h2>

<p>Here's a starting point you can adapt:</p>

<table>
<thead>
<tr><th>Service</th><th>Labour Rate</th><th>Notes</th></tr>
</thead>
<tbody>
<tr><td>Basic Service</td><td>£80</td><td>Customer supplies oil/filter</td></tr>
<tr><td>Full Service</td><td>£140</td><td>Including fluids check/top-up</td></tr>
<tr><td>Brake Pads (per axle)</td><td>£70</td><td>Customer supplies parts</td></tr>
<tr><td>Diagnostics Scan</td><td>£40</td><td>Code read + basic diagnosis</td></tr>
<tr><td>Hourly Rate</td><td>£40</td><td>Complex/diagnostic work</td></tr>
</tbody>
</table>

<h2>Ready to Start Earning?</h2>

<p>Set up your SpannerWork profile, add your services with clear pricing, and start connecting with customers who need your skills. <a href="/create">Create your first service listing now</a>.</p>`
  },

  {
    slug: 'safety-checks-before-renting-out-tools',
    title: '5 Essential Safety Checks Before Renting Out Your Tools',
    excerpt: 'Protect yourself and your renters with these pre-rental safety checks. From visual inspections to documentation, here\'s how to rent out tools responsibly.',
    category: 'For Providers',
    tags: ['tool rental', 'safety', 'provider tips', 'equipment', 'liability'],
    author: 'SpannerWork Team',
    readTime: 7,
    metaTitle: 'Tool Rental Safety Checklist | SpannerWork',
    metaDescription: 'Essential safety checks before renting out your tools. Protect yourself and renters with this comprehensive inspection and documentation guide.',
    content: `<h2>Why Safety Checks Matter</h2>
<p>Renting out your tools is a great way to earn from equipment that would otherwise sit idle. But with that opportunity comes responsibility. A faulty tool can cause injuries, damage property, and create liability issues for you as the owner.</p>

<p>This guide covers the essential checks you should perform before every rental to protect yourself and your renters.</p>

<h2>Check 1: Visual Inspection</h2>

<p>Before every rental, give your tools a thorough visual once-over:</p>

<h3>Power Tools</h3>
<ul>
<li><strong>Cord condition</strong> - No cuts, fraying, or exposed wires</li>
<li><strong>Plug integrity</strong> - No cracks, bent pins, or burn marks</li>
<li><strong>Housing</strong> - No cracks that could expose internals</li>
<li><strong>Guards and covers</strong> - All safety guards present and secure</li>
<li><strong>Switches</strong> - Operating correctly, not sticking</li>
</ul>

<h3>Hand Tools</h3>
<ul>
<li><strong>Handles</strong> - No cracks, splinters, or loose heads</li>
<li><strong>Edges</strong> - Sharp tools properly maintained (not dangerously dull)</li>
<li><strong>Adjustment mechanisms</strong> - Working smoothly</li>
<li><strong>Rust</strong> - Surface rust is cosmetic, but check for structural issues</li>
</ul>

<h3>Pneumatic/Hydraulic</h3>
<ul>
<li><strong>Hoses</strong> - No cracks, bulges, or leaks</li>
<li><strong>Fittings</strong> - Secure and not cross-threaded</li>
<li><strong>Seals</strong> - No visible fluid leaks</li>
</ul>

<h2>Check 2: Functional Testing</h2>

<p>A tool might look fine but have hidden issues. Run through these tests:</p>

<h3>Power Tools</h3>
<ol>
<li>Plug in and switch on (in a safe manner)</li>
<li>Check the tool runs smoothly without unusual vibration</li>
<li>Listen for unusual sounds (grinding, clicking)</li>
<li>Verify safety switches work (trigger release, guard interlocks)</li>
<li>Check battery charge holds (for cordless tools)</li>
</ol>

<h3>Mechanical Tools</h3>
<ol>
<li>Work through the full range of motion</li>
<li>Check ratchets engage properly</li>
<li>Verify torque settings are accurate (use a calibrated wrench if available)</li>
<li>Test pressure relief valves (jacks, presses)</li>
</ol>

<blockquote>
<p>"I had a renter return my impact wrench saying it wasn't working. Turned out the switch was failing intermittently. Now I run every power tool for 30 seconds before handing it over." - Paul, tool provider</p>
</blockquote>

<h2>Check 3: Documentation and Photos</h2>

<p>Protect yourself with clear records:</p>

<h3>Before Every Rental</h3>
<ul>
<li><strong>Take photos</strong> of the tool from multiple angles</li>
<li><strong>Document existing wear</strong> - Note any scratches, marks, or cosmetic issues</li>
<li><strong>Record serial numbers</strong> for valuable items</li>
<li><strong>Note condition of accessories</strong> - Cases, blades, bits, etc.</li>
</ul>

<h3>Create a Handover Checklist</h3>
<p>Walk through this with the renter:</p>
<ul>
<li>Tool condition noted and agreed</li>
<li>Accessories included and listed</li>
<li>Any known quirks or important operating notes</li>
<li>Expected return condition</li>
</ul>

<h2>Check 4: Instruction and Manuals</h2>

<p>Not everyone knows how to use every tool properly:</p>

<ul>
<li><strong>Provide manuals</strong> when available (digital copies work fine)</li>
<li><strong>Brief the renter</strong> on safe operation if you suspect they're unfamiliar</li>
<li><strong>Highlight safety features</strong> and their proper use</li>
<li><strong>Note any specific requirements</strong> (oil types, fuel mix, warm-up procedures)</li>
</ul>

<p>If a potential renter seems unsure about safe operation, it's okay to decline the rental or offer a brief tutorial.</p>

<h2>Check 5: Insurance and Liability</h2>

<p>Understand your coverage:</p>

<h3>SpannerWork Protection</h3>
<p>SpannerWork provides a level of protection for tool rentals, but understand the limits:</p>
<ul>
<li>What's covered under the platform's protection</li>
<li>Maximum claim values</li>
<li>Documentation required for claims</li>
</ul>

<h3>Your Own Insurance</h3>
<ul>
<li>Check if your home insurance covers tool rental (most don't)</li>
<li>Consider specific tool insurance for high-value items</li>
<li>Keep records of tool values and purchase receipts</li>
</ul>

<h3>Setting Appropriate Deposits</h3>
<p>Deposits encourage careful use:</p>
<ul>
<li>Set deposits proportional to tool value</li>
<li>Clearly state deposit and damage policies in your listing</li>
<li>Return deposits promptly when tools come back in good condition</li>
</ul>

<h2>Quick Pre-Rental Checklist</h2>

<p>Print this out and use it before each rental:</p>

<ol>
<li>☐ Visual inspection completed - no safety issues found</li>
<li>☐ Functional test - tool operates correctly</li>
<li>☐ Photos taken of current condition</li>
<li>☐ Accessories checked and listed</li>
<li>☐ Renter briefed on safe operation</li>
<li>☐ Return expectations discussed</li>
<li>☐ Deposit collected (if applicable)</li>
</ol>

<h2>What to Do If Something's Wrong</h2>

<p>If you spot an issue during your checks:</p>
<ul>
<li><strong>Minor issues</strong> - Fix before renting, or disclose clearly and adjust pricing</li>
<li><strong>Safety issues</strong> - Do not rent until repaired</li>
<li><strong>Uncertain</strong> - Have it checked by a professional before renting</li>
</ul>

<p>Your reputation depends on providing safe, working equipment. A few extra minutes of checks before each rental protects everyone involved.</p>

<p>Ready to list your tools? <a href="/create">Create a tool listing on SpannerWork</a> and start earning safely.</p>`
  },

  {
    slug: 'workshop-space-vs-home-garage-comparison',
    title: 'Workshop Space vs Home Garage: Which is Right for Your Project?',
    excerpt: 'Deciding where to work on your project? Compare the pros, cons, and true costs of renting workshop space versus working from your home garage.',
    category: 'Workshop Space',
    tags: ['workshop rental', 'garage', 'DIY projects', 'car repair', 'comparison'],
    author: 'SpannerWork Team',
    readTime: 8,
    metaTitle: 'Workshop Rental vs Home Garage | SpannerWork',
    metaDescription: 'Compare workshop rental vs working from home. True cost analysis, pros and cons for different project types, and when to consider renting space.',
    content: `<h2>The Space Dilemma</h2>
<p>Every DIY mechanic and car enthusiast faces this question at some point: is my home setup good enough, or should I rent proper workshop space?</p>

<p>The answer depends on your project, budget, and how much you value your time. Let's break down both options honestly.</p>

<h2>Working From Home: The Reality</h2>

<h3>Typical Home Garage Setup</h3>
<p>Most UK garages offer:</p>
<ul>
<li>Roughly 2.4m × 5m (enough for one car plus a bit of space)</li>
<li>Single power socket (maybe two if you're lucky)</li>
<li>No lift or pit access</li>
<li>Concrete floor (often not level)</li>
<li>Limited headroom for engine hoists</li>
<li>Shared with bikes, lawnmowers, and things that "might come in useful"</li>
</ul>

<h3>True Costs of Home Work</h3>
<p>While working at home seems "free," consider:</p>
<ul>
<li><strong>Tools and equipment</strong> - You need to own everything</li>
<li><strong>Electricity</strong> - Running compressors and welders adds up</li>
<li><strong>Heating</strong> - Working in British winters is miserable without it</li>
<li><strong>Time impact</strong> - Without a lift, many jobs take 2-3× longer</li>
<li><strong>Storage</strong> - Where do the removed parts go?</li>
</ul>

<h3>Home Garage Pros</h3>
<ul>
<li>Always available (no booking required)</li>
<li>Familiar environment with your tools where you left them</li>
<li>No travel time or costs</li>
<li>Can work in short bursts</li>
<li>Tea kettle ten steps away</li>
</ul>

<h3>Home Garage Cons</h3>
<ul>
<li>Limited to jobs you can do on axle stands</li>
<li>Crawling on concrete is hard on the body</li>
<li>Neighbours may object to noise and smells</li>
<li>Partner may object to oil on the drive</li>
<li>Weather impacts work (garage doors open for ventilation)</li>
</ul>

<h2>Renting Workshop Space: What You Get</h2>

<h3>Typical Rental Workshop</h3>
<p>A good rental space typically includes:</p>
<ul>
<li>Vehicle lift (2 or 4 post)</li>
<li>Compressed air supply</li>
<li>Ample power outlets (240V and often 3-phase)</li>
<li>Proper lighting</li>
<li>Workbench and vice</li>
<li>Basic tools available</li>
<li>Oil disposal facilities</li>
<li>Heating in winter</li>
</ul>

<h3>True Costs of Workshop Rental</h3>
<p>Typical UK rates:</p>
<ul>
<li><strong>Hourly</strong> - £20-40/hour (minimum booking usually 2-3 hours)</li>
<li><strong>Half day</strong> - £60-100</li>
<li><strong>Full day</strong> - £100-180</li>
<li><strong>Regular booking discounts</strong> - Often available for repeat customers</li>
</ul>

<h3>Workshop Pros</h3>
<ul>
<li>Lift access transforms difficult jobs</li>
<li>Professional equipment you couldn't justify buying</li>
<li>Purpose-designed space (drainage, extraction, lighting)</li>
<li>Often expert advice available</li>
<li>Focused working environment</li>
</ul>

<h3>Workshop Cons</h3>
<ul>
<li>Costs money for every session</li>
<li>Need to book in advance</li>
<li>Travel time and transport issues</li>
<li>Can't leave projects mid-job easily</li>
<li>Need to bring or arrange tools and parts</li>
</ul>

<h2>Which Projects Suit Which Space?</h2>

<h3>Fine at Home</h3>
<ul>
<li>Oil and filter changes</li>
<li>Brake pad replacement</li>
<li>Battery replacement</li>
<li>Basic electrical work</li>
<li>Interior work</li>
<li>Diagnostics and code reading</li>
</ul>

<h3>Better in a Workshop</h3>
<ul>
<li>Exhaust work (access from below is essential)</li>
<li>Suspension overhauls</li>
<li>Gearbox and clutch replacement</li>
<li>Subframe and chassis inspection</li>
<li>Fuel tank work</li>
<li>Welding and bodywork</li>
</ul>

<h3>The Hybrid Approach</h3>
<p>Many enthusiasts use both:</p>
<ol>
<li><strong>Diagnose at home</strong> - Figure out what's needed</li>
<li><strong>Order parts</strong> - Get everything ready</li>
<li><strong>Book workshop</strong> - For the actual work</li>
<li><strong>Finishing touches at home</strong> - Clean up and final checks</li>
</ol>

<h2>Cost Comparison: Real Example</h2>

<p>Let's compare a clutch replacement:</p>

<h3>At Home</h3>
<ul>
<li>2 weekends of work (uncomfortable, on your back)</li>
<li>Transmission jack rental: £30</li>
<li>Axle stands and support: Own (£0)</li>
<li>Frustration level: High</li>
<li><strong>Total extra cost: £30</strong></li>
</ul>

<h3>At Workshop</h3>
<ul>
<li>1 day of focused work (on a lift)</li>
<li>Workshop rental: £120</li>
<li>Lift makes job 3× faster and safer</li>
<li>Frustration level: Low</li>
<li><strong>Total extra cost: £120</strong></li>
</ul>

<p>The £90 difference might be worth it for your sanity and your back.</p>

<h2>Finding Workshop Space</h2>

<p>SpannerWork connects you with local workshop spaces available for rent. Options range from:</p>
<ul>
<li>Professional units with multiple lifts</li>
<li>Home workshops with single lift access</li>
<li>Shared space with other enthusiasts</li>
<li>Full-service options with tools included</li>
</ul>

<p>Browse what's available near you and read reviews from other users who've worked there.</p>

<h2>Making the Decision</h2>

<p>Ask yourself:</p>
<ol>
<li>How often do I work on cars? (Regular = invest in home setup)</li>
<li>What jobs am I doing? (Undercar = workshop value)</li>
<li>How much is my time worth? (Lift = faster = home sooner)</li>
<li>Do I enjoy the process? (If yes, home garage is part of the hobby)</li>
</ol>

<h2>Conclusion</h2>

<p>There's no wrong answer. Many enthusiasts maintain a decent home setup for regular maintenance while renting workshop space for bigger projects. The key is being realistic about what's possible in your space and not letting inadequate facilities turn a fun project into a frustrating chore.</p>

<p>Ready to find workshop space near you? <a href="/feed">Browse available workshops on SpannerWork</a>.</p>`
  },

  {
    slug: 'diyers-guide-diagnostic-tools',
    title: 'The DIYer\'s Guide to Diagnostic Tools: What You Actually Need',
    excerpt: 'Cut through the marketing hype and learn which diagnostic tools are worth buying for home mechanics, from basic code readers to professional-level scanners.',
    category: 'Tools & Equipment',
    tags: ['diagnostics', 'OBD2', 'car tools', 'DIY mechanic', 'equipment guide'],
    author: 'SpannerWork Team',
    readTime: 9,
    metaTitle: 'DIY Car Diagnostics Guide | SpannerWork',
    metaDescription: 'Which diagnostic tools do you actually need? Honest guide to OBD2 scanners, multimeters, and specialist equipment for home mechanics.',
    content: `<h2>The Diagnostic Dilemma</h2>
<p>Walk into Halfords or browse Amazon for diagnostic tools and you'll find options ranging from £10 to £5,000. Marketing promises everything from "professional-level diagnostics" to "reads all codes on all cars."</p>

<p>The reality? Most DIY mechanics need far less than they think, and what they do need, they often get wrong. This guide cuts through the hype.</p>

<h2>Understanding OBD2 Basics</h2>

<h3>What OBD2 Actually Does</h3>
<p>On-Board Diagnostics II (OBD2) is a standardised system that:</p>
<ul>
<li>Monitors emission-related systems</li>
<li>Stores fault codes when problems are detected</li>
<li>Provides live data from various sensors</li>
<li>Allows resetting of warning lights</li>
</ul>

<h3>What OBD2 Doesn't Do</h3>
<ul>
<li>Cover all car systems (ABS, airbags, gearbox often separate)</li>
<li>Tell you exactly what's broken</li>
<li>Replace proper diagnosis</li>
<li>Work the same on every car</li>
</ul>

<blockquote>
<p>"A code reader tells you the symptom, not the problem. P0171 (lean condition) could be a vacuum leak, MAF sensor, fuel pump, or twenty other things." - Every frustrated DIYer, eventually</p>
</blockquote>

<h2>Tier 1: Essential (Under £50)</h2>

<h3>Basic OBD2 Code Reader</h3>
<p><strong>What it does:</strong> Reads and clears engine fault codes, shows live data basics.</p>

<p><strong>What to buy:</strong></p>
<ul>
<li>Budget: ELM327 Bluetooth adapter (£10-20) + free app (Torque, OBD Auto Doctor)</li>
<li>Better: Dedicated unit like Ancel AD310 (£25-40)</li>
</ul>

<p><strong>Good for:</strong></p>
<ul>
<li>Understanding why the engine light is on</li>
<li>Pre-purchase checks</li>
<li>Clearing codes after repairs</li>
<li>Basic live data monitoring</li>
</ul>

<p><strong>Limitations:</strong></p>
<ul>
<li>Engine only (generic OBD2)</li>
<li>Limited manufacturer-specific codes</li>
<li>No ABS, airbag, or body systems</li>
</ul>

<h3>Digital Multimeter</h3>
<p><strong>What it does:</strong> Measures voltage, resistance, current.</p>

<p><strong>What to buy:</strong> Any auto-ranging meter from a decent brand (£20-40). Fluke if you want one for life.</p>

<p><strong>Good for:</strong></p>
<ul>
<li>Testing battery voltage and charging</li>
<li>Checking fuses and circuits</li>
<li>Testing sensors</li>
<li>Finding parasitic drains</li>
</ul>

<p><strong>Essential skill:</strong> Learn to use it properly. A multimeter in unskilled hands is just a number generator.</p>

<h2>Tier 2: Useful (£50-200)</h2>

<h3>Enhanced OBD2 Scanner</h3>
<p><strong>What it does:</strong> Reads manufacturer-specific codes beyond basic OBD2.</p>

<p><strong>What to buy:</strong></p>
<ul>
<li>iCarsoft (make-specific versions): £80-120</li>
<li>Foxwell NT510 Elite: £150-200 (covers most makes)</li>
</ul>

<p><strong>Good for:</strong></p>
<ul>
<li>ABS and airbag codes</li>
<li>Transmission codes</li>
<li>Manufacturer-specific information</li>
<li>More detailed live data</li>
<li>Some service resets (oil, brakes)</li>
</ul>

<h3>12V Test Light</h3>
<p><strong>Cost:</strong> £5-15</p>

<p>Faster than a multimeter for quick checks:</p>
<ul>
<li>Power to a circuit? Probe and see.</li>
<li>Good ground? Clip to positive, probe the ground.</li>
<li>Finding switched vs constant live.</li>
</ul>

<h2>Tier 3: Specialist (£200-1000)</h2>

<h3>Professional Scan Tools</h3>
<p>Tools like Snap-on, Autel MaxiCOM, or Launch X431 offer:</p>
<ul>
<li>Bi-directional control (actuate components)</li>
<li>Key programming</li>
<li>ECU coding and adaptation</li>
<li>Full system coverage</li>
<li>Guided diagnostics</li>
</ul>

<p><strong>Do you need this?</strong> Probably not, unless you're working on cars professionally or have a specific need (like key programming for a fleet).</p>

<p><strong>Alternative:</strong> Rent access when needed through SpannerWork providers, or pay a garage for specific diagnostic tasks.</p>

<h3>Oscilloscope</h3>
<p>For serious electrical diagnosis:</p>
<ul>
<li>Viewing sensor waveforms</li>
<li>Checking injector patterns</li>
<li>Ignition analysis</li>
</ul>

<p><strong>Entry options:</strong> Hantek USB scopes (£80-150) or automotive-specific Pico (£300+)</p>

<p>Most DIYers will never need one. If you do, you'll know.</p>

<h2>When to Rent vs Buy</h2>

<h3>Buy</h3>
<ul>
<li>Basic code reader - You'll use it often</li>
<li>Multimeter - Essential and inexpensive</li>
<li>Make-specific scanner if you only own one brand</li>
</ul>

<h3>Rent or Borrow</h3>
<ul>
<li>Professional-level scanners for occasional use</li>
<li>Specialist equipment (oscilloscopes, smoke machines)</li>
<li>Make-specific tools you'll use once</li>
</ul>

<p>SpannerWork has providers offering diagnostic equipment rental and even diagnostic services where they come to you with professional gear.</p>

<h2>The Honest Truth About Diagnostics</h2>

<h3>Codes Are Clues, Not Answers</h3>
<p>A fault code points to a system or circuit, not a specific failed part. Good diagnosis requires:</p>
<ol>
<li>Reading the code</li>
<li>Understanding what triggers it</li>
<li>Testing the relevant components</li>
<li>Verifying the repair</li>
</ol>

<h3>YouTube Isn't Always Right</h3>
<p>"Just replace the X sensor" videos often show one case that happened to work. Your same code might have a completely different cause.</p>

<h3>Know Your Limits</h3>
<p>Complex diagnostic work often requires:</p>
<ul>
<li>Understanding of system operation</li>
<li>Technical data and wiring diagrams</li>
<li>Experience with similar faults</li>
<li>Professional equipment</li>
</ul>

<p>There's no shame in using your code reader to understand the general problem, then taking it to a professional for confirmation and repair.</p>

<h2>Recommended Starter Kit</h2>

<p>For most DIY mechanics working on their own cars:</p>
<ul>
<li>ELM327 Bluetooth adapter with Torque app: £15</li>
<li>Auto-ranging multimeter: £30</li>
<li>12V test light: £10</li>
<li>Make-specific scanner (optional): £100-150</li>
</ul>

<p><strong>Total: £55-205</strong></p>

<p>This covers 90% of diagnostic needs for home mechanics. For the other 10%, rent, borrow, or pay for professional diagnosis.</p>

<h2>Find Diagnostic Tools to Rent</h2>

<p>Need professional equipment for a specific job? <a href="/feed">Browse diagnostic equipment rentals on SpannerWork</a> or find a provider who offers mobile diagnostic services.</p>`
  },

  {
    slug: 'prepare-car-for-lift-session',
    title: 'How to Prepare Your Car for a Rented Lift Session',
    excerpt: 'Maximise your workshop rental time with proper preparation. What to do before you arrive, what to bring, and how to make the most of your booked session.',
    category: 'DIY Tips',
    tags: ['workshop rental', 'preparation', 'car lift', 'DIY tips', 'efficiency'],
    author: 'SpannerWork Team',
    readTime: 6,
    metaTitle: 'Workshop Lift Session Prep Guide | SpannerWork',
    metaDescription: 'Get the most from your workshop rental. Preparation checklist, what to bring, and tips for efficient lift session work on your car.',
    content: `<h2>Why Preparation Matters</h2>
<p>Workshop time isn't free. Whether you're paying £40 for a couple of hours or £150 for a full day, you want to spend that time actually working on your car—not running to the parts shop or realising you forgot a crucial tool.</p>

<p>Good preparation can double your productivity. Here's how to arrive ready to work.</p>

<h2>Before Booking: Know What You're Doing</h2>

<h3>Research Your Job</h3>
<ul>
<li>Watch tutorial videos specific to your car model</li>
<li>Read forum posts about common issues and gotchas</li>
<li>Download the workshop manual section (Haynes, Autodata, or manufacturer)</li>
<li>Make a step-by-step checklist of the procedure</li>
</ul>

<h3>Estimate Time Realistically</h3>
<p>Whatever time the internet says, add 50% for:</p>
<ul>
<li>Stuck bolts</li>
<li>Unexpected discoveries</li>
<li>Tools you forgot</li>
<li>Coffee breaks</li>
</ul>

<p>A "2-hour job" often takes 3-4 hours in reality, especially your first time.</p>

<h2>Parts Preparation</h2>

<h3>Order Everything in Advance</h3>
<ul>
<li>Don't rely on next-day delivery—order 3-4 days early</li>
<li>Get the correct parts (VIN lookup if unsure)</li>
<li>Order spares of anything likely to break during removal</li>
<li>Consider pattern vs OE based on your budget and the component</li>
</ul>

<h3>The "While You're There" List</h3>
<p>If you're going underneath anyway, what else makes sense?</p>
<ul>
<li>Exhaust work? Check hangers and clamps</li>
<li>Suspension? Might as well do drop links</li>
<li>Brakes? Inspect flexible hoses</li>
</ul>

<p>Order these parts too—you've already paid for the lift time.</p>

<h3>Consumables Checklist</h3>
<ul>
<li>Correct fluids (oil, coolant, brake fluid, gearbox oil)</li>
<li>Copper grease / anti-seize</li>
<li>Thread lock (if specified)</li>
<li>New bolts if one-use (stretch bolts, etc.)</li>
<li>Gaskets and seals</li>
<li>Brake cleaner</li>
<li>Cable ties</li>
</ul>

<h2>Tool Preparation</h2>

<h3>Make a Tool List</h3>
<p>Based on your research, list every tool you'll need:</p>
<ul>
<li>Socket sizes (metric and imperial if applicable)</li>
<li>Spanner sizes</li>
<li>Specialist tools (ball joint splitter, spring compressor, etc.)</li>
<li>Torque wrench (check the specs needed)</li>
</ul>

<h3>Check What the Workshop Provides</h3>
<p>Many workshop rentals include:</p>
<ul>
<li>Basic hand tools</li>
<li>Air tools (impact wrench, ratchet)</li>
<li>Jack and stands (in addition to the lift)</li>
<li>Workbench and vice</li>
</ul>

<p>Ask before you arrive so you don't bring unnecessary gear.</p>

<h3>Pack the Night Before</h3>
<ul>
<li>Load tools into the car</li>
<li>Parts boxed and labelled</li>
<li>Fluids ready</li>
<li>Rags and gloves</li>
<li>Creeper if you have one (even with a lift, useful for low tasks)</li>
</ul>

<h2>Day of Your Session</h2>

<h3>Before You Leave Home</h3>
<ul>
<li>Check your booking time and address</li>
<li>Confirm the workshop can reach you if issues arise</li>
<li>Fill the fuel tank (you may need to run the engine)</li>
<li>Check tyre pressures are reasonable (for rolling onto lift)</li>
</ul>

<h3>What to Bring</h3>
<ul>
<li><strong>Essential:</strong> All parts, tools you need, workshop manual/notes</li>
<li><strong>Comfort:</strong> Food, drinks, music speaker</li>
<li><strong>Backup:</strong> Phone charger, card for emergency parts run</li>
<li><strong>Capture:</strong> Phone for photos and videos of reassembly references</li>
</ul>

<blockquote>
<p>"I now photograph every connection, hose routing, and bolt location before I undo anything. Saves hours during reassembly." - Every experienced DIYer</p>
</blockquote>

<h2>During Your Session</h2>

<h3>Arrival</h3>
<ol>
<li>Check in with the workshop provider</li>
<li>Confirm lift operation and any house rules</li>
<li>Position car and raise it before unpacking tools</li>
<li>Quick inspection of what you're working on</li>
</ol>

<h3>Work Efficiently</h3>
<ul>
<li>Lay out parts and tools before starting</li>
<li>Keep bolts organised (labelled bags, magnetic trays)</li>
<li>Take photos at each disassembly stage</li>
<li>Don't fight stuck bolts—use penetrating oil and take breaks</li>
</ul>

<h3>If Something Goes Wrong</h3>
<ul>
<li>Don't panic—most issues have solutions</li>
<li>Ask the workshop owner for advice (if available)</li>
<li>Have a backup plan (can the car leave on its own wheels?)</li>
<li>Know the nearest parts shop and their closing time</li>
</ul>

<h2>End of Session</h2>

<h3>Before Leaving</h3>
<ul>
<li>Complete your work checklist</li>
<li>Torque all critical bolts to spec</li>
<li>Lower the car and check nothing is hanging or loose</li>
<li>Test drive if possible and safe</li>
<li>Pack all your tools (count them!)</li>
<li>Clean up your work area</li>
<li>Check for leaks after the car has sat for a few minutes</li>
</ul>

<h3>After You Leave</h3>
<ul>
<li>Re-check critical bolts after 50-100 miles</li>
<li>Leave a review for the workshop (helps others and the provider)</li>
<li>Note anything you'd do differently next time</li>
</ul>

<h2>Preparation Checklist</h2>

<p>Print and use:</p>

<ol>
<li>☐ Job researched and procedure understood</li>
<li>☐ All parts ordered and received</li>
<li>☐ Consumables ready</li>
<li>☐ Tool list prepared and packed</li>
<li>☐ Workshop booking confirmed</li>
<li>☐ Car fuel tank filled</li>
<li>☐ Phone charged for photos</li>
<li>☐ Food and drinks packed</li>
<li>☐ Emergency cash/card for parts run</li>
</ol>

<h2>Find Workshop Space</h2>

<p>Ready to book a lift session? <a href="/feed">Browse available workshops on SpannerWork</a> and find space near you with the equipment you need.</p>`
  },

  {
    slug: 'hobbyist-to-side-hustle-part-time-mechanic',
    title: 'From Hobbyist to Side Hustle: Earning as a Part-Time Mechanic',
    excerpt: 'Turn your passion into profit. A practical guide to offering mechanic services on the side, from legal considerations to getting your first customers.',
    category: 'For Providers',
    tags: ['side hustle', 'mobile mechanic', 'earning', 'business', 'getting started'],
    author: 'SpannerWork Team',
    readTime: 11,
    metaTitle: 'Start Earning as a Part-Time Mechanic | SpannerWork',
    metaDescription: 'Turn your car knowledge into a side income. Legal requirements, insurance, pricing, and tips for starting as a part-time mechanic in the UK.',
    content: `<h2>The Opportunity</h2>
<p>You've been working on your own cars for years. Friends ask you to help with theirs. Family members expect you at every breakdown. Sound familiar?</p>

<p>What if those favours became a legitimate side income? The UK has a massive demand for affordable, skilled mechanics outside the main dealer network. And with platforms like SpannerWork, reaching customers has never been easier.</p>

<p>But before you start advertising, there are important considerations. This guide walks you through turning hobby skills into a proper side business.</p>

<h2>Am I Ready?</h2>

<h3>Honest Skill Assessment</h3>
<p>Ask yourself:</p>
<ul>
<li>What jobs can I do confidently and safely?</li>
<li>Where are my knowledge gaps?</li>
<li>Am I good at diagnosing problems, or just following instructions?</li>
<li>Can I handle unexpected complications?</li>
</ul>

<p>It's perfectly fine to offer a limited range of services. Many successful providers specialise:</p>
<ul>
<li>Servicing and brakes only</li>
<li>Classic cars</li>
<li>Specific makes (VAG specialist, BMW specialist)</li>
<li>Pre-purchase inspections</li>
</ul>

<h3>Qualifications</h3>
<p><strong>The legal position:</strong> You don't legally need qualifications to work on cars in the UK (unlike, say, gas work).</p>

<p><strong>The practical position:</strong> Qualifications help with:</p>
<ul>
<li>Customer trust</li>
<li>Insurance options</li>
<li>Your own confidence</li>
<li>Handling warranty claims</li>
</ul>

<p>If you don't have formal qualifications, be honest about it. Many customers are happy with experienced DIYers for routine work—they just want transparency.</p>

<h2>Legal and Business Considerations</h2>

<h3>Self-Employment</h3>
<p>If you're earning money regularly, you need to:</p>
<ol>
<li><strong>Register as self-employed</strong> with HMRC (do this as soon as you start earning)</li>
<li><strong>Keep records</strong> of all income and expenses</li>
<li><strong>File a self-assessment tax return</strong> each year</li>
<li><strong>Pay National Insurance</strong> if earnings exceed the threshold</li>
</ol>

<p>This sounds daunting but is straightforward. Many side-hustlers manage their own bookkeeping with simple spreadsheets or apps like FreeAgent.</p>

<h3>Insurance</h3>
<p>This is critical. You need:</p>

<p><strong>Public Liability Insurance</strong></p>
<ul>
<li>Covers damage to third-party property</li>
<li>Covers injury to others</li>
<li>Typically £1-5 million cover</li>
<li>Cost: £150-400/year for part-time work</li>
</ul>

<p><strong>Professional Indemnity (optional but recommended)</strong></p>
<ul>
<li>Covers claims of negligent advice or work</li>
<li>Important if you're doing diagnostics or safety-critical work</li>
</ul>

<p><strong>Road Risk Insurance</strong></p>
<ul>
<li>If you're driving customers' cars</li>
<li>Your personal car insurance won't cover this</li>
<li>Options: Individual policies or "any driver" coverage</li>
</ul>

<p>Get quotes from specialists like Simply Business or Hiscox who understand motor trade side work.</p>

<h3>Location Considerations</h3>
<p><strong>Working from home:</strong></p>
<ul>
<li>Check your home insurance policy</li>
<li>Some policies exclude business use</li>
<li>Neighbours may have concerns (noise, vehicles)</li>
<li>Council may have views on running a business</li>
</ul>

<p><strong>Mobile work:</strong></p>
<ul>
<li>Fewer restrictions</li>
<li>Need suitable transport for tools</li>
<li>Limited to jobs possible without a lift</li>
<li>Weather dependent</li>
</ul>

<p><strong>Rented workspace:</strong></p>
<ul>
<li>Professional image</li>
<li>Access to lifts and equipment</li>
<li>Higher overhead</li>
<li>May need to book in advance</li>
</ul>

<h2>Setting Up on SpannerWork</h2>

<h3>Creating Your Profile</h3>
<p>Your profile is your shopfront. Make it count:</p>
<ul>
<li><strong>Clear photo</strong> - You, or you with a car you've worked on</li>
<li><strong>Honest bio</strong> - Your experience, specialities, approach</li>
<li><strong>Specific services</strong> - What exactly do you offer?</li>
<li><strong>Clear pricing</strong> - Hourly rate, fixed prices for common jobs</li>
<li><strong>Availability</strong> - When can you work?</li>
</ul>

<h3>Listing Your Services</h3>
<p>Start with what you know well:</p>
<ul>
<li>Services that you can complete confidently</li>
<li>Jobs you've done many times</li>
<li>Work you can price accurately</li>
</ul>

<p>You can always add more services as you build experience and reviews.</p>

<h3>Getting Your First Reviews</h3>
<p>The chicken-and-egg problem: customers want reviews, but you need customers first.</p>

<p>Options:</p>
<ul>
<li>Price your first few jobs competitively to attract bookings</li>
<li>Offer friends/family official bookings (they pay, you deliver professionally, they leave honest reviews)</li>
<li>Be exceptionally responsive and communicative with early enquiries</li>
<li>Follow up politely to remind happy customers to leave reviews</li>
</ul>

<h2>Running Your Side Business</h2>

<h3>Communication</h3>
<p>Good communication is as important as good work:</p>
<ul>
<li>Respond to enquiries quickly (within hours, not days)</li>
<li>Explain clearly what you'll do and what it costs</li>
<li>Keep customers updated during longer jobs</li>
<li>If you find additional problems, explain before proceeding</li>
</ul>

<h3>Managing Expectations</h3>
<ul>
<li>Be honest about your skill level</li>
<li>Don't take on jobs beyond your capability</li>
<li>Allow for unexpected complications</li>
<li>Have a plan for when things go wrong</li>
</ul>

<h3>Handling Problems</h3>
<p>Things will occasionally go wrong. How you handle it matters:</p>
<ul>
<li>Acknowledge the issue honestly</li>
<li>Take responsibility where appropriate</li>
<li>Fix problems at your cost if you caused them</li>
<li>Use insurance if needed (that's what it's for)</li>
</ul>

<h2>Growing Your Side Hustle</h2>

<h3>Building Reputation</h3>
<ul>
<li>Deliver consistent quality work</li>
<li>Build relationships with repeat customers</li>
<li>Ask satisfied customers for referrals</li>
<li>Learn from feedback (even negative)</li>
</ul>

<h3>Expanding Services</h3>
<p>As you gain experience and confidence:</p>
<ul>
<li>Add new services you're competent at</li>
<li>Consider specialist areas with less competition</li>
<li>Invest in training for in-demand skills</li>
<li>Build relationships with specialists who can help with work beyond your scope</li>
</ul>

<h3>Know When It's Working</h3>
<p>Signs your side hustle is successful:</p>
<ul>
<li>Repeat customers</li>
<li>Referrals from happy clients</li>
<li>Steady booking requests</li>
<li>Positive reviews</li>
<li>Income exceeding expenses and time invested</li>
</ul>

<h2>Real Talk: The Challenges</h2>

<p>It's not all easy:</p>
<ul>
<li><strong>Time pressure</strong> - Balancing day job, side work, and life</li>
<li><strong>Physical demands</strong> - Working evenings/weekends after a full work week</li>
<li><strong>Difficult customers</strong> - They exist, you'll meet them</li>
<li><strong>Unexpected problems</strong> - That simple job that becomes a nightmare</li>
<li><strong>Financial uncertainty</strong> - Bookings vary, costs are constant</li>
</ul>

<p>Start small, build gradually, and don't burn yourself out.</p>

<h2>Getting Started Checklist</h2>

<ol>
<li>☐ Honest assessment of skills and limits</li>
<li>☐ Register as self-employed</li>
<li>☐ Get appropriate insurance</li>
<li>☐ Set up record-keeping system</li>
<li>☐ Create SpannerWork profile</li>
<li>☐ List initial services</li>
<li>☐ Research local pricing</li>
<li>☐ Prepare workspace and tools</li>
<li>☐ Complete first booking</li>
<li>☐ Get first review</li>
</ol>

<h2>Ready to Start?</h2>

<p>There's never a perfect time to begin. If you've read this far, you're already thinking seriously about it.</p>

<p><a href="/create">Create your provider profile on SpannerWork</a> and start your journey from hobbyist to earning side-hustler.</p>`
  }
];

async function main() {
  console.log('Starting blog post seeding...');

  for (const post of blogPosts) {
    try {
      // Check if post already exists
      const existing = await prisma.blogPost.findUnique({
        where: { slug: post.slug }
      });

      if (existing) {
        console.log(`Skipping "${post.title}" - already exists`);
        continue;
      }

      await prisma.blogPost.create({
        data: {
          ...post,
          status: 'DRAFT',
          publishedAt: null
        }
      });

      console.log(`Created: "${post.title}"`);
    } catch (error) {
      console.error(`Error creating "${post.title}":`, error);
    }
  }

  console.log('Blog post seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
