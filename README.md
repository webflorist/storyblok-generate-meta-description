# Automated AI-generation of meta descriptions for the Storyblok CMS

[![npm version](https://img.shields.io/npm/v/storyblok-generate-meta-description.svg)](https://www.npmjs.com/package/storyblok-generate-meta-description)
[![license](https://img.shields.io/github/license/webflorist/storyblok-generate-meta-description)](https://github.com/webflorist/storyblok-generate-meta-description/blob/main/LICENSE)

An npx CLI tool to automatically generate meta descriptions of stories of a [Storyblok CMS](https://www.storyblok.com) space using the OpenAI API.

## Requirements

- A **Storyblok** space.
- A **OpenAI** account.

## Installation

```shell

# simply auto-download and run via npx
$ npx storyblok-generate-meta-description

# or install globally
$ npm install -g storyblok-generate-meta-description

# or install for project using npm
$ npm install storyblok-generate-meta-description

# or install for project using yarn
$ yarn add storyblok-generate-meta-description

# or install for project using pnpm
$ pnpm add storyblok-generate-meta-description
```

## Usage

Call `npx storyblok-generate-meta-description` with the following options:

### Options

```text
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
--max-tokens <number>          Maximum tokens to use per API call. Defaults to '500'.
--max-characters <number>      Maximum characters for the generated text. Defaults to '155'.
--overwrite                    Overwrites existing meta descriptions. Defaults to false.
--publish                      Publish stories after updating. Defaults to false.
                               Will not publish stories, that have unpublished changes or are not published.
--dry-run                      Only display the changes instead of performing them. Defaults to false.
--verbose (<level>)            Show detailed output for every processed story.
                               Optionally, you can specify a level of verbosity:
                               - '1': Show only the generated meta description.
                               - '2': Show the parsed content and generated meta description (default).
--help                         Show this help
```

Storyblok OAuth token, space-id and region as well as the OpenAI API Key can be set via environment variables. You can also use a `.env` file in your project root for this (see `.env.example`).

### Minimal example

```shell
npx storyblok-generate-meta-description --token 1234567890abcdef --space 12345 --openai-api-key 1234567890abcdef --language en
```

### Maximal example

```shell
npx storyblok-generate-meta-description \
    --token 1234567890abcdef \
    --openai-api-key 1234567890abcdef \
    --region us \
    --language en \
    --model gpt-4o \
    --max-tokens 1000 \
    --max-characters 100 \
    --overwrite \
    --dry-run \
    --verbose
```

## License

This package is open-sourced software licensed under the [MIT license](https://github.com/webflorist/storyblok-generate-meta-description/blob/main/LICENSE).
