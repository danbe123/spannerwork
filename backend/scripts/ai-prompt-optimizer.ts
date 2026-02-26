#!/usr/bin/env npx tsx
/**
 * AI Prompt Optimizer - Claude's Quality Control System
 *
 * This script tests Gemini outputs against quality criteria and iteratively
 * refines prompts until 98% satisfaction is achieved.
 *
 * Run with: npx tsx scripts/ai-prompt-optimizer.ts
 */

import * as fs from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  targetSatisfaction: 98,
  maxIterations: 20,
  testsPerIteration: 10,
  apiKey: process.env.GEMINI_API_KEY || '',
  model: 'gemini-3-flash-preview',  // Frontier Flash 3 model
  resultsFile: './scripts/optimization-results.json',
  promptsFile: './scripts/optimized-prompts.json',
  retryDelayMs: 10000,  // Wait 10s between retries for rate limits
  maxRetries: 3,
};

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ============================================================================
// TEST CASES - Real-world inputs from UK automotive tool rental
// ============================================================================

const TEST_CASES = [
  { input: "makita drill good condition 2 batteries", expectedCategory: "Power Tools" },
  { input: "snap on scanner reads all codes obd2", expectedCategory: "Diagnostics" },
  { input: "3 ton trolley jack heavy duty", expectedCategory: "Lifting Equipment" },
  { input: "basic socket set half inch drive chrome", expectedCategory: "Hand Tools" },
  { input: "mig welder 180amp gas/gasless", expectedCategory: "Welding" },
  { input: "air compressor 50 litre tank good nick", expectedCategory: "Air Tools" },
  { input: "engine hoist 2 ton foldable", expectedCategory: "Lifting Equipment" },
  { input: "dewalt angle grinder 9 inch", expectedCategory: "Power Tools" },
  { input: "torque wrench 1/2 inch drive calibrated", expectedCategory: "Hand Tools" },
  { input: "brake bleeding kit with catch bottle", expectedCategory: "Specialist Tools" },
  { input: "timing light strobe diesel petrol", expectedCategory: "Diagnostics" },
  { input: "impact wrench cordless milwaukee", expectedCategory: "Power Tools" },
  { input: "axle stands 3 ton pair ratchet", expectedCategory: "Lifting Equipment" },
  { input: "multimeter fluke digital automotive", expectedCategory: "Diagnostics" },
  { input: "spring compressor macpherson strut", expectedCategory: "Specialist Tools" },
];

// ============================================================================
// QUALITY CRITERIA - What makes a good AI output
// ============================================================================

interface QualityScore {
  criterion: string;
  score: number; // 0-100
  feedback: string;
}

interface EvaluationResult {
  overallScore: number;
  scores: QualityScore[];
  pass: boolean;
  rawOutput: any;
  input: string;
}

function evaluateTitleQuality(output: any, input: string): QualityScore {
  const title = output?.title || '';
  let score = 0;
  const feedback: string[] = [];

  // Length check (5-60 chars ideal)
  if (title.length >= 5 && title.length <= 60) {
    score += 30;
  } else {
    feedback.push(`Title length ${title.length} outside 5-60`);
  }

  // Starts with capital
  if (/^[A-Z]/.test(title)) {
    score += 10;
  } else {
    feedback.push('Should start with capital');
  }

  // Contains brand if mentioned in input - improved matching
  const brandMappings: Record<string, string[]> = {
    'makita': ['makita'],
    'snap-on': ['snap-on', 'snapon', 'snap on'],
    'dewalt': ['dewalt', 'de walt'],
    'milwaukee': ['milwaukee'],
    'bosch': ['bosch'],
    'fluke': ['fluke'],
    'sealey': ['sealey'],
    'draper': ['draper'],
    'clarke': ['clarke'],
  };

  const inputLower = input.toLowerCase();
  const titleLower = title.toLowerCase();

  // Find which brand is mentioned in input
  let foundBrand = false;
  let brandMatched = false;

  for (const [canonical, variants] of Object.entries(brandMappings)) {
    if (variants.some(v => inputLower.includes(v))) {
      foundBrand = true;
      // Check if ANY variant appears in title (normalized)
      const titleNormalized = titleLower.replace(/-/g, '').replace(/ /g, '');
      const allVariants = [...variants, canonical, canonical.replace(/-/g, '')];
      if (allVariants.some(v => titleNormalized.includes(v.replace(/-/g, '').replace(/ /g, '')))) {
        brandMatched = true;
        break;
      }
    }
  }

  if (foundBrand) {
    if (brandMatched) {
      score += 30;
    } else {
      feedback.push('Brand missing from title');
    }
  } else {
    score += 30; // No brand mentioned, full points
  }

  // Professional wording (no slang)
  const slang = ['mate', 'innit', 'gonna', 'wanna', 'lovely', 'cracking'];
  if (!slang.some(s => titleLower.includes(s))) {
    score += 30;
  } else {
    feedback.push('Contains informal language');
  }

  return { criterion: 'title_quality', score, feedback: feedback.join('; ') || '✓' };
}

function evaluateDescriptionConciseness(output: any): QualityScore {
  const desc = output?.description || '';
  let score = 0;
  const feedback: string[] = [];

  // Word count (ideal: 15-50 words)
  const wordCount = desc.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 15 && wordCount <= 50) {
    score += 50;
  } else if (wordCount < 15) {
    score += 20;
    feedback.push(`Too short (${wordCount} words)`);
  } else {
    score += Math.max(0, 50 - (wordCount - 50) * 2);
    feedback.push(`Too long (${wordCount} words)`);
  }

  // Sentence count (ideal: 2-4)
  const sentenceCount = (desc.match(/[.!?]+/g) || []).length;
  if (sentenceCount >= 2 && sentenceCount <= 4) {
    score += 30;
  } else {
    score += 15;
    feedback.push(`${sentenceCount} sentences (ideal: 2-4)`);
  }

  // No marketing waffle
  const waffle = ['amazing', 'fantastic', 'incredible', 'perfect for', 'ideal for all', 'look no further', 'whether you'];
  if (!waffle.some(w => desc.toLowerCase().includes(w))) {
    score += 20;
  } else {
    feedback.push('Contains marketing fluff');
  }

  return { criterion: 'description_conciseness', score, feedback: feedback.join('; ') || '✓' };
}

function evaluateCategoryAccuracy(output: any, expected: any): QualityScore {
  const category = (output?.category || '').toLowerCase().trim();
  const expectedCat = (expected?.expectedCategory || '').toLowerCase().trim();

  if (category === expectedCat) {
    return { criterion: 'category_accuracy', score: 100, feedback: '✓' };
  }

  // Partial match
  if (category.includes(expectedCat.split(' ')[0]) || expectedCat.includes(category.split(' ')[0])) {
    return { criterion: 'category_accuracy', score: 60, feedback: `Got "${category}", expected "${expectedCat}"` };
  }

  return { criterion: 'category_accuracy', score: 0, feedback: `WRONG: "${category}" ≠ "${expectedCat}"` };
}

function evaluatePricingReasonability(output: any): QualityScore {
  const dailyRate = output?.suggestedDailyRate || 0;
  const deposit = output?.suggestedDeposit || 0;
  let score = 0;
  const feedback: string[] = [];

  // Daily rate in pence (£5-100/day = 500-10000 pence)
  if (dailyRate >= 500 && dailyRate <= 10000) {
    score += 40;
  } else if (dailyRate > 0) {
    feedback.push(`Rate £${(dailyRate/100).toFixed(0)} outside £5-100`);
    score += 10;
  } else {
    feedback.push('Missing daily rate');
  }

  // Deposit should be reasonable (£15-150 typically)
  if (deposit >= 1500 && deposit <= 15000) {
    score += 40;
  } else if (deposit > 15000) {
    feedback.push(`Deposit £${(deposit/100).toFixed(0)} too high (max ~£150)`);
    score += 10;
  } else if (deposit > 0) {
    feedback.push(`Deposit £${(deposit/100).toFixed(0)} too low`);
    score += 20;
  } else {
    feedback.push('Missing deposit');
  }

  // Deposit shouldn't be more than 5x daily rate
  if (dailyRate > 0 && deposit > 0 && deposit <= dailyRate * 5) {
    score += 20;
  } else if (dailyRate > 0 && deposit > dailyRate * 5) {
    feedback.push('Deposit too high vs rate');
  }

  return { criterion: 'pricing_reasonability', score, feedback: feedback.join('; ') || '✓' };
}

function evaluateConditionValidity(output: any): QualityScore {
  const condition = output?.condition || '';
  const validConditions = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'];

  if (validConditions.includes(condition)) {
    return { criterion: 'condition_validity', score: 100, feedback: '✓' };
  }

  return { criterion: 'condition_validity', score: 0, feedback: `Invalid: "${condition}"` };
}

function evaluateFeaturesQuality(output: any): QualityScore {
  const features = output?.features || [];
  let score = 0;
  const feedback: string[] = [];

  if (!Array.isArray(features)) {
    return { criterion: 'features_quality', score: 0, feedback: 'Features not an array' };
  }

  // Should have 2-6 features
  if (features.length >= 2 && features.length <= 6) {
    score += 50;
  } else {
    feedback.push(`${features.length} features (ideal: 2-6)`);
    score += 20;
  }

  // Features should be unique
  const uniqueFeatures = [...new Set(features.map((f: string) => f?.toLowerCase?.() || ''))];
  if (uniqueFeatures.length === features.length) {
    score += 30;
  } else {
    feedback.push('Duplicate features');
  }

  // Features should be concise (under 30 chars each)
  if (features.every((f: string) => (f?.length || 0) <= 30)) {
    score += 20;
  } else {
    feedback.push('Some features too long');
  }

  return { criterion: 'features_quality', score, feedback: feedback.join('; ') || '✓' };
}

function evaluateJsonValidity(output: any): QualityScore {
  const required = ['title', 'description', 'category', 'suggestedDailyRate', 'suggestedDeposit', 'condition'];
  const missing = required.filter(field => !(field in output));

  if (missing.length === 0) {
    return { criterion: 'json_validity', score: 100, feedback: '✓' };
  }

  const score = Math.max(0, 100 - (missing.length * 20));
  return { criterion: 'json_validity', score, feedback: `Missing: ${missing.join(', ')}` };
}

const CRITERIA = [
  { name: 'title_quality', weight: 20, evaluate: evaluateTitleQuality },
  { name: 'description_conciseness', weight: 15, evaluate: evaluateDescriptionConciseness },
  { name: 'category_accuracy', weight: 15, evaluate: evaluateCategoryAccuracy },
  { name: 'pricing_reasonability', weight: 20, evaluate: evaluatePricingReasonability },
  { name: 'condition_validity', weight: 10, evaluate: evaluateConditionValidity },
  { name: 'features_quality', weight: 10, evaluate: evaluateFeaturesQuality },
  { name: 'json_validity', weight: 10, evaluate: evaluateJsonValidity },
];

// ============================================================================
// PROMPT TEMPLATE
// ============================================================================

interface PromptTemplate {
  version: string;
  systemInstruction: string;
  fewShotExamples: string;
  userPromptTemplate: string;
}

const INITIAL_PROMPT: PromptTemplate = {
  version: 'v1.0.0',
  systemInstruction: `You are an AI for SpannerWork, a UK peer-to-peer rental marketplace for automotive tools.

STRICT RULES:
1. All prices in PENCE (£20 = 2000)
2. Descriptions: 2-4 sentences MAX, 30-50 words
3. Be accurate - don't invent features not mentioned
4. British English only
5. Categories MUST be exactly one of: Power Tools, Hand Tools, Diagnostics, Lifting Equipment, Welding, Air Tools, Specialist Tools

DEPOSIT GUIDANCE (by tool value):
- Basic hand tools (under £50): £15-25 deposit (1500-2500 pence)
- Standard power tools (£50-150): £25-40 deposit (2500-4000 pence)
- Premium power tools (£150-300): £40-60 deposit (4000-6000 pence)
- Diagnostic equipment (£200-500): £50-75 deposit (5000-7500 pence)
- Specialist tools (£500+): £75-100 deposit (7500-10000 pence)
- NEVER exceed £150 deposit

OUTPUT: Return ONLY valid JSON, no markdown, no explanation.`,

  fewShotExamples: `
EXAMPLE 1:
Input: "makita drill good condition has 2 batteries"
{"title":"Makita Cordless Drill with 2 Batteries","description":"Makita cordless drill in good condition. Comes with 2 batteries and charger.","category":"Power Tools","features":["Cordless","2 batteries included","Good condition"],"suggestedDailyRate":2000,"suggestedDeposit":4000,"condition":"GOOD","keywords":["makita","cordless drill","power tool"]}

EXAMPLE 2:
Input: "snap on scanner reads all codes"
{"title":"Snap-on Professional Diagnostic Scanner","description":"Professional Snap-on OBD scanner. Reads fault codes from all vehicle systems.","category":"Diagnostics","features":["Professional grade","Multi-system","All codes"],"suggestedDailyRate":5000,"suggestedDeposit":7500,"condition":"GOOD","keywords":["snap-on","diagnostic","OBD"]}

EXAMPLE 3:
Input: "3 ton trolley jack heavy duty"
{"title":"Heavy Duty 3 Ton Trolley Jack","description":"3-ton trolley jack in good working order. Suitable for cars, vans, and light commercials.","category":"Lifting Equipment","features":["3 ton capacity","Heavy duty","Wheeled"],"suggestedDailyRate":1500,"suggestedDeposit":3000,"condition":"GOOD","keywords":["trolley jack","3 ton","lifting"]}

EXAMPLE 4:
Input: "fluke multimeter automotive"
{"title":"Fluke Automotive Digital Multimeter","description":"Professional Fluke digital multimeter for automotive diagnostics. Accurate readings for electrical troubleshooting.","category":"Diagnostics","features":["Fluke brand","Digital display","Automotive rated"],"suggestedDailyRate":2500,"suggestedDeposit":5000,"condition":"GOOD","keywords":["fluke","multimeter","electrical"]}`,

  userPromptTemplate: `Generate a rental listing from this description:
"{input}"

Return ONLY valid JSON:
{"title":"...","description":"...","category":"...","features":[...],"suggestedDailyRate":...,"suggestedDeposit":...,"condition":"...","keywords":[...]}`,
};

// ============================================================================
// GEMINI API CALL
// ============================================================================

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  error?: { message: string };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGeminiWithRetry(prompt: PromptTemplate, input: string, retries = 0): Promise<any> {
  const fullPrompt = `${prompt.fewShotExamples}

${prompt.userPromptTemplate.replace('{input}', input)}`;

  const url = `${GEMINI_API_BASE}/${CONFIG.model}:generateContent?key=${CONFIG.apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        systemInstruction: { parts: [{ text: prompt.systemInstruction }] },
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    });

    const data = (await response.json()) as GeminiResponse;

    // Check for rate limit error
    if (data.error) {
      const errorMsg = data.error.message || '';
      if (errorMsg.includes('quota') || errorMsg.includes('rate') || errorMsg.includes('429')) {
        if (retries < CONFIG.maxRetries) {
          const waitTime = CONFIG.retryDelayMs * Math.pow(2, retries); // Exponential backoff
          console.log(`\n⏳ Rate limited. Waiting ${waitTime/1000}s before retry ${retries + 1}...`);
          await sleep(waitTime);
          return callGeminiWithRetry(prompt, input, retries + 1);
        }
      }
      throw new Error(errorMsg);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
      return JSON.parse(text);
    } catch {
      // Try to extract JSON
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('No valid JSON in response');
    }
  } catch (error: any) {
    if (retries < CONFIG.maxRetries && (error.message?.includes('fetch') || error.code === 'ECONNRESET')) {
      const waitTime = CONFIG.retryDelayMs * Math.pow(2, retries);
      console.log(`\n⏳ Network error. Waiting ${waitTime/1000}s before retry ${retries + 1}...`);
      await sleep(waitTime);
      return callGeminiWithRetry(prompt, input, retries + 1);
    }
    throw error;
  }
}

// ============================================================================
// OPTIMIZER CLASS
// ============================================================================

interface IterationResult {
  iteration: number;
  timestamp: string;
  promptVersion: string;
  avgScore: number;
  satisfactionRate: number;
  passCount: number;
  totalTests: number;
  criterionScores: Record<string, number>;
  failures: string[];
  details: Array<{ input: string; score: number; issues: string[] }>;
}

class AIPromptOptimizer {
  private currentPrompt: PromptTemplate;
  private results: IterationResult[] = [];

  constructor() {
    if (!CONFIG.apiKey) {
      throw new Error('GEMINI_API_KEY not set');
    }
    this.currentPrompt = { ...INITIAL_PROMPT };
    this.loadProgress();
  }

  private loadProgress(): void {
    try {
      if (fs.existsSync(CONFIG.resultsFile)) {
        this.results = JSON.parse(fs.readFileSync(CONFIG.resultsFile, 'utf-8'));
        console.log(`📂 Loaded ${this.results.length} previous iterations`);
      }
      if (fs.existsSync(CONFIG.promptsFile)) {
        this.currentPrompt = JSON.parse(fs.readFileSync(CONFIG.promptsFile, 'utf-8'));
        console.log(`📂 Loaded prompt version ${this.currentPrompt.version}`);
      }
    } catch (e) {
      console.log('📂 Starting fresh');
    }
  }

  private saveProgress(): void {
    fs.writeFileSync(CONFIG.resultsFile, JSON.stringify(this.results, null, 2));
    fs.writeFileSync(CONFIG.promptsFile, JSON.stringify(this.currentPrompt, null, 2));
  }

  private evaluateOutput(output: any, input: string, testCase: any): EvaluationResult {
    const scores: QualityScore[] = [];

    scores.push(evaluateTitleQuality(output, input));
    scores.push(evaluateDescriptionConciseness(output));
    scores.push(evaluateCategoryAccuracy(output, testCase));
    scores.push(evaluatePricingReasonability(output));
    scores.push(evaluateConditionValidity(output));
    scores.push(evaluateFeaturesQuality(output));
    scores.push(evaluateJsonValidity(output));

    // Calculate weighted average
    let totalWeight = 0;
    let weightedSum = 0;
    for (let i = 0; i < CRITERIA.length; i++) {
      weightedSum += scores[i].score * CRITERIA[i].weight;
      totalWeight += CRITERIA[i].weight;
    }

    const overallScore = Math.round(weightedSum / totalWeight);

    return {
      overallScore,
      scores,
      pass: overallScore >= CONFIG.targetSatisfaction,
      rawOutput: output,
      input,
    };
  }

  async runIteration(): Promise<IterationResult> {
    const testCases = TEST_CASES.slice(0, CONFIG.testsPerIteration);
    const evaluations: EvaluationResult[] = [];
    const criterionTotals: Record<string, number[]> = {};

    console.log(`\n🧪 Testing ${testCases.length} cases...`);

    for (const testCase of testCases) {
      process.stdout.write('.');
      try {
        const output = await callGeminiWithRetry(this.currentPrompt, testCase.input);
        const result = this.evaluateOutput(output, testCase.input, testCase);
        evaluations.push(result);

        // Aggregate criterion scores
        for (const score of result.scores) {
          if (!criterionTotals[score.criterion]) criterionTotals[score.criterion] = [];
          criterionTotals[score.criterion].push(score.score);
        }
      } catch (error: any) {
        console.log(`\n❌ Error for "${testCase.input}": ${error.message}`);
        evaluations.push({
          overallScore: 0,
          scores: [{ criterion: 'api_error', score: 0, feedback: error.message }],
          pass: false,
          rawOutput: null,
          input: testCase.input,
        });
      }

      // Rate limiting - longer wait between requests
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n');

    const avgScore = Math.round(
      evaluations.reduce((sum, e) => sum + e.overallScore, 0) / evaluations.length
    );

    const passCount = evaluations.filter(e => e.pass).length;
    const satisfactionRate = Math.round((passCount / evaluations.length) * 100);

    // Average criterion scores
    const criterionScores: Record<string, number> = {};
    for (const [criterion, scores] of Object.entries(criterionTotals)) {
      criterionScores[criterion] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    // Collect failures
    const failures: string[] = [];
    const details: Array<{ input: string; score: number; issues: string[] }> = [];

    for (const evaluation of evaluations) {
      const issues = evaluation.scores
        .filter(s => s.score < 70 && s.feedback !== '✓')
        .map(s => `[${s.criterion}] ${s.feedback}`);

      details.push({
        input: evaluation.input,
        score: evaluation.overallScore,
        issues,
      });

      if (!evaluation.pass) {
        failures.push(...issues);
      }
    }

    const iteration: IterationResult = {
      iteration: this.results.length + 1,
      timestamp: new Date().toISOString(),
      promptVersion: this.currentPrompt.version,
      avgScore,
      satisfactionRate,
      passCount,
      totalTests: evaluations.length,
      criterionScores,
      failures: [...new Set(failures)].slice(0, 15),
      details,
    };

    this.results.push(iteration);
    this.saveProgress();

    return iteration;
  }

  improvePrompt(iteration: IterationResult): boolean {
    // Improve anything below target (98%)
    const weakCriteria = Object.entries(iteration.criterionScores)
      .filter(([_, score]) => score < CONFIG.targetSatisfaction)
      .sort((a, b) => a[1] - b[1]);

    if (weakCriteria.length === 0) return false;

    const [weakest, score] = weakCriteria[0];
    console.log(`\n🔧 Improving weakest criterion: ${weakest} (${score}%)`);

    // Increment version
    const parts = this.currentPrompt.version.split('.');
    parts[2] = String(parseInt(parts[2]) + 1);
    this.currentPrompt.version = parts.join('.');

    // Apply targeted improvements
    switch (weakest) {
      case 'category_accuracy':
        this.currentPrompt.systemInstruction = this.currentPrompt.systemInstruction.replace(
          'Categories MUST be exactly one of:',
          `CATEGORY MAPPING (follow strictly):
- Drills, grinders, impact wrenches, sanders → Power Tools
- Sockets, spanners, screwdrivers, torque wrenches → Hand Tools
- OBD scanners, multimeters, timing lights, code readers → Diagnostics
- Jacks, axle stands, engine hoists, ramps → Lifting Equipment
- MIG, TIG, arc welders, plasma cutters → Welding
- Compressors, air tools, spray guns → Air Tools
- Spring compressors, bearing pullers, special tools → Specialist Tools

Categories MUST be exactly one of:`
        );
        break;

      case 'pricing_reasonability':
        this.currentPrompt.fewShotExamples += `

EXAMPLE 5 (pricing):
Input: "basic socket set"
{"title":"Standard Socket Set","description":"Basic socket set for general automotive work. Multiple sizes included.","category":"Hand Tools","features":["Multiple sizes","Chrome vanadium","Carry case"],"suggestedDailyRate":800,"suggestedDeposit":2000,"condition":"GOOD","keywords":["socket set","hand tools"]}`;
        break;

      case 'description_conciseness':
        this.currentPrompt.systemInstruction = this.currentPrompt.systemInstruction.replace(
          'Descriptions: 2-4 sentences MAX, 30-50 words',
          'Descriptions: EXACTLY 2-3 sentences, 20-40 words MAXIMUM. No marketing language.'
        );
        break;

      case 'title_quality':
        // Only add once
        if (!this.currentPrompt.systemInstruction.includes('TITLE RULES:')) {
          this.currentPrompt.systemInstruction += '\n\nTITLE RULES: Include brand if mentioned (Makita, Snap-on, DeWalt, Milwaukee, Fluke). No slang. Capitalize properly. 5-50 chars.';
        }
        break;

      case 'features_quality':
        if (!this.currentPrompt.systemInstruction.includes('FEATURES:')) {
          this.currentPrompt.systemInstruction += '\n\nFEATURES: Exactly 3-5 features. Each under 25 chars. No duplicates.';
        }
        break;

      default:
        // Don't add anything - avoid prompt bloat
        break;
    }

    this.saveProgress();
    console.log(`📦 Updated to version ${this.currentPrompt.version}`);
    return true;
  }

  printReport(iteration: IterationResult): void {
    console.log('\n' + '═'.repeat(70));
    console.log(`📊 ITERATION ${iteration.iteration} RESULTS`);
    console.log('═'.repeat(70));
    console.log(`Version: ${iteration.promptVersion}`);
    console.log(`Average Score: ${iteration.avgScore}%`);
    console.log(`Satisfaction: ${iteration.satisfactionRate}% (${iteration.passCount}/${iteration.totalTests} passed)`);

    console.log('\n📈 Criterion Scores:');
    const sortedCriteria = Object.entries(iteration.criterionScores).sort((a, b) => a[1] - b[1]);
    for (const [criterion, score] of sortedCriteria) {
      const bar = '█'.repeat(Math.floor(score / 5)) + '░'.repeat(20 - Math.floor(score / 5));
      const status = score >= 98 ? '✅' : score >= 80 ? '🟡' : '❌';
      console.log(`  ${status} ${criterion.padEnd(25)} ${bar} ${score}%`);
    }

    if (iteration.failures.length > 0) {
      console.log('\n⚠️ Issues:');
      for (const failure of iteration.failures.slice(0, 8)) {
        console.log(`  • ${failure}`);
      }
    }

    console.log('\n📋 Individual Results:');
    for (const detail of iteration.details) {
      const status = detail.score >= 98 ? '✅' : detail.score >= 80 ? '🟡' : '❌';
      console.log(`  ${status} ${detail.score}% - "${detail.input.substring(0, 40)}..."`);
      if (detail.issues.length > 0 && detail.score < 98) {
        console.log(`     └─ ${detail.issues.slice(0, 2).join(' | ')}`);
      }
    }

    console.log('═'.repeat(70));
  }

  async optimize(): Promise<void> {
    console.log('🚀 AI Prompt Optimizer - Claude Quality Control');
    console.log(`🎯 Target: ${CONFIG.targetSatisfaction}% satisfaction`);
    console.log(`📝 Max iterations: ${CONFIG.maxIterations}`);
    console.log(`🧪 Tests per iteration: ${CONFIG.testsPerIteration}`);

    for (let i = this.results.length; i < CONFIG.maxIterations; i++) {
      const iteration = await this.runIteration();
      this.printReport(iteration);

      // Check if ALL criteria are at 98%+
      const allCriteriaPass = Object.values(iteration.criterionScores)
        .every(score => score >= CONFIG.targetSatisfaction);

      if (allCriteriaPass && iteration.satisfactionRate >= CONFIG.targetSatisfaction) {
        console.log('\n🏆 TARGET ACHIEVED!');
        console.log(`✅ All criteria at 98%+`);
        console.log(`✅ Pass rate: ${iteration.satisfactionRate}%`);
        console.log(`📦 Optimal prompt: ${iteration.promptVersion}`);
        this.exportFinalPrompt();
        return;
      }

      // Apply improvement
      const improved = this.improvePrompt(iteration);
      if (!improved) {
        console.log('\n⚠️ No more improvements to apply');
        break;
      }

      console.log('\n⏳ Next iteration in 3 seconds...');
      await new Promise(r => setTimeout(r, 3000));
    }

    const best = Math.max(...this.results.map(r => r.satisfactionRate));
    console.log(`\n📊 Best achieved: ${best}%`);
  }

  exportFinalPrompt(): void {
    const exportPath = './src/config/ai-optimized.config.ts';
    const content = `// Auto-generated optimized AI prompts
// Generated: ${new Date().toISOString()}
// Satisfaction: ${this.results[this.results.length - 1]?.satisfactionRate}%
// Version: ${this.currentPrompt.version}

export const OPTIMIZED_SYSTEM_INSTRUCTION = \`${this.currentPrompt.systemInstruction.replace(/`/g, '\\`')}\`;

export const OPTIMIZED_FEW_SHOT_EXAMPLES = \`${this.currentPrompt.fewShotExamples.replace(/`/g, '\\`')}\`;

export const OPTIMIZED_USER_TEMPLATE = \`${this.currentPrompt.userPromptTemplate.replace(/`/g, '\\`')}\`;
`;

    fs.writeFileSync(exportPath, content);
    console.log(`📤 Exported to ${exportPath}`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    const optimizer = new AIPromptOptimizer();
    await optimizer.optimize();
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

main();
