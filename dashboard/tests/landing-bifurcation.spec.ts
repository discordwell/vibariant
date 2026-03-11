import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

type Side = "blue" | "orange";

interface AuditTarget {
  name: string;
  selector: string;
  side: Side;
  minAccentPixels?: number;
  dominanceRatio?: number;
}

interface PixelReport {
  bluePixels: number;
  orangePixels: number;
  accentPixels: number;
  blueShare: number;
  orangeShare: number;
}

const bifurcationTargets: AuditTarget[] = [
  {
    name: "hero.left-decoration",
    selector: '[data-bifurcation-target="hero-left-decoration"]',
    side: "blue",
    minAccentPixels: 200,
    dominanceRatio: 2.5,
  },
  {
    name: "hero.right-decoration",
    selector: '[data-bifurcation-target="hero-right-decoration"]',
    side: "orange",
    minAccentPixels: 200,
    dominanceRatio: 2.5,
  },
  {
    name: "hero.start-cta",
    selector: '[data-bifurcation-target="hero-start-cta"]',
    side: "blue",
    minAccentPixels: 800,
    dominanceRatio: 2.5,
  },
  {
    name: "hero.watch-cta",
    selector: '[data-bifurcation-target="hero-watch-cta"]',
    side: "orange",
    minAccentPixels: 800,
    dominanceRatio: 2.5,
  },
  {
    name: "features.left-decoration",
    selector: '[data-bifurcation-target="features-left-decoration"]',
    side: "blue",
    minAccentPixels: 120,
    dominanceRatio: 2.5,
  },
  {
    name: "features.right-decoration",
    selector: '[data-bifurcation-target="features-right-decoration"]',
    side: "orange",
    minAccentPixels: 120,
    dominanceRatio: 2.5,
  },
  {
    name: "features.card-1",
    selector: '[data-bifurcation-target="feature-card-1"]',
    side: "blue",
    minAccentPixels: 280,
    dominanceRatio: 1.6,
  },
  {
    name: "features.card-2",
    selector: '[data-bifurcation-target="feature-card-2"]',
    side: "orange",
    minAccentPixels: 280,
    dominanceRatio: 1.6,
  },
  {
    name: "features.card-5",
    selector: '[data-bifurcation-target="feature-card-5"]',
    side: "blue",
    minAccentPixels: 280,
    dominanceRatio: 1.6,
  },
  {
    name: "features.card-6",
    selector: '[data-bifurcation-target="feature-card-6"]',
    side: "orange",
    minAccentPixels: 280,
    dominanceRatio: 1.6,
  },
  {
    name: "demo.left-decoration",
    selector: '[data-bifurcation-target="demo-left-decoration"]',
    side: "blue",
    minAccentPixels: 80,
    dominanceRatio: 2.5,
  },
  {
    name: "demo.right-decoration",
    selector: '[data-bifurcation-target="demo-right-decoration"]',
    side: "orange",
    minAccentPixels: 120,
    dominanceRatio: 2.5,
  },
  {
    name: "demo.variant-a",
    selector: '[data-bifurcation-target="demo-variant-a-card"]',
    side: "blue",
    minAccentPixels: 900,
    dominanceRatio: 1.8,
  },
  {
    name: "demo.variant-b",
    selector: '[data-bifurcation-target="demo-variant-b-card"]',
    side: "orange",
    minAccentPixels: 900,
    dominanceRatio: 1.8,
  },
  {
    name: "pricing.left-decoration",
    selector: '[data-bifurcation-target="pricing-left-decoration"]',
    side: "blue",
    minAccentPixels: 100,
    dominanceRatio: 2.5,
  },
  {
    name: "pricing.right-decoration",
    selector: '[data-bifurcation-target="pricing-right-decoration"]',
    side: "orange",
    minAccentPixels: 140,
    dominanceRatio: 2.5,
  },
  {
    name: "pricing.free",
    selector: '[data-bifurcation-target="pricing-free-tier"]',
    side: "blue",
    minAccentPixels: 1_200,
    dominanceRatio: 1.45,
  },
  {
    name: "pricing.team",
    selector: '[data-bifurcation-target="pricing-team-tier"]',
    side: "orange",
    minAccentPixels: 1_200,
    dominanceRatio: 1.45,
  },
];

function rgbToHsv(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }

  const saturation = max === 0 ? 0 : delta / max;
  return { hue, saturation, value: max };
}

function analyzeTarget(buffer: Buffer): PixelReport {
  const image = PNG.sync.read(buffer);
  let bluePixels = 0;
  let orangePixels = 0;

  for (let index = 0; index < image.data.length; index += 4) {
    const alpha = image.data[index + 3];
    if (alpha < 12) {
      continue;
    }

    const red = image.data[index];
    const green = image.data[index + 1];
    const blue = image.data[index + 2];
    const { hue, saturation, value } = rgbToHsv(red, green, blue);

    if (value < 0.08 || saturation < 0.12) {
      continue;
    }

    if (hue >= 190 && hue <= 250) {
      bluePixels += 1;
      continue;
    }

    if (hue >= 15 && hue <= 50) {
      orangePixels += 1;
    }
  }

  const accentPixels = bluePixels + orangePixels;
  return {
    bluePixels,
    orangePixels,
    accentPixels,
    blueShare: accentPixels === 0 ? 0 : bluePixels / accentPixels,
    orangeShare: accentPixels === 0 ? 0 : orangePixels / accentPixels,
  };
}

test("landing preserves the blue/orange bifurcation path", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(250);

  const report: Array<AuditTarget & PixelReport> = [];

  for (const target of bifurcationTargets) {
    const locator = page.locator(target.selector);
    await expect(locator, `${target.name} should be visible`).toBeVisible();

    const screenshot = await locator.screenshot({ animations: "disabled" });
    const stats = analyzeTarget(screenshot);
    report.push({ ...target, ...stats });

    await testInfo.attach(`${target.name}.png`, {
      body: screenshot,
      contentType: "image/png",
    });

    expect(
      stats.accentPixels,
      `${target.name} should expose enough themed pixels`,
    ).toBeGreaterThanOrEqual(target.minAccentPixels ?? 0);

    if (target.side === "blue") {
      expect(
        stats.bluePixels,
        `${target.name} should skew blue (${JSON.stringify(stats)})`,
      ).toBeGreaterThan(stats.orangePixels * (target.dominanceRatio ?? 1));
      continue;
    }

    expect(
      stats.orangePixels,
      `${target.name} should skew orange (${JSON.stringify(stats)})`,
    ).toBeGreaterThan(stats.bluePixels * (target.dominanceRatio ?? 1));
  }

  await testInfo.attach("bifurcation-report.json", {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: "application/json",
  });
});
