require("dotenv").config();

const fetch = require('node-fetch');

const logger = require('pino')();

// Replace these values with your own GetPocket API credentials
const consumerKey = process.env.POCKET_CONSUMER_KEY;
const accessToken = process.env.POCKET_ACCESS_TOKEN;
const todoistToken = process.env.TODOIST_TOKEN;
const wordsPerMinute = 250;
const dailyReadProjectId = '2328700616'; // Replace with your "Daily Read" project ID
const wordCount = (parseInt(process.argv[2], 10) || 30)* wordsPerMinute;

logger.info(`Running with word count: ${wordCount}`);

// Function to fetch unread articles from GetPocket API
async function fetchUnreadArticles() {
    const url = 'https://getpocket.com/v3/get';
    const data = {
        consumer_key: consumerKey,
        access_token: accessToken,
        state: 'unread',
        detailType: 'complete'
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Accept': 'application/json'
        },
        body: JSON.stringify(data)
    });

    const responseData = await response.json();
    return Object.values(responseData.list);
}

// Function to select articles until reaching 8000 words
async function selectArticles() {
  let totalWords = 0;
   const selectedArticles = [];
   const unreadArticles = await fetchUnreadArticles();

   // Shuffle the array of unread articles randomly
   const shuffledArticles = unreadArticles.sort(() => Math.random() - 0.5);

   for (const article of shuffledArticles) {
       const articleWords = parseInt(article.word_count, 10) || 0;

       // Select the article if adding it keeps the total words below 8000
       if (totalWords + articleWords < wordCount) {
           selectedArticles.push(article);
           totalWords += articleWords;
       } else {
           break; // Stop selecting articles once the word limit is reached
       }
   }

   return selectedArticles;
}

// Function to add a task to Todoist
async function addTaskToTodoist(content, dueDate) {
    const url = 'https://api.todoist.com/rest/v2/tasks';
    const data = {
        content: content,
        project_id: dailyReadProjectId,
        due_date: dueDate,
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${todoistToken}`
        },
        body: JSON.stringify(data)
    });

    const responseData = await response.json();
    return responseData;
}

// Main function to run the program
async function main() {
    try {
        const selectedArticles = await selectArticles();

        const today = new Date().toISOString().slice(0, 10); // Get today's date in yyyy-mm-dd format

        for (const article of selectedArticles) {
            const link = `https://getpocket.com/read/${article.resolved_id}`;
            const duration = article.word_count / wordsPerMinute;
            const content = `[📰 ${article.resolved_title}](${link}) [${Math.ceil(duration)} mins]`;
            await addTaskToTodoist(content, today);
            logger.info(`Added task to Todoist: ${content}`);
        }

        console.log('All tasks added to Todoist successfully!');
    } catch (error) {
        logger.error('Error adding tasks to Todoist:', error);
    }
}

main();
