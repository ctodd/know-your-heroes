import argparse
import json
import signal
import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, StaleElementReferenceException

DEBUG = False

def debug_print(*args, **kwargs):
    if DEBUG:
        print("DEBUG:", *args, **kwargs)

def signal_handler(sig, frame):
    print("CTRL-C detected. Saving results and exiting...")
    save_results()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

def save_results():
    global heroes
    with open('aws_heroes.json', 'w', encoding='utf-8') as f:
        json.dump(heroes, f, indent=2, ensure_ascii=False)
    print("Results saved to aws_heroes.json")

def capitalize_words(s):
    return ' '.join(word.capitalize() for word in s.split())

def get_full_description(driver, learn_more_url):
    debug_print(f"Opening new tab for URL: {learn_more_url}")
    driver.execute_script("window.open('');")
    driver.switch_to.window(driver.window_handles[-1])
    driver.get(learn_more_url)

    try:
        hero_info = {}

        debug_print("Extracting full description")
        full_description_elem = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "div.lb-txt-18.lb-rtxt"))
        )
        hero_info['full_description'] = full_description_elem.text.strip()
        debug_print(f"Full description: {hero_info['full_description'][:50]}...")

        debug_print("Extracting employment, hero_since, and location")
        info_elements = driver.find_elements(By.CSS_SELECTOR, "h2.lb-txt-18.lb-none-v-margin.lb-h2.lb-title")
        for elem in info_elements:
            text = elem.text.strip()
            if "Hero since" in text:
                hero_info['hero_since'] = text
            elif any(icon in elem.get_attribute('innerHTML') for icon in ['icon-globe', 'icon-map-marker']):
                hero_info['location'] = text
            elif any(icon in elem.get_attribute('innerHTML') for icon in ['icon-user', 'icon-briefcase']):
                hero_info['employment'] = text

        for key in ['employment', 'hero_since', 'location']:
            if key not in hero_info:
                hero_info[key] = "Not found"
            debug_print(f"{key}: {hero_info[key]}")

        debug_print("Extracting social media links")
        social_links = {}
        social_elements = driver.find_elements(By.CSS_SELECTOR, "figure.lb-tiny-iblock.lb-img")
        for element in social_elements:
            link_elem = element.find_element(By.TAG_NAME, "a")
            href = link_elem.get_attribute('href')
            img_elem = element.find_element(By.TAG_NAME, "img")
            title = img_elem.get_attribute('title')
            alt = img_elem.get_attribute('alt')
            icon_url = img_elem.get_attribute('src')
            
            if href and (title or alt):
                platform = capitalize_words(title or alt)
                social_links[platform] = {
                    'url': href,
                    'icon_url': icon_url
                }
        hero_info['social_links'] = social_links
        debug_print(f"Social links: {social_links}")

        debug_print("Extracting project links")
        project_links = []
        links = driver.find_elements(By.XPATH, "//div[@class='lb-txt-18 lb-rtxt']//a")
        for link in links:
            project_links.append({
                'text': link.text.strip(),
                'url': link.get_attribute('href')
            })
        hero_info['project_links'] = project_links
        debug_print(f"Project links: {project_links}")

    except Exception as e:
        print(f"Error extracting information: {str(e)}")
        hero_info = {
            "full_description": "Failed to load information",
            "employment": "Not found",
            "hero_since": "Not found",
            "location": "Not found",
            "social_links": {},
            "project_links": []
        }

    debug_print("Closing tab and switching back")
    driver.close()
    driver.switch_to.window(driver.window_handles[0])
    return hero_info

def scrape_aws_heroes(max_pages=None):
    global heroes
    chrome_options = Options()
    if not DEBUG:
        chrome_options.add_argument("--headless")
    driver = webdriver.Chrome(service=Service(), options=chrome_options)
    url = "https://aws.amazon.com/developer/community/heroes/?community-heroes-all.sort-by=item.additionalFields.sortPosition&community-heroes-all.sort-order=asc&awsf.filter-hero-category=*all&awsf.filter-location=*all&awsf.filter-year=*all&awsf.filter-activity=*all"
    debug_print(f"Opening initial URL: {url}")
    driver.get(url)

    page_num = 1
    termination_reason = "Unknown"

    try:
        while max_pages is None or page_num <= max_pages:
            if DEBUG:
                debug_print(f"Scraping page {page_num}")
            else:
                print(f"Scraping page {page_num}")

            debug_print("Waiting for cards to load")
            WebDriverWait(driver, 20).until(
                EC.presence_of_all_elements_located((By.CLASS_NAME, "m-card-container"))
            )

            debug_print("Finding all hero cards")
            cards = driver.find_elements(By.CLASS_NAME, "m-card-container")
            debug_print(f"Found {len(cards)} cards")
            
            for index, card in enumerate(cards):
                try:
                    debug_print(f"Processing card {index + 1}")
                    hero = {}
                    hero['name'] = card.find_element(By.CLASS_NAME, "m-headline").text.strip()
                    hero['category'] = card.find_element(By.CLASS_NAME, "m-category").text.strip()
                    hero['image_url'] = card.find_element(By.TAG_NAME, "img").get_attribute("src")
                    
                    debug_print(f"Hero: {hero['name']}, Category: {hero['category']}")
                    
                    learn_more = card.find_element(By.XPATH, ".//a[contains(text(), 'Learn more')]")
                    learn_more_url = learn_more.get_attribute('href')
                    
                    debug_print(f"Getting full description for {hero['name']}")
                    hero_info = get_full_description(driver, learn_more_url)
                    hero.update(hero_info)

                    heroes.append(hero)
                    save_results()
                    debug_print(f"Processed and saved hero: {hero['name']}")
                except Exception as e:
                    print(f"Error processing a card: {str(e)}")
                    continue

            if max_pages is not None and page_num >= max_pages:
                termination_reason = f"Reached maximum number of pages ({max_pages})"
                break

            debug_print("Checking for next page")
            try:
                next_button = driver.find_element(By.CSS_SELECTOR, "a.m-icon-angle-right[aria-label='Next Page']:not(.lb-disabled)")
                debug_print("Next button found and not disabled")
                
                debug_print("Clicking next button")
                driver.execute_script("arguments[0].click();", next_button)
                
                debug_print("Waiting for page to load")
                WebDriverWait(driver, 20).until(
                    EC.staleness_of(cards[0])
                )
                
                page_num += 1
                debug_print(f"Moved to page {page_num}")
                time.sleep(5)
            except NoSuchElementException:
                termination_reason = "Next button not found or disabled"
                debug_print(termination_reason)
                break
            except Exception as e:
                termination_reason = f"Error navigating to next page: {str(e)}"
                print(termination_reason)
                break

    finally:
        driver.quit()
        print(f"Termination reason: {termination_reason}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape AWS Heroes")
    parser.add_argument("--max-pages", type=int, help="Maximum number of pages to scrape")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    args = parser.parse_args()

    DEBUG = args.debug
    if DEBUG:
        print("Debug mode enabled")

    heroes = []
    
    debug_print("Creating initial JSON file")
    with open('aws_heroes.json', 'w', encoding='utf-8') as f:
        json.dump([], f)

    scrape_aws_heroes(args.max_pages)
    save_results()
    print("Scraping completed")