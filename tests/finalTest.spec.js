const { test, expect } = require('@playwright/test');

test('Stack Overflow Javascript Questions', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    

    // Navigate to the Stack Overflow Questions page
    await page.goto('https://stackoverflow.com/questions');

    page.on('dialog', async dialog => {
        console.log(`Dialog message: ${dialog.message()}`);
        await dialog.dismiss();  // Dismiss the dialog
    });


    // Accept cookies and filter for 'javascript' tagged questions
    

    await page.locator('button[id="onetrust-accept-btn-handler"]').click();
    await page.locator('button[role="button"]').click();
    const radioButton = page.locator('input[type="radio"][value="Newest"]');
    await expect(radioButton).toBeChecked();
    await page.getByRole('combobox', { name: 'The following tags:' }).click();
    await page.getByRole('combobox', { name: 'The following tags:' }).fill('javascript');
    await page.getByLabel('Autocomplete suggestions').getByText('javascript').first().click();
    await page.getByRole('button', { name: 'Apply filter' }).click();

    // Function to extract question data from the current page
    async function extractQuestionData(page) {
        const questionLocators = page.locator('.s-post-summary'); // Locator for each question summary
        const count = await questionLocators.count(); // Get the count of questions on the page

        const questions = []; // Array to store extracted questions

        // Iterate through each question summary and extract details
        for (let i = 0; i < count; i++) {
            const titleLocator = questionLocators.nth(i).locator('.s-link');
            const tagsLocator = questionLocators.nth(i).locator('.post-tag');
            const votesLocator = questionLocators.nth(i).locator('.s-post-summary--stats-item__emphasized');
            const timestampLocator = questionLocators.nth(i).locator('.relativetime');

            // Extract question details: title, votes, tags, and timestamp
            const title = await titleLocator.innerText().catch(() => 'No Title');
            const votes = await votesLocator.innerText().then(v => parseInt(v.trim(), 10)).catch(() => 0);
            const tags = await tagsLocator.allInnerTexts();
            const timestamp = await timestampLocator.getAttribute('title').catch(() => 'No timestamp');

            // Add the extracted data to the questions array
            questions.push({
                title: title.trim(),
                tags: tags.map(tag => tag.trim()),
                votes,
                timestamp: timestamp || 'No timestamp',
            });
        }

        return questions;
    }

    // Collect up to 100 questions, paginating if necessary
    let questions = [];
    let pageCounter = 1;

    while (questions.length < 100) {
        await page.waitForSelector('div.s-post-summary'); // Ensure questions are loaded
        const newQuestions = await extractQuestionData(page);

       // Stop if no questions are extracted
       if (newQuestions.length === 0) {
        console.log('No questions extracted. Stopping.');
        break;
    }

    // Add only the necessary number of new questions to reach a total of 100
    const availableSpace = 100 - questions.length; // Space available for new questions
    const questionsToAdd = newQuestions.slice(0, availableSpace); // Get only the available space

    // Log the number of questions extracted from the current page
    console.log(`Page ${pageCounter}: Extracted ${questionsToAdd.length} questions.`);
    console.log('Collected Questions:', questionsToAdd);

    questions = questions.concat(questionsToAdd);

    // Check if we have reached the limit of 100 questions
    if (questions.length >= 100) {
        console.log(`Collected ${questions.length} questions. Stopping...`);
        break;
    }

        // Check if there is a "Next" button to paginate
        const nextButton = page.locator('a[rel="next"]');
        if (await nextButton.count() > 0) {
            const isDisabled = await nextButton.evaluate(node =>
                node.hasAttribute('disabled') || 
                node.classList.contains('is-disabled') || 
                node.style.display === 'none'
            );

            // If "Next" is available, go to the next page
            if (!isDisabled) {
                await nextButton.click();
                await page.waitForLoadState('domcontentloaded'); // Wait for the new page to load
                pageCounter++;
            } else {
                console.log('Next button is disabled. Stopping...');
                break;
            }
        } else {
            console.log('No next button found. Stopping...');
            break;
        }
    }

        questions = questions.slice(0, 100);

    // Validate that questions are sorted from newest to oldest based on the timestamp
    function validateSortingByTimestamp(questions) {
        for (let i = 1; i < questions.length; i++) {
            if (new Date(questions[i].timestamp) > new Date(questions[i - 1].timestamp)) {
                console.log(`Question order invalid at index ${i}.`);
                return false;
            }
        }
        console.log("Questions are sorted from newest to oldest.");
        return true;
    }

    // Validate that each question includes the "javascript" tag
    function validateTags(questions) {
        for (const question of questions) {
            if (!question.tags.includes('javascript')) {
                console.log(`Question "${question.title}" does not contain the 'javascript' tag.`);
                return false;
            }
        }
        console.log("All questions include the 'javascript' tag.");
        return true;
    }

    // Perform both validations
    const isSorted = validateSortingByTimestamp(questions);
    const hasCorrectTags = validateTags(questions);

    if (isSorted && hasCorrectTags) {
        console.log('All validations passed!');
    } else {
        console.log('Validation failed.');
    }

    // Close the context (end the session)
    await context.close();
});
