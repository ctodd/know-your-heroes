import json
import codecs
import random
import os
import time
from anthropic import Anthropic, APIError
import logging
from logging.handlers import RotatingFileHandler

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Set up logging
log_directory = "logs"
if not os.path.exists(log_directory):
    os.makedirs(log_directory)

log_file = os.path.join(log_directory, "hero_trivia_generator.log")

# Create a logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Create handlers
console_handler = logging.StreamHandler()
file_handler = RotatingFileHandler(log_file, maxBytes=10485760, backupCount=5)  # 10MB per file, max 5 files

# Create formatters and add it to handlers
log_format = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
console_handler.setFormatter(log_format)
file_handler.setFormatter(log_format)

# Add handlers to the logger
logger.addHandler(console_handler)
logger.addHandler(file_handler)

# Initialize the Anthropic client
anthropic = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

STATE_FILE = "processing_state.json"
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds

def generate_trivia_questions(hero):
    prompt = f"""
    Generate exactly 15 trivia questions about {hero['name']} based ONLY on the following information. Do not include any information not explicitly stated here:

    Location: {hero['location']}
    Employment: {hero['employment']}
    Hero since: {hero['hero_since']}
    Projects: {', '.join([link['text'] for link in hero['project_links']])}
    Description: {hero['full_description']}

    For each question:
    1. Provide four options with one correct answer.
    2. Ensure all information comes directly from the provided data.
    3. Avoid any potentially sensitive references.
    4. Do not use Amazon, Google, AWS, or Microsoft as options for employment.
    5. Focus on creating interesting questions primarily from the description field.
    6. Answers should be limited to 5 words.
    7. Answers MUST match one of the 4 options provided.

    Format your response as a valid JSON array of objects. Each object must contain 'question', 'options' (array), and 'correct_answer' keys. Ensure the JSON is properly formatted and complete.
    """

    for attempt in range(MAX_RETRIES):
        try:
            response = anthropic.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=4000,
                temperature=0.2,  # Lowered temperature
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            # Extract the JSON content from the response
            json_content = response.content[0].text
            questions = json.loads(json_content)

            # Validate question count
            if len(questions) != 15:
                raise ValueError(f"Expected 15 questions, but got {len(questions)}")

            return questions

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            logger.error(f"Raw content: {json_content}")
            if attempt < MAX_RETRIES - 1:
                logger.info(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
            else:
                raise Exception("Failed to parse JSON after multiple attempts. The AI might be generating invalid JSON.") from e
        except ValueError as e:
            logger.error(f"Validation error: {e}")
            if attempt < MAX_RETRIES - 1:
                logger.info(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
            else:
                raise Exception("Failed to generate the correct number of questions after multiple attempts.") from e
        except APIError as e:
            logger.error(f"API error: {e}")
            if attempt < MAX_RETRIES - 1:
                logger.info(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
            else:
                raise Exception("API error persisted after multiple attempts. Check your API key and network connection.") from e


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    return {"last_processed_index": -1}

def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f)

def process_heroes_file(input_file, output_file):
    # Read input file with UTF-8 encoding
    with codecs.open(input_file, 'r', encoding='utf-8') as f:
        heroes = json.load(f)

    state = load_state()
    start_index = state["last_processed_index"] + 1

    for index, hero in enumerate(heroes[start_index:], start=start_index):
        logger.info(f"Processing hero: {hero['name']}")
        try:
            questions = generate_trivia_questions(hero)
            
            # Load existing trivia questions
            if os.path.exists(output_file):
                with codecs.open(output_file, 'r', encoding='utf-8') as f:
                    all_trivia_questions = json.load(f)
            else:
                all_trivia_questions = {"trivia_questions": []}

            # Add or update questions for this hero
            hero_entry = next((item for item in all_trivia_questions["trivia_questions"] if item["hero_name"] == hero["name"]), None)
            if hero_entry:
                hero_entry["questions"] = questions
            else:
                all_trivia_questions["trivia_questions"].append({
                    "hero_name": hero["name"],
                    "questions": questions
                })

            # Write updated questions to file with UTF-8 encoding
            with codecs.open(output_file, 'w', encoding='utf-8') as f:
                json.dump(all_trivia_questions, f, ensure_ascii=False, indent=2)

            # Update state
            state["last_processed_index"] = index
            save_state(state)

            logger.info(f"Successfully processed and saved questions for {hero['name']}")

        except Exception as e:
            logger.error(f"Error processing hero {hero['name']}: {str(e)}")
            logger.error("Stopping processing. You can resume from the last successful hero.")
            break

# Usage
input_file = "aws_heroes.json"
output_file = "aws_heroes_questions.json"
process_heroes_file(input_file, output_file)
