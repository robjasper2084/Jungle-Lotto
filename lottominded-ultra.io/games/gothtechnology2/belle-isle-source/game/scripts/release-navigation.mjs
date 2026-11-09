/** Reveal the actual course using the native disclosure control, never DOM mutation. */
export async function revealPracticeCourse(page,expect,selector){
 const course=page.locator(selector),disclosure=page.locator('#trial-practice');
 await expect(course).toHaveCount(1);
 await expect(disclosure).toBeVisible();
 if(!await disclosure.evaluate(element=>element.open))await page.locator('#trial-practice > summary').tap();
 await expect(disclosure).toHaveJSProperty('open',true);
 await expect(course).toBeVisible();
 await expect(course).toBeEnabled();
}
