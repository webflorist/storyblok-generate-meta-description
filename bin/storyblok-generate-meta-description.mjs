#!/usr/bin/env node

import minimist from 'minimist'
import StoryblokClient from 'storyblok-js-client'
import { performance } from 'perf_hooks'
import dotenvx from '@dotenvx/dotenvx'
import OpenAI from 'openai'
import lodash from 'lodash'
import { richTextResolver } from '@storyblok/richtext'
import { convert as htmlToText } from 'html-to-text'

const { render: renderRichText } = richTextResolver()

const startTime = performance.now()

dotenvx.config({ quiet: true })

const args = minimist(process.argv.slice(2))

if ('help' in args) {
	console.log(`USAGE
  $ npx storyblok-generate-meta-description
  
OPTIONS
  --token <token>                (required) Personal OAuth access token created
                                 in the account settings of a Stoyblok user.
                                 (NOT the Access Token of a Space!)
                                 Alternatively, you can set the STORYBLOK_OAUTH_TOKEN environment variable.
  --space <space_id>             (required) ID of the space to backup
                                 Alternatively, you can set the STORYBLOK_SPACE_ID environment variable.
  --openai-api-key <key>         (required) OpenAI API Key
                                 Alternatively, you can set the OPENAI_API_KEY environment variable.
  --region <region>              Region of the space. Possible values are:
                                 - 'eu' (default): EU
                                 - 'us': US
                                 - 'ap': Australia
                                 - 'ca': Canada
                                 - 'cn': China
                                 Alternatively, you can set the STORYBLOK_REGION environment variable.
  --language <language>          (required) Language code to generate meta description in.
  --target-field <field>         (required) Field to write the slug to (e.g. 'seo.description').
                                 Use dot notation for nested fields.
  --content-types <types>        Comma seperated list of content/component types to process. Defaults to 'page'.
  --skip-stories <stories>       Comma seperated list of the full-slugs of stories to skip.
                                 (e.g. --skip-stories "home,about-us")
  --only-stories <stories>       Comma seperated list of the full-slugs of stories you want to limit processing to.
                                 (e.g. --only-stories "about-us")
  --model <model>                OpenAI model to use. Defaults to 'gpt-4o-mini'.
  --max-tokens <number>          Maximum completion tokens to use per API call. Defaults to '500'.
  --max-characters <number>      Maximum characters for the generated text. Defaults to '155'.
  --overwrite                    Overwrites existing meta descriptions. Defaults to false.
  --publish                      Publish stories after updating. Defaults to false.
                                 WARNING: May publish previously unpublished stories.
  --dry-run                      Only display the changes instead of performing them. Defaults to false.
  --verbose (<level>)            Show detailed output for every processed story.
                                 Optionally, you can specify a level of verbosity:
                                 - '1': Show only the generated meta description.
                                 - '2': Show the parsed content and generated meta description (default).
  --help                         Show this help

MINIMAL EXAMPLE
  $ npx storyblok-generate-meta-description --token 1234567890abcdef --space 12345 --openai-api-key 1234567890abcdef --language en --target-field "seo.description"

MAXIMAL EXAMPLE
  $ npx storyblok-generate-meta-description \\
      --token 1234567890abcdef \\
      --openai-api-key 1234567890abcdef \\
      --region us \\
      --language en \\
      --target-field "seo.description" \\
      --content-types "page,news-article" \\
      --skip-stories "home" \\
      --model gpt-4o \\
      --max-tokens 1000 \\
      --max-characters 100 \\
      --overwrite \\
      --publish \\
      --dry-run \\
      --verbose
`)
	process.exit(0)
}

if (!('token' in args) && !process.env.STORYBLOK_OAUTH_TOKEN) {
	console.log(
		'Error: State your oauth token via the --token argument or the environment variable STORYBLOK_OAUTH_TOKEN. Use --help to find out more.'
	)
	process.exit(1)
}
const oauthToken = args.token || process.env.STORYBLOK_OAUTH_TOKEN

if (!('space' in args) && !process.env.STORYBLOK_SPACE_ID) {
	console.log(
		'Error: State your space id via the --space argument or the environment variable STORYBLOK_SPACE_ID. Use --help to find out more.'
	)
	process.exit(1)
}
const spaceId = args.space || process.env.STORYBLOK_SPACE_ID

let region = 'eu'
if ('region' in args || process.env.STORYBLOK_REGION) {
	region = args.region || process.env.STORYBLOK_REGION

	if (!['eu', 'us', 'ap', 'ca', 'cn'].includes(region)) {
		console.log('Error: Invalid region parameter stated. Use --help to find out more.')
		process.exit(1)
	}
}

const verbose = args.verbose ? (args.verbose === true ? 2 : args.verbose) : 0

if (!('openai-api-key' in args) && !process.env.OPENAI_API_KEY) {
	console.log(
		'Error: State your OpenAI API key via the --openai-api-key argument or the environment variable OPENAI_API_KEY. Use --help to find out more.'
	)
	process.exit(1)
}
const openaiApiKey = args['openai-api-key'] || process.env.OPENAI_API_KEY

if (!('language' in args)) {
	console.log(
		'Error: State the desired language using the --language argument. Use --help to find out more.'
	)
	process.exit(1)
}
const language = args['language']

if (!('target-field' in args)) {
	console.log(
		'Error: State the field to write description to using the --target-field argument. Use --help to find out more.'
	)
	process.exit(1)
}
const targetField = args['target-field']

const contentTypes = args['content-types'] ? args['content-types'].split(',') : ['page']

const model = args['model'] || 'gpt-4o-mini'

const maxCharacters = args['max-characters'] || '155'

const maxTokens = args['max-tokens'] ? Number.parseInt(args['max-tokens']) : 500

const skipStories = args['skip-stories'] ? args['skip-stories'].split(',') : []

const onlyStories = args['only-stories'] ? args['only-stories'].split(',') : []

// Init Management API
const StoryblokMAPI = new StoryblokClient({
	oauthToken: oauthToken,
	region: region,
})

// Init OpenAI API
const openai = new OpenAI({
	apiKey: openaiApiKey,
})

// Generation function
let totalUsedPromptTokens = 0
let totalUsedCompletionTokens = 0
const generateMetaDescription = async (text) => {
	const response = await openai.chat.completions.create({
		model: model,
		messages: [
			{
				role: 'system',
				content: [
					{
						type: 'text',
						text: `You are an text analyst. Your goal is to generate a short summary of this text suitable for the meta description of a website and output the result in the following language: ${language}. Limit the output to ${maxCharacters} characters.`,
					},
				],
			},
			{
				role: 'user',
				content: [
					{
						type: 'text',
						text: 'Follow the instructions and rules provided in the System role.',
					},
					{
						type: 'text',
						text: text,
					},
				],
			},
		],
		max_completion_tokens: maxTokens,
	})

	totalUsedPromptTokens += response.usage.prompt_tokens
	totalUsedCompletionTokens += response.usage.completion_tokens

	return response.choices[0].message.content
}

// Write console.log, if verbose mode is enabled
function verboseLog(text, level = 1) {
	if (verbose >= level) {
		console.log(text)
	}
}

// General information
console.log('')
console.log(`Performing generation of meta descriptions for space ${spaceId}:`)
console.log(
	`- mode: ${args['dry-run'] ? 'dry-run' : 'live'} ${!args['dry-run'] ? (args.publish ? '(publish)' : '(no-publish)') : ''}`
)
console.log(`- language: ${language}`)
console.log(`- max characters: ${maxCharacters}`)
console.log(`- max tokens: ${maxTokens}`)
console.log(`- content types: ${contentTypes.join(', ')}`)
if (skipStories.length > 0) {
	console.log(`- skipped stories: ${skipStories.join(', ')}`)
}
if (onlyStories.length > 0) {
	console.log(`- only stories: ${onlyStories.join(', ')}`)
}
console.log(`- overwrite: ${args.overwrite ? 'yes' : 'no'}`)

// Fetch all stories
console.log('')
console.log(`Fetching stories...`)
const stories = []
const storyList = await StoryblokMAPI.getAll(`spaces/${spaceId}/stories`)
for (const story of storyList) {
	if (
		!story.is_folder &&
		contentTypes.includes(story.content_type) &&
		!skipStories.includes(story.full_slug) &&
		(onlyStories.length > 0 ? onlyStories.includes(story.full_slug) : true)
	) {
		const storyData = await StoryblokMAPI.get(`spaces/${spaceId}/stories/${story.id}`)
		stories.push(storyData.data.story)
	}
}

// Fetch all components
console.log('')
console.log(`Fetching components...`)
const components = await StoryblokMAPI.getAll(`spaces/${spaceId}/components`)

const isObject = (item) => typeof item === 'object' && !Array.isArray(item) && item !== null
const isArray = (item) => Array.isArray(item)

const parseContentNode = (node) => {
	if (isObject(node)) {
		let component = null
		if ('component' in node) {
			component = components.find((component) => component.name === node.component)

			if (!component) {
				console.log(`Error: Component "${node.component}" not found.`)
				process.exit(1)
			}
		}

		for (const [key, subNode] of Object.entries(node)) {
			if (component && key in component.schema) {
				const fieldType = component.schema[key].type

				switch (fieldType) {
					case 'text':
					case 'textarea':
						if (subNode.length > 0) {
							storyContent.push(subNode)
						}
						break
					case 'richtext':
						if (isObject(subNode)) {
							const richTextHtml = renderRichText(subNode)
							const plainText = htmlToText(richTextHtml, { wordwrap: false })
							storyContent.push(plainText)
						}
						break
				}
			}
			if (isArray(subNode)) {
				subNode.forEach((item) => parseContentNode(item))
			}
			// If subnode is object, parse it.
			else if (isObject(subNode)) {
				parseContentNode(subNode)
			}
		}
	}
}

// Process stories
console.log('')
console.log(`Processing stories...`)
const storyContent = []
for (const story of stories) {
	storyContent.length = 0
	verboseLog('')
	verboseLog(`Slug "${story.full_slug}"`)
	verboseLog(`Name "${story.name}"`)
	verboseLog(`==============================`)

	const existingValue = lodash.get(story.content, targetField)

	if (typeof existingValue === 'undefined') {
		console.log(
			`Error: Target field "${targetField}" not found on story. Make sure the field exists. If you are using the SEO App you have to save the story at least once for the fields to be created.`
		)
		continue
	}

	if (typeof existingValue !== 'string') {
		console.log(
			`Error: Target field "${targetField}" does not seem to be a text field. Make sure the field exists and is a text field.`
		)
		continue
	}

	if (existingValue.length > 0 && !args.overwrite) {
		verboseLog(
			`Meta Description already present in field "${targetField}". Use parameter --overwrite to force generation.`
		)
		continue
	}

	parseContentNode(story.content)

	const storyContentString = storyContent.join('\n\n')

	verboseLog('', 2)
	verboseLog('Parsed content:', 2)
	verboseLog('---------------', 2)
	verboseLog(storyContentString, 2)

	const generatedDescription = await generateMetaDescription(storyContent.join('\n\n'))

	verboseLog('')
	verboseLog('Generated description:')
	verboseLog('----------------------')
	verboseLog(generatedDescription)

	verboseLog('')
	verboseLog('Process result:')
	verboseLog('---------------')

	if (args['dry-run']) {
		verboseLog('Dry-run mode. No changes performed.')
		continue
	}

	lodash.set(story.content, targetField, generatedDescription)

	await StoryblokMAPI.put(`spaces/${spaceId}/stories/${story.id}`, {
		story: story,
		...(args.publish ? { publish: 1 } : {}),
	})

	verboseLog('Story successfully updated.')
}

const endTime = performance.now()

console.log('')
console.log('Result')
console.log('======')
console.log(`Process successfully finished in ${Math.round((endTime - startTime) / 1000)} seconds.`)
console.log('')
console.log(`Used OpenAI tokens:`)
console.log(`- Prompt/Input: ${totalUsedPromptTokens}`)
console.log(`- Completion/Output: ${totalUsedCompletionTokens}`)
console.log(`- Total: ${totalUsedPromptTokens + totalUsedCompletionTokens}`)
process.exit(0)
