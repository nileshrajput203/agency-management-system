import sys, os
from playwright.sync_api import sync_playwright

def main():
    if len(sys.argv) < 3:
        print("Usage: python generate_pdf.py <input_html_path> <output_pdf_path>")
        sys.exit(1)
        
    input_html = sys.argv[1]
    output_pdf = sys.argv[2]
    
    with open(input_html, "r", encoding="utf-8") as f:
        html_content = f.read()
        
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html_content, wait_until="load")
        page.pdf(
            path=output_pdf,
            format="A4",
            print_background=True,
            margin={"top": "3mm", "bottom": "3mm", "left": "3mm", "right": "3mm"}
        )
        browser.close()
        
if __name__ == "__main__":
    main()
