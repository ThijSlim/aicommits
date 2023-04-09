import { testSuite } from 'manten';

export default testSuite(({ describe }) => {
	describe('OpenAI', ({ runTestSuite }) => {
		runTestSuite(import('./openai-merge.spec.js'));
	});
});
