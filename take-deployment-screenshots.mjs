#!/usr/bin/env node
/**
 * Deployment Screenshot Proof
 * Tests production deployment on mobile and desktop
 */

import { chromium } from 'playwright';

const PRODUCTION_URL = 'https://python-kanban.pages.dev';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshots() {
  console.log('📸 Taking deployment screenshots...\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    // Mobile screenshots
    console.log('📱 Mobile viewport (iPhone 14 Pro)...');
    const mobileContext = await browser.newContext({
      viewport: { width: 393, height: 852 },
      hasTouch: true,
      isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
    });
    
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(PRODUCTION_URL);
    await mobilePage.waitForLoadState('networkidle');
    await sleep(3000);
    
    // Mobile - Main view
    await mobilePage.screenshot({ 
      path: 'production-mobile-1-main.png',
      fullPage: false
    });
    console.log('  ✅ Saved: production-mobile-1-main.png');
    
    // Mobile - Scroll to show more cards
    await mobilePage.evaluate(() => window.scrollTo(0, 400));
    await sleep(1000);
    await mobilePage.screenshot({ 
      path: 'production-mobile-2-scrolled.png',
      fullPage: false
    });
    console.log('  ✅ Saved: production-mobile-2-scrolled.png');
    
    // Mobile - Check Eruda (try to click if visible)
    const erudaBtn = await mobilePage.locator('.eruda-entry-btn').count();
    if (erudaBtn > 0) {
      await mobilePage.locator('.eruda-entry-btn').first().click();
      await sleep(1500);
      await mobilePage.screenshot({ 
        path: 'production-mobile-3-eruda.png',
        fullPage: false
      });
      console.log('  ✅ Saved: production-mobile-3-eruda.png (console open)');
    } else {
      console.log('  ⚠️  Eruda button not found (may need ?debug=true)');
      // Try with debug param
      await mobilePage.goto(PRODUCTION_URL + '?debug=true');
      await sleep(3000);
      await mobilePage.screenshot({ 
        path: 'production-mobile-3-eruda.png',
        fullPage: false
      });
      console.log('  ✅ Saved: production-mobile-3-eruda.png (debug mode)');
    }
    
    // Mobile - Footer
    await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1000);
    await mobilePage.screenshot({ 
      path: 'production-mobile-4-footer.png',
      fullPage: false
    });
    console.log('  ✅ Saved: production-mobile-4-footer.png');
    
    await mobileContext.close();
    
    // Desktop screenshots
    console.log('\n💻 Desktop viewport (1920x1080)...');
    const desktopContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(PRODUCTION_URL);
    await desktopPage.waitForLoadState('networkidle');
    await sleep(3000);
    
    await desktopPage.screenshot({ 
      path: 'production-desktop-1-main.png',
      fullPage: false
    });
    console.log('  ✅ Saved: production-desktop-1-main.png');
    
    await desktopContext.close();
    
    console.log('\n✅ All screenshots captured!');
    console.log('\n📁 Files saved:');
    console.log('  - production-mobile-1-main.png');
    console.log('  - production-mobile-2-scrolled.png');
    console.log('  - production-mobile-3-eruda.png');
    console.log('  - production-mobile-4-footer.png');
    console.log('  - production-desktop-1-main.png');
    console.log(`\n🔗 Production URL: ${PRODUCTION_URL}`);
    
  } catch (error) {
    console.error('❌ Screenshot error:', error);
  } finally {
    await browser.close();
  }
}

takeScreenshots().catch(console.error);
