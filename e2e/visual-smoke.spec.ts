import { test, expect, Page } from '@playwright/test';

const TRANSPARENT_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFklEQVQImWP4z8DwH5kAATQGEC8tDwAS8wn/jHKAOAAAAABJRU5ErkJggg==';

const setupMocks = async (page: Page) => {
  await page.route('**/api/validate-key', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ valid: true }) })
  );
  await page.route('**/api/codex-status', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ available: false, hint: 'mocked' }),
    })
  );
  await page.route('**/api/generate', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        success: true,
        imageData: `data:image/png;base64,${TRANSPARENT_PNG_B64}`,
      }),
    })
  );
};

test.describe('Visual smoke', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('captures every step screen for manual review', async ({ page }) => {
    const dir = 'screenshots';

    // Step 1
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'AI 모델 설정' })).toBeVisible();
    await page.screenshot({ path: `${dir}/step1-api-config.png`, fullPage: true });

    // Fill key and advance to Step 2
    await page.getByPlaceholder('AIza...').fill('AIza-smoke');
    await page.getByRole('button', { name: /다음: 캐릭터 정의/ }).click();

    await expect(page.getByRole('heading', { name: /캐릭터 정의/ })).toBeVisible();
    await page.screenshot({ path: `${dir}/step2-character-empty.png`, fullPage: true });

    await page
      .getByPlaceholder(/빨간 나비넥타이/)
      .fill('빨간 나비넥타이를 한 노란 오리');
    await page.screenshot({ path: `${dir}/step2-character-filled.png`, fullPage: true });
    await page.getByRole('button', { name: /다음: 시나리오 선택/ }).click();

    // Step 3: scenario grid
    await expect(page.getByRole('heading', { name: /시나리오 팩 선택/ })).toBeVisible();
    await page.screenshot({ path: `${dir}/step3-scenario-grid.png`, fullPage: true });

    // Pick a preset
    await page.getByText('직장인 일상').first().click();
    await expect(page.getByRole('heading', { name: '직장인 일상' })).toBeVisible();
    await page.screenshot({ path: `${dir}/step3-scenario-preset.png`, fullPage: true });

    // Step 4: generate UI (pre-start)
    await page
      .getByRole('button', { name: /24개 이모티콘 세트 생성/ })
      .click();
    await expect(page.getByText(/0 \/ 24 완료/)).toBeVisible();
    await page.screenshot({ path: `${dir}/step4-generate-prestart.png`, fullPage: true });

    // Composition plan accordion expanded
    await page.getByText(/화각 분산 계획/).click();
    await page.screenshot({ path: `${dir}/step4-composition-plan.png`, fullPage: true });

    // Settings accordion expanded
    await page.getByRole('button', { name: /생성 설정 확인 및 수정/ }).click();
    await page.screenshot({ path: `${dir}/step4-settings-accordion.png`, fullPage: true });

    // Custom small set to verify total/progress are not hardcoded
    await page.goto('/');
    await page.getByPlaceholder('AIza...').fill('AIza-smoke');
    await page.getByRole('button', { name: /다음: 캐릭터 정의/ }).click();
    await page.getByPlaceholder(/빨간 나비넥타이/).fill('duck');
    await page.getByRole('button', { name: /다음: 시나리오 선택/ }).click();
    await page.getByRole('heading', { name: '커스텀 세트' }).click();
    const countInput = page.locator('input[type="number"][max="24"]');
    await countInput.fill('4');
    await countInput.blur();
    await page
      .getByRole('button', { name: /4개 이모티콘 세트 생성/ })
      .click();
    await expect(page.getByText(/0 \/ 4 완료/)).toBeVisible();
    await page.screenshot({ path: `${dir}/step4-generate-count4.png`, fullPage: true });
  });
});
