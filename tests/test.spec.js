const { chromium } = require("playwright");
const { test, expect } = require('@playwright/test');

test('Stack Overflow', async () => {
  test.setTimeout(120000);
  // Launch a new browser instance
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  

  // Navigate to Stack Overflow's questions page 
  console.log("Navigating to Stack Overflow...");
  await page.goto("https://stackoverflow.com/questions");

  await page.waitForLoadState('networkidle');

  const iframe = page.frameLocator('iframe[src*="https://accounts.google.com/gsi/iframe/select"]');
  const containerBox = iframe.locator('div[id="credentials-picker-container"]');
  const isVisible = await containerBox.isVisible();
  
  if(isVisible){
    console.log('Container box is present, closing it..');
    const closeButton= iframe.locator('div[id="close"]');
    await closeButton.click();
    await page.waitForTimeout(3000);
  } else{
    console.log('Container box is not present, moving on to next steps..');
    await page.waitForTimeout(3000);
  }

    await page.locator('button[id="onetrust-accept-btn-handler"]').click();
    await page.locator('button[role="button"]').click();
    const radioButton = page.locator('input[type="radio"][value="Newest"]');
    await expect(radioButton).toBeChecked();
    await page.getByRole('combobox', { name: 'The following tags:' }).click();
    await page.getByRole('combobox', { name: 'The following tags:' }).fill('javascript');
    await page.getByLabel('Autocomplete suggestions').getByText('javascript').first().click();
    await page.getByRole('button', { name: 'Apply filter' }).click();


    // extract the questions and the data from each page
  async function extractQuestion(page) {
    const questionElements = page.locator('.s-post-summary');
    const count = await questionElements.count();
    
    const questionsfromCurrentPage = [];
    
    for(let i=0;i<count;i++){
      const title = await questionElements.nth(i).locator('.s-link').innerText().then(text => text.trim()).catch(() => 'No title');
      const tags = await questionElements.nth(i).locator('.post-tag').allInnerTexts().catch(() => []);
      const tagsArray = Array.isArray(tags) ? tags.map(tag => tag.trim()) : [];
      const votes = await questionElements.nth(i).locator('.s-post-summary--stats-item__emphasized')
                              .innerText().then(v => parseInt(v.trim(),10)).catch(() => 0);
      const timeStamp = await questionElements.nth(i).locator('.relativetime').getAttribute('title').catch((v => 'No timestamp'));

      questionsfromCurrentPage.push({
        title,
        tags: tagsArray,
        votes,
        timeStamp,
      });
    }
     return questionsfromCurrentPage;
  }
    
  let questions = [];
  let pagesCount = 1;

  while(questions.length < 100){

    await page.waitForSelector('div.s-post-summary', {timeout: 20000});
    const newQuestions = await extractQuestion(page);

    if(newQuestions.length == 0){
      console.log('No questions extracted. Stopping..');
      break;
    }

    const availableSpace = 100 - questions.length;
    const questionsToAdd = newQuestions.slice(0, availableSpace);

    console.log(`Page ${pagesCount}: Extracted ${questionsToAdd.length} questions`);
    console.log('Collected questions:', questionsToAdd);

    questions = questions.concat(questionsToAdd);

    if(questions.length >= 100){
      console.log(`Collected ${questions.length} questions. Stopping..`);
      break;
    }

    //clicking on next button
    const nextButton = page.locator('a[rel="next"]');
        try{
            if(await nextButton.count() > 0){
              const isDisabled = await nextButton.evaluate(node =>
              node.hasAttribute('disabled') || 
              node.classList.contains('is-disabled') ||
              node.style.display === 'none'
             );

      if(!isDisabled){
        await nextButton.click();
        await page.waitForLoadState('domcontentloaded', {timeout: 20000});
        pagesCount++;
        console.log('Clicked on next button successfully');
      } else{
        console.log('Next button is disabled. Stopping..');
        break;
      }
    } else{
      console.log('No next button is found. Stopping..');
      break;
    }
  } catch (error) {
    console.error('Error clicking next button:', error);
  }
}

  questions = questions.slice(0,100);

  function validateTimeStampSort(questions){
    for(let i=1;i<questions.length;i++){
      if(new Date(questions[i].timeStamp) > new Date(questions[i-1].timeStamp)){
        console.log(`Questions order is not sorted at ${i}`);
        return false;
      }
    }
    console.log("Questions are sorted from newest to oldest");
    return true;
  }

  function validateTags(questions){
    for(const question of questions){
      if(!question.tags.includes('javascript')){
        console.log(`Question "${question.title}" does not contain 'javascript' tag`);
        return false;
      }
    }
    console.log("All questions contain 'javascript' tag");
    return true;
  }

  const isSorted = validateTimeStampSort(questions);
  const hasJavascriptTag = validateTags(questions);

  if(isSorted && hasJavascriptTag){
    console.log('All the validations are passed');
  } else{
    console.log('Validation failed');
  }
  // Close the browser
  await browser.close();
});
