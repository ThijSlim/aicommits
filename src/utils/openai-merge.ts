import https from 'https';
import type { ClientRequest, IncomingMessage } from 'http';
import type { ChatCompletionRequestMessage, CreateChatCompletionRequest, CreateChatCompletionResponse } from 'openai';
import { type TiktokenModel, encoding_for_model as encodingForModel } from '@dqbd/tiktoken';
import createHttpsProxyAgent from 'https-proxy-agent';
import { KnownError } from './error.js';

const httpsPost = async (
	hostname: string,
	path: string,
	headers: Record<string, string>,
	json: unknown,
	proxy?: string,
) => new Promise<{
	request: ClientRequest;
	response: IncomingMessage;
	data: string;
}>((resolve, reject) => {
	const postContent = JSON.stringify(json);
	const request = https.request(
		{
			port: 443,
			hostname,
			path,
			method: 'POST',
			headers: {
				...headers,
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(postContent),
			},
			timeout: 10_000, // 10s
			agent: (
				proxy
					? createHttpsProxyAgent(proxy)
					: undefined
			),
		},
		(response) => {
			const body: Buffer[] = [];
			response.on('data', chunk => body.push(chunk));
			response.on('end', () => {
				resolve({
					request,
					response,
					data: Buffer.concat(body).toString(),
				});
			});
		},
	);
	request.on('error', reject);
	request.on('timeout', () => {
		request.destroy();
		reject(new KnownError('Request timed out'));
	});

	request.write(postContent);
	request.end();
});

const createChatCompletion = async (
	apiKey: string,
	json: CreateChatCompletionRequest,
	proxy?: string,
) => {
	const { response, data } = await httpsPost(
		'api.openai.com',
		'/v1/chat/completions',
		{
			Authorization: `Bearer ${apiKey}`,
		},
		json,
		proxy,
	);

	if (
		!response.statusCode
		|| response.statusCode < 200
		|| response.statusCode > 299
	) {
		let errorMessage = `OpenAI API Error: ${response.statusCode} - ${response.statusMessage}`;

		if (data) {
			errorMessage += `\n\n${data}`;
		}

		if (response.statusCode === 500) {
			errorMessage += '\n\nCheck the API status: https://status.openai.com';
		}

		throw new KnownError(errorMessage);
	}

	return JSON.parse(data) as CreateChatCompletionResponse;
};

const getBasePrompt = () => `
I want you to act as a git-cli.
I will give you file content and you will merge the conflicts preferring our changes.
Generate only the code snippet without explaination.`;

const sanitizeMessage = (message: string) => message.trim().replace(/[\n\r]/g, '').replace(/(\w)\.$/, '$1');

export const autoMergeFile = async (
	apiKey: string,
	model: TiktokenModel,
	fileContent: string,
	proxy?: string,
) : Promise<string> => {
	const basePrompt = getBasePrompt();

	const messages: ChatCompletionRequestMessage[] = [
		{
			role: 'system',
			content: `${basePrompt}\n`,
		},
		{
			role: 'user',
			content: fileContent,
		},
		{
			role: 'system',
			content: 'Fix the the code without adding new code. Generate only the code snippet without explaination.',
		},
	];

	const prompt = messages.map(message => message.content).join('\n');

	/**
	 * text-davinci-003 has a token limit of 4000
	 * https://platform.openai.com/docs/models/overview#:~:text=to%20Sep%202021-,text%2Ddavinci%2D003,-Can%20do%20any
	 */
	if (encodingForModel(model).encode(prompt).length > 4000) {
		throw new KnownError('The diff is too large for the OpenAI API. Try reducing the number of staged changes, or write your own commit message.');
	}

	try {
		const completion = await createChatCompletion(
			apiKey,
			{
				model,
				messages,
				temperature: 0.7,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0,
				stream: false,
			},
			proxy,
		);

		console.log(completion.choices[0].message?.content);

		return sanitizeMessage(completion.choices[0].message?.content ?? '');
	} catch (error) {
		const errorAsAny = error as any;
		if (errorAsAny.code === 'ENOTFOUND') {
			throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall}). Are you connected to the internet?`);
		}

		throw errorAsAny;
	}
};
