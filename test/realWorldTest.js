import { isPaywalled } from '../index.js';

async function runRealWorldTest() {
  console.log('Running real-world test on actual HN thread...');

  try {
    const url = 'https://news.ycombinator.com/item?id=43186050';
    console.log(`Testing URL: ${url}`);

    const result = await isPaywalled(url);

    console.log('Result:', result);

    if (result.isPaywalled) {
      console.log('✅ Archive link detected:', result.url);
    } else {
      console.log('❌ No archive link found');
    }

  } catch (error) {
    console.error('Error during real-world test:', error);
  }
}

runRealWorldTest();

