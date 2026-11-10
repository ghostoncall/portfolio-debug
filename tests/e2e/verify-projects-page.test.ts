import { test, expect } from '@playwright/test';

test('Projects page renders correctly', async ({ page }) => {
  // Navigate to the projects page
  await page.goto('http://localhost:8080/projects/rag-research-assistant');
  
  // Wait for the page to load
  await page.waitForLoadState('domcontentloaded');
  
  // Check that the page title is correct
  await expect(page).toHaveTitle(/Research Assistant/);
  
  // Verify the page has project content (use specific selector for article h1)
  const h1 = page.locator('article h1');
  await expect(h1.first()).toContainText('Research Assistant');
  
  // Take a screenshot so we can see it worked
  await page.screenshot({ path: '/tmp/projects-page-working.png', fullPage: true });
  
  console.log('Project page loaded successfully!');
});
