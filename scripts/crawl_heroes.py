import requests
from bs4 import BeautifulSoup
import json

def crawl_paginated_landing_page(base_url):
    current_url = base_url
    all_cards = []

    while current_url:
        print(f"Fetching URL: {current_url}")
        
        # Fetch the page
        response = requests.get(current_url)
        
        # Check if the request was successful
        if response.status_code != 200:
            print(f"Failed to fetch the page. Status code: {response.status_code}")
            break

        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Print the first 500 characters of the HTML to check what we're getting
        print("First 500 characters of HTML:")
        print(soup.prettify()[:500])
        
        # Find all elements with class="m-card-container"
        cards = soup.find_all(class_="m-card-container")
        
        print(f"Number of cards found: {len(cards)}")
        
        if not cards:
            # If no cards found, let's try a more general search
            all_divs = soup.find_all('div')
            print(f"Total number of div elements: {len(all_divs)}")
            for div in all_divs[:10]:  # Print classes of first 10 divs
                print(f"Div classes: {div.get('class', 'No class')}")

        # ... (rest of the card processing code remains the same)

        # Find the element with aria-label="Next Page"
        next_link = soup.find(attrs={"aria-label": "Next Page"})
        if next_link and 'href' in next_link.attrs:
            current_url = base_url + next_link['href']
        else:
            current_url = None

    # Convert the list of card data to JSON and print
    print(json.dumps(all_cards, indent=2))

# Usage
base_url = "https://aws.amazon.com/developer/community/heroes/"
crawl_paginated_landing_page(base_url)