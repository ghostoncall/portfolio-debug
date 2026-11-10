import { test, expect } from '@playwright/test';

const pages = [
  { url: '/', name: 'Home' },
  { url: '/projects', name: 'Projects index' },
  { url: '/projects/rag-research-assistant', name: 'Project: Rag Research Assistant' },
  { url: '/projects/vision-defect-detection', name: 'Project: Vision Defect Detection' },
  { url: '/projects/agentic-workflow', name: 'Project: Agentic Workflow' },
  { url: '/skills', name: 'Skills' },
  { url: '/experience', name: 'Experience' },
  { url: '/onlyme/login', name: 'Admin Login' },
];

for (const { url, name } of pages) {
  test(`Public page: ${name}`, async ({ page }) => {
    await page.goto(`http://localhost:8080${url}`);
    await page.waitForLoadState('domcontentloaded');
    
    // Verify page title is not "This page didn't load" - check body text
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('This page didn\u2019t load');
    
    // Take a screenshot
    await page.screenshot({ path: `/tmp/public-${name.toLowerCase().replace(/\s+/g, '-')}.png`, fullPage: true });
    
    console.log(`✓ ${name} loaded successfully`);
  });
}
