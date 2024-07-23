# Know Your Heroes

![banner](heroes-logo-dark.png)

[![license](https://img.shields.io/github/license/ctodd/know-your-heroes
)](LICENSE)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

Know Your Heroes is a game inspired by the AWS Heroes Community. There are 260+ AWS Heroes worldwide, and although we recognize each other's faces, it's difficult to remember names and other details when we see each other. After a recent in-person event, I decided to create a game which helped each of us learn more about each other and hopefully improve our memories at the same time.

Know Your Heroes was 100% created by Generative AI Code Generation using Anthropic Claude 3.5 Sonnet through prompt engineering, copy and paste, and lots of Whack-a-Mole to get it right.

## Table of Contents

- [Codegen](#codegen)
- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Bugs](#bugs)
- [Contributing](#contributing)
- [License](#license)

## CodeGen

I am a big fan of using Generative AI to write code. While this comes with a lot of pitfalls and concerns, as an individual it allows me to experiment much more rapidly. All the issues we face with AI generated code we also face with human generated code. Software development is a process, and when followed properly, we get good/fast/secure code. 

## Background

This game serves as a thought experiment. Without having any experience developing games, but having deep experience writing software, could I get Generative AI to create a complete game including Infrastructure as Code, and game data files without writing a single line of code. As it turns out, yes I could.

## Install

The game consists of three major components:
* Python Website Scraper
* Python Trivia Question Generation Agent
* AWS Cloudformation Template
* Javascript Game

The game is designed to be deployed on AWS. The game will run locally for basic functionality, but in order for the Login and Leaderboard functionality to work, it must be deployed in AWS.

### Deploy Infrastructure using Cloudformation

1. Navigate to [Cloudformation in the AWS Console](https://console.aws.amazon.com/cloudformation/home) and select your preferred AWS Region.
2. Click "Create Stack" and select "With New Resources"
3. Under "Specify Template", select "Upload a template file"
4. Choose the template file from [cloudformation/template.yaml](cloudformation/template.yaml) and click "Upload", then "Next"
5. Enter a "Stack Name" and "BucketName", then click "Next"
6. On the "Configure stack options" page, you can use the defaults and click "Next"
7. At the bottom of the "Review and Create" page, check the "I acknowledge that AWS CloudFormation might create IAM resources." checkbox, then click Submit.

It takes 5-10 minutes to deploy the infrastructure, with CloudFront taking the longest. Click on the "Resources" tab to track the progress.

From the Resources Tab you can click links to navigate to areas within the AWS Console to collect configuration information, update settings, and troubleshoot issues from the deployed infrastructure.

Once the Cognito resources have been deployed, you can collect the following credentials to configure the game:

* User Pool ID (Cognito User Pool Overview)
* User Pool Client ID (App Integration Tab, App Clients)
* Identity Pool ID (Cognito Identity Pool Overview)

### Configure the Game

In the [src](src) directory, rename the [src/aws-config.js-dist](src/aws-config.js-dist) to src/aws-config.js.

Update the new file with your preferred AWS Region, and the IDs collected above.

### Upload Game Files

Next navigate to the Game's S3 bucket and upload all of the files in the [src](src) directory except the .gitignore file.

### Configure a custom URL (OPTIONAL)

If you wish to use a custom URL with the game instead of the generic CloudFront URL provided, you can edit the Cloudfront settings page. Instructions on how to do this, as well as associated tasks such as creating an SSL certificate (in us-east-1 only!), you can learn more on the AWS Documentation site

https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html

### Test the game

If everything went correctly, you can access the game using the CloudFront Distribution URL.

Open the DevTools Inspector in your browser (F12 in Chrome) and look for errors. Consult the [Troubleshooting](#troubleshooting) section to address any errors.

### The Scraper

This was a super interesting part of the project as the AWS Heroes website uses dynamically loaded content including pagination, and uses CSS to show/hide error messages. This required many attempts to get a crawler which worked with this unique page arrangement and HTML structures between the landing page and individual Heroes pages.

The original static crawler [scripts/crawl_heroes.py](scripts/crawl_heroes.py) is left behind as a historical reference. In order to crawl the Heroes website, you must use the Selenium based crawler [scripts/selenium_crawl_heroes.py](scripts/selenium_crawl_heroes.py) which can render Javascript using a headless Chrome browser.

The scraper is designed to load each page of the Heroes website, read each of the (up to) nine Hero Cards displayed, then individually crawl each Heroes page. All of the notable elements are collected, such as Job, Location, Yeas as Hero, and Description as well as Social links. A JSON file [aws_heroes.json](aws_heroes.json) is created with all of this info:

```
  {
    "name": "Chris Miller",
    "category": "AWS MACHINE LEARNING HERO",
    "image_url": "https://d1.awsstatic.com/Developer%20Marketing/developer-center/chris-miller.7c658e7232ec12eb8cdc046d3ce0b70108de5f42.png",
    "full_description": "Chris Miller is an entrepreneur, inventor..."
    "employment": "Chris Miller, CEO at Cloud Brigade",
    "location": "Santa Cruz, USA",
    "hero_since": "Hero since 2021",
    "social_links": {
    },
    "project_links": [
      {
        "text": "The Poopinator",
        "url": "https://www.cloudbrigade.com/the-poopinator-video/"
      },
    ]
  },
```

The JSON file can be used to generate a list of Trivia Questions about AWS Heroes using an LLM. This was a manual process using the [Claude.ai](https://claude.ai) chatbot which involved uploaded a version of the [aws_heroes.json](aws_heroes.json) file with all the URLs removed using ```grep -vi url```.

### The Trivia Question Generation Agent

In order to generate trivia questions for 262 Heroes, this needed to be done programmatically. Fortunately the latest models know how to build agents, so this went quickly. The prompt and temperature settings needed some tweaking to generate reasonable questions (the jury is still out on that).

The agent requires an Anthropic API key, which as of this writing is free and comes with $5 worth of credits by validating your account with an SMS message. The cost per Hero to generate 15 Trivia questions with Claude 3.5 Sonnet is about $0.02. There's me giving you my $0.02...

The agent takes the aws_heroes.json file as input, this is produced by the Scraper, and outputs a file named aws_heroes_questions.json. Both these files need to be uploaded to the S3 bucket in order for the game to work. The most recently generated files are in the [src](src) directory.

### Running the Scraper

```
%python3 selenium_crawl_heroes.py --help
usage: selenium_crawl_heroes.py [-h] [--max-pages MAX_PAGES] [--debug]

Scrape AWS Heroes

options:
  -h, --help            show this help message and exit
  --max-pages MAX_PAGES
                        Maximum number of pages to scrape
  --debug               Enable debug mode
```

--max-pages limits the number of landing page "pagination" pages which are crawled, and saves time when troubleshooting and getting all the right data. By default the crawler will crawl all pages until it hits the end. The termination process is typically caused by a timeout, this capability was problematic due to the "No Pages Left" error message being hidden and shown using DNS (it always matches a pattern match on page 1).

--debug will run the browser in normal mode and you can watch the pages getting crawled, as well as view very verbose output.

Another note is that the JSON is created on the fly, that way if you have to terminate the process, all of the scraped JSON is in the file.

## Usage

The game is a truely "Serverless" game, comprised primarily of static Javascript, HTML, and CSS files. The AWS Infrastructure consists of CloudFront, S3, Cognito, DynamoDB, and IAM. No logging is enabled by default, and the storage and traffic requirements are so low, the game should fall under the AWS Free Tier with minimal charges for subsequent years.

In theory there isn't anything to maintain here except in the event a security issue arises, and/or updates to the AWS SDK files. Follow the Git Repo to be alerted to updates.

## Troubleshooting

Much work was put into a trouble free experience, and a number of problems were encountered with authentication and permissions during the development of the game. Three possible problems come to mind:

1. Incorrect Cognito IDs in the aws-config.js file

    This is the number one cause of 400 and Credential related errors. This is likely to happen if you deploy the CloudFormation stack multiple times and forget to update the aws-config.js file.

2. Incorrect Cognito Identity Pool permsiions for Guest Users

    Cognito is configured to allow un-authenticated "scan" access to the DynamoDB table for the Leaderboard, this allows the scores to be displayed to anonymous users. If you see errors regarding Cognito Credentials on initial page load, it might mean Guest Access is not be enabled in the Identity Pool.

3. Incorrect OAC bucket policy for S3

    CloudFormation was configured to deploy an Origin Access Control (OAC) bucket policy which allows the game to be served from S3 as an origin without requiring public bucket access. This is a best practice and if configured correctly, you will not get the dreaded "Access Denied" error.

4. You forgot to upload the game files to S3 :-)

## Bugs

1. Signup Modal doesn't validate email address structure.
2. No error message returned when login/password is incorrect.
3. May need to add exception handling for entering/resending the Confirmation Code 

## Contributing

Feel free to dive in! [Open an issue](https://github.com/ctodd/know-your-heroes/issues/new) or submit PRs.

Small note: If editing the Readme, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

[MIT © Chris Miller.](../LICENSE)

Amazon Web Services icons by [Icons8](https://icons8.com)

https://icons8.com/icon/33039/amazon-web-services