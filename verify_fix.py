import requests
import json

CARDS_URL = "https://sekaimaster.exmeaning.com/master/cards.json"
SUPPLIES_URL = "https://sekaimaster.exmeaning.com/master/cardSupplies.json"

try:
    print("Fetching data...")
    cards = requests.get(CARDS_URL).json()
    supplies = requests.get(SUPPLIES_URL).json()
    
    print(f"Loaded {len(cards)} cards and {len(supplies)} supplies.")
    
    # Create map
    supply_map = {s['id']: s['cardSupplyType'] for s in supplies}
    print("Supply Map created.")
    
    # Simulate mapping
    mapped_count = 0
    fallback_count = 0
    
    sample_cards = []
    
    for card in cards:
        supply_id = card.get('cardSupplyId')
        supply_type = supply_map.get(supply_id, "normal")
        
        if supply_id in supply_map:
            mapped_count += 1
        else:
            fallback_count += 1
            
        if len(sample_cards) < 5 and supply_type != 'normal':
             sample_cards.append({'id': card['id'], 'supply_type': supply_type})

    print(f"Mapped: {mapped_count}, Fallback: {fallback_count}")
    print("Sample mapped cards (non-normal):")
    print(json.dumps(sample_cards, indent=2))
    
    if mapped_count > 0:
        print("Verification SUCCESS: Mapping logic works as expected.")
    else:
        print("Verification FAILED: No cards were mapped using the map.")

except Exception as e:
    print(f"Error: {e}")
