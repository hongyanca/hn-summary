/**
 * Fetches the top posts from Hacker News API, sorts them by points,
 * and formats them into an array of simplified objects.
 * 
 * @param {number} [count=60] - Number of posts to fetch
 * @returns {Promise<Array>} - Array of post objects
 */
export async function fetchTopHackerNewsPosts(count = 60) {
  try {
    // Step 1: Fetch the top story IDs
    const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch top stories: ${response.status} ${response.statusText}`);
    }

    // Get IDs array and limit to the requested count
    const storyIds = await response.json();
    const limitedIds = storyIds.slice(0, count);

    // Step 2: Fetch details for each story (in parallel)
    const storyPromises = limitedIds.map(id =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to fetch item ${id}: ${res.status} ${res.statusText}`);
          }
          return res.json();
        })
    );

    // Wait for all story details to be fetched
    const stories = await Promise.all(storyPromises);

    // Step 3: Format and sort the stories
    const formattedStories = stories
      .filter(story => {
        // Filter out any null values or non-stories
        return story && story.url && story.score;
      })
      .map(story => {
        // Format each story to the desired output structure
        return {
          articleTitle: story.title, // Added article title
          articleLink: story.url,
          commentsLink: `https://news.ycombinator.com/item?id=${story.id}`,
          points: story.score,
          createdAt: new Date(story.time * 1000).toISOString()
        };
      })
      .sort((a, b) => {
        // Sort by points in descending order
        return b.points - a.points;
      });

    return formattedStories;

  } catch (error) {
    console.error('Error fetching Hacker News posts:', error);
    throw error;
  }
}

/**
 * Fetch top HN posts with rate limiting and error handling
 * Adds additional metadata and retries failed requests
 * 
 * @param {Object} options - Configuration options
 * @param {number} [options.count=60] - Number of posts to fetch
 * @param {number} [options.maxRetries=3] - Maximum number of retries for failed requests
 * @param {number} [options.delayBetweenRequests=100] - Delay between API requests in ms
 * @returns {Promise<Array>} - Array of post objects
 */
export async function fetchHackerNewsPostsAdvanced({
  count = 60,
  maxRetries = 3,
  delayBetweenRequests = 100
} = {}) {
  try {
    // Step 1: Fetch the top story IDs
    let storyIds;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch top stories: ${response.status} ${response.statusText}`);
        }
        storyIds = await response.json();
        break; // Success, exit the retry loop
      } catch (error) {
        retries++;
        if (retries >= maxRetries) throw error;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests * retries));
      }
    }

    // Limit to the requested count
    const limitedIds = storyIds.slice(0, count);

    // Step 2: Fetch details for each story (with rate limiting)
    const stories = [];

    for (const id of limitedIds) {
      let storyRetries = 0;
      let story = null;

      while (storyRetries < maxRetries && !story) {
        try {
          // Add a small delay to avoid API rate limits
          if (stories.length > 0) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
          }

          const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (!response.ok) {
            throw new Error(`Failed to fetch item ${id}: ${response.status} ${response.statusText}`);
          }
          story = await response.json();
        } catch (error) {
          storyRetries++;
          if (storyRetries >= maxRetries) {
            console.warn(`Failed to fetch story ${id} after ${maxRetries} attempts, skipping.`);
          } else {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delayBetweenRequests * storyRetries));
          }
        }
      }

      if (story) {
        stories.push(story);
      }
    }

    // Step 3: Format and sort the stories
    const formattedStories = stories
      .filter(story => {
        // Filter out any null values or non-stories (e.g., jobs or polls without URLs)
        return story && story.url && story.score !== undefined;
      })
      .map(story => {
        // Format each story to the desired output structure
        return {
          articleTitle: story.title, // Added article title
          articleLink: story.url,
          commentsLink: `https://news.ycombinator.com/item?id=${story.id}`,
          points: story.score,
          createdAt: new Date(story.time * 1000).toISOString(),
          commentsCount: story.descendants || 0,
          author: story.by
        };
      })
      .sort((a, b) => {
        // Sort by points in descending order
        return b.points - a.points;
      });

    return formattedStories;

  } catch (error) {
    console.error('Error fetching Hacker News posts:', error);
    throw error;
  }
}

