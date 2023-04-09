import { readFile } from 'fs/promises';
// eslint-disable-next-line unicorn/import-style
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { expect, testSuite } from 'manten';
import {
	autoMergeFile,
} from '../../../src/utils/openai-merge.js';

const { OPENAI_KEY } = process.env;

export default testSuite(({ describe }) => {
	if (!OPENAI_KEY) {
		console.warn('⚠️  process.env.OPENAI_KEY is necessary to run these tests. Skipping...');
		return;
	}

	function removeTabsAndEnters(string_: string): string {
		return string_.trim().replace(/\s+/g, '');
	}

	describe('ConventionalCommits', async ({ test }) => {
		await test('Merge files', async () => {
			const { mergeConflict, merged } = await readMergeConflictFile('csharp-main');

			const commitMessage = await runMergeChanges(mergeConflict);

			expect(removeTabsAndEnters(commitMessage)).toEqual(removeTabsAndEnters(merged));
		});

		async function runMergeChanges(mergeConflictFileContent: string): Promise<string> {
			const resolvedFile = await autoMergeFile(OPENAI_KEY!, 'gpt-3.5-turbo', mergeConflictFileContent);

			return resolvedFile;
		}

		/*
		 *	See ./merge-fixtures/README.md in order to generate diff files
		 */
		async function readMergeConflictFile(filename: string):
		Promise<{mergeConflict:string; merged: string}> {
			const __filename = fileURLToPath(import.meta.url);
			const __dirname = dirname(__filename);

			const mergeConflict = await readFile(
				path.resolve(__dirname, `./merge-fixtures/${filename}/conflict.txt`),
				'utf8',
			);

			const merged = await readFile(
				path.resolve(__dirname, `./merge-fixtures/${filename}/merged.txt`),
				'utf8',
			);

			return { mergeConflict, merged };
		}
	});
});
