import { describe, it, expect } from 'vitest';
import { GOAL_PATTERNS } from '../goals/patterns.js';
import { rankGoals, filterByConfidence } from '../goals/ranker.js';
import { classifyElement, classifyPage } from '../goals/classifier.js';
import type { DetectedGoal, ScannedElement, GoalType } from '../types/index.js';

// ---------------------------------------------------------------------------
// Goal Pattern Matching
// ---------------------------------------------------------------------------

describe('GOAL_PATTERNS', () => {
  describe('purchase patterns', () => {
    const patterns = GOAL_PATTERNS.purchase;

    it('matches "Buy Now" text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Buy Now'))).toBe(true);
    });

    it('matches "Add to Cart" text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Add to Cart'))).toBe(true);
    });

    it('matches "checkout" text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Checkout'))).toBe(true);
    });

    it('matches "Place Order" text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Place Order'))).toBe(true);
    });

    it('matches "Subscribe" text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Subscribe'))).toBe(true);
    });

    it('matches /checkout URL pattern', () => {
      expect(patterns.urlPatterns.some((r) => r.test('/checkout'))).toBe(true);
    });

    it('matches /cart URL pattern', () => {
      expect(patterns.urlPatterns.some((r) => r.test('/cart'))).toBe(true);
    });

    it('has highest importance (1.0)', () => {
      expect(patterns.importance).toBe(1.0);
    });

    it('does not match unrelated text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Read more about us'))).toBe(false);
    });
  });

  describe('signup patterns', () => {
    const patterns = GOAL_PATTERNS.signup;

    it('matches "Sign Up" text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Sign Up'))).toBe(true);
    });

    it('matches "Create Account" text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Create Account'))).toBe(true);
    });

    it('matches "Register" text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Register'))).toBe(true);
    });

    it('matches /signup URL pattern', () => {
      expect(patterns.urlPatterns.some((r) => r.test('/signup'))).toBe(true);
    });

    it('has importance 0.9', () => {
      expect(patterns.importance).toBe(0.9);
    });
  });

  describe('lead_capture patterns', () => {
    const patterns = GOAL_PATTERNS.lead_capture;

    it('matches "Submit" text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Submit'))).toBe(true);
    });

    it('matches "Request Demo" text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Request Demo'))).toBe(true);
    });

    it('matches "Contact Us" text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Contact Us'))).toBe(true);
    });

    it('matches "Book a Call" text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Book a Call'))).toBe(true);
    });

    it('matches /contact URL pattern', () => {
      expect(patterns.urlPatterns.some((r) => r.test('/contact'))).toBe(true);
    });

    it('has importance 0.8', () => {
      expect(patterns.importance).toBe(0.8);
    });
  });

  describe('engagement patterns', () => {
    const patterns = GOAL_PATTERNS.engagement;

    it('matches "Learn More" text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Learn More'))).toBe(true);
    });

    it('matches "Watch Video" text', () => {
      expect(patterns.textPatterns.some((r) => r.test('Watch Video'))).toBe(true);
    });

    it('has lowest importance (0.5)', () => {
      expect(patterns.importance).toBe(0.5);
    });
  });
});

// ---------------------------------------------------------------------------
// Goal Ranking
// ---------------------------------------------------------------------------

describe('rankGoals', () => {
  function makeGoal(id: string, goalType: GoalType, confidence: number, importance: number): DetectedGoal {
    return {
      id,
      goalType,
      label: `Test ${goalType}`,
      confidence,
      importance,
      trigger: { type: 'click', selector: `#${id}` },
    };
  }

  it('ranks by composite score (confidence * importance) descending', () => {
    const goals = [
      makeGoal('engagement-1', 'engagement', 0.8, 0.5),    // score = 0.4
      makeGoal('purchase-1', 'purchase', 0.7, 1.0),         // score = 0.7
      makeGoal('signup-1', 'signup', 0.6, 0.9),             // score = 0.54
    ];

    const ranked = rankGoals(goals);
    expect(ranked[0].id).toBe('purchase-1');   // 0.7
    expect(ranked[1].id).toBe('signup-1');     // 0.54
    expect(ranked[2].id).toBe('engagement-1'); // 0.4
  });

  it('purchase > signup > engagement by importance when confidence is equal', () => {
    const goals = [
      makeGoal('engagement-1', 'engagement', 0.8, 0.5),
      makeGoal('purchase-1', 'purchase', 0.8, 1.0),
      makeGoal('signup-1', 'signup', 0.8, 0.9),
    ];

    const ranked = rankGoals(goals);
    expect(ranked[0].goalType).toBe('purchase');
    expect(ranked[1].goalType).toBe('signup');
    expect(ranked[2].goalType).toBe('engagement');
  });

  it('deduplicates goals by ID, keeping highest confidence version', () => {
    const goals = [
      makeGoal('goal-a', 'purchase', 0.5, 1.0),
      makeGoal('goal-a', 'purchase', 0.9, 1.0),
    ];

    const ranked = rankGoals(goals);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].confidence).toBe(0.9);
  });

  it('limits to maxGoals', () => {
    const goals = Array.from({ length: 30 }, (_, i) =>
      makeGoal(`goal-${i}`, 'engagement', 0.5 + i * 0.01, 0.5),
    );

    const ranked = rankGoals(goals, 5);
    expect(ranked).toHaveLength(5);
  });

  it('returns empty array for empty input', () => {
    expect(rankGoals([])).toEqual([]);
  });
});

describe('filterByConfidence', () => {
  function makeGoal(confidence: number): DetectedGoal {
    return {
      id: `goal-${confidence}`,
      goalType: 'engagement',
      label: 'Test',
      confidence,
      importance: 0.5,
      trigger: { type: 'click' },
    };
  }

  it('filters out goals below threshold', () => {
    const goals = [makeGoal(0.1), makeGoal(0.3), makeGoal(0.5), makeGoal(0.8)];
    const filtered = filterByConfidence(goals, 0.3);
    expect(filtered).toHaveLength(3);
    expect(filtered.every((g) => g.confidence >= 0.3)).toBe(true);
  });

  it('keeps all goals when all meet threshold', () => {
    const goals = [makeGoal(0.5), makeGoal(0.8)];
    const filtered = filterByConfidence(goals, 0.3);
    expect(filtered).toHaveLength(2);
  });

  it('returns empty when no goals meet threshold', () => {
    const goals = [makeGoal(0.1), makeGoal(0.2)];
    const filtered = filterByConfidence(goals, 0.5);
    expect(filtered).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Classifier with mock DOM elements
// ---------------------------------------------------------------------------

describe('classifyElement', () => {
  function mockScannedElement(overrides: Partial<ScannedElement> = {}): ScannedElement {
    return {
      element: {
        matches: (selector: string) => {
          // Simulate matching against known purchase selectors
          const matchSelectors = (overrides as { _matchSelectors?: string[] })._matchSelectors ?? [];
          return matchSelectors.includes(selector);
        },
      } as unknown as Element,
      selector: '#test-button',
      text: '',
      tagName: 'BUTTON',
      visible: true,
      rect: { width: 200, height: 50, top: 100, left: 100 },
      ...overrides,
    };
  }

  it('classifies "Buy Now" button as purchase goal', () => {
    const el = mockScannedElement({ text: 'Buy Now' });
    const goals = classifyElement(el);
    expect(goals.length).toBeGreaterThan(0);

    const purchaseGoal = goals.find((g) => g.goalType === 'purchase');
    expect(purchaseGoal).toBeDefined();
    expect(purchaseGoal!.confidence).toBeGreaterThanOrEqual(0.4);
  });

  it('classifies "Sign Up" button as signup goal', () => {
    const el = mockScannedElement({ text: 'Sign Up' });
    const goals = classifyElement(el);

    const signupGoal = goals.find((g) => g.goalType === 'signup');
    expect(signupGoal).toBeDefined();
  });

  it('classifies "Submit" button as lead_capture goal', () => {
    const el = mockScannedElement({ text: 'Submit' });
    const goals = classifyElement(el);

    const leadGoal = goals.find((g) => g.goalType === 'lead_capture');
    expect(leadGoal).toBeDefined();
  });

  it('classifies "Learn More" link as engagement goal', () => {
    const el = mockScannedElement({
      text: 'Learn More',
      tagName: 'A',
      href: 'https://example.com/features',
    });
    const goals = classifyElement(el);

    const engGoal = goals.find((g) => g.goalType === 'engagement');
    expect(engGoal).toBeDefined();
  });

  it('boosts confidence for visible, large elements', () => {
    const visible = mockScannedElement({ text: 'Buy Now', visible: true, rect: { width: 200, height: 50, top: 100, left: 100 } });
    const hidden = mockScannedElement({ text: 'Buy Now', visible: false, rect: { width: 10, height: 10, top: 0, left: 0 } });

    const visibleGoals = classifyElement(visible);
    const hiddenGoals = classifyElement(hidden);

    const visiblePurchase = visibleGoals.find((g) => g.goalType === 'purchase');
    const hiddenPurchase = hiddenGoals.find((g) => g.goalType === 'purchase');

    expect(visiblePurchase).toBeDefined();
    expect(hiddenPurchase).toBeDefined();
    // Visible + large element should have higher confidence
    expect(visiblePurchase!.confidence).toBeGreaterThan(hiddenPurchase!.confidence);
  });

  it('combines text and selector matches for higher confidence', () => {
    const textOnly = mockScannedElement({ text: 'Buy Now' });
    const textAndSelector = mockScannedElement({
      text: 'Buy Now',
      _matchSelectors: ['.buy-now'],
    } as Partial<ScannedElement> & { _matchSelectors: string[] });

    const textGoals = classifyElement(textOnly);
    const combinedGoals = classifyElement(textAndSelector);

    const textPurchase = textGoals.find((g) => g.goalType === 'purchase');
    const combinedPurchase = combinedGoals.find((g) => g.goalType === 'purchase');

    expect(textPurchase).toBeDefined();
    expect(combinedPurchase).toBeDefined();
    expect(combinedPurchase!.confidence).toBeGreaterThan(textPurchase!.confidence);
  });

  it('returns empty for non-matching elements', () => {
    const el = mockScannedElement({ text: 'Company Logo' });
    const goals = classifyElement(el);
    expect(goals).toHaveLength(0);
  });

  it('sets trigger type to form_submit for FORM elements', () => {
    const el = mockScannedElement({ text: 'Submit', tagName: 'FORM' });
    const goals = classifyElement(el);
    const leadGoal = goals.find((g) => g.goalType === 'lead_capture');
    expect(leadGoal).toBeDefined();
    expect(leadGoal!.trigger.type).toBe('form_submit');
  });

  it('sets trigger type to click for non-FORM elements', () => {
    const el = mockScannedElement({ text: 'Buy Now', tagName: 'BUTTON' });
    const goals = classifyElement(el);
    const purchaseGoal = goals.find((g) => g.goalType === 'purchase');
    expect(purchaseGoal).toBeDefined();
    expect(purchaseGoal!.trigger.type).toBe('click');
  });

  it('generates deterministic goal IDs', () => {
    const el = mockScannedElement({ text: 'Buy Now', selector: '#buy-btn' });
    const goals1 = classifyElement(el);
    const goals2 = classifyElement(el);
    expect(goals1[0].id).toBe(goals2[0].id);
  });
});

describe('classifyPage', () => {
  it('detects confirmation page from URL', () => {
    const goals = classifyPage({
      url: 'https://example.com/thank-you',
      title: 'Order Complete',
      headingText: 'Thank you for your purchase!',
    });

    const confirmation = goals.find((g) => g.goalType === 'confirmation_page');
    expect(confirmation).toBeDefined();
    expect(confirmation!.confidence).toBeGreaterThanOrEqual(0.4);
  });

  it('detects checkout page from URL', () => {
    const goals = classifyPage({
      url: 'https://example.com/checkout',
      title: 'Checkout',
      headingText: 'Complete your order',
    });

    const purchase = goals.find((g) => g.goalType === 'purchase');
    expect(purchase).toBeDefined();
  });

  it('sets navigation trigger type for page-level goals', () => {
    const goals = classifyPage({
      url: 'https://example.com/thank-you',
      title: 'Thank You',
      headingText: '',
    });

    for (const goal of goals) {
      expect(goal.trigger.type).toBe('navigation');
    }
  });

  it('returns empty for non-matching pages', () => {
    const goals = classifyPage({
      url: 'https://example.com/about',
      title: 'About Us',
      headingText: 'Our Story',
    });

    expect(goals).toHaveLength(0);
  });
});
