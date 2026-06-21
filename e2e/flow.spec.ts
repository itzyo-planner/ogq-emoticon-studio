import { test, expect, Page } from '@playwright/test';

// 1x1 transparent PNG, base64 — used to fake AI image responses without
// hitting upstream providers in CI.
const TRANSPARENT_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const TINY_SOLID_PNG_B64 =
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
        imageData: `data:image/png;base64,${TINY_SOLID_PNG_B64}`,
      }),
    })
  );
  await page.route('**/api/generate-prompts', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        success: true,
        prompts: Array.from({ length: 24 }, (_, i) => `Mocked prompt ${i + 1}`),
        usedModel: 'mock',
      }),
    })
  );
};

test.describe('Emoticon Studio happy path', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test('loads landing page with step nav', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Emoticon Studio' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI 모델 설정' })).toBeVisible();
    await expect(page.getByRole('button', { name: /1\. API/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /4\. Generate/ })).toBeVisible();
  });

  test('cannot proceed without API key', async ({ page }) => {
    await page.goto('/');
    const next = page.getByRole('button', { name: /다음: 캐릭터 정의/ });
    await expect(next).toBeDisabled();
  });

  test('completes API → character → preset → generate flow', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. API config
    await page.getByPlaceholder('AIza...').fill('AIza-mock-test-key');
    await page.getByRole('button', { name: /다음: 캐릭터 정의/ }).click();

    // 2. Character description
    await expect(page.getByRole('heading', { name: /캐릭터 정의/ })).toBeVisible();
    await page
      .getByPlaceholder(/빨간 나비넥타이/)
      .fill('빨간 나비넥타이를 한 노란 오리');
    await page.getByRole('button', { name: /다음: 시나리오 선택/ }).click();

    // 3. Pick preset
    await expect(page.getByRole('heading', { name: /시나리오 팩 선택/ })).toBeVisible();
    await page.getByText('직장인 일상').first().click();
    await expect(page.getByRole('heading', { name: '직장인 일상' })).toBeVisible();

    // 4. Confirm preset → land on generate step
    await page
      .getByRole('button', { name: /24개 이모티콘 세트 생성/ })
      .click();
    await expect(page.getByText(/0 \/ 24 완료/)).toBeVisible();
  });

  test('custom mode adapts to chosen count', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('AIza...').fill('AIza-mock');
    await page.getByRole('button', { name: /다음: 캐릭터 정의/ }).click();
    await page.getByPlaceholder(/빨간 나비넥타이/).fill('테스트 캐릭터');
    await page.getByRole('button', { name: /다음: 시나리오 선택/ }).click();

    await page.getByRole('heading', { name: '커스텀 세트' }).click();
    await expect(
      page.getByRole('heading', { name: /커스텀 시나리오 목록/ })
    ).toBeVisible();

    // Change emoticon count to 6 via the number input
    const countInput = page.locator('input[type="number"][max="24"]');
    await countInput.fill('6');
    await countInput.blur();

    await page
      .getByRole('button', { name: /6개 이모티콘 세트 생성/ })
      .click();

    // Generate step should reflect total of 6, not hardcoded 24
    await expect(page.getByText(/0 \/ 6 완료/)).toBeVisible();
  });

  test('shows duplicate-prompt warning when prompts collide', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByPlaceholder('AIza...').fill('AIza-mock');
    await page.getByRole('button', { name: /다음: 캐릭터 정의/ }).click();
    await page.getByPlaceholder(/빨간 나비넥타이/).fill('duck');
    await page.getByRole('button', { name: /다음: 시나리오 선택/ }).click();

    await page.getByRole('heading', { name: '커스텀 세트' }).click();
    const countInput = page.locator('input[type="number"][max="24"]');
    await countInput.fill('3');
    await countInput.blur();

    const slots = page.getByPlaceholder(/번 이모티콘 설명/);
    await slots.nth(0).fill('drinking coffee tired morning');
    await slots.nth(1).fill('tired drinking coffee morning');
    await slots.nth(2).fill('sleeping curled blanket');

    await page.getByRole('button', { name: /3개 이모티콘 세트 생성/ }).click();

    await expect(page.getByText(/유사 프롬프트 감지/)).toBeVisible();
  });

  test('shows a composition plan with multiple camera angles', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByPlaceholder('AIza...').fill('AIza-mock');
    await page.getByRole('button', { name: /다음: 캐릭터 정의/ }).click();
    await page.getByPlaceholder(/빨간 나비넥타이/).fill('office worker tired');
    await page.getByRole('button', { name: /다음: 시나리오 선택/ }).click();
    await page.getByText('직장인 일상').first().click();
    await page
      .getByRole('button', { name: /24개 이모티콘 세트 생성/ })
      .click();

    await expect(page.getByText(/0 \/ 24 완료/)).toBeVisible();
    const planSummary = page.getByText(/화각 분산 계획/);
    await expect(planSummary).toBeVisible();
    // Expect multiple distinct compositions
    await expect(planSummary).toContainText(/\d+종/);
  });

  test('runs generation and exposes OGQ package button when complete', async ({
    page,
  }) => {
    const captured: string[] = [];
    await page.route('**/api/generate', async (route) => {
      const body = route.request().postDataJSON();
      if (body && typeof body.composition === 'string') {
        captured.push(body.composition);
      }
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          imageData: `data:image/png;base64,${TINY_SOLID_PNG_B64}`,
        }),
      });
    });

    await page.goto('/');
    await page.getByPlaceholder('AIza...').fill('AIza-mock');
    await page.getByRole('button', { name: /다음: 캐릭터 정의/ }).click();
    await page.getByPlaceholder(/빨간 나비넥타이/).fill('duck');
    await page.getByRole('button', { name: /다음: 시나리오 선택/ }).click();

    await page.getByRole('heading', { name: '커스텀 세트' }).click();
    const countInput = page.locator('input[type="number"][max="24"]');
    await countInput.fill('2');
    await countInput.blur();

    await page.getByRole('button', { name: /2개 이모티콘 세트 생성/ }).click();

    await page.getByRole('button', { name: /생성 시작/ }).click();

    // Wait for both mocked generations to complete.
    await expect(page.getByText(/2 \/ 2 완료/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /OGQ 패키지/ })).toBeVisible();

    // Each request should have carried a composition string.
    expect(captured.length).toBe(2);
    captured.forEach((c) => expect(c.length).toBeGreaterThan(10));
    // And the two slots should not collapse to the same composition.
    expect(new Set(captured).size).toBe(2);
  });
});
